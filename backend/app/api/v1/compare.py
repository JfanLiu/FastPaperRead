"""
论文比较API端点 - 数据库持久化实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
from pydantic import BaseModel
import uuid

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, skim_crud
from ...core.llm import ContentEnhancer
from ...db.models import CompareSetModel

router = APIRouter()


class CompareSetCreate(BaseModel):
    """创建对比集合"""
    name: str
    paper_ids: List[str]
    dimensions: Optional[List[str]] = None


class CompareSetResponse(BaseModel):
    """对比集合响应"""
    id: str
    name: str
    paper_ids: List[str]
    papers: List[dict]


class CompareMatrixResponse(BaseModel):
    """对比矩阵响应"""
    dimensions: List[str]
    papers: List[dict]
    matrix: List[dict]
    conflicts: List[dict]
    summary: str


class QuickCompareMatrixRequest(BaseModel):
    """快速对比矩阵请求（不创建集合、不落库）"""
    paper_ids: List[str]
    dimensions: Optional[List[str]] = None
    use_llm: bool = False
    persist: bool = False


DEFAULT_DIMENSIONS = [
    "研究问题",
    "方法",
    "数据集",
    "评估指标",
    "主要结果",
    "局限性"
]


def _get_cached_packs(paper) -> dict:
    extra = getattr(paper, "extra_data", None) or {}
    if not isinstance(extra, dict):
        return {}
    skim_pack = (extra.get("skim_pack_cache") or {}).get("data")
    deep_pack = (extra.get("deep_pack_cache") or {}).get("data")
    return {
        "skim_pack": skim_pack if isinstance(skim_pack, dict) else None,
        "deep_pack": deep_pack if isinstance(deep_pack, dict) else None,
    }


def _build_papers_info(db: Session, paper_ids: List[str]) -> List[dict]:
    papers_info: List[dict] = []
    for paper_id in paper_ids:
        paper = paper_crud.get(db, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail=f"论文不存在: {paper_id}")

        skim = skim_crud.get(db, paper_id)
        cached = _get_cached_packs(paper)

        papers_info.append({
            "id": paper.id,
            "title": paper.title,
            "authors": paper.authors,
            "year": paper.year,
            "venue": paper.venue,
            "abstract": paper.abstract or "",
            "skim": {
                "research_question": skim.research_question if skim else "",
                "contributions": skim.contributions if skim else [],
                "evidence_strength": skim.evidence_strength if skim else "",
            } if skim else None,
            "skim_pack": cached.get("skim_pack"),
            "deep_pack": cached.get("deep_pack"),
        })
    return papers_info


def _build_matrix(papers_info: List[dict], compare_dimensions: List[str]) -> tuple[list, list]:
    matrix: List[dict] = []
    conflicts: List[dict] = []

    for dim in compare_dimensions:
        row = {"dimension": dim, "values": []}

        for paper in papers_info:
            value = _extract_dimension_value(paper, dim)
            row["values"].append({
                "paper_id": paper["id"],
                "paper_title": paper["title"],
                "value": value
            })

        matrix.append(row)

        values = [v["value"] for v in row["values"] if v["value"]]
        if len(set(values)) > 1:
            conflicts.append({
                "dimension": dim,
                "papers": [v["paper_title"] for v in row["values"]],
                "values": values
            })

    return matrix, conflicts


async def _llm_fill_matrix_values(
    enhancer: ContentEnhancer,
    papers_info: List[dict],
    compare_dimensions: List[str],
) -> Dict[str, Dict[str, str]]:
    """
    调用 LLM 生成更丰富的维度值，返回 {dimension: {paper_id: value}}
    """
    # 构造输入：每篇论文一段简要上下文
    paper_blocks = []
    for p in papers_info:
        deep = p.get("deep_pack") or {}
        mf = (deep.get("method_flow") or {})
        ex = (deep.get("experiment_setup") or {})
        pc = (deep.get("paper_card") or {})
        datasets = ex.get("datasets") or []
        metrics = ex.get("metrics") or []
        block = {
            "id": p.get("id"),
            "title": p.get("title"),
            "year": p.get("year"),
            "venue": p.get("venue"),
            "abstract": (p.get("abstract") or "")[:1000],
            "one_line": pc.get("one_line_summary") if isinstance(pc, dict) else "",
            "method": mf.get("overview") or mf.get("method_name") or "",
            "datasets": ", ".join([d.get("name") for d in datasets if isinstance(d, dict) and d.get("name")]),
            "metrics": ", ".join([m.get("name") for m in metrics if isinstance(m, dict) and m.get("name")]),
            "results": "; ".join(pc.get("key_takeaways", [])[:2]) if isinstance(pc, dict) else "",
            "limitations": "; ".join(pc.get("limitations", [])[:3]) if isinstance(pc, dict) else "",
        }
        paper_blocks.append(block)

    user_content = {
        "papers": paper_blocks,
        "dimensions": compare_dimensions,
        "instruction": "为每个维度、每篇论文给出1-2句对比描述，尽量引用方法/数据/指标/结果等具体信息。输出 JSON 对象：{dimension: {paper_id: value}}。"
    }
    try:
        response = await enhancer.llm.chat_completion([
            {"role": "system", "content": "你是一个论文对比助手，请输出严格的 JSON。"},
            {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)}
        ])
        parsed = json.loads(response)
        if isinstance(parsed, dict):
            return parsed
    except Exception as e:
        logger.warning(f"LLM 对比填充失败: {e}")
    return {}


@router.post("/sets", response_model=dict)
async def create_compare_set(
    request: CompareSetCreate,
    db: Session = Depends(get_db)
):
    """
    创建对比集合
    """
    # 验证论文存在
    papers = []
    for paper_id in request.paper_ids:
        paper = paper_crud.get(db, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail=f"论文不存在: {paper_id}")
        papers.append({
            "id": paper.id,
            "title": paper.title,
            "authors": paper.authors,
            "year": paper.year,
            "venue": paper.venue,
        })
    
    # 创建集合
    compare_set = CompareSetModel(
        id=str(uuid.uuid4()),
        name=request.name,
        paper_ids=request.paper_ids,
        dimensions=request.dimensions or DEFAULT_DIMENSIONS
    )
    db.add(compare_set)
    db.commit()
    db.refresh(compare_set)
    
    return {
        "id": compare_set.id,
        "name": compare_set.name,
        "paper_count": len(papers),
        "papers": papers
    }


@router.get("/sets", response_model=dict)
async def list_compare_sets(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    获取所有对比集合
    """
    query = db.query(CompareSetModel).order_by(CompareSetModel.updated_at.desc())
    total = query.count()
    sets = query.offset(skip).limit(limit).all()
    
    items = []
    for s in sets:
        items.append({
            "id": s.id,
            "name": s.name,
            "paper_ids": s.paper_ids,
            "paper_count": len(s.paper_ids or []),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })
    
    return {
        "items": items,
        "total": total
    }


@router.get("/sets/{set_id}", response_model=dict)
async def get_compare_set(
    set_id: str,
    db: Session = Depends(get_db)
):
    """
    获取对比集合
    """
    compare_set = db.query(CompareSetModel).filter(CompareSetModel.id == set_id).first()
    if not compare_set:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    # 获取论文详情
    papers = []
    for paper_id in compare_set.paper_ids or []:
        paper = paper_crud.get(db, paper_id)
        if paper:
            papers.append({
                "id": paper.id,
                "title": paper.title,
                "authors": paper.authors,
                "year": paper.year,
                "venue": paper.venue,
            })
    
    return {
        "id": compare_set.id,
        "name": compare_set.name,
        "paper_ids": compare_set.paper_ids,
        "dimensions": compare_set.dimensions,
        "papers": papers,
        "matrix": compare_set.matrix,
        "conflicts": compare_set.conflicts,
        "summary": compare_set.summary,
        "created_at": compare_set.created_at.isoformat() if compare_set.created_at else None,
        "updated_at": compare_set.updated_at.isoformat() if compare_set.updated_at else None,
    }


@router.delete("/sets/{set_id}")
async def delete_compare_set(
    set_id: str,
    db: Session = Depends(get_db)
):
    """
    删除对比集合
    """
    compare_set = db.query(CompareSetModel).filter(CompareSetModel.id == set_id).first()
    if not compare_set:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    db.delete(compare_set)
    db.commit()
    
    return {"message": "已删除", "id": set_id}


@router.post("/sets/{set_id}/papers/{paper_id}")
async def add_paper_to_set(
    set_id: str,
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    添加论文到对比集合
    """
    compare_set = db.query(CompareSetModel).filter(CompareSetModel.id == set_id).first()
    if not compare_set:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    paper_ids = compare_set.paper_ids or []
    if paper_id not in paper_ids:
        paper_ids.append(paper_id)
        compare_set.paper_ids = paper_ids
        # 清除旧的矩阵缓存
        compare_set.matrix = None
        compare_set.conflicts = None
        compare_set.summary = None
        db.commit()
    
    return {"message": "已添加", "paper_count": len(compare_set.paper_ids)}


@router.delete("/sets/{set_id}/papers/{paper_id}")
async def remove_paper_from_set(
    set_id: str,
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    从对比集合移除论文
    """
    compare_set = db.query(CompareSetModel).filter(CompareSetModel.id == set_id).first()
    if not compare_set:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    paper_ids = compare_set.paper_ids or []
    if paper_id in paper_ids:
        paper_ids.remove(paper_id)
        compare_set.paper_ids = paper_ids
        # 清除旧的矩阵缓存
        compare_set.matrix = None
        compare_set.conflicts = None
        compare_set.summary = None
        db.commit()
    
    return {"message": "已移除", "paper_count": len(compare_set.paper_ids)}


@router.post("/sets/{set_id}/matrix", response_model=dict)
async def generate_compare_matrix(
    set_id: str,
    dimensions: Optional[List[str]] = None,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    生成对比矩阵
    """
    compare_set = db.query(CompareSetModel).filter(CompareSetModel.id == set_id).first()
    if not compare_set:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    paper_ids = compare_set.paper_ids or []
    
    if len(paper_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要2篇论文进行比较")
    
    # 使用指定维度或默认维度
    compare_dimensions = dimensions or compare_set.dimensions or DEFAULT_DIMENSIONS
    
    papers_info = _build_papers_info(db, paper_ids)
    matrix, conflicts = _build_matrix(papers_info, compare_dimensions)
    
    # 生成摘要
    summary = _generate_comparison_summary(papers_info, matrix, conflicts)
    
    # 保存结果到数据库
    compare_set.matrix = matrix
    compare_set.conflicts = conflicts
    compare_set.summary = summary
    db.commit()
    
    return {
        "set_id": set_id,
        "dimensions": compare_dimensions,
        "papers": papers_info,
        "matrix": matrix,
        "conflicts": conflicts,
        "summary": summary
    }


@router.post("/quick-matrix", response_model=dict)
async def quick_compare_matrix(
    request: QuickCompareMatrixRequest,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer),
):
    """
    快速对比矩阵（不创建集合、不落库）
    """
    paper_ids = request.paper_ids or []
    if len(paper_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要2篇论文进行比较")
    if len(paper_ids) > 8:
        raise HTTPException(status_code=400, detail="最多支持8篇论文同时比较")

    compare_dimensions = request.dimensions or DEFAULT_DIMENSIONS
    papers_info = _build_papers_info(db, paper_ids)
    matrix, conflicts = _build_matrix(papers_info, compare_dimensions)

    if request.use_llm:
        llm_values = await _llm_fill_matrix_values(enhancer, papers_info, compare_dimensions)
        if llm_values:
            # 覆盖 matrix 中的值
            for row in matrix:
                dim = row.get("dimension")
                dim_vals = llm_values.get(dim) if isinstance(llm_values, dict) else {}
                if not isinstance(dim_vals, dict):
                    continue
                for v in row.get("values", []):
                    pid = v.get("paper_id")
                    if pid in dim_vals and dim_vals[pid]:
                        v["value"] = dim_vals[pid]
            # 重新计算冲突基于当前 matrix
            conflicts = []
            for row in matrix:
                values = [v["value"] for v in row.get("values", []) if v.get("value")]
                if len(set(values)) > 1:
                    conflicts.append({
                        "dimension": row.get("dimension"),
                        "papers": [v.get("paper_title") for v in row.get("values", [])],
                        "values": values,
                    })
    summary = _generate_comparison_summary(papers_info, matrix, conflicts)

    return {
        "dimensions": compare_dimensions,
        "papers": papers_info,
        "matrix": matrix,
        "conflicts": conflicts,
        "summary": summary,
    }


@router.post("/quick-compare")
async def quick_compare(
    paper_ids: List[str],
    dimensions: Optional[List[str]] = None,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    快速比较（不创建集合）
    """
    if len(paper_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要2篇论文进行比较")
    
    if len(paper_ids) > 5:
        raise HTTPException(status_code=400, detail="最多支持5篇论文同时比较")
    
    compare_dimensions = dimensions or [
        "研究问题", "方法", "数据集", "评估指标", "主要结果"
    ]
    
    # 收集论文信息
    papers_content = []
    for i, paper_id in enumerate(paper_ids[:2]):  # 先处理前2篇
        paper = paper_crud.get(db, paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail=f"论文不存在: {paper_id}")
        papers_content.append(paper.abstract or paper.title)
    
    # 调用LLM进行比较
    try:
        result = await enhancer.compare_papers(
            papers_content[0],
            papers_content[1],
            compare_dimensions
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"比较失败: {str(e)}")
    
    return {
        "paper_ids": paper_ids,
        "comparison": result
    }


def _extract_dimension_value(paper: dict, dimension: str) -> str:
    """
    根据维度从论文信息中提取值
    """
    dim_lower = dimension.lower()
    
    if "问题" in dim_lower or "question" in dim_lower:
        if paper.get("skim") and paper["skim"].get("research_question"):
            return paper["skim"]["research_question"]
        deep = paper.get("deep_pack") or {}
        pc = deep.get("paper_card") or {}
        if pc.get("one_line_summary"):
            return pc.get("one_line_summary", "")
        return ""
    
    if "方法" in dim_lower or "method" in dim_lower:
        deep = paper.get("deep_pack") or {}
        mf = deep.get("method_flow") or {}
        if mf.get("overview"):
            return mf.get("overview", "")
        if mf.get("method_name"):
            return mf.get("method_name", "")
        abstract = paper.get("abstract", "")
        if "propose" in abstract.lower() or "method" in abstract.lower():
            return abstract[:200]
        return ""
    
    if "数据" in dim_lower or "dataset" in dim_lower:
        deep = paper.get("deep_pack") or {}
        ex = deep.get("experiment_setup") or {}
        datasets = ex.get("datasets") or []
        if isinstance(datasets, list) and len(datasets) > 0:
            names = [d.get("name") for d in datasets if isinstance(d, dict) and d.get("name")]
            return "、".join(names)
        return ""
    
    if "指标" in dim_lower or "metric" in dim_lower:
        deep = paper.get("deep_pack") or {}
        ex = deep.get("experiment_setup") or {}
        metrics = ex.get("metrics") or []
        if isinstance(metrics, list) and len(metrics) > 0:
            names = [m.get("name") for m in metrics if isinstance(m, dict) and m.get("name")]
            return "、".join(names)
        return ""
    
    if "结果" in dim_lower or "result" in dim_lower:
        deep = paper.get("deep_pack") or {}
        pc = deep.get("paper_card") or {}
        kt = pc.get("key_takeaways") or []
        if isinstance(kt, list) and len(kt) > 0:
            return "；".join([str(x) for x in kt[:2] if x])
        if paper.get("skim") and paper["skim"].get("contributions"):
            return "; ".join(paper["skim"]["contributions"][:2])
        return ""
    
    if "局限" in dim_lower or "limitation" in dim_lower:
        deep = paper.get("deep_pack") or {}
        pc = deep.get("paper_card") or {}
        lim = pc.get("limitations") or []
        if isinstance(lim, list) and len(lim) > 0:
            return "；".join([str(x) for x in lim[:3] if x])
        return ""
    
    return ""


def _generate_comparison_summary(papers: List[dict], matrix: List[dict], conflicts: List[dict]) -> str:
    """
    生成比较摘要
    """
    paper_count = len(papers)
    conflict_count = len(conflicts)
    
    summary_parts = [f"比较了 {paper_count} 篇论文"]
    
    if conflict_count > 0:
        summary_parts.append(f"在 {conflict_count} 个维度上存在差异")
    else:
        summary_parts.append("在所有维度上具有相似性")
    
    # 年份范围
    years = [p.get("year") for p in papers if p.get("year")]
    if years:
        summary_parts.append(f"发表年份: {min(years)}-{max(years)}")
    
    return "。".join(summary_parts) + "。"
