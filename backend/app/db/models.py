"""
SQLAlchemy 数据库模型
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from .base import Base


class PaperStatus(str, enum.Enum):
    IMPORTING = "importing"
    PARSING = "parsing"
    UNREAD = "unread"
    SKIMMED = "skimmed"
    DEEPREAD = "deepread"
    ARCHIVED = "archived"


class AnchorType(str, enum.Enum):
    PARAGRAPH = "paragraph"
    SECTION = "section"
    FIGURE = "figure"
    TABLE = "table"
    EQUATION = "equation"
    CITATION = "citation"


class CardType(str, enum.Enum):
    PAPER = "paper"
    EVIDENCE = "evidence"
    METHOD = "method"
    NOTE = "note"


def generate_uuid():
    return str(uuid.uuid4())


class PaperModel(Base):
    """论文表"""
    __tablename__ = "papers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    # 元数据
    title = Column(String(500), nullable=False)
    authors = Column(JSON, default=list)
    year = Column(Integer, nullable=True)
    venue = Column(String(200), nullable=True)
    abstract = Column(Text, nullable=True)
    keywords = Column(JSON, default=list)
    
    # 来源
    source_type = Column(String(20), default="pdf")
    source_value = Column(String(500), default="")
    
    # 文件路径
    pdf_path = Column(String(500), nullable=True)
    markdown_path = Column(String(500), nullable=True)
    
    # 状态
    status = Column(SQLEnum(PaperStatus), default=PaperStatus.IMPORTING)
    quality_grade = Column(String(1), nullable=True)
    repro_status = Column(String(20), nullable=True)
    
    # 阅读进度
    current_section = Column(String(200), nullable=True)
    read_progress = Column(Float, default=0.0)
    
    # 扩展元数据（用于存储批注、方法流程缓存等）
    extra_data = Column(JSON, default=dict)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_read_at = Column(DateTime, nullable=True)
    
    # 关系
    anchors = relationship("AnchorModel", back_populates="paper", cascade="all, delete-orphan")
    cards = relationship("CardModel", back_populates="paper", cascade="all, delete-orphan")
    checklists = relationship("ChecklistModel", back_populates="paper", cascade="all, delete-orphan")
    skim_card = relationship("SkimCardModel", back_populates="paper", uselist=False, cascade="all, delete-orphan")


class AnchorModel(Base):
    """锚点表"""
    __tablename__ = "anchors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False)
    
    # 类型
    type = Column(SQLEnum(AnchorType), nullable=False)
    
    # 位置
    page = Column(Integer, default=1)
    bbox = Column(JSON, nullable=True)
    
    # 结构
    section = Column(String(200), nullable=True)
    section_level = Column(Integer, default=0)
    sequence = Column(Integer, default=0)
    
    # 内容
    text = Column(Text, default="")
    caption = Column(Text, nullable=True)
    
    # 图表专用
    image_path = Column(String(500), nullable=True)
    figure_number = Column(String(50), nullable=True)
    
    # 公式专用
    latex = Column(Text, nullable=True)
    equation_number = Column(String(50), nullable=True)
    symbols = Column(JSON, default=list)
    
    # 表格专用
    table_data = Column(JSON, nullable=True)
    
    # 引用专用
    ref_id = Column(String(100), nullable=True)
    ref_text = Column(Text, nullable=True)
    
    # 元数据
    anchor_metadata = Column(JSON, default=dict)
    
    # 缓存
    explanation_cache = Column(JSON, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    paper = relationship("PaperModel", back_populates="anchors")


class CardModel(Base):
    """卡片表"""
    __tablename__ = "cards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False)
    
    # 类型
    type = Column(SQLEnum(CardType), nullable=False)
    
    # 内容
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    
    # 来源
    source_anchor_ids = Column(JSON, default=list)
    uncertainty = Column(String(20), default="from_text")
    
    # 标签
    tags = Column(JSON, default=list)
    
    # 状态
    status = Column(String(20), default="draft")
    version = Column(Integer, default=1)
    
    # PaperCard专用
    one_line_summary = Column(Text, nullable=True)
    contributions = Column(JSON, nullable=True)
    limitations = Column(JSON, nullable=True)
    applicable_scope = Column(Text, nullable=True)
    
    # EvidenceCard专用
    claim = Column(Text, nullable=True)
    evidence = Column(Text, nullable=True)
    evidence_strength = Column(String(20), nullable=True)
    alternative_explanations = Column(JSON, nullable=True)
    risks = Column(JSON, nullable=True)
    figure_anchor_ids = Column(JSON, nullable=True)
    
    # MethodCard专用
    method_name = Column(String(200), nullable=True)
    inputs = Column(JSON, nullable=True)
    outputs = Column(JSON, nullable=True)
    assumptions = Column(JSON, nullable=True)
    process = Column(Text, nullable=True)
    pseudocode = Column(Text, nullable=True)
    complexity = Column(String(100), nullable=True)
    equation_anchor_ids = Column(JSON, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    paper = relationship("PaperModel", back_populates="cards")


class ChecklistModel(Base):
    """复现清单表"""
    __tablename__ = "checklists"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False)
    
    # 条目
    items = Column(JSON, default=list)
    
    # 统计
    total_items = Column(Integer, default=0)
    found_items = Column(Integer, default=0)
    missing_items = Column(Integer, default=0)
    
    # 评估
    completeness_score = Column(Float, default=0.0)
    repro_verdict = Column(String(20), default="unknown")
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    paper = relationship("PaperModel", back_populates="checklists")


class SkimCardModel(Base):
    """SkimCard表"""
    __tablename__ = "skim_cards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False, unique=True)
    
    # 内容
    research_question = Column(Text, default="")
    contributions = Column(JSON, default=list)
    evidence_strength = Column(String(20), default="medium")
    evidence_strength_reason = Column(Text, default="")
    red_flags = Column(JSON, default=list)
    recommended_route = Column(String(50), default="review")
    recommended_sections = Column(JSON, default=list)
    key_figures = Column(JSON, default=list)
    
    # 来源
    source_anchor_ids = Column(JSON, default=list)
    
    # 时间戳
    generated_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    paper = relationship("PaperModel", back_populates="skim_card")


class ImportJobModel(Base):
    """导入任务表"""
    __tablename__ = "import_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), nullable=False)
    
    # 状态
    status = Column(String(20), default="pending")
    progress = Column(Float, default=0.0)
    current_step = Column(String(100), default="")
    steps = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class ReadingQueueModel(Base):
    """阅读队列表"""
    __tablename__ = "reading_queue"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False, unique=True)
    
    # 优先级和顺序
    priority = Column(Integer, default=0)  # 越大越优先
    position = Column(Integer, default=0)  # 队列位置
    
    # 备注
    note = Column(Text, nullable=True)
    
    # 时间戳
    added_at = Column(DateTime, default=datetime.utcnow)


class CompareSetModel(Base):
    """论文对比集合表"""
    __tablename__ = "compare_sets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False)
    paper_ids = Column(JSON, default=list)
    dimensions = Column(JSON, default=list)
    
    # 对比结果缓存
    matrix = Column(JSON, nullable=True)
    conflicts = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CardAnchorLinkModel(Base):
    """卡片-锚点关联表"""
    __tablename__ = "card_anchor_links"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    card_id = Column(String(36), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False)
    
    # 关联类型：source=卡片来源锚点, reference=卡片引用锚点
    link_type = Column(String(20), default="source")
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewModel(Base):
    """审稿记录表"""
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False, unique=True)
    
    # 审稿草稿
    summary = Column(Text, nullable=True)
    strengths = Column(JSON, default=list)
    weaknesses = Column(JSON, default=list)
    questions = Column(JSON, default=list)
    minor_issues = Column(JSON, default=list)
    recommendation = Column(String(50), default="pending")
    raw_text = Column(Text, nullable=True)
    
    # 评分
    novelty_score = Column(Integer, nullable=True)
    novelty_reason = Column(Text, nullable=True)
    soundness_score = Column(Integer, nullable=True)
    soundness_reason = Column(Text, nullable=True)
    clarity_score = Column(Integer, nullable=True)
    clarity_reason = Column(Text, nullable=True)
    significance_score = Column(Integer, nullable=True)
    significance_reason = Column(Text, nullable=True)
    reproducibility_score = Column(Integer, nullable=True)
    reproducibility_reason = Column(Text, nullable=True)
    total_score = Column(Float, nullable=True)
    
    # 时间戳
    generated_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalyticsEventModel(Base):
    """分析事件表 - 埋点记录"""
    __tablename__ = "analytics_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    # 事件信息
    event_type = Column(String(50), nullable=False, index=True)  # 事件类型
    event_name = Column(String(100), nullable=False, index=True)  # 事件名称
    
    # 关联实体
    paper_id = Column(String(36), ForeignKey("papers.id", ondelete="SET NULL"), nullable=True, index=True)
    card_id = Column(String(36), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="SET NULL"), nullable=True)
    
    # 事件数据
    properties = Column(JSON, default=dict)  # 事件属性
    value = Column(Float, nullable=True)  # 数值（如时长、计数等）
    
    # 上下文
    page = Column(String(100), nullable=True)  # 页面
    session_id = Column(String(36), nullable=True)  # 会话ID
    user_agent = Column(String(500), nullable=True)  # 用户代理
    
    # 时间戳
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

