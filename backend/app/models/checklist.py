"""
复现清单数据模型
"""
from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid


class ChecklistGroup(str, Enum):
    """清单分组"""
    DATA = "data"               # 数据
    PREPROCESS = "preprocess"   # 预处理
    TRAINING = "training"       # 训练
    EVALUATION = "evaluation"   # 评估
    ENVIRONMENT = "environment" # 环境


class ItemStatus(str, Enum):
    """条目状态"""
    FOUND = "found"           # 已找到
    MISSING = "missing"       # 缺失
    INFERRED = "inferred"     # 推测
    NEEDS_VERIFY = "needs_verify"  # 需确认


class ChecklistItem(BaseModel):
    """清单条目"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group: ChecklistGroup
    
    # 内容
    name: str                    # 条目名称（如"学习率"）
    value: Optional[str] = None  # 值（如"1e-4"）
    description: str = ""        # 描述
    
    # 来源追溯
    source_anchor_id: Optional[str] = None
    status: ItemStatus = ItemStatus.FOUND
    
    # 重要性
    is_critical: bool = False  # 是否关键项
    
    class Config:
        use_enum_values = True


class ReproChecklist(BaseModel):
    """复现清单"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_id: str
    
    # 条目列表
    items: List[ChecklistItem] = Field(default_factory=list)
    
    # 统计
    total_items: int = 0
    found_items: int = 0
    missing_items: int = 0
    
    # 复现评估
    completeness_score: float = 0.0  # 0-100
    repro_verdict: str = "unknown"   # complete/partial/missing/unknown
    
    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def update_stats(self):
        """更新统计数据"""
        self.total_items = len(self.items)
        self.found_items = len([i for i in self.items if i.status == ItemStatus.FOUND])
        self.missing_items = len([i for i in self.items if i.status == ItemStatus.MISSING])
        
        if self.total_items > 0:
            self.completeness_score = (self.found_items / self.total_items) * 100
        
        # 计算复现评估
        if self.completeness_score >= 90:
            self.repro_verdict = "complete"
        elif self.completeness_score >= 60:
            self.repro_verdict = "partial"
        else:
            self.repro_verdict = "missing"
    
    def get_items_by_group(self, group: ChecklistGroup) -> List[ChecklistItem]:
        """按分组获取条目"""
        return [item for item in self.items if item.group == group]
    
    def get_missing_items(self) -> List[ChecklistItem]:
        """获取缺失条目"""
        return [item for item in self.items if item.status == ItemStatus.MISSING]


# 预定义的检查项模板
CHECKLIST_TEMPLATES = {
    ChecklistGroup.DATA: [
        {"name": "数据集名称", "is_critical": True},
        {"name": "数据集大小", "is_critical": True},
        {"name": "训练/验证/测试划分", "is_critical": True},
        {"name": "数据来源/下载链接", "is_critical": False},
        {"name": "数据预处理步骤", "is_critical": False},
    ],
    ChecklistGroup.PREPROCESS: [
        {"name": "输入尺寸/维度", "is_critical": True},
        {"name": "归一化方法", "is_critical": False},
        {"name": "数据增强策略", "is_critical": False},
        {"name": "tokenization方法", "is_critical": False},
    ],
    ChecklistGroup.TRAINING: [
        {"name": "模型架构", "is_critical": True},
        {"name": "参数量", "is_critical": False},
        {"name": "优化器", "is_critical": True},
        {"name": "学习率", "is_critical": True},
        {"name": "学习率调度", "is_critical": False},
        {"name": "batch size", "is_critical": True},
        {"name": "训练轮数/步数", "is_critical": True},
        {"name": "正则化方法", "is_critical": False},
        {"name": "随机种子", "is_critical": False},
    ],
    ChecklistGroup.EVALUATION: [
        {"name": "评估指标", "is_critical": True},
        {"name": "评估数据集", "is_critical": True},
        {"name": "baseline方法", "is_critical": True},
        {"name": "统计显著性检验", "is_critical": False},
        {"name": "消融实验", "is_critical": False},
    ],
    ChecklistGroup.ENVIRONMENT: [
        {"name": "硬件配置(GPU型号)", "is_critical": False},
        {"name": "框架版本", "is_critical": True},
        {"name": "关键依赖版本", "is_critical": False},
        {"name": "训练时间", "is_critical": False},
        {"name": "代码仓库", "is_critical": False},
    ],
}

