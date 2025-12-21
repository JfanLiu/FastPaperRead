"""
论文相关的API Schema
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, HttpUrl


class PaperImportRequest(BaseModel):
    """论文导入请求"""
    # 支持多种导入方式
    pdf_url: Optional[str] = None
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    
    # 可选的预填元数据
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "pdf_url": "https://arxiv.org/pdf/2301.00001.pdf",
                "title": "Example Paper Title",
                "authors": ["Author One", "Author Two"]
            }
        }


class PaperImportResponse(BaseModel):
    """论文导入响应"""
    paper_id: str
    job_id: str
    status: str = "pending"
    message: str = "论文导入任务已创建"


class PaperMetadata(BaseModel):
    """论文元数据"""
    title: str
    authors: List[str] = []
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    keywords: List[str] = []


class PaperCreate(BaseModel):
    """创建论文"""
    title: str
    authors: List[str] = []
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    source_type: str = "pdf"
    source_value: str = ""


class PaperUpdate(BaseModel):
    """更新论文"""
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    status: Optional[str] = None
    quality_grade: Optional[str] = None
    current_section: Optional[str] = None
    read_progress: Optional[float] = None


class PaperResponse(BaseModel):
    """论文响应"""
    id: str
    title: str
    authors: List[str]
    year: Optional[int]
    venue: Optional[str]
    abstract: Optional[str]
    keywords: List[str]
    
    source_type: str
    source_value: str
    pdf_path: Optional[str]
    
    status: str
    quality_grade: Optional[str]
    repro_status: Optional[str]
    read_progress: float
    
    anchor_count: int = 0
    card_count: int = 0
    
    created_at: datetime
    updated_at: datetime
    last_read_at: Optional[datetime]


class PaperListResponse(BaseModel):
    """论文列表响应"""
    items: List[PaperResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class PaperParseStatusResponse(BaseModel):
    """解析状态响应"""
    paper_id: str
    job_id: str
    status: str  # pending/running/completed/failed
    progress: float  # 0-100
    current_step: str
    steps: dict
    error_message: Optional[str] = None


class PaperStatsResponse(BaseModel):
    """论文统计响应"""
    total: int
    unread: int
    skimmed: int
    deepread: int
    archived: int
    by_quality: dict  # {"A": 10, "B": 20, ...}
    by_year: dict     # {"2024": 5, "2023": 10, ...}

