"""
增强引擎相关的API Schema
"""
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ExplanationLevel(str, Enum):
    """解释级别"""
    ONE_LINER = "one_liner"   # 一句话（10字以内）
    PLAIN = "plain"           # 通俗版（100字，带类比）
    STRICT = "strict"         # 严格版（学术定义+公式）


class EnhanceType(str, Enum):
    """增强类型"""
    TERM = "term"             # 术语解释
    EQUATION = "equation"     # 公式解释
    FIGURE = "figure"         # 图表解释
    PARAGRAPH = "paragraph"   # 段落总结
    MISSING_DETAIL = "missing_detail"  # 缺失细节


class EnhanceRequest(BaseModel):
    """增强请求"""
    paper_id: str
    anchor_id: str
    enhance_type: EnhanceType
    level: ExplanationLevel = ExplanationLevel.PLAIN
    
    # 可选的额外上下文
    selected_text: Optional[str] = None
    context_anchor_ids: Optional[List[str]] = None
    
    # 是否使用缓存
    use_cache: bool = True


class TermExplanationResponse(BaseModel):
    """术语解释响应"""
    term: str
    one_liner: str
    plain: str
    strict: str
    source_anchor_id: str
    uncertainty: str  # from_text/inferred/needs_verify
    related_terms: List[str] = []


class EquationExplanationResponse(BaseModel):
    """公式解释响应"""
    latex: str
    symbol_table: Dict[str, str]  # 符号 -> 含义
    key_assumptions: List[str]
    derivation_steps: List[str]
    plain_explanation: str
    source_anchor_id: str
    uncertainty: str


class FigureExplanationResponse(BaseModel):
    """图表解释响应"""
    figure_number: str
    caption: str
    what_it_shows: str          # 图想证明什么
    evidence_assessment: str    # 证据是否充分
    alternative_explanations: List[str]  # 替代解释
    key_observations: List[str]
    source_anchor_id: str
    uncertainty: str


class ParagraphSummaryResponse(BaseModel):
    """段落总结响应"""
    original_text: str
    one_liner: str
    plain_summary: str
    strict_summary: str
    key_points: List[str]
    source_anchor_id: str


class MissingDetailResponse(BaseModel):
    """缺失细节响应"""
    category: str  # data/training/eval/env
    detail_name: str
    inferred_value: Optional[str]  # 推测的值
    confidence: str  # high/medium/low
    source_hint: str  # 在原文哪里可能找到
    needs_verify: bool


class EnhanceResponse(BaseModel):
    """通用增强响应"""
    enhance_type: str
    anchor_id: str
    
    # 根据类型返回不同内容
    term: Optional[TermExplanationResponse] = None
    equation: Optional[EquationExplanationResponse] = None
    figure: Optional[FigureExplanationResponse] = None
    paragraph: Optional[ParagraphSummaryResponse] = None
    missing_details: Optional[List[MissingDetailResponse]] = None
    
    # 元信息
    cached: bool = False
    processing_time_ms: int = 0


class BatchEnhanceRequest(BaseModel):
    """批量增强请求"""
    paper_id: str
    items: List[Dict[str, Any]]  # [{anchor_id, enhance_type, level}, ...]


class MissingDetailScanRequest(BaseModel):
    """缺失细节扫描请求"""
    paper_id: str
    categories: Optional[List[str]] = None  # data/training/eval/env
    
    # 扫描范围
    section_ids: Optional[List[str]] = None
    full_scan: bool = True


class MissingDetailScanResponse(BaseModel):
    """缺失细节扫描响应"""
    paper_id: str
    total_checked: int
    missing_count: int
    completeness_score: float  # 0-100
    
    # 按类别分组
    by_category: Dict[str, List[MissingDetailResponse]]
    
    # 建议查找位置
    suggested_sections: List[str]

