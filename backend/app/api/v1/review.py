"""
审稿模式API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, skim_crud, card_crud
from ...core.llm import ContentEnhancer

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


# 内存存储审稿结果
_review_drafts = {}


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
    
    # 存储
    _review_drafts[paper_id] = {
        **review_draft,
        "generated_at": datetime.now().isoformat(),
        "raw_text": review_text
    }
    
    return {
        "paper_id": paper_id,
        "draft": review_draft,
        "raw_text": review_text
    }


@router.get("/{paper_id}/draft", response_model=dict)
async def get_review_draft(paper_id: str):
    """
    获取审稿草稿
    """
    if paper_id not in _review_drafts:
        raise HTTPException(status_code=404, detail="审稿草稿不存在，请先生成")
    
    return {
        "paper_id": paper_id,
        "draft": _review_drafts[paper_id]
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
    
    # 存储反馈
    review_data = {
        "paper_id": paper_id,
        "paper_title": paper.title,
        "scores": {
            "novelty": {"score": feedback.novelty_score, "reason": feedback.novelty_reason},
            "soundness": {"score": feedback.soundness_score, "reason": feedback.soundness_reason},
            "clarity": {"score": feedback.clarity_score, "reason": feedback.clarity_reason},
            "significance": {"score": feedback.significance_score, "reason": feedback.significance_reason},
            "reproducibility": {"score": feedback.reproducibility_score, "reason": feedback.reproducibility_reason},
        },
        "total_score": round(total_score, 1),
        "recommendation": feedback.overall_recommendation,
        "questions": feedback.questions,
        "minor_issues": feedback.minor_issues,
        "submitted_at": datetime.now().isoformat()
    }
    
    _review_drafts[paper_id] = {
        **_review_drafts.get(paper_id, {}),
        "feedback": review_data
    }
    
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
    if paper_id not in _review_drafts:
        raise HTTPException(status_code=404, detail="审稿记录不存在")
    
    review = _review_drafts[paper_id]
    paper = paper_crud.get(db, paper_id)
    
    if format == "markdown":
        content = _format_review_as_markdown(review, paper)
    else:
        content = review.get("raw_text", "")
    
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


def _format_review_as_markdown(review: dict, paper) -> str:
    """
    格式化审稿意见为Markdown
    """
    lines = [f"# 审稿意见: {paper.title if paper else 'Unknown'}\n"]
    
    if review.get("feedback"):
        fb = review["feedback"]
        lines.append("## 评分\n")
        for dim, data in fb.get("scores", {}).items():
            lines.append(f"- **{dim}**: {data['score']}/5 - {data['reason']}")
        lines.append(f"\n**总分**: {fb.get('total_score', 'N/A')}/5")
        lines.append(f"**建议**: {fb.get('recommendation', 'N/A')}\n")
    
    draft = review.get("draft", review)
    
    if draft.get("summary"):
        lines.append("## 总体评价\n")
        lines.append(draft["summary"] + "\n")
    
    if draft.get("strengths"):
        lines.append("## 主要优点\n")
        for s in draft["strengths"]:
            lines.append(f"- {s}")
        lines.append("")
    
    if draft.get("weaknesses"):
        lines.append("## 主要问题\n")
        for w in draft["weaknesses"]:
            lines.append(f"- {w}")
        lines.append("")
    
    if draft.get("questions"):
        lines.append("## 问题\n")
        for q in draft["questions"]:
            lines.append(f"- {q}")
        lines.append("")
    
    if draft.get("minor_issues"):
        lines.append("## 小问题\n")
        for m in draft["minor_issues"]:
            lines.append(f"- {m}")
    
    lines.append(f"\n---\n*生成时间: {review.get('generated_at', 'N/A')}*")
    
    return "\n".join(lines)
