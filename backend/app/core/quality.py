"""
论文质量评估服务

提供质量打分和红旗规则检测
"""
import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("fastpaperread.quality")


class QualityGrade(str, Enum):
    """质量等级"""
    A = "A"  # 高质量
    B = "B"  # 良好
    C = "C"  # 一般
    D = "D"  # 较差
    F = "F"  # 问题严重


class RedFlagSeverity(str, Enum):
    """红旗严重程度"""
    HIGH = "high"      # 严重问题
    MEDIUM = "medium"  # 中等问题
    LOW = "low"        # 轻微问题


@dataclass
class RedFlag:
    """红旗警告"""
    type: str
    message: str
    severity: RedFlagSeverity
    details: Optional[str] = None


@dataclass
class QualityScore:
    """质量评分结果"""
    overall_score: float  # 0-100
    grade: QualityGrade
    dimensions: Dict[str, float] = field(default_factory=dict)
    red_flags: List[RedFlag] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "grade": self.grade.value,
            "dimensions": self.dimensions,
            "red_flags": [
                {
                    "type": rf.type,
                    "message": rf.message,
                    "severity": rf.severity.value,
                    "details": rf.details
                }
                for rf in self.red_flags
            ],
            "suggestions": self.suggestions
        }


class QualityEvaluator:
    """质量评估器"""
    
    # 红旗规则定义
    RED_FLAG_RULES = [
        {
            "type": "missing_abstract",
            "check": lambda d: not d.get("abstract") or len(d.get("abstract", "")) < 50,
            "message": "缺少摘要或摘要过短",
            "severity": RedFlagSeverity.MEDIUM,
        },
        {
            "type": "short_paper",
            "check": lambda d: d.get("page_count", 0) > 0 and d.get("page_count", 10) < 4,
            "message": "论文页数过少（少于4页）",
            "severity": RedFlagSeverity.MEDIUM,
        },
        {
            "type": "no_figures",
            "check": lambda d: d.get("figure_count", 0) == 0 and d.get("page_count", 10) > 4,
            "message": "论文没有图表",
            "severity": RedFlagSeverity.LOW,
        },
        {
            "type": "few_references",
            "check": lambda d: 0 < d.get("reference_count", 20) < 10,
            "message": "参考文献过少（少于10篇）",
            "severity": RedFlagSeverity.MEDIUM,
        },
        {
            "type": "vague_contributions",
            "check": lambda d: d.get("contributions") and len(d.get("contributions", [])) == 0,
            "message": "贡献描述模糊",
            "severity": RedFlagSeverity.MEDIUM,
        },
        {
            "type": "weak_evidence",
            "check": lambda d: d.get("evidence_strength") == "weak",
            "message": "证据强度较弱",
            "severity": RedFlagSeverity.HIGH,
        },
        {
            "type": "no_baseline",
            "check": lambda d: d.get("has_baseline_comparison") is False,
            "message": "缺少基线对比实验",
            "severity": RedFlagSeverity.HIGH,
        },
        {
            "type": "no_ablation",
            "check": lambda d: d.get("has_ablation") is False and d.get("page_count", 10) > 6,
            "message": "缺少消融实验",
            "severity": RedFlagSeverity.MEDIUM,
        },
        {
            "type": "single_dataset",
            "check": lambda d: d.get("dataset_count", 2) == 1,
            "message": "仅在单个数据集上评估",
            "severity": RedFlagSeverity.LOW,
        },
        {
            "type": "overclaiming",
            "check": lambda d: _check_overclaiming(d.get("abstract", "")),
            "message": "存在过度声称（使用'first'、'best'等绝对词汇）",
            "severity": RedFlagSeverity.MEDIUM,
        },
    ]
    
    def evaluate(
        self,
        abstract: Optional[str] = None,
        contributions: Optional[List[str]] = None,
        evidence_strength: Optional[str] = None,
        skim_data: Optional[Dict[str, Any]] = None,
        paper_stats: Optional[Dict[str, Any]] = None
    ) -> QualityScore:
        """
        评估论文质量
        
        Args:
            abstract: 摘要
            contributions: 贡献列表
            evidence_strength: 证据强度 (strong/medium/weak)
            skim_data: SkimCard数据
            paper_stats: 论文统计（页数、图表数、引用数等）
        
        Returns:
            质量评分结果
        """
        # 合并数据
        data = {
            "abstract": abstract or "",
            "contributions": contributions or [],
            "evidence_strength": evidence_strength or "medium",
        }
        
        if skim_data:
            data.update({
                "contributions": skim_data.get("contributions", data["contributions"]),
                "evidence_strength": skim_data.get("evidence_strength", data["evidence_strength"]),
                "red_flags_from_skim": skim_data.get("red_flags", []),
            })
        
        if paper_stats:
            data.update(paper_stats)
        
        # 检测红旗
        red_flags = self._detect_red_flags(data)
        
        # 添加skim中已有的红旗
        if data.get("red_flags_from_skim"):
            for rf_text in data["red_flags_from_skim"]:
                red_flags.append(RedFlag(
                    type="skim_warning",
                    message=rf_text,
                    severity=RedFlagSeverity.MEDIUM
                ))
        
        # 计算各维度分数
        dimensions = self._calculate_dimensions(data, red_flags)
        
        # 计算总分
        overall_score = self._calculate_overall_score(dimensions, red_flags)
        
        # 确定等级
        grade = self._determine_grade(overall_score, red_flags)
        
        # 生成建议
        suggestions = self._generate_suggestions(data, red_flags)
        
        return QualityScore(
            overall_score=overall_score,
            grade=grade,
            dimensions=dimensions,
            red_flags=red_flags,
            suggestions=suggestions
        )
    
    def _detect_red_flags(self, data: Dict[str, Any]) -> List[RedFlag]:
        """检测红旗"""
        red_flags = []
        
        for rule in self.RED_FLAG_RULES:
            try:
                if rule["check"](data):
                    red_flags.append(RedFlag(
                        type=rule["type"],
                        message=rule["message"],
                        severity=rule["severity"]
                    ))
            except Exception as e:
                logger.debug(f"红旗规则检查失败: {rule['type']}, {e}")
        
        return red_flags
    
    def _calculate_dimensions(
        self,
        data: Dict[str, Any],
        red_flags: List[RedFlag]
    ) -> Dict[str, float]:
        """计算各维度分数"""
        dimensions = {}
        
        # 方法论得分
        methodology_score = 80.0
        if any(rf.type in ["no_baseline", "no_ablation"] for rf in red_flags):
            methodology_score -= 20
        if any(rf.type == "single_dataset" for rf in red_flags):
            methodology_score -= 10
        dimensions["methodology"] = max(0, methodology_score)
        
        # 证据强度得分
        evidence_map = {"strong": 90, "medium": 70, "weak": 40}
        dimensions["evidence"] = evidence_map.get(data.get("evidence_strength", "medium"), 70)
        
        # 完整性得分
        completeness_score = 80.0
        if any(rf.type == "missing_abstract" for rf in red_flags):
            completeness_score -= 20
        if any(rf.type == "vague_contributions" for rf in red_flags):
            completeness_score -= 15
        if any(rf.type == "few_references" for rf in red_flags):
            completeness_score -= 10
        dimensions["completeness"] = max(0, completeness_score)
        
        # 表达清晰度（基于贡献数量和长度）
        contributions = data.get("contributions", [])
        if contributions and len(contributions) >= 2:
            clarity_score = 80
        elif contributions:
            clarity_score = 60
        else:
            clarity_score = 40
        dimensions["clarity"] = clarity_score
        
        return dimensions
    
    def _calculate_overall_score(
        self,
        dimensions: Dict[str, float],
        red_flags: List[RedFlag]
    ) -> float:
        """计算总分"""
        if not dimensions:
            base_score = 60.0
        else:
            # 加权平均
            weights = {
                "methodology": 0.3,
                "evidence": 0.3,
                "completeness": 0.2,
                "clarity": 0.2
            }
            base_score = sum(
                dimensions.get(k, 60) * w 
                for k, w in weights.items()
            )
        
        # 红旗扣分
        penalty = 0
        for rf in red_flags:
            if rf.severity == RedFlagSeverity.HIGH:
                penalty += 15
            elif rf.severity == RedFlagSeverity.MEDIUM:
                penalty += 8
            else:
                penalty += 3
        
        return max(0, min(100, base_score - penalty))
    
    def _determine_grade(
        self,
        score: float,
        red_flags: List[RedFlag]
    ) -> QualityGrade:
        """确定等级"""
        # 有严重红旗时降级
        high_severity_count = sum(1 for rf in red_flags if rf.severity == RedFlagSeverity.HIGH)
        
        if score >= 85 and high_severity_count == 0:
            return QualityGrade.A
        elif score >= 70 and high_severity_count <= 1:
            return QualityGrade.B
        elif score >= 50:
            return QualityGrade.C
        elif score >= 30:
            return QualityGrade.D
        else:
            return QualityGrade.F
    
    def _generate_suggestions(
        self,
        data: Dict[str, Any],
        red_flags: List[RedFlag]
    ) -> List[str]:
        """生成改进建议"""
        suggestions = []
        
        for rf in red_flags:
            if rf.type == "missing_abstract":
                suggestions.append("仔细阅读摘要部分，确认研究目标和主要贡献")
            elif rf.type == "no_baseline":
                suggestions.append("关注论文是否与相关工作进行了公平比较")
            elif rf.type == "weak_evidence":
                suggestions.append("仔细审查实验结果的可靠性和统计显著性")
            elif rf.type == "overclaiming":
                suggestions.append("注意区分论文声称和实际验证的结论")
            elif rf.type == "single_dataset":
                suggestions.append("考虑方法在其他数据集上的泛化能力")
        
        return suggestions[:5]  # 最多5条建议


def _check_overclaiming(text: str) -> bool:
    """检查是否存在过度声称"""
    overclaim_patterns = [
        r'\bfirst\s+to\b',
        r'\bstate[- ]of[- ]the[- ]art\b',
        r'\boutperforms?\s+all\b',
        r'\bbest\s+(?:performance|results?)\b',
        r'\bsuperior\s+to\s+all\b',
        r'\bgroundbreaking\b',
        r'\brevolutionary\b',
    ]
    
    text_lower = text.lower()
    for pattern in overclaim_patterns:
        if re.search(pattern, text_lower):
            return True
    return False


# 全局实例
quality_evaluator = QualityEvaluator()


def evaluate_paper_quality(
    abstract: Optional[str] = None,
    contributions: Optional[List[str]] = None,
    evidence_strength: Optional[str] = None,
    skim_data: Optional[Dict[str, Any]] = None,
    paper_stats: Optional[Dict[str, Any]] = None
) -> QualityScore:
    """便捷函数：评估论文质量"""
    return quality_evaluator.evaluate(
        abstract=abstract,
        contributions=contributions,
        evidence_strength=evidence_strength,
        skim_data=skim_data,
        paper_stats=paper_stats
    )

