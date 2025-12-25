"""
LLM Prompt 模板
"""

SKIM_CARD_PROMPT = """你是一个学术论文分析助手。请分析以下论文内容，生成一个快速阅读卡片(SkimCard)。

论文内容：
{content}

请按以下JSON格式输出：
{{
  "research_question": "用一句话概括论文解决的核心问题",
  "contributions": ["贡献1", "贡献2", "贡献3"],
  "evidence_strength": "strong/medium/weak",
  "evidence_strength_reason": "解释证据强度的原因",
  "red_flags": ["可能的问题1", "可能的问题2"],
  "recommended_route": "full_read/focused_read/skim/skip",
  "recommended_sections": ["建议阅读的章节1", "建议阅读的章节2"]
}}

只输出JSON，不要其他内容。"""


TERM_EXPLAINER_PROMPT = """你是一个学术术语解释专家。请解释以下术语：

术语：{term}

上下文：
{context}

请按以下JSON格式输出：
{{
  "definition": "术语的定义",
  "explanation": "通俗易懂的解释（面向研究生水平）",
  "examples": ["例子1", "例子2"],
  "related_terms": ["相关术语1", "相关术语2"]
}}

只输出JSON，不要其他内容。"""


FIGURE_EXPLAINER_PROMPT = """你是一个学术图表分析专家。请分析以下图表：

图表标题/描述：{caption}

图表上下文：
{context}

请按以下JSON格式输出：
{{
  "description": "图表展示了什么",
  "key_findings": ["关键发现1", "关键发现2"],
  "interpretation": "如何解读这个图表",
  "limitations": ["局限性1"],
  "related_content": "与论文其他部分的关联"
}}

只输出JSON，不要其他内容。"""


EQUATION_EXPLAINER_PROMPT = """你是一个数学公式解释专家。请解释以下公式：

公式：
{latex}

上下文：
{context}

请按以下JSON格式输出：
{{
  "explanation": "公式的含义",
  "symbols": [
    {{"symbol": "x", "meaning": "符号x的含义"}},
    {{"symbol": "y", "meaning": "符号y的含义"}}
  ],
  "derivation_hint": "推导思路（如果适用）",
  "usage": "公式的用途",
  "related_equations": ["相关公式（如果有）"]
}}

只输出JSON，不要其他内容。"""


MISSING_DETAIL_FINDER_PROMPT = """你是一个论文复现专家。请分析以下论文内容，找出复现论文时可能缺失的关键细节。

论文内容：
{content}

请按以下JSON格式输出：
{{
  "items": [
    {{
      "group": "data/model/training/evaluation/code",
      "text": "缺失的细节描述",
      "importance": "high/medium/low",
      "suggestion": "建议如何获取这个信息"
    }}
  ],
  "completeness_score": 0.0-1.0之间的分数,
  "overall_assessment": "整体评估"
}}

只输出JSON，不要其他内容。"""


PAPER_CARD_PROMPT = """你是一个论文总结专家。请为以下论文生成一个Paper Card。

论文内容：
{content}

请按以下JSON格式输出：
{{
  "one_line_summary": "一句话总结",
  "contributions": ["贡献1", "贡献2", "贡献3"],
  "limitations": ["局限性1", "局限性2"],
  "applicable_scope": "适用范围和场景"
}}

只输出JSON，不要其他内容。"""


EVIDENCE_CARD_PROMPT = """你是一个论文证据分析专家。请分析以下内容，生成一个Evidence Card。

内容：
{content}

请按以下JSON格式输出：
{{
  "claim": "论文的主张",
  "evidence": "支持主张的证据",
  "evidence_strength": "strong/medium/weak",
  "alternative_explanations": ["替代解释1", "替代解释2"],
  "risks": ["风险1", "风险2"]
}}

只输出JSON，不要其他内容。"""


METHOD_CARD_PROMPT = """你是一个方法论分析专家。请分析以下方法描述，生成一个Method Card。

方法描述：
{content}

请按以下JSON格式输出：
{{
  "method_name": "方法名称",
  "inputs": ["输入1", "输入2"],
  "outputs": ["输出1", "输出2"],
  "assumptions": ["假设1", "假设2"],
  "process": "方法流程描述",
  "pseudocode": "伪代码（可选）",
  "complexity": "时间/空间复杂度"
}}

只输出JSON，不要其他内容。"""


SECTION_SUMMARY_PROMPT = """请总结以下论文章节的核心内容：

章节标题：{section_title}

章节内容：
{content}

请用2-3句话总结这个章节的关键信息。"""


COMPARE_PAPERS_PROMPT = """请比较以下两篇论文：

论文1：
{paper1_content}

论文2：
{paper2_content}

比较维度：{dimensions}

请按以下JSON格式输出：
{{
  "comparison": [
    {{
      "dimension": "维度名称",
      "paper1": "论文1在此维度的表现",
      "paper2": "论文2在此维度的表现",
      "summary": "对比总结"
    }}
  ],
  "overall_summary": "整体对比结论"
}}

只输出JSON，不要其他内容。"""


REVIEW_DRAFT_PROMPT = """你是一个学术审稿人。请为以下论文撰写审稿意见草稿。

论文内容：
{content}

请按以下结构输出审稿意见：

## 总体评价
[对论文的整体评价]

## 主要优点
1. [优点1]
2. [优点2]

## 主要问题
1. [问题1]
2. [问题2]

## 具体建议
1. [建议1]
2. [建议2]

## 小问题
- [小问题1]
- [小问题2]

## 结论
[Accept/Minor Revision/Major Revision/Reject] - [理由]"""


METHOD_FLOW_PROMPT = """你是一个方法流程分析专家。请从以下论文内容中提取方法流程。

论文内容：
{content}

请按以下JSON格式输出：
{{
  "method_name": "方法名称",
  "overview": "方法概述（1-2句话）",
  "steps": [
    {{
      "step": 1,
      "name": "步骤名称",
      "description": "详细描述",
      "inputs": ["输入1", "输入2"],
      "outputs": ["输出1", "输出2"]
    }}
  ],
  "key_innovations": ["创新点1", "创新点2"],
  "dependencies": ["依赖的技术/工具1", "依赖的技术/工具2"],
  "pseudocode": "伪代码（如果适用）"
}}

只输出JSON，不要其他内容。"""


EXPERIMENT_SETUP_PROMPT = """你是一个实验设置分析专家。请从以下论文内容中提取实验设置信息。

论文内容：
{content}

请按以下JSON格式输出：
{{
  "datasets": [
    {{
      "name": "数据集名称",
      "description": "描述",
      "size": "数据规模",
      "split": "训练/验证/测试划分"
    }}
  ],
  "baselines": ["对比方法1", "对比方法2"],
  "metrics": [
    {{
      "name": "指标名称",
      "description": "指标描述"
    }}
  ],
  "hyperparameters": [
    {{
      "name": "参数名",
      "value": "参数值",
      "description": "说明"
    }}
  ],
  "training_details": {{
    "optimizer": "优化器",
    "learning_rate": "学习率",
    "batch_size": "批次大小",
    "epochs": "训练轮数",
    "hardware": "硬件配置"
  }},
  "reproducibility_notes": "复现注意事项"
}}

只输出JSON，不要其他内容。"""
