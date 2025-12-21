"""
论文相关的Pydantic Schema
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class PaperStatus(str, Enum):
    IMPORTING = "importing"
    PARSING = "parsing"
    UNREAD = "unread"
    SKIMMED = "skimmed"
    DEEPREAD = "deepread"
    ARCHIVED = "archived"


class PaperSource(BaseModel):
    """论文来源"""
    type: str = Field(default="pdf", description="来源类型: pdf, arxiv, doi, url")
    value: str = Field(default="", description="来源值")


class PaperBase(BaseModel):
    """论文基础字段"""
    title: str = Field(..., max_length=500)
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)


class PaperCreate(PaperBase):
    """创建论文"""
    source_type: str = "pdf"
    source_value: str = ""


class PaperUpdate(BaseModel):
    """更新论文"""
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    keywords: Optional[List[str]] = None
    quality_grade: Optional[str] = None
    status: Optional[str] = None


class PaperInDB(PaperBase):
    """数据库中的论文"""
    id: str
    source_type: str = "pdf"
    source_value: str = ""
    pdf_path: Optional[str] = None
    markdown_path: Optional[str] = None
    status: str = "importing"
    quality_grade: Optional[str] = None
    repro_status: Optional[str] = None
    current_section: Optional[str] = None
    read_progress: float = 0.0
    created_at: datetime
    updated_at: datetime
    last_read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaperListResponse(BaseModel):
    """论文列表响应"""
    papers: List[PaperInDB]
    total: int
    skip: int
    limit: int


class PaperStats(BaseModel):
    """论文统计"""
    total: int
    unread: int
    skimmed: int
    deepread: int
    archived: int
    by_quality: Dict[str, int]
    by_year: Dict[str, int]
