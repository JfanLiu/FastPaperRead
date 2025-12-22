"""
锚点相关的API Schema
"""
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel, field_validator


class BoundingBoxSchema(BaseModel):
    """边界框"""
    x1: float
    y1: float
    x2: float
    y2: float


class AnchorResponse(BaseModel):
    """锚点响应"""
    id: str
    paper_id: str
    type: str  # paragraph/section/figure/table/equation/citation
    
    # 位置
    page: int
    bbox: Optional[BoundingBoxSchema] = None
    
    # 结构
    section: Optional[str] = None
    section_level: int = 0
    sequence: int = 0
    
    # 内容
    text: str
    caption: Optional[str] = None
    
    # 类型特定字段
    image_path: Optional[str] = None
    figure_number: Optional[str] = None
    latex: Optional[str] = None
    equation_number: Optional[str] = None
    symbols: List[str] = []
    table_data: Optional[Dict[str, Any]] = None
    ref_id: Optional[str] = None
    
    # 关联
    card_ids: List[str] = []
    
    # 缓存的解释
    cached_explanation: Optional[Dict[str, str]] = None


class AnchorListResponse(BaseModel):
    """锚点列表响应"""
    items: List[AnchorResponse]
    total: int
    
    # 按类型统计
    by_type: Dict[str, int] = {}


class AnchorsByPageResponse(BaseModel):
    """按页分组的锚点"""
    page: int
    anchors: List[AnchorResponse]


class SectionNodeSchema(BaseModel):
    """章节节点"""
    id: str
    title: str
    level: int
    anchor_id: str
    page: int
    children: List["SectionNodeSchema"] = []
    is_read: bool = False
    is_must_read: bool = False


# 解决循环引用
SectionNodeSchema.model_rebuild()


class SectionTreeResponse(BaseModel):
    """章节树响应"""
    paper_id: str
    sections: List[SectionNodeSchema]


class ReadingRouteResponse(BaseModel):
    """阅读路线响应"""
    name: str
    description: str
    sections: List[SectionNodeSchema]
    estimated_time: int  # 分钟
    total_sections: int


class AnchorSearchRequest(BaseModel):
    """锚点搜索请求"""
    query: str
    types: Optional[List[str]] = None  # 限定类型
    page_range: Optional[List[int]] = None  # [start, end]
    limit: int = 20
    
    @field_validator('page_range')
    @classmethod
    def validate_page_range(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        """验证 page_range 必须包含恰好 2 个元素 [start, end]"""
        if v is not None:
            if len(v) != 2:
                raise ValueError('page_range must contain exactly 2 elements [start, end]')
            start, end = v
            if start < 1:
                raise ValueError('page_range start must be >= 1')
            if end < start:
                raise ValueError('page_range end must be >= start')
        return v

