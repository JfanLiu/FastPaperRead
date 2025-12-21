"""
Skim相关的Pydantic Schema
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class SkimCardResponse(BaseModel):
    """SkimCard响应"""
    research_question: str = ""
    contributions: List[str] = Field(default_factory=list)
    evidence_strength: str = "medium"
    evidence_strength_reason: str = ""
    red_flags: List[str] = Field(default_factory=list)
    recommended_route: str = "review"
    recommended_sections: List[str] = Field(default_factory=list)
    key_figures: List[str] = Field(default_factory=list)


class SkimDecisionRequest(BaseModel):
    """阅读决策请求"""
    decision: str = Field(..., description="deep_read / focused_read / skip / archive")
    quality_grade: Optional[str] = Field(None, description="质量评分: A/B/C/D")
    notes: Optional[str] = Field(None, description="备注")


class SkimGenerateRequest(BaseModel):
    """生成SkimCard请求"""
    force: bool = Field(default=False, description="是否强制重新生成")
