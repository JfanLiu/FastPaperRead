"""
快速阅读(Skim)相关API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, skim_crud
from ...db.models import PaperStatus
from ...core.llm import ContentEnhancer
from ...schemas.skim import SkimCardResponse, SkimDecisionRequest

router = APIRouter()


@router.post("/{paper_id}/generate", response_model=dict)
async def generate_skim_card(
    paper_id: str,
    force: bool = False,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    生成SkimCard
    
    - 基于论文摘要、引言等快速生成阅读卡片
    - 如果已存在且force=False，返回缓存
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 检查缓存
    existing = skim_crud.get(db, paper_id)
    if existing and not force:
        return {
            "skim_card": {
                "research_question": existing.research_question,
                "contributions": existing.contributions,
                "evidence_strength": existing.evidence_strength,
                "evidence_strength_reason": existing.evidence_strength_reason,
                "red_flags": existing.red_flags,
                "recommended_route": existing.recommended_route,
                "recommended_sections": existing.recommended_sections,
                "key_figures": existing.key_figures,
            },
            "cached": True
        }
    
    # 获取论文内容
    content = paper.abstract or ""
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足，无法生成SkimCard")
    
    # 调用LLM生成
    try:
        result = await enhancer.generate_skim_card(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")
    
    # 保存结果
    skim_card = skim_crud.create_or_update(
        db,
        paper_id=paper_id,
        research_question=result.get("research_question", ""),
        contributions=result.get("contributions", []),
        evidence_strength=result.get("evidence_strength", "medium"),
        evidence_strength_reason=result.get("evidence_strength_reason", ""),
        red_flags=result.get("red_flags", []),
        recommended_route=result.get("recommended_route", "review"),
        recommended_sections=result.get("recommended_sections", []),
        key_figures=result.get("key_figures", [])
    )
    
    return {
        "skim_card": {
            "research_question": skim_card.research_question,
            "contributions": skim_card.contributions,
            "evidence_strength": skim_card.evidence_strength,
            "evidence_strength_reason": skim_card.evidence_strength_reason,
            "red_flags": skim_card.red_flags,
            "recommended_route": skim_card.recommended_route,
            "recommended_sections": skim_card.recommended_sections,
            "key_figures": skim_card.key_figures,
        },
        "cached": False
    }


@router.get("/{paper_id}", response_model=dict)
async def get_skim_card(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """获取已生成的SkimCard"""
    skim_card = skim_crud.get(db, paper_id)
    if not skim_card:
        raise HTTPException(status_code=404, detail="SkimCard不存在，请先生成")
    
    return {
        "skim_card": {
            "research_question": skim_card.research_question,
            "contributions": skim_card.contributions,
            "evidence_strength": skim_card.evidence_strength,
            "evidence_strength_reason": skim_card.evidence_strength_reason,
            "red_flags": skim_card.red_flags,
            "recommended_route": skim_card.recommended_route,
            "recommended_sections": skim_card.recommended_sections,
            "key_figures": skim_card.key_figures,
        }
    }


@router.post("/{paper_id}/decision", response_model=dict)
async def make_skim_decision(
    paper_id: str,
    request: SkimDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    做出阅读决策
    
    - decision: deep_read / focused_read / skip / archive
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 根据决策更新论文状态
    decision_to_status = {
        "deep_read": PaperStatus.SKIMMED,
        "focused_read": PaperStatus.SKIMMED,
        "skip": PaperStatus.ARCHIVED,
        "archive": PaperStatus.ARCHIVED,
    }
    
    new_status = decision_to_status.get(request.decision, PaperStatus.SKIMMED)
    paper = paper_crud.update_status(db, paper_id, new_status)
    
    # 如果有质量评分，更新
    if request.quality_grade:
        paper = paper_crud.update(db, paper_id, quality_grade=request.quality_grade)
    
    return {
        "message": "决策已记录",
        "decision": request.decision,
        "new_status": new_status.value
    }
