"""
卡片相关的API Schema
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class CardCreate(BaseModel):
    """创建卡片"""
    paper_id: str
    type: str  # paper/evidence/method/note
    title: str
    content: str
    source_anchor_ids: List[str] = []
    uncertainty: str = "from_text"  # from_text/inferred/needs_verify
    tags: List[str] = []
    
    # 类型特定字段
    # PaperCard
    one_line_summary: Optional[str] = None
    contributions: Optional[List[str]] = None
    limitations: Optional[List[str]] = None
    applicable_scope: Optional[str] = None
    
    # EvidenceCard
    claim: Optional[str] = None
    evidence: Optional[str] = None
    evidence_strength: Optional[str] = None
    alternative_explanations: Optional[List[str]] = None
    risks: Optional[List[str]] = None
    figure_anchor_ids: Optional[List[str]] = None
    
    # MethodCard
    method_name: Optional[str] = None
    inputs: Optional[List[str]] = None
    outputs: Optional[List[str]] = None
    assumptions: Optional[List[str]] = None
    process: Optional[str] = None
    pseudocode: Optional[str] = None
    complexity: Optional[str] = None
    equation_anchor_ids: Optional[List[str]] = None


class CardUpdate(BaseModel):
    """更新卡片"""
    title: Optional[str] = None
    content: Optional[str] = None
    source_anchor_ids: Optional[List[str]] = None
    uncertainty: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None  # draft/final
    
    # 类型特定字段可选更新
    one_line_summary: Optional[str] = None
    contributions: Optional[List[str]] = None
    limitations: Optional[List[str]] = None
    claim: Optional[str] = None
    evidence: Optional[str] = None
    evidence_strength: Optional[str] = None


class CardResponse(BaseModel):
    """卡片响应"""
    id: str
    paper_id: str
    type: str
    title: str
    content: str
    source_anchor_ids: List[str]
    uncertainty: str
    tags: List[str]
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    
    # 类型特定字段
    one_line_summary: Optional[str] = None
    contributions: Optional[List[str]] = None
    limitations: Optional[List[str]] = None
    applicable_scope: Optional[str] = None
    keywords: Optional[List[str]] = None
    
    claim: Optional[str] = None
    evidence: Optional[str] = None
    evidence_strength: Optional[str] = None
    alternative_explanations: Optional[List[str]] = None
    risks: Optional[List[str]] = None
    figure_anchor_ids: Optional[List[str]] = None
    
    method_name: Optional[str] = None
    inputs: Optional[List[str]] = None
    outputs: Optional[List[str]] = None
    assumptions: Optional[List[str]] = None
    process: Optional[str] = None
    pseudocode: Optional[str] = None
    complexity: Optional[str] = None
    equation_anchor_ids: Optional[List[str]] = None


class CardListResponse(BaseModel):
    """卡片列表响应"""
    items: List[CardResponse]
    total: int
    by_type: dict = {}


class CardFromAnchorRequest(BaseModel):
    """从锚点创建卡片请求"""
    anchor_id: str
    card_type: str  # evidence/method/note
    auto_generate: bool = True  # 是否自动生成内容


class CardSearchRequest(BaseModel):
    """卡片搜索请求"""
    query: str
    types: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    paper_ids: Optional[List[str]] = None
    status: Optional[str] = None
    limit: int = 20
    offset: int = 0

