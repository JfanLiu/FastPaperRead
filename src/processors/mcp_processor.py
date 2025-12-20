"""
MCP处理器 - 已重构为使用本地LLM和搜索服务
保留原有函数签名以保持兼容性
"""
import asyncio
from typing import List
from .llm_processor import llm_processor, LLMProcessor
from .search_processor import search_processor, SearchProcessor


async def get_keywords(tex_content: str) -> str:
    """从论文内容提取关键词
    
    Args:
        tex_content: 论文内容（Markdown/TEX格式）
        
    Returns:
        str: 空格分隔的关键词
    """
    return llm_processor.extract_keywords(tex_content)


async def get_link(keywords: str) -> List[str]:
    """根据关键词搜索相关链接
    
    Args:
        keywords: 空格分隔的关键词
        
    Returns:
        List[str]: 相关URL列表
    """
    keyword_list = keywords.strip().split()
    return await search_processor.search_for_paper_context(keyword_list)


async def get_sumary(tex_content: str) -> str:
    """生成论文摘要
    
    注意：原函数名有拼写错误，保留以兼容
    
    Args:
        tex_content: 论文内容
        
    Returns:
        str: 论文摘要
    """
    return llm_processor.generate_summary(tex_content)


async def get_summary(tex_content: str) -> str:
    """生成论文摘要（正确拼写版本）"""
    return llm_processor.generate_summary(tex_content)


async def get_knowedge(tex_content: str, knowledges: List[str]) -> str:
    """结合知识库分析论文
    
    注意：原函数名有拼写错误，保留以兼容
    
    Args:
        tex_content: 论文内容
        knowledges: 知识库URL列表
        
    Returns:
        str: 分析结果
    """
    # 如果有知识库URL，尝试获取内容
    knowledge_contents = []
    for url in knowledges[:5]:  # 限制数量
        try:
            content = await search_processor.get_page_content(url)
            if content:
                knowledge_contents.append(content[:2000])  # 限制每个内容的长度
        except Exception as e:
            print(f"获取知识库内容失败 {url}: {e}")
    
    return llm_processor.analyze_with_knowledge(tex_content, knowledge_contents)


async def get_knowledge(tex_content: str, knowledges: List[str]) -> str:
    """结合知识库分析论文（正确拼写版本）"""
    return await get_knowedge(tex_content, knowledges)


async def get_blog(tex_content: str, code_content: str, knowledges: List[str]) -> str:
    """生成结构化Blog
    
    Args:
        tex_content: 论文内容
        code_content: 代码分析结果
        knowledges: 知识库URL列表
        
    Returns:
        str: Markdown格式的Blog
    """
    # 获取知识库内容
    knowledge_contents = []
    for url in knowledges[:3]:
        try:
            content = await search_processor.get_page_content(url)
            if content:
                knowledge_contents.append(content[:2000])
        except Exception as e:
            print(f"获取知识库内容失败 {url}: {e}")
    
    return llm_processor.generate_blog(
        paper_content=tex_content,
        code_analysis=code_content,
        knowledge_contents=knowledge_contents
    )


# ==================== 新增功能函数 ====================

async def analyze_code_with_paper(code_structure: str, paper_summary: str) -> str:
    """分析代码与论文的对应关系
    
    Args:
        code_structure: 代码结构摘要
        paper_summary: 论文摘要
        
    Returns:
        str: 代码分析结果
    """
    return llm_processor.analyze_code(code_structure, paper_summary)


async def search_academic_papers(query: str, max_results: int = 10) -> List[dict]:
    """搜索学术论文
    
    Args:
        query: 搜索查询
        max_results: 最大结果数
        
    Returns:
        List[dict]: 搜索结果
    """
    return await search_processor.search_academic(query, max_results)
