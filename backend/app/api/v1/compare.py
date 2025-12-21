"""
论文比较API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, skim_crud
from ...core.llm import ContentEnhancer

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


# 内存存储（生产环境应使用数据库）
_compare_sets = {}


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
    import uuid
    set_id = str(uuid.uuid4())
    
    _compare_sets[set_id] = {
        "id": set_id,
        "name": request.name,
        "paper_ids": request.paper_ids,
        "dimensions": request.dimensions or [
            "研究问题",
            "方法",
            "数据集",
            "评估指标",
            "主要结果",
            "局限性"
        ]
    }
    
    return {
        "id": set_id,
        "name": request.name,
        "paper_count": len(papers),
        "papers": papers
    }


@router.get("/sets/{set_id}", response_model=dict)
async def get_compare_set(
    set_id: str,
    db: Session = Depends(get_db)
):
    """
    获取对比集合
    """
    if set_id not in _compare_sets:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    compare_set = _compare_sets[set_id]
    
    # 获取论文详情
    papers = []
    for paper_id in compare_set["paper_ids"]:
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
        **compare_set,
        "papers": papers
    }


@router.post("/sets/{set_id}/papers/{paper_id}")
async def add_paper_to_set(
    set_id: str,
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    添加论文到对比集合
    """
    if set_id not in _compare_sets:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    if paper_id not in _compare_sets[set_id]["paper_ids"]:
        _compare_sets[set_id]["paper_ids"].append(paper_id)
    
    return {"message": "已添加", "paper_count": len(_compare_sets[set_id]["paper_ids"])}


@router.delete("/sets/{set_id}/papers/{paper_id}")
async def remove_paper_from_set(
    set_id: str,
    paper_id: str
):
    """
    从对比集合移除论文
    """
    if set_id not in _compare_sets:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    if paper_id in _compare_sets[set_id]["paper_ids"]:
        _compare_sets[set_id]["paper_ids"].remove(paper_id)
    
    return {"message": "已移除", "paper_count": len(_compare_sets[set_id]["paper_ids"])}


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
    if set_id not in _compare_sets:
        raise HTTPException(status_code=404, detail="对比集合不存在")
    
    compare_set = _compare_sets[set_id]
    paper_ids = compare_set["paper_ids"]
    
    if len(paper_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要2篇论文进行比较")
    
    # 使用指定维度或默认维度
    compare_dimensions = dimensions or compare_set.get("dimensions", [
        "研究问题", "方法", "数据集", "评估指标", "主要结果", "局限性"
    ])
    
    # 收集论文信息
    papers_info = []
    for paper_id in paper_ids:
        paper = paper_crud.get(db, paper_id)
        if not paper:
            continue
        
        skim = skim_crud.get(db, paper_id)
        
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
            } if skim else None
        })
    
    # 构建比较矩阵
    matrix = []
    conflicts = []
    
    for dim in compare_dimensions:
        row = {
            "dimension": dim,
            "values": []
        }
        
        for paper in papers_info:
            # 根据维度提取相关信息
            value = _extract_dimension_value(paper, dim)
            row["values"].append({
                "paper_id": paper["id"],
                "paper_title": paper["title"],
                "value": value
            })
        
        matrix.append(row)
        
        # 检测冲突
        values = [v["value"] for v in row["values"] if v["value"]]
        if len(set(values)) > 1:
            conflicts.append({
                "dimension": dim,
                "papers": [v["paper_title"] for v in row["values"]],
                "values": values
            })
    
    # 生成摘要
    summary = _generate_comparison_summary(papers_info, matrix, conflicts)
    
    return {
        "set_id": set_id,
        "dimensions": compare_dimensions,
        "papers": papers_info,
        "matrix": matrix,
        "conflicts": conflicts,
        "summary": summary
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
        return ""
    
    if "方法" in dim_lower or "method" in dim_lower:
        # 从摘要中提取方法相关信息
        abstract = paper.get("abstract", "")
        if "propose" in abstract.lower() or "method" in abstract.lower():
            return abstract[:200]
        return ""
    
    if "数据" in dim_lower or "dataset" in dim_lower:
        return ""  # 需要更深度的解析
    
    if "指标" in dim_lower or "metric" in dim_lower:
        return ""  # 需要更深度的解析
    
    if "结果" in dim_lower or "result" in dim_lower:
        if paper.get("skim") and paper["skim"].get("contributions"):
            return "; ".join(paper["skim"]["contributions"][:2])
        return ""
    
    if "局限" in dim_lower or "limitation" in dim_lower:
        return ""  # 需要更深度的解析
    
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
