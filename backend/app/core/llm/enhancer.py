"""
内容增强器 - 调用LLM进行各类增强
"""
import json
import logging
from typing import Dict, Any, Optional, List

from .client import get_llm_client
from .prompts import PromptTemplates
from ...models.anchor import Anchor

logger = logging.getLogger(__name__)


class ContentEnhancer:
    """内容增强器"""
    
    def __init__(self):
        self.client = get_llm_client()
        self.prompts = PromptTemplates
    
    async def generate_skim_card(
        self,
        title: str,
        abstract: str,
        sections: List[str]
    ) -> Dict[str, Any]:
        """
        生成SkimCard
        """
        try:
            prompt = self.prompts.SKIM_CARD_USER.format(
                title=title,
                abstract=abstract or "（无摘要）",
                sections="\n".join(f"- {s}" for s in sections)
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.SKIM_CARD_SYSTEM,
                temperature=0.3,
                max_tokens=1500
            )
            
            # 解析JSON
            result = self._parse_json_response(response)
            
            # 确保必要字段存在
            return {
                "research_question": result.get("research_question", "待分析"),
                "contributions": result.get("contributions", []),
                "evidence_strength": result.get("evidence_strength", "medium"),
                "evidence_strength_reason": result.get("evidence_strength_reason", ""),
                "red_flags": result.get("red_flags", []),
                "recommended_sections": result.get("recommended_sections", ["Abstract", "Method", "Experiments"])
            }
        except Exception as e:
            logger.error(f"Failed to generate skim card: {e}")
            return self._default_skim_card()
    
    async def explain_term(
        self,
        term: str,
        context: str
    ) -> Dict[str, Any]:
        """
        解释术语
        """
        try:
            prompt = self.prompts.TERM_EXPLAIN_USER.format(
                term=term,
                context=context[:2000]  # 限制上下文长度
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.TERM_EXPLAIN_SYSTEM,
                temperature=0.3,
                max_tokens=800
            )
            
            result = self._parse_json_response(response)
            
            return {
                "term": term,
                "one_liner": result.get("one_liner", ""),
                "plain": result.get("plain", ""),
                "strict": result.get("strict", ""),
                "uncertainty": result.get("uncertainty", "inferred"),
                "related_terms": result.get("related_terms", [])
            }
        except Exception as e:
            logger.error(f"Failed to explain term: {e}")
            return {
                "term": term,
                "one_liner": "解释生成失败",
                "plain": "",
                "strict": "",
                "uncertainty": "needs_verify",
                "related_terms": []
            }
    
    async def explain_equation(
        self,
        latex: str,
        context: str
    ) -> Dict[str, Any]:
        """
        解释公式
        """
        try:
            prompt = self.prompts.EQUATION_EXPLAIN_USER.format(
                latex=latex,
                context=context[:2000]
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.EQUATION_EXPLAIN_SYSTEM,
                temperature=0.3,
                max_tokens=1000
            )
            
            result = self._parse_json_response(response)
            
            return {
                "latex": latex,
                "symbol_table": result.get("symbol_table", {}),
                "key_assumptions": result.get("key_assumptions", []),
                "derivation_steps": result.get("derivation_steps", []),
                "plain_explanation": result.get("plain_explanation", ""),
                "uncertainty": result.get("uncertainty", "inferred")
            }
        except Exception as e:
            logger.error(f"Failed to explain equation: {e}")
            return {
                "latex": latex,
                "symbol_table": {},
                "key_assumptions": [],
                "derivation_steps": [],
                "plain_explanation": "解释生成失败",
                "uncertainty": "needs_verify"
            }
    
    async def explain_figure(
        self,
        figure_number: str,
        caption: str,
        context: str
    ) -> Dict[str, Any]:
        """
        解释图表
        """
        try:
            prompt = self.prompts.FIGURE_EXPLAIN_USER.format(
                figure_number=figure_number or "未知",
                caption=caption or "无标题",
                context=context[:2000]
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.FIGURE_EXPLAIN_SYSTEM,
                temperature=0.4,
                max_tokens=1000
            )
            
            result = self._parse_json_response(response)
            
            return {
                "figure_number": figure_number,
                "caption": caption,
                "what_it_shows": result.get("what_it_shows", ""),
                "evidence_assessment": result.get("evidence_assessment", ""),
                "alternative_explanations": result.get("alternative_explanations", []),
                "key_observations": result.get("key_observations", []),
                "uncertainty": result.get("uncertainty", "inferred")
            }
        except Exception as e:
            logger.error(f"Failed to explain figure: {e}")
            return {
                "figure_number": figure_number,
                "caption": caption,
                "what_it_shows": "分析生成失败",
                "evidence_assessment": "",
                "alternative_explanations": [],
                "key_observations": [],
                "uncertainty": "needs_verify"
            }
    
    async def summarize_paragraph(
        self,
        text: str
    ) -> Dict[str, Any]:
        """
        总结段落
        """
        try:
            prompt = self.prompts.PARAGRAPH_SUMMARY_USER.format(
                text=text[:3000]
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.PARAGRAPH_SUMMARY_SYSTEM,
                temperature=0.3,
                max_tokens=600
            )
            
            result = self._parse_json_response(response)
            
            return {
                "original_text": text[:500] + "..." if len(text) > 500 else text,
                "one_liner": result.get("one_liner", ""),
                "plain_summary": result.get("plain_summary", ""),
                "strict_summary": result.get("strict_summary", ""),
                "key_points": result.get("key_points", [])
            }
        except Exception as e:
            logger.error(f"Failed to summarize paragraph: {e}")
            return {
                "original_text": text[:200],
                "one_liner": "",
                "plain_summary": "",
                "strict_summary": "",
                "key_points": []
            }
    
    async def extract_repro_checklist(
        self,
        content: str
    ) -> List[Dict[str, Any]]:
        """
        提取复现清单
        """
        try:
            prompt = self.prompts.REPRO_CHECKLIST_USER.format(
                content=content[:5000]
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.REPRO_CHECKLIST_SYSTEM,
                temperature=0.2,
                max_tokens=2000
            )
            
            result = self._parse_json_response(response)
            
            if isinstance(result, list):
                return result
            elif isinstance(result, dict) and "items" in result:
                return result["items"]
            else:
                return []
        except Exception as e:
            logger.error(f"Failed to extract repro checklist: {e}")
            return []
    
    async def generate_review_draft(
        self,
        title: str,
        analysis: str
    ) -> Dict[str, Any]:
        """
        生成审稿草稿
        """
        try:
            prompt = self.prompts.REVIEW_DRAFT_USER.format(
                title=title,
                analysis=analysis[:4000]
            )
            
            response = await self.client.generate(
                prompt=prompt,
                system_prompt=self.prompts.REVIEW_DRAFT_SYSTEM,
                temperature=0.4,
                max_tokens=2000
            )
            
            return self._parse_json_response(response)
        except Exception as e:
            logger.error(f"Failed to generate review draft: {e}")
            return {
                "rubric": {},
                "questions": []
            }
    
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """
        解析LLM的JSON响应
        """
        # 尝试直接解析
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # 尝试提取```json```块
        import re
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass
        
        # 尝试提取{...}
        brace_match = re.search(r'\{[\s\S]*\}', response)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass
        
        # 返回空字典
        logger.warning(f"Failed to parse JSON response: {response[:200]}")
        return {}
    
    def _default_skim_card(self) -> Dict[str, Any]:
        """返回默认SkimCard"""
        return {
            "research_question": "解析失败，请重试",
            "contributions": [],
            "evidence_strength": "medium",
            "evidence_strength_reason": "",
            "red_flags": [],
            "recommended_sections": ["Abstract", "Method", "Experiments"]
        }

