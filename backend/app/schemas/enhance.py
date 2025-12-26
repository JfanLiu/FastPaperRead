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


# =========================
# Skim Pack（统一粗读包）
# =========================

class SkimCardData(BaseModel):
    """SkimCard 数据"""
    research_question: str = ""
    contributions: List[str] = Field(default_factory=list)
    evidence_strength: str = "medium"
    evidence_strength_reason: str = ""
    red_flags: List[str] = Field(default_factory=list)
    recommended_route: str = "skim"
    recommended_sections: List[str] = Field(default_factory=list)


class KeyFigure(BaseModel):
    """关键图表信息"""
    id: str
    caption: str = ""
    importance: str = ""
    one_liner: str = ""


class SkimPackTeachingSkim(BaseModel):
    """粗读包中的 Teaching Skim 部分"""
    cards: List[TeachingSkimCard] = Field(default_factory=list)
    tables: List[TeachingSkimTable] = Field(default_factory=list)
    next_steps: List[TeachingSkimNextStep] = Field(default_factory=list)


class SkimPack(BaseModel):
    """统一粗读包"""
    version: str = "skim_pack_v1"
    paper_id: str
    skim_card: SkimCardData
    key_figures: List[KeyFigure] = Field(default_factory=list)
    teaching_skim: SkimPackTeachingSkim


class SkimPackRequest(BaseModel):
    """粗读包生成请求"""
    sections_outline: List[Dict[str, Any]] = Field(default_factory=list)


class SkimPackResponse(BaseModel):
    """粗读包生成响应"""
    skim_pack: SkimPack
    cached: bool = False


# =========================
# Deep Pack（统一精读包）
# =========================

class PaperCardData(BaseModel):
    """PaperCard 数据"""
    one_line_summary: str = ""
    contributions: List[str] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    applicable_scope: str = ""
    repro_risk: str = ""
    key_takeaways: List[str] = Field(default_factory=list)


class ClaimItem(BaseModel):
    """主张条目"""
    id: str
    text: str
    evidence_summary: str = ""
    evidence_type: str = "empirical"
    strength: str = "medium"
    uncertainty: str = "inferred"
    alternative_explanations: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    source_sections: List[str] = Field(default_factory=list)


class EvidenceLedgerData(BaseModel):
    """证据台账数据"""
    claims: List[ClaimItem] = Field(default_factory=list)
    overall_evidence_quality: str = "medium"
    key_assumptions: List[str] = Field(default_factory=list)
    methodology_concerns: List[str] = Field(default_factory=list)


class MethodStep(BaseModel):
    """方法步骤"""
    step: int
    name: str
    description: str = ""
    inputs: List[str] = Field(default_factory=list)
    outputs: List[str] = Field(default_factory=list)


class MethodFlowData(BaseModel):
    """方法流程数据"""
    method_name: str = ""
    overview: str = ""
    steps: List[MethodStep] = Field(default_factory=list)
    key_innovations: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    pseudocode: str = ""


class DatasetInfo(BaseModel):
    """数据集信息"""
    name: str
    description: str = ""
    size: str = ""
    split: str = ""


class MetricInfo(BaseModel):
    """指标信息"""
    name: str
    description: str = ""


class HyperparameterInfo(BaseModel):
    """超参数信息"""
    name: str
    value: str = ""
    description: str = ""


class TrainingDetails(BaseModel):
    """训练细节"""
    optimizer: str = ""
    learning_rate: str = ""
    batch_size: str = ""
    epochs: str = ""
    hardware: str = ""


class ExperimentSetupData(BaseModel):
    """实验设置数据"""
    datasets: List[DatasetInfo] = Field(default_factory=list)
    baselines: List[str] = Field(default_factory=list)
    metrics: List[MetricInfo] = Field(default_factory=list)
    hyperparameters: List[HyperparameterInfo] = Field(default_factory=list)
    training_details: Optional[TrainingDetails] = None
    reproducibility_notes: str = ""


class SectionSummaryLeveled(BaseModel):
    """三层章节摘要"""
    one_liner: str = ""
    plain: str = ""
    strict: str = ""


class DeepPack(BaseModel):
    """统一精读包"""
    version: str = "deep_pack_v1"
    paper_id: str
    paper_card: PaperCardData
    evidence_ledger: EvidenceLedgerData
    method_flow: MethodFlowData
    experiment_setup: ExperimentSetupData
    section_summaries: Dict[str, SectionSummaryLeveled] = Field(default_factory=dict)


class SectionInfo(BaseModel):
    """章节信息"""
    title: str
    content: str


class DeepPackRequest(BaseModel):
    """精读包生成请求"""
    sections: List[SectionInfo] = Field(default_factory=list)


class DeepPackResponse(BaseModel):
    """精读包生成响应"""
    deep_pack: DeepPack
    cached: bool = False


# =========================
# Batch Section Summary（批量章节摘要）
# =========================

class BatchSectionSummaryRequest(BaseModel):
    """批量章节摘要请求"""
    sections: List[SectionInfo]


class BatchSectionSummaryResponse(BaseModel):
    """批量章节摘要响应"""
    section_summaries: Dict[str, SectionSummaryLeveled]
