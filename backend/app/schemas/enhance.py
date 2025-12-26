"""
增强引擎相关的Pydantic Schema
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal


class EnhanceRequest(BaseModel):
    """增强请求基类"""
    anchor_id: str


class TermExplainRequest(EnhanceRequest):
    """术语解释请求"""
    term: str = Field(..., description="要解释的术语")


class TermExplanation(BaseModel):
    """术语解释结果"""
    definition: str = ""
    explanation: str = ""
    examples: List[str] = Field(default_factory=list)
    related_terms: List[str] = Field(default_factory=list)


class FigureExplanation(BaseModel):
    """图表解释结果"""
    description: str = ""
    key_findings: List[str] = Field(default_factory=list)
    interpretation: str = ""
    limitations: List[str] = Field(default_factory=list)
    related_content: str = ""


class EquationExplanation(BaseModel):
    """公式解释结果"""
    explanation: str = ""
    symbols: List[Dict[str, str]] = Field(default_factory=list)
    derivation_hint: Optional[str] = None
    usage: str = ""
    related_equations: List[str] = Field(default_factory=list)


class MissingDetailItem(BaseModel):
    """缺失细节条目"""
    group: str = Field(..., description="data/model/training/evaluation/code")
    text: str
    importance: str = "medium"
    suggestion: str = ""


class MissingDetailsResponse(BaseModel):
    """缺失细节响应"""
    items: List[MissingDetailItem] = Field(default_factory=list)
    completeness_score: float = 0.0
    overall_assessment: str = ""


class EnhanceResponse(BaseModel):
    """增强响应"""
    explanation: Dict[str, Any]
    cached: bool = False


# =========================
# Teaching Skim（教学粗读）
# =========================

ConfidenceLevel = Literal["from_text", "inferred", "needs_verify"]
TeachingSkimGroup = Literal["why", "insight", "what", "how", "results", "takeaways"]
TeachingSkimNextStepType = Literal[
    "one_pager_diagram",
    "algorithm_walkthrough",
    "compare_with",
    "reproduction_plan",
    "ablation_audit",
    "transfer_to_llm",
    "implementation_notes",
]


class TeachingSkimAnchorCandidate(BaseModel):
    anchor_id: str
    type: Optional[str] = None  # section/figure/table/equation/paragraph
    section: Optional[str] = None
    page: Optional[int] = None
    snippet: Optional[str] = None  # caption/text 截断


class TeachingSkimCard(BaseModel):
    id: str
    group: TeachingSkimGroup
    title: str
    one_liner: str
    key_points: List[str] = Field(default_factory=list)
    why_it_matters: str = ""
    evidence_anchors: List[str] = Field(default_factory=list)
    confidence: ConfidenceLevel = "inferred"


class TeachingSkimTable(BaseModel):
    id: str
    title: str
    columns: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)
    evidence_anchors: List[str] = Field(default_factory=list)


class TeachingSkimNextStep(BaseModel):
    id: str
    type: TeachingSkimNextStepType
    title: str
    goal: str = ""
    deliverable: str = ""
    estimated_time: str = ""
    inputs_required: List[str] = Field(default_factory=list)


class TeachingSkimRouteScope(BaseModel):
    type: Literal["route", "full"] = "route"
    sections: List[str] = Field(default_factory=list)


class TeachingSkimPack(BaseModel):
    version: str = "teaching_skim_v1"
    paper_id: str
    route_scope: TeachingSkimRouteScope
    cards: List[TeachingSkimCard] = Field(default_factory=list)
    tables: List[TeachingSkimTable] = Field(default_factory=list)
    next_steps: List[TeachingSkimNextStep] = Field(default_factory=list)


class TeachingSkimGenerateRequest(BaseModel):
    paper_id: str
    route_scope: TeachingSkimRouteScope
    paper_meta: Dict[str, Any] = Field(default_factory=dict)
    skim_card: Dict[str, Any] = Field(default_factory=dict)
    key_figures: List[Dict[str, Any]] = Field(default_factory=list)
    section_summaries: Dict[str, Any] = Field(default_factory=dict)
    evidence_anchor_candidates: List[TeachingSkimAnchorCandidate] = Field(default_factory=list)


class TeachingSkimGenerateResponse(BaseModel):
    teaching_skim: TeachingSkimPack
