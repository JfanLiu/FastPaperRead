"""
处理器模块
"""
from .pdf_processor import PDFProcessor
from .git_processor import GitProcessor
from .llm_processor import LLMProcessor, llm_processor
from .search_processor import SearchProcessor, search_processor

# 兼容性导入
from .mcp_processor import (
    get_keywords,
    get_link,
    get_sumary,
    get_summary,
    get_knowedge,
    get_knowledge,
    get_blog,
    analyze_code_with_paper,
    search_academic_papers
)

__all__ = [
    'PDFProcessor',
    'GitProcessor', 
    'LLMProcessor',
    'SearchProcessor',
    'llm_processor',
    'search_processor',
    # MCP兼容函数
    'get_keywords',
    'get_link',
    'get_sumary',
    'get_summary',
    'get_knowedge',
    'get_knowledge',
    'get_blog',
    'analyze_code_with_paper',
    'search_academic_papers'
]

