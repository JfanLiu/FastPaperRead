"""
API依赖注入
"""
from typing import Generator
from sqlalchemy.orm import Session

from ..db.base import SessionLocal, init_db
from ..core.llm import LLMClient, ContentEnhancer


def get_db() -> Generator:
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# LLM客户端单例
_llm_client = None
_enhancer = None


def get_llm_client() -> LLMClient:
    """获取LLM客户端"""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client


def get_enhancer() -> ContentEnhancer:
    """获取内容增强器"""
    global _enhancer
    if _enhancer is None:
        _enhancer = ContentEnhancer()
    return _enhancer


def init_dependencies():
    """初始化依赖"""
    # 初始化数据库
    init_db()

