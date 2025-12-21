"""
审稿模式API路由
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import uuid

router = APIRouter()

# 临时存储
_reviews_db = {}


class ReviewRubric(BaseModel):
    """审稿评分项"""
    novelty: int = 0           # 1-5
    novelty_reason: str = ""
    soundness: int = 0         # 1-5
    soundness_reason: str = ""
    rigor: int = 0             # 1-5
    rigor_reason: str = ""
    reproducibility: int = 0   # 1-5
    reproducibility_reason: str = ""
    clarity: int = 0           # 1-5
    clarity_reason: str = ""


class ReviewQuestion(BaseModel):
    """审稿问题"""
    id: str
    question: str
    severity: str = "minor"  # major/minor
    topic: str = "method"    # method/experiment/stats/repro/writing
    anchor_id: Optional[str] = None


class ReviewCreate(BaseModel):
    """创建审稿"""
    paper_id: str
    rubric: Optional[ReviewRubric] = None
    questions: List[ReviewQuestion] = []
    recommendation: Optional[str] = None  # strong_accept/weak_accept/weak_reject/strong_reject
    confidence: Optional[int] = None  # 1-5
    summary: Optional[str] = None


class ReviewResponse(BaseModel):
    """审稿响应"""
    id: str
    paper_id: str
    rubric: ReviewRubric
    questions: List[ReviewQuestion]
    recommendation: Optional[str]
    confidence: Optional[int]
    summary: Optional[str]
    claims_evidence: List[dict] = []
    created_at: datetime
    updated_at: datetime


@router.post("/generate/{paper_id}")
async def generate_review_draft(paper_id: str):
    """生成审稿草稿"""
    review_id = str(uuid.uuid4())
    now = datetime.now()
    
    # TODO: 基于论文内容和已有卡片生成审稿草稿
    review = {
        "id": review_id,
        "paper_id": paper_id,
        "rubric": ReviewRubric(
            novelty=3,
            novelty_reason="方法有一定新意，但...",
            soundness=3,
            soundness_reason="实验设计合理，但...",
            rigor=3,
            rigor_reason="统计分析较为完整",
            reproducibility=2,
            reproducibility_reason="缺少部分实现细节",
            clarity=4,
            clarity_reason="写作清晰"
        ).model_dump(),
        "questions": [
            {
                "id": str(uuid.uuid4()),
                "question": "请补充关于超参数选择的说明",
                "severity": "minor",
                "topic": "experiment"
            }
        ],
        "recommendation": None,
        "confidence": None,
        "summary": None,
        "claims_evidence": [],
        "created_at": now,
        "updated_at": now
    }
    
    _reviews_db[review_id] = review
    return review


@router.get("/{paper_id}", response_model=ReviewResponse)
async def get_review(paper_id: str):
    """获取论文的审稿"""
    for review in _reviews_db.values():
        if review["paper_id"] == paper_id:
            return review
    
    raise HTTPException(404, "审稿不存在")


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(review_id: str, update: ReviewCreate):
    """更新审稿"""
    if review_id not in _reviews_db:
        raise HTTPException(404, "审稿不存在")
    
    review = _reviews_db[review_id]
    update_data = update.model_dump(exclude_unset=True)
    review.update(update_data)
    review["updated_at"] = datetime.now()
    
    return review


@router.post("/{review_id}/questions")
async def add_question(review_id: str, question: ReviewQuestion):
    """添加审稿问题"""
    if review_id not in _reviews_db:
        raise HTTPException(404, "审稿不存在")
    
    question.id = str(uuid.uuid4())
    _reviews_db[review_id]["questions"].append(question.model_dump())
    
    return {"message": "问题已添加", "question_id": question.id}


@router.delete("/{review_id}/questions/{question_id}")
async def remove_question(review_id: str, question_id: str):
    """删除审稿问题"""
    if review_id not in _reviews_db:
        raise HTTPException(404, "审稿不存在")
    
    review = _reviews_db[review_id]
    review["questions"] = [q for q in review["questions"] if q["id"] != question_id]
    
    return {"message": "问题已删除"}


@router.get("/{review_id}/claims-evidence")
async def get_claims_evidence(review_id: str):
    """获取主张-证据表"""
    if review_id not in _reviews_db:
        raise HTTPException(404, "审稿不存在")
    
    # TODO: 从EvidenceCard生成
    return {"claims_evidence": _reviews_db[review_id].get("claims_evidence", [])}


@router.post("/{review_id}/recommendation")
async def set_recommendation(
    review_id: str, 
    recommendation: str, 
    confidence: int
):
    """设置审稿建议"""
    if review_id not in _reviews_db:
        raise HTTPException(404, "审稿不存在")
    
    valid_recommendations = ["strong_accept", "weak_accept", "weak_reject", "strong_reject"]
    if recommendation not in valid_recommendations:
        raise HTTPException(400, "无效的建议类型")
    
    if not 1 <= confidence <= 5:
        raise HTTPException(400, "置信度必须在1-5之间")
    
    _reviews_db[review_id]["recommendation"] = recommendation
    _reviews_db[review_id]["confidence"] = confidence
    _reviews_db[review_id]["updated_at"] = datetime.now()
    
    return {"message": "建议已设置"}


@router.get("/{review_id}/export")
async def export_review(review_id: str, format: str = "markdown"):
    """导出审稿报告"""
    if review_id not in _reviews_db:
        raise HTTPException(404, "审稿不存在")
    
    review = _reviews_db[review_id]
    
    if format == "markdown":
        content = _generate_review_markdown(review)
    else:
        content = str(review)
    
    return {"format": format, "content": content}


def _generate_review_markdown(review: dict) -> str:
    """生成Markdown格式的审稿报告"""
    rubric = review.get("rubric", {})
    questions = review.get("questions", [])
    
    md = f"""# Review Report

## Scores

| Criterion | Score | Reason |
|-----------|-------|--------|
| Novelty | {rubric.get('novelty', '-')}/5 | {rubric.get('novelty_reason', '-')} |
| Soundness | {rubric.get('soundness', '-')}/5 | {rubric.get('soundness_reason', '-')} |
| Rigor | {rubric.get('rigor', '-')}/5 | {rubric.get('rigor_reason', '-')} |
| Reproducibility | {rubric.get('reproducibility', '-')}/5 | {rubric.get('reproducibility_reason', '-')} |
| Clarity | {rubric.get('clarity', '-')}/5 | {rubric.get('clarity_reason', '-')} |

## Questions for Authors

"""
    
    for i, q in enumerate(questions, 1):
        severity = "🔴" if q.get("severity") == "major" else "🟡"
        md += f"{i}. {severity} [{q.get('topic', 'general')}] {q.get('question', '')}\n"
    
    if review.get("recommendation"):
        md += f"\n## Recommendation\n\n**{review['recommendation']}** (Confidence: {review.get('confidence', '-')}/5)\n"
    
    if review.get("summary"):
        md += f"\n## Summary\n\n{review['summary']}\n"
    
    return md

