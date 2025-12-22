"""
审稿模式API端点 - 数据库持久化实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, skim_crud, card_crud
from ...core.llm import ContentEnhancer
from ...db.models import ReviewModel

router = APIRouter()


class ReviewDraftRequest(BaseModel):
    """审稿草稿请求"""
    format: str = "structured"  # structured, free, conference
    language: str = "zh"  # zh, en


class ReviewFeedback(BaseModel):
    """审稿反馈"""
    novelty_score: int  # 1-5
    novelty_reason: str
    soundness_score: int  # 1-5
    soundness_reason: str
    clarity_score: int  # 1-5
    clarity_reason: str
    significance_score: int  # 1-5
    significance_reason: str
    reproducibility_score: int  # 1-5
    reproducibility_reason: str
    overall_recommendation: str  # accept, weak_accept, weak_reject, reject
    questions: list[str]
    minor_issues: list[str]


def review_to_dict(review: ReviewModel, paper=None) -> dict:
    """转换审稿模型为字典"""
    return {
        "paper_id": review.paper_id,
        "paper_title": paper.title if paper else None,
        "draft": {
            "summary": review.summary,
            "strengths": review.strengths or [],
            "weaknesses": review.weaknesses or [],
            "questions": review.questions or [],
            "minor_issues": review.minor_issues or [],
            "recommendation": review.recommendation,
        },
        "raw_text": review.raw_text,
        "scores": {
            "novelty": {"score": review.novelty_score, "reason": review.novelty_reason},
            "soundness": {"score": review.soundness_score, "reason": review.soundness_reason},
            "clarity": {"score": review.clarity_score, "reason": review.clarity_reason},
            "significance": {"score": review.significance_score, "reason": review.significance_reason},
            "reproducibility": {"score": review.reproducibility_score, "reason": review.reproducibility_reason},
        } if review.novelty_score else None,
        "total_score": review.total_score,
        "generated_at": review.generated_at.isoformat() if review.generated_at else None,
        "submitted_at": review.submitted_at.isoformat() if review.submitted_at else None,
    }


@router.post("/{paper_id}/draft", response_model=dict)
async def generate_review_draft(
    paper_id: str,
    request: ReviewDraftRequest = ReviewDraftRequest(),
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    生成审稿意见草稿
    
    基于:
    - SkimCard
    - 已创建的卡片(EvidenceCard, MethodCard)
    - 论文内容
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 收集材料
    skim = skim_crud.get(db, paper_id)
    cards = card_crud.get_by_paper(db, paper_id)
    
    # 构建上下文
    context_parts = [f"论文标题: {paper.title}"]
    
    if paper.abstract:
        context_parts.append(f"摘要: {paper.abstract}")
    
    if skim:
        context_parts.append(f"研究问题: {skim.research_question}")
        if skim.contributions:
            context_parts.append(f"贡献: {'; '.join(skim.contributions)}")
        if skim.red_flags:
            context_parts.append(f"风险点: {'; '.join(skim.red_flags)}")
        context_parts.append(f"证据强度: {skim.evidence_strength} - {skim.evidence_strength_reason}")
    
    # 添加卡片内容
    for card in cards:
        if card.type and card.type.value == 'evidence':
            if card.claim and card.evidence:
                context_parts.append(f"证据: {card.claim} -> {card.evidence}")
        elif card.type and card.type.value == 'method':
            if card.method_name:
                context_parts.append(f"方法: {card.method_name}")
    
    content = "\n".join(context_parts)
    
    # 调用LLM生成审稿意见
    try:
        review_text = await enhancer.generate_review_draft(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")
    
    # 解析结构化审稿意见
    review_draft = _parse_review_draft(review_text, paper, skim)
    
    # 保存或更新数据库
    review = db.query(ReviewModel).filter(ReviewModel.paper_id == paper_id).first()
    if not review:
        review = ReviewModel(paper_id=paper_id)
        db.add(review)
    
    review.summary = review_draft["summary"]
    review.strengths = review_draft["strengths"]
    review.weaknesses = review_draft["weaknesses"]
    review.questions = review_draft["questions"]
    review.minor_issues = review_draft["minor_issues"]
    review.recommendation = review_draft["recommendation"]
    review.raw_text = review_text
    review.generated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(review)
    
    return {
        "paper_id": paper_id,
        "draft": review_draft,
        "raw_text": review_text
    }


@router.get("/{paper_id}/draft", response_model=dict)
async def get_review_draft(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    获取审稿草稿
    """
    review = db.query(ReviewModel).filter(ReviewModel.paper_id == paper_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="审稿草稿不存在，请先生成")
    
    paper = paper_crud.get(db, paper_id)
    
    return {
        "paper_id": paper_id,
        "draft": review_to_dict(review, paper)
    }


@router.post("/{paper_id}/feedback", response_model=dict)
async def submit_review_feedback(
    paper_id: str,
    feedback: ReviewFeedback,
    db: Session = Depends(get_db)
):
    """
    提交/更新审稿反馈
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 计算总分
    total_score = (
        feedback.novelty_score +
        feedback.soundness_score +
        feedback.clarity_score +
        feedback.significance_score +
        feedback.reproducibility_score
    ) / 5.0
    
    # 获取或创建审稿记录
    review = db.query(ReviewModel).filter(ReviewModel.paper_id == paper_id).first()
    if not review:
        review = ReviewModel(paper_id=paper_id)
        db.add(review)
    
    # 更新评分
    review.novelty_score = feedback.novelty_score
    review.novelty_reason = feedback.novelty_reason
    review.soundness_score = feedback.soundness_score
    review.soundness_reason = feedback.soundness_reason
    review.clarity_score = feedback.clarity_score
    review.clarity_reason = feedback.clarity_reason
    review.significance_score = feedback.significance_score
    review.significance_reason = feedback.significance_reason
    review.reproducibility_score = feedback.reproducibility_score
    review.reproducibility_reason = feedback.reproducibility_reason
    review.total_score = round(total_score, 1)
    review.recommendation = feedback.overall_recommendation
    review.questions = feedback.questions
    review.minor_issues = feedback.minor_issues
    review.submitted_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "反馈已保存",
        "total_score": total_score,
        "recommendation": feedback.overall_recommendation
    }


@router.get("/{paper_id}/export-review", response_model=dict)
async def export_review(
    paper_id: str,
    format: str = "markdown",
    db: Session = Depends(get_db)
):
    """
    导出审稿意见
    """
    review = db.query(ReviewModel).filter(ReviewModel.paper_id == paper_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="审稿记录不存在")
    
    paper = paper_crud.get(db, paper_id)
    
    if format == "markdown":
        content = _format_review_as_markdown(review, paper)
    else:
        content = review.raw_text or ""
    
    return {
        "paper_id": paper_id,
        "format": format,
        "content": content
    }


@router.get("/{paper_id}/rubric", response_model=dict)
async def get_review_rubric(paper_id: str):
    """
    获取审稿评分标准
    """
    rubric = {
        "novelty": {
            "name": "新颖性",
            "description": "论文提出的方法/想法是否新颖",
            "scale": [
                {"score": 1, "label": "无新意", "description": "完全是现有工作的重复"},
                {"score": 2, "label": "新意有限", "description": "仅有小的改进"},
                {"score": 3, "label": "一定新意", "description": "有一些新的想法或方法"},
                {"score": 4, "label": "较新颖", "description": "提出了有价值的新方法"},
                {"score": 5, "label": "非常新颖", "description": "开创性工作"},
            ]
        },
        "soundness": {
            "name": "严谨性",
            "description": "技术方法是否正确、实验是否可靠",
            "scale": [
                {"score": 1, "label": "存在重大问题", "description": "方法或实验有明显错误"},
                {"score": 2, "label": "有一些问题", "description": "存在一些需要澄清的问题"},
                {"score": 3, "label": "基本可靠", "description": "总体正确但有小问题"},
                {"score": 4, "label": "严谨", "description": "方法和实验都很可靠"},
                {"score": 5, "label": "非常严谨", "description": "方法论和实验无可挑剔"},
            ]
        },
        "clarity": {
            "name": "清晰度",
            "description": "论文写作是否清晰易懂",
            "scale": [
                {"score": 1, "label": "难以理解", "description": "结构混乱、表达不清"},
                {"score": 2, "label": "需改进", "description": "部分内容难以理解"},
                {"score": 3, "label": "尚可", "description": "基本清晰但有改进空间"},
                {"score": 4, "label": "清晰", "description": "写作清晰、结构良好"},
                {"score": 5, "label": "非常清晰", "description": "表达优秀、易于理解"},
            ]
        },
        "significance": {
            "name": "重要性",
            "description": "工作对领域的潜在影响",
            "scale": [
                {"score": 1, "label": "不重要", "description": "对领域没有明显贡献"},
                {"score": 2, "label": "有限贡献", "description": "贡献较小"},
                {"score": 3, "label": "有一定贡献", "description": "对特定问题有价值"},
                {"score": 4, "label": "重要", "description": "对领域有明显贡献"},
                {"score": 5, "label": "非常重要", "description": "可能产生重大影响"},
            ]
        },
        "reproducibility": {
            "name": "可复现性",
            "description": "是否提供足够信息以复现结果",
            "scale": [
                {"score": 1, "label": "无法复现", "description": "缺少关键细节"},
                {"score": 2, "label": "困难", "description": "缺少部分重要信息"},
                {"score": 3, "label": "可能", "description": "信息基本完整"},
                {"score": 4, "label": "较易", "description": "提供了详细的实验设置"},
                {"score": 5, "label": "完全可复现", "description": "提供代码和数据"},
            ]
        }
    }
    
    return {"rubric": rubric}


@router.get("/list", response_model=dict)
async def list_reviews(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    获取所有审稿记录
    """
    query = db.query(ReviewModel).order_by(ReviewModel.updated_at.desc())
    total = query.count()
    reviews = query.offset(skip).limit(limit).all()
    
    items = []
    for r in reviews:
        paper = paper_crud.get(db, r.paper_id)
        items.append({
            "paper_id": r.paper_id,
            "paper_title": paper.title if paper else None,
            "recommendation": r.recommendation,
            "total_score": r.total_score,
            "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        })
    
    return {
        "items": items,
        "total": total
    }


def _parse_review_draft(review_text: str, paper, skim) -> dict:
    """
    解析审稿草稿文本为结构化格式
    """
    # 基于SkimCard预填一些信息
    draft = {
        "summary": "",
        "strengths": [],
        "weaknesses": [],
        "questions": [],
        "minor_issues": [],
        "recommendation": "weak_accept"
    }
    
    # 简单解析
    lines = review_text.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if "总体评价" in line or "Summary" in line.lower():
            current_section = "summary"
        elif "优点" in line or "Strengths" in line.lower():
            current_section = "strengths"
        elif "问题" in line or "Weaknesses" in line.lower():
            current_section = "weaknesses"
        elif "建议" in line or "Questions" in line.lower():
            current_section = "questions"
        elif "小问题" in line or "Minor" in line.lower():
            current_section = "minor_issues"
        elif "结论" in line or "Conclusion" in line.lower():
            current_section = "recommendation"
        elif line.startswith(('-', '•', '*', '1', '2', '3')):
            # 列表项
            item = line.lstrip('-•*0123456789. ')
            if current_section == "strengths":
                draft["strengths"].append(item)
            elif current_section == "weaknesses":
                draft["weaknesses"].append(item)
            elif current_section == "questions":
                draft["questions"].append(item)
            elif current_section == "minor_issues":
                draft["minor_issues"].append(item)
        elif current_section == "summary":
            draft["summary"] += line + " "
    
    draft["summary"] = draft["summary"].strip()
    
    return draft


def _format_review_as_markdown(review: ReviewModel, paper) -> str:
    """
    格式化审稿意见为Markdown
    """
    lines = [f"# 审稿意见: {paper.title if paper else 'Unknown'}\n"]
    
    if review.novelty_score:
        lines.append("## 评分\n")
        scores = [
            ("新颖性", review.novelty_score, review.novelty_reason),
            ("严谨性", review.soundness_score, review.soundness_reason),
            ("清晰度", review.clarity_score, review.clarity_reason),
            ("重要性", review.significance_score, review.significance_reason),
            ("可复现性", review.reproducibility_score, review.reproducibility_reason),
        ]
        for name, score, reason in scores:
            if score:
                lines.append(f"- **{name}**: {score}/5 - {reason or ''}")
        lines.append(f"\n**总分**: {review.total_score or 'N/A'}/5")
        lines.append(f"**建议**: {review.recommendation or 'N/A'}\n")
    
    if review.summary:
        lines.append("## 总体评价\n")
        lines.append(review.summary + "\n")
    
    if review.strengths:
        lines.append("## 主要优点\n")
        for s in review.strengths:
            lines.append(f"- {s}")
        lines.append("")
    
    if review.weaknesses:
        lines.append("## 主要问题\n")
        for w in review.weaknesses:
            lines.append(f"- {w}")
        lines.append("")
    
    if review.questions:
        lines.append("## 问题\n")
        for q in review.questions:
            lines.append(f"- {q}")
        lines.append("")
    
    if review.minor_issues:
        lines.append("## 小问题\n")
        for m in review.minor_issues:
            lines.append(f"- {m}")
    
    lines.append(f"\n---\n*生成时间: {review.generated_at.isoformat() if review.generated_at else 'N/A'}*")
    
    return "\n".join(lines)
