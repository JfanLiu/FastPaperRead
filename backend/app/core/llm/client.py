"""
LLM客户端 - 支持OpenAI兼容接口
"""
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from openai import AsyncOpenAI

from ...config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """LLM客户端，支持OpenAI兼容接口"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.api_key = api_key or settings.LLM_API_KEY
        self.base_url = base_url or settings.LLM_BASE_URL
        self.model = model or settings.LLM_MODEL
        self.client = None
        
        if not self.api_key:
            logger.warning("LLM API key not configured - LLM features will be disabled")
        else:
            logger.info(f"LLM configured: model={self.model}, base_url={self.base_url}")
            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
    
    def is_available(self) -> bool:
        """检查LLM是否可用"""
        return self.client is not None
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> str:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            temperature: 温度参数
            max_tokens: 最大token数
            
        Returns:
            LLM生成的文本
        """
        if not self.is_available():
            raise ValueError("LLM API key not configured. Please set LLM_API_KEY in .env file.")
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"LLM request failed: {e}")
            raise
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        流式聊天请求
        """
        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                **kwargs
            )
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"LLM stream request failed: {e}")
            raise
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        简化的文本生成接口
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        return await self.chat(messages, **kwargs)
    
    # 别名方法，保持向后兼容
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """chat_completion 是 chat 的别名"""
        return await self.chat(messages, **kwargs)


# 全局客户端实例
_client: Optional[LLMClient] = None


def get_llm_client() -> LLMClient:
    """获取LLM客户端实例"""
    global _client
    if _client is None:
        _client = LLMClient()
    return _client

