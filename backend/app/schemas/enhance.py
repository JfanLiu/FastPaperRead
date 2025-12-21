"""
增强引擎相关的Pydantic Schema
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


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
