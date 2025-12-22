"""
复现清单API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud
from ...db.models import ChecklistModel
from ...core.llm import ContentEnhancer

router = APIRouter()


class ChecklistItem(BaseModel):
    """清单项目"""
    id: Optional[str] = None
    group: str  # data, model, training, evaluation, code
    text: str
    found: bool = False
    source_anchor_id: Optional[str] = None
    inferred_value: Optional[str] = None
    needs_verify: bool = False
    note: Optional[str] = None


class ChecklistCreate(BaseModel):
    """创建清单"""
    items: List[ChecklistItem] = []


class ChecklistUpdate(BaseModel):
    """更新清单"""
    items: Optional[List[ChecklistItem]] = None
    note: Optional[str] = None


# 预定义清单模板
CHECKLIST_TEMPLATES = {
    "ml_reproducibility": {
        "name": "机器学习可复现性清单",
        "groups": {
            "data": {
                "name": "数据",
                "items": [
                    "数据集名称和版本",
                    "数据预处理步骤",
                    "训练/验证/测试集划分",
                    "数据增强方法",
                    "数据清洗/过滤条件",
                ]
            },
            "model": {
                "name": "模型",
                "items": [
                    "模型架构详细描述",
                    "模型参数量",
                    "初始化方法",
                    "激活函数",
                    "正则化方法",
                ]
            },
            "training": {
                "name": "训练",
                "items": [
                    "优化器及参数",
                    "学习率及调度策略",
                    "批量大小",
                    "训练轮数",
                    "早停条件",
                    "随机种子",
                    "硬件环境(GPU型号/数量)",
                    "训练时间",
                ]
            },
            "evaluation": {
                "name": "评估",
                "items": [
                    "评估指标定义",
                    "评估数据集",
                    "Baseline对比",
                    "统计显著性检验",
                    "消融实验",
                ]
            },
            "code": {
                "name": "代码",
                "items": [
                    "代码开源链接",
                    "依赖库版本",
                    "运行说明",
                    "预训练模型链接",
                ]
            }
        }
    }
}


def get_checklist_by_paper(db: Session, paper_id: str) -> Optional[ChecklistModel]:
    """获取论文的复现清单"""
    return db.query(ChecklistModel).filter(ChecklistModel.paper_id == paper_id).first()


def create_or_update_checklist(db: Session, paper_id: str, items: List[dict], **kwargs) -> ChecklistModel:
    """创建或更新复现清单"""
    checklist = get_checklist_by_paper(db, paper_id)
    
    # 计算统计
    total = len(items)
    found = sum(1 for item in items if item.get('found', False))
    missing = total - found
    completeness = found / total if total > 0 else 0
    
    if checklist:
        checklist.items = items
        checklist.total_items = total
        checklist.found_items = found
        checklist.missing_items = missing
        checklist.completeness_score = completeness
        checklist.updated_at = datetime.utcnow()
        for key, value in kwargs.items():
            if hasattr(checklist, key):
                setattr(checklist, key, value)
    else:
        checklist = ChecklistModel(
            paper_id=paper_id,
            items=items,
            total_items=total,
            found_items=found,
            missing_items=missing,
            completeness_score=completeness,
            **kwargs
        )
        db.add(checklist)
    
    db.commit()
    db.refresh(checklist)
    return checklist


@router.get("/templates")
async def get_checklist_templates():
    """
    获取可用的清单模板
    """
    return {
        "templates": [
            {
                "id": tid,
                "name": t["name"],
                "groups": list(t["groups"].keys()),
                "total_items": sum(len(g["items"]) for g in t["groups"].values())
            }
            for tid, t in CHECKLIST_TEMPLATES.items()
        ]
    }


@router.get("/templates/{template_id}")
async def get_template_detail(template_id: str):
    """
    获取模板详情
    """
    if template_id not in CHECKLIST_TEMPLATES:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    return CHECKLIST_TEMPLATES[template_id]


@router.post("/{paper_id}/generate")
async def generate_checklist(
    paper_id: str,
    template_id: str = "ml_reproducibility",
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    自动生成复现清单
    
    基于模板和论文内容，使用LLM扫描论文并填充清单
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    if template_id not in CHECKLIST_TEMPLATES:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    template = CHECKLIST_TEMPLATES[template_id]
    
    # 获取论文内容
    content = paper.abstract or ""
    if paper.markdown_path:
        try:
            with open(paper.markdown_path, 'r', encoding='utf-8') as f:
                content = f.read()[:8000]
        except:
            pass
    
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足")
    
    # 使用LLM扫描缺失细节
    try:
        result = await enhancer.find_missing_details(content)
    except Exception as e:
        # LLM失败，使用模板默认值
        result = {"items": [], "completeness_score": 0}
    
    # 构建清单项目
    items = []
    import uuid
    
    for group_id, group_data in template["groups"].items():
        for item_text in group_data["items"]:
            # 检查LLM是否找到了这个项目
            found = False
            inferred_value = None
            
            for llm_item in result.get("items", []):
                if llm_item.get("group") == group_id and item_text.lower() in llm_item.get("text", "").lower():
                    found = not llm_item.get("missing", True)
                    inferred_value = llm_item.get("suggestion")
                    break
            
            items.append({
                "id": str(uuid.uuid4()),
                "group": group_id,
                "text": item_text,
                "found": found,
                "inferred_value": inferred_value,
                "needs_verify": not found,
                "note": ""
            })
    
    # 保存清单
    checklist = create_or_update_checklist(db, paper_id, items)
    
    return {
        "paper_id": paper_id,
        "checklist_id": checklist.id,
        "template": template_id,
        "items": items,
        "stats": {
            "total": checklist.total_items,
            "found": checklist.found_items,
            "missing": checklist.missing_items,
            "completeness": round(checklist.completeness_score * 100, 1)
        }
    }


@router.get("/{paper_id}")
async def get_paper_checklist(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    获取论文的复现清单
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    checklist = get_checklist_by_paper(db, paper_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="清单不存在，请先生成")
    
    # 按组分类
    by_group = {}
    for item in checklist.items:
        group = item.get("group", "other")
        if group not in by_group:
            by_group[group] = []
        by_group[group].append(item)
    
    return {
        "paper_id": paper_id,
        "checklist_id": checklist.id,
        "items": checklist.items,
        "by_group": by_group,
        "stats": {
            "total": checklist.total_items,
            "found": checklist.found_items,
            "missing": checklist.missing_items,
            "completeness": round(checklist.completeness_score * 100, 1)
        },
        "verdict": checklist.repro_verdict,
        "created_at": checklist.created_at.isoformat() if checklist.created_at else None,
        "updated_at": checklist.updated_at.isoformat() if checklist.updated_at else None
    }


@router.put("/{paper_id}")
async def update_paper_checklist(
    paper_id: str,
    update: ChecklistUpdate,
    db: Session = Depends(get_db)
):
    """
    更新复现清单
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    checklist = get_checklist_by_paper(db, paper_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="清单不存在，请先生成")
    
    if update.items is not None:
        items = [item.model_dump() for item in update.items]
        checklist = create_or_update_checklist(db, paper_id, items)
    
    return {
        "message": "更新成功",
        "stats": {
            "total": checklist.total_items,
            "found": checklist.found_items,
            "missing": checklist.missing_items,
            "completeness": round(checklist.completeness_score * 100, 1)
        }
    }


@router.put("/{paper_id}/item/{item_id}")
async def update_checklist_item(
    paper_id: str,
    item_id: str,
    found: Optional[bool] = None,
    note: Optional[str] = None,
    inferred_value: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    更新单个清单项目
    """
    checklist = get_checklist_by_paper(db, paper_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="清单不存在")
    
    items = checklist.items
    updated = False
    
    for item in items:
        if item.get("id") == item_id:
            if found is not None:
                item["found"] = found
                item["needs_verify"] = not found
            if note is not None:
                item["note"] = note
            if inferred_value is not None:
                item["inferred_value"] = inferred_value
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 重新计算统计
    checklist = create_or_update_checklist(db, paper_id, items)
    
    return {
        "message": "更新成功",
        "item_id": item_id,
        "stats": {
            "total": checklist.total_items,
            "found": checklist.found_items,
            "completeness": round(checklist.completeness_score * 100, 1)
        }
    }


@router.post("/{paper_id}/verdict")
async def set_repro_verdict(
    paper_id: str,
    verdict: str,  # reproducible, partially_reproducible, not_reproducible, unknown
    db: Session = Depends(get_db)
):
    """
    设置可复现性判定
    """
    valid_verdicts = ["reproducible", "partially_reproducible", "not_reproducible", "unknown"]
    if verdict not in valid_verdicts:
        raise HTTPException(status_code=400, detail=f"无效的判定，必须是: {valid_verdicts}")
    
    checklist = get_checklist_by_paper(db, paper_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="清单不存在")
    
    checklist.repro_verdict = verdict
    db.commit()
    
    # 同时更新论文的复现状态
    paper = paper_crud.get(db, paper_id)
    if paper:
        paper.repro_status = verdict
        db.commit()
    
    return {
        "message": "判定已设置",
        "verdict": verdict
    }


