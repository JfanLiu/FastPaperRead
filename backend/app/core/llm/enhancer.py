"""
内容增强器 - 使用LLM增强论文内容
"""
import json
import re
from typing import Optional, Dict, List, Any
from .client import LLMClient
from . import prompts


class ContentEnhancer:
    """内容增强器"""
    
    def __init__(self, llm_client: LLMClient = None):
        self.llm = llm_client or LLMClient()
    
    def _parse_json_response(self, response: str) -> Dict:
        """解析LLM返回的JSON"""
        try:
            # 尝试直接解析
            return json.loads(response)
        except json.JSONDecodeError:
            # 尝试提取JSON部分
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
        return {}
    
    async def generate_skim_card(self, content: str) -> Dict:
        """生成SkimCard"""
        prompt = prompts.SKIM_CARD_PROMPT.format(content=content[:8000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术论文分析助手。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def explain_term(self, term: str, context: str) -> Dict:
        """解释术语"""
        prompt = prompts.TERM_EXPLAINER_PROMPT.format(
            term=term,
            context=context[:2000]
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术术语解释专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def explain_figure(self, caption: str, context: str) -> Dict:
        """解释图表"""
        prompt = prompts.FIGURE_EXPLAINER_PROMPT.format(
            caption=caption,
            context=context[:2000]
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术图表分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def explain_equation(self, latex: str, context: str) -> Dict:
        """解释公式"""
        prompt = prompts.EQUATION_EXPLAINER_PROMPT.format(
            latex=latex,
            context=context[:2000]
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个数学公式解释专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def find_missing_details(self, content: str) -> Dict:
        """查找复现缺失细节"""
        prompt = prompts.MISSING_DETAIL_FINDER_PROMPT.format(
            content=content[:8000]
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文复现专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_paper_card(self, content: str) -> Dict:
        """生成PaperCard"""
        prompt = prompts.PAPER_CARD_PROMPT.format(content=content[:8000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文总结专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_evidence_card(self, content: str) -> Dict:
        """生成EvidenceCard"""
        prompt = prompts.EVIDENCE_CARD_PROMPT.format(content=content[:4000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文证据分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_method_card(self, content: str) -> Dict:
        """生成MethodCard"""
        prompt = prompts.METHOD_CARD_PROMPT.format(content=content[:4000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个方法论分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def summarize_section(self, section_title: str, content: str) -> str:
        """总结章节"""
        prompt = prompts.SECTION_SUMMARY_PROMPT.format(
            section_title=section_title,
            content=content[:4000]
        )
        response = await self.llm.chat_completion([
            {"role": "user", "content": prompt}
        ])
        return response
    
    async def compare_papers(
        self,
        paper1_content: str,
        paper2_content: str,
        dimensions: List[str] = None
    ) -> Dict:
        """比较论文"""
        if dimensions is None:
            dimensions = ["方法", "实验设计", "结果", "局限性"]
        
        prompt = prompts.COMPARE_PAPERS_PROMPT.format(
            paper1_content=paper1_content[:4000],
            paper2_content=paper2_content[:4000],
            dimensions=", ".join(dimensions)
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文比较专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_review_draft(self, content: str) -> str:
        """生成审稿意见草稿"""
        prompt = prompts.REVIEW_DRAFT_PROMPT.format(content=content[:8000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个资深学术审稿人。"},
            {"role": "user", "content": prompt}
        ])
        return response
    
    async def extract_method_flow(self, content: str) -> Dict:
        """提取方法流程"""
        prompt = prompts.METHOD_FLOW_PROMPT.format(content=content[:8000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个方法流程分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def extract_experiment_setup(self, content: str) -> Dict:
        """提取实验设置"""
        prompt = prompts.EXPERIMENT_SETUP_PROMPT.format(content=content[:8000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个实验设置分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)