"""
卡片数据模型

卡片是用户阅读产出的结构化资产：
- PaperCard: 论文总结
- EvidenceCard: 证据卡
- MethodCard: 方法卡
"""
from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


class CardType(str, Enum):
    """卡片类型"""
    PAPER = "paper"           # 论文总结卡
    EVIDENCE = "evidence"     # 证据卡
    METHOD = "method"         # 方法卡
    NOTE = "note"             # 普通笔记


class CardStatus(str, Enum):
    """卡片状态"""
    DRAFT = "draft"     # 草稿
    FINAL = "final"     # 定稿


class UncertaintyLevel(str, Enum):
    """不确定性级别"""
    FROM_TEXT = "from_text"       # 来自原文
    INFERRED = "inferred"         # AI推测
    NEEDS_VERIFY = "needs_verify" # 需要确认


class Card(BaseModel):
    """卡片基类"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_id: str
    type: CardType
    
    # 内容
    title: str
    content: str  # Markdown格式
    
    # 来源追溯
    source_anchor_ids: List[str] = Field(default_factory=list)
    uncertainty: UncertaintyLevel = UncertaintyLevel.FROM_TEXT
    
    # 标签和分类
    tags: List[str] = Field(default_factory=list)
    
    # 状态
    status: CardStatus = CardStatus.DRAFT
    
    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # 版本控制（可选）
    version: int = 1
    
    class Config:
        use_enum_values = True


class PaperCard(Card):
    """论文总结卡"""
    type: CardType = CardType.PAPER
    
    # 一句话总结
    one_line_summary: str = ""
    
    # 贡献点（3-5条）
    contributions: List[str] = Field(default_factory=list)
    
    # 局限性（2-3条）
    limitations: List[str] = Field(default_factory=list)
    
    # 适用范围
    applicable_scope: str = ""
    
    # 关键词
    keywords: List[str] = Field(default_factory=list)


class EvidenceCard(Card):
    """证据卡 - 主张与证据对"""
    type: CardType = CardType.EVIDENCE
    
    # 主张
    claim: str = ""
    
    # 证据描述
    evidence: str = ""
    
    # 证据强度
    evidence_strength: str = "medium"  # strong/medium/weak
    
    # 替代解释
    alternative_explanations: List[str] = Field(default_factory=list)
    
    # 风险点
    risks: List[str] = Field(default_factory=list)
    
    # 关联图表锚点
    figure_anchor_ids: List[str] = Field(default_factory=list)


class MethodCard(Card):
    """方法卡"""
    type: CardType = CardType.METHOD
    
    # 方法名称
    method_name: str = ""
    
    # 输入
    inputs: List[str] = Field(default_factory=list)
    
    # 输出
    outputs: List[str] = Field(default_factory=list)
    
    # 假设
    assumptions: List[str] = Field(default_factory=list)
    
    # 流程描述
    process: str = ""
    
    # 伪代码
    pseudocode: str = ""
    
    # 复杂度
    complexity: str = ""
    
    # 关键公式锚点
    equation_anchor_ids: List[str] = Field(default_factory=list)


class NoteCard(Card):
    """普通笔记卡"""
    type: CardType = CardType.NOTE
    
    # 笔记类型
    note_type: str = "general"  # general/question/idea/todo
    
    # 相关卡片
    related_card_ids: List[str] = Field(default_factory=list)


