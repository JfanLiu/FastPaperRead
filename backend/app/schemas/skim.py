"""
粗读(Skim)相关的API Schema
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class SkimCardResponse(BaseModel):
    """SkimCard响应 - 粗读卡片"""
    paper_id: str
    
    # 研究问题
    research_question: str
    
    # 贡献点（3-5条）
    contributions: List[str]
    
    # 证据强度
    evidence_strength: str  # strong/medium/weak
    evidence_strength_reason: str
    
    # 红旗（风险点）
    red_flags: List[str]
    
    # 推荐阅读路线
    recommended_route: str  # quick_repro/review/full
    recommended_sections: List[str]
    key_figures: List[str]  # 关键图表的anchor_id
    
    # 元信息
    generated_at: datetime
    source_anchor_ids: List[str]


class SkimDecisionRequest(BaseModel):
    """粗读决策请求"""
    paper_id: str
    decision: str  # archive/queue/deepread
    
    # 归档原因（如果decision=archive）
    archive_reasons: Optional[List[str]] = None  # not_relevant/weak_evidence/repro_risk/duplicate/no_time
    archive_note: Optional[str] = None
    
    # 队列配置（如果decision=queue）
    queue_priority: Optional[str] = None  # high/medium/low
    estimated_time: Optional[int] = None  # 分钟
    reading_goal: Optional[str] = None  # method/experiment/full
    
    # 精读路线（如果decision=deepread）
    reading_route: Optional[str] = None  # quick_repro/review/full/custom


class SkimDecisionResponse(BaseModel):
    """粗读决策响应"""
    paper_id: str
    decision: str
    status: str  # 更新后的论文状态
    message: str
    next_action: str  # 建议的下一步操作


class KeyFigureResponse(BaseModel):
    """关键图表响应"""
    anchor_id: str
    figure_number: str
    caption: str
    image_url: str
    page: int
    relevance_score: float  # 0-1


class RelatedPaperResponse(BaseModel):
    """相关论文响应"""
    id: str
    title: str
    authors: List[str]
    year: int
    relation_type: str  # classic/recent/similar/contrasting
    relevance_reason: str


class LiteratureMapResponse(BaseModel):
    """文献地图响应"""
    paper_id: str
    
    # 四类推荐
    classic: List[RelatedPaperResponse]      # 经典论文
    recent: List[RelatedPaperResponse]       # 最新论文
    similar: List[RelatedPaperResponse]      # 同类论文
    contrasting: List[RelatedPaperResponse]  # 对立观点
    
    # 统计
    total_related: int


class SkimGenerateRequest(BaseModel):
    """生成SkimCard请求"""
    paper_id: str
    force_regenerate: bool = False  # 强制重新生成


class QueueItemResponse(BaseModel):
    """待读队列项"""
    paper_id: str
    title: str
    authors: List[str]
    priority: str
    estimated_time: int
    reading_goal: str
    added_at: datetime
    
    # SkimCard摘要
    one_line_summary: Optional[str] = None
    quality_grade: Optional[str] = None

