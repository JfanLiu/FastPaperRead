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

    async def generate_teaching_skim(self, payload: Dict[str, Any]) -> Dict:
        """
        生成教学粗读（Teaching Skim）结构化卡片集合

        payload 应尽量包含：
        - paper_meta
        - skim_card
        - key_figures
        - section_summaries
        - evidence_anchor_candidates
        - paper_id, route_scope
        """
        try:
            paper_meta_json = json.dumps(payload.get("paper_meta", {}), ensure_ascii=False)
            skim_card_json = json.dumps(payload.get("skim_card", {}), ensure_ascii=False)
            key_figures_json = json.dumps(payload.get("key_figures", []), ensure_ascii=False)
            section_summaries_json = json.dumps(payload.get("section_summaries", {}), ensure_ascii=False)
            anchor_candidates_json = json.dumps(payload.get("evidence_anchor_candidates", []), ensure_ascii=False)
        except Exception:
            paper_meta_json = "{}"
            skim_card_json = "{}"
            key_figures_json = "[]"
            section_summaries_json = "{}"
            anchor_candidates_json = "[]"

        prompt = prompts.TEACHING_SKIM_PROMPT.format(
            paper_meta_json=paper_meta_json,
            skim_card_json=skim_card_json,
            key_figures_json=key_figures_json,
            section_summaries_json=section_summaries_json,
            anchor_candidates_json=anchor_candidates_json,
            paper_id=payload.get("paper_id", ""),
        )

        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文带读/教学讲解专家。"},
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
    
    async def explain_term_leveled(self, term: str, context: str) -> Dict:
        """解释术语（三层版本）"""
        prompt = prompts.TERM_EXPLAINER_LEVELED_PROMPT.format(
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
    
    async def generate_evidence_ledger(self, content: str) -> Dict:
        """生成主张-证据台账"""
        prompt = prompts.EVIDENCE_LEDGER_PROMPT.format(content=content[:8000])
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术论文证据分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_quote_snippet(
        self, 
        selected_text: str, 
        authors: str, 
        year: str, 
        title: str
    ) -> Dict:
        """生成引用骨架"""
        prompt = prompts.QUOTE_SNIPPET_PROMPT.format(
            selected_text=selected_text[:2000],
            authors=authors,
            year=year,
            title=title
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术写作助手。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def summarize_section_leveled(self, section_title: str, content: str) -> Dict:
        """生成三层摘要"""
        prompt = prompts.SECTION_SUMMARY_LEVELED_PROMPT.format(
            section_title=section_title,
            content=content[:4000]
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术论文分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def chat_with_paper(
        self, 
        message: str,
        title: str,
        authors: str,
        year: str,
        mode: str = "seminar",
        context: str = "",
        history: List[Dict] = None
    ) -> str:
        """与论文对话"""
        system_prompt = prompts.CHAT_SYSTEM_PROMPT.format(
            title=title,
            authors=authors,
            year=year,
            mode=mode,
            context=f"相关上下文:\n{context}" if context else ""
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息
        if history:
            messages.extend(history[-10:])  # 只保留最近10条
        
        messages.append({"role": "user", "content": message})
        
        response = await self.llm.chat_completion(messages)
        return response
    
    async def generate_paper_card_full(self, content: str, existing_cards: str = "") -> Dict:
        """生成完整的PaperCard"""
        prompt = prompts.GENERATE_PAPER_CARD_PROMPT.format(
            content=content[:8000],
            existing_cards=existing_cards[:2000] if existing_cards else "无"
        )
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文总结专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_skim_pack(
        self,
        paper_id: str,
        paper_meta: Dict[str, Any],
        paper_content: str,
        sections_outline: List[Dict[str, Any]]
    ) -> Dict:
        """
        统一生成粗读包（Skim Pack）：
        - skim_card
        - key_figures
        - teaching_skim (cards + tables + next_steps)
        
        一次 LLM 调用，输出完整粗读材料
        """
        try:
            paper_meta_json = json.dumps(paper_meta, ensure_ascii=False)
            sections_outline_json = json.dumps(sections_outline, ensure_ascii=False)
        except Exception:
            paper_meta_json = "{}"
            sections_outline_json = "[]"
        
        prompt = prompts.SKIM_PACK_PROMPT.format(
            paper_id=paper_id,
            paper_meta_json=paper_meta_json,
            paper_content=paper_content[:12000],  # 留足上下文
            sections_outline_json=sections_outline_json
        )
        
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文带读/教学讲解专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def generate_deep_pack(
        self,
        paper_id: str,
        paper_meta: Dict[str, Any],
        paper_content: str,
        sections: List[Dict[str, Any]]
    ) -> Dict:
        """
        统一生成精读包（Deep Pack）：
        - paper_card
        - evidence_ledger
        - method_flow
        - experiment_setup
        - section_summaries (所有章节的三层摘要)
        
        一次 LLM 调用，输出完整精读材料
        """
        try:
            paper_meta_json = json.dumps(paper_meta, ensure_ascii=False)
            sections_json = json.dumps(sections, ensure_ascii=False)
        except Exception:
            paper_meta_json = "{}"
            sections_json = "[]"
        
        prompt = prompts.DEEP_PACK_PROMPT.format(
            paper_id=paper_id,
            paper_meta_json=paper_meta_json,
            paper_content=paper_content[:15000],  # 精读需要更多上下文
            sections_json=sections_json[:8000]  # 章节列表也可能很长
        )
        
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个论文深度分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)
    
    async def batch_section_summary(
        self,
        sections: List[Dict[str, Any]]
    ) -> Dict:
        """
        批量生成所有章节的三层摘要
        
        sections: [{"title": "章节标题", "content": "章节内容"}, ...]
        
        一次 LLM 调用，输出所有章节摘要
        """
        try:
            sections_json = json.dumps(sections, ensure_ascii=False)
        except Exception:
            sections_json = "[]"
        
        prompt = prompts.BATCH_SECTION_SUMMARY_PROMPT.format(
            sections_json=sections_json[:15000]  # 控制总长度
        )
        
        response = await self.llm.chat_completion([
            {"role": "system", "content": "你是一个学术论文分析专家。"},
            {"role": "user", "content": prompt}
        ])
        return self._parse_json_response(response)