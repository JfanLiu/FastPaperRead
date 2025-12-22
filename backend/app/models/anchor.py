"""
锚点数据模型 - 核心系统

锚点是连接原文与所有结构化内容的桥梁：
- 每个段落、图表、公式、表格都有对应的锚点
- 卡片、清单、解释都通过锚点关联到原文
- 支持精确定位和可追溯
"""
from enum import Enum
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from pydantic import BaseModel, Field
import uuid


class AnchorType(str, Enum):
    """锚点类型"""
    PARAGRAPH = "paragraph"    # 段落
    SECTION = "section"        # 章节标题
    FIGURE = "figure"          # 图表
    TABLE = "table"            # 表格
    EQUATION = "equation"      # 公式
    CITATION = "citation"      # 引用
    ALGORITHM = "algorithm"    # 算法/伪代码
    CODE = "code"              # 代码块
    LIST = "list"              # 列表


class BoundingBox(BaseModel):
    """边界框"""
    x1: float  # 左上角x (0-1 归一化)
    y1: float  # 左上角y
    x2: float  # 右下角x
    y2: float  # 右下角y
    
    def to_tuple(self) -> Tuple[float, float, float, float]:
        return (self.x1, self.y1, self.x2, self.y2)
    
    @classmethod
    def from_tuple(cls, t: Tuple[float, float, float, float]) -> "BoundingBox":
        return cls(x1=t[0], y1=t[1], x2=t[2], y2=t[3])


class Anchor(BaseModel):
    """
    锚点模型
    
    锚点是系统的核心数据结构，用于：
    1. 定位原文中的内容（页码+边界框）
    2. 关联派生内容（卡片、解释、清单项）
    3. 支持点击跳转和高亮
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_id: str
    
    # 类型
    type: AnchorType
    
    # 位置信息
    page: int                    # 页码（从1开始）
    bbox: Optional[BoundingBox] = None  # 边界框（PDF坐标）
    
    # 结构信息
    section: Optional[str] = None       # 所属章节
    section_level: int = 0              # 章节层级 (0=顶级)
    sequence: int = 0                   # 在文档中的顺序
    
    # 内容
    text: str = ""                      # 文本内容
    caption: Optional[str] = None       # 标题（图表用）
    
    # 图表专用
    image_path: Optional[str] = None    # 图片文件路径
    figure_number: Optional[str] = None # 图号（如 "Figure 1"）
    
    # 公式专用
    latex: Optional[str] = None         # LaTeX源码
    equation_number: Optional[str] = None  # 公式编号
    symbols: List[str] = Field(default_factory=list)  # 符号列表
    
    # 表格专用
    table_data: Optional[Dict[str, Any]] = None  # 表格数据（JSON）
    
    # 引用专用
    ref_id: Optional[str] = None        # 参考文献ID
    ref_text: Optional[str] = None      # 引用文本
    
    # 元数据
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # 关联的派生内容
    card_ids: List[str] = Field(default_factory=list)
    explanation_cache: Optional[Dict[str, str]] = None  # 缓存的解释
    
    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        use_enum_values = True
    
    def get_location_key(self) -> str:
        """获取位置唯一键，用于去重"""
        return f"{self.paper_id}:{self.page}:{self.type}:{self.sequence}"


class AnchorGroup(BaseModel):
    """锚点组 - 用于章节等层级结构"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_id: str
    name: str
    anchor_ids: List[str] = Field(default_factory=list)
    parent_id: Optional[str] = None
    children_ids: List[str] = Field(default_factory=list)
    level: int = 0


class SectionTree(BaseModel):
    """章节树结构"""
    paper_id: str
    sections: List["SectionNode"] = Field(default_factory=list)


class SectionNode(BaseModel):
    """章节节点"""
    id: str
    title: str
    level: int  # 1=H1, 2=H2, 3=H3
    anchor_id: str  # 对应的锚点ID
    page: int
    children: List["SectionNode"] = Field(default_factory=list)
    
    # 阅读状态
    is_read: bool = False
    is_must_read: bool = False  # 是否为必读章节


# 解决循环引用
SectionNode.model_rebuild()
SectionTree.model_rebuild()


