"""
快速阅读(Skim)相关API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, skim_crud, anchor_crud
from ...db.models import PaperStatus, ReadingQueueModel
from ...core.llm import ContentEnhancer
from ...core.quality import evaluate_paper_quality
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
    
    # 评估质量
    quality_score = evaluate_paper_quality(
        abstract=paper.abstract,
        contributions=result.get("contributions", []),
        evidence_strength=result.get("evidence_strength", "medium"),
        skim_data={
            "red_flags": result.get("red_flags", [])
        }
    )
    
    # 合并红旗（LLM生成的 + 规则检测的）
    all_red_flags = list(result.get("red_flags", []))
    for rf in quality_score.red_flags:
        if rf.message not in all_red_flags:
            all_red_flags.append(rf.message)
    
    # 更新论文质量等级
    paper_crud.update(db, paper_id, quality_grade=quality_score.grade.value)
    
    # 保存结果
    skim_card = skim_crud.create_or_update(
        db,
        paper_id=paper_id,
        research_question=result.get("research_question", ""),
        contributions=result.get("contributions", []),
        evidence_strength=result.get("evidence_strength", "medium"),
        evidence_strength_reason=result.get("evidence_strength_reason", ""),
        red_flags=all_red_flags,
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
        "quality": quality_score.to_dict(),
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


@router.get("/{paper_id}/quality", response_model=dict)
async def get_paper_quality(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    获取论文质量评估
    
    返回质量分数、等级、红旗警告和改进建议
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 获取skim数据
    skim_card = skim_crud.get(db, paper_id)
    skim_data = None
    if skim_card:
        skim_data = {
            "contributions": skim_card.contributions,
            "evidence_strength": skim_card.evidence_strength,
            "red_flags": skim_card.red_flags,
        }
    
    # 获取论文统计
    figure_count = anchor_crud.count_by_type(db, paper_id).get("figure", 0)
    paper_stats = {
        "figure_count": figure_count,
    }
    
    # 评估质量
    quality_score = evaluate_paper_quality(
        abstract=paper.abstract,
        skim_data=skim_data,
        paper_stats=paper_stats
    )
    
    return {
        "paper_id": paper_id,
        "quality": quality_score.to_dict(),
        "current_grade": paper.quality_grade
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


# ============================================
# 阅读队列 API
# ============================================

@router.get("/queue", response_model=dict)
async def get_reading_queue(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    获取待读队列
    
    返回按优先级和添加时间排序的论文列表
    """
    queue_items = db.query(ReadingQueueModel).order_by(
        desc(ReadingQueueModel.priority),
        ReadingQueueModel.added_at
    ).limit(limit).all()
    
    papers = []
    for item in queue_items:
        paper = paper_crud.get(db, item.paper_id)
        if paper:
            papers.append({
                "queue_id": item.id,
                "paper_id": paper.id,
                "title": paper.title,
                "authors": paper.authors,
                "year": paper.year,
                "status": paper.status.value if paper.status else "unknown",
                "quality_grade": paper.quality_grade,
                "priority": item.priority,
                "note": item.note,
                "added_at": item.added_at.isoformat() if item.added_at else None,
            })
    
    return {
        "items": papers,
        "total": len(papers)
    }


@router.post("/queue/{paper_id}", response_model=dict)
async def add_to_queue(
    paper_id: str,
    priority: int = Query(0, ge=0, le=10),
    note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    将论文加入阅读队列
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 检查是否已在队列中
    existing = db.query(ReadingQueueModel).filter(
        ReadingQueueModel.paper_id == paper_id
    ).first()
    
    if existing:
        # 更新优先级和备注
        existing.priority = priority
        if note is not None:
            existing.note = note
        db.commit()
        return {
            "message": "已更新队列项",
            "queue_id": existing.id,
            "paper_id": paper_id
        }
    
    # 添加到队列
    queue_item = ReadingQueueModel(
        paper_id=paper_id,
        priority=priority,
        note=note
    )
    db.add(queue_item)
    db.commit()
    db.refresh(queue_item)
    
    return {
        "message": "已加入阅读队列",
        "queue_id": queue_item.id,
        "paper_id": paper_id
    }


@router.delete("/queue/{paper_id}")
async def remove_from_queue(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    从阅读队列移除论文
    """
    queue_item = db.query(ReadingQueueModel).filter(
        ReadingQueueModel.paper_id == paper_id
    ).first()
    
    if not queue_item:
        raise HTTPException(status_code=404, detail="论文不在队列中")
    
    db.delete(queue_item)
    db.commit()
    
    return {"message": "已从队列移除", "paper_id": paper_id}


# ============================================
# 关键图表 API
# ============================================

@router.get("/{paper_id}/key-figures", response_model=dict)
async def get_key_figures(
    paper_id: str,
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """
    获取论文的关键图表
    
    返回论文中最重要的figure锚点
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 获取所有figure类型的锚点
    figures = anchor_crud.get_by_paper(
        db,
        paper_id,
        type="figure"
    )
    
    # 简单排序：优先有caption的，然后按序号
    def figure_score(fig):
        score = 0
        if fig.caption:
            score += 10
        if fig.figure_number:
            # 提取数字进行排序
            try:
                num = int(''.join(filter(str.isdigit, fig.figure_number or '0')))
                score += (100 - num)  # 小编号优先
            except:
                pass
        return score
    
    sorted_figures = sorted(figures, key=figure_score, reverse=True)[:limit]
    
    result = []
    for fig in sorted_figures:
        result.append({
            "anchor_id": fig.id,
            "type": "figure",
            "page": fig.page,
            "figure_number": fig.figure_number,
            "caption": fig.caption,
            "image_path": fig.image_path,
            "section": fig.section,
        })
    
    return {
        "paper_id": paper_id,
        "figures": result,
        "total": len(figures),
        "returned": len(result)
    }
