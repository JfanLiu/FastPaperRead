"""
论文数据模型
"""
from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


class PaperStatus(str, Enum):
    """论文状态"""
    IMPORTING = "importing"      # 导入中
    PARSING = "parsing"          # 解析中
    UNREAD = "unread"            # 未读
    SKIMMED = "skimmed"          # 已粗读
    DEEPREAD = "deepread"        # 已精读
    ARCHIVED = "archived"        # 已归档


class PaperSource(str, Enum):
    """论文来源"""
    PDF = "pdf"
    DOI = "doi"
    ARXIV = "arxiv"
    URL = "url"


class Paper(BaseModel):
    """论文模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # 元数据
    title: str
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    
    # 来源信息
    source_type: PaperSource = PaperSource.PDF
    source_value: str = ""  # URL/DOI/arXiv ID
    
    # 文件路径
    pdf_path: Optional[str] = None
    markdown_path: Optional[str] = None
    
    # 状态
    status: PaperStatus = PaperStatus.IMPORTING
    quality_grade: Optional[str] = None  # A/B/C/D
    repro_status: Optional[str] = None   # complete/partial/missing
    
    # 阅读进度
    current_section: Optional[str] = None
    read_progress: float = 0.0  # 0-100
    
    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_read_at: Optional[datetime] = None
    
    # 关联数据（IDs）
    anchor_ids: List[str] = Field(default_factory=list)
    card_ids: List[str] = Field(default_factory=list)
    
    class Config:
        use_enum_values = True


class PaperImportJob(BaseModel):
    """论文导入任务"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_id: str
    status: str = "pending"  # pending/running/completed/failed
    progress: float = 0.0
    current_step: str = ""
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # 解析进度
    steps: dict = Field(default_factory=lambda: {
        "download": "pending",
        "parse_text": "pending",
        "extract_sections": "pending",
        "extract_figures": "pending",
        "extract_equations": "pending",
        "extract_references": "pending",
        "generate_anchors": "pending"
    })


