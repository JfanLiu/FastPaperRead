"""
API依赖注入
"""
from typing import Generator
from sqlalchemy.orm import Session

from ..db.base import SessionLocal, init_db, get_db  # 从db.base导入get_db，避免重复定义
from ..core.llm import LLMClient, ContentEnhancer

# 注意：get_db 现在从 db.base 导入，不再在此重复定义
# 这确保所有模块使用同一个函数对象，避免 FastAPI 依赖注入问题


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

