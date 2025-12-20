"""
搜索处理器 - 使用 Tavily 进行网络搜索
"""
import os
from typing import List, Dict, Optional
from config import config


class SearchProcessor:
    """搜索处理器，使用Tavily进行学术和网络搜索"""
    
    def __init__(self):
        self.api_key = config.TAVILY_API_KEY
        self._client = None
        
        if not self.api_key:
            print("⚠️ TAVILY_API_KEY 未配置，搜索功能将不可用")
    
    def _get_client(self):
        """懒加载Tavily客户端"""
        if self._client is None and self.api_key:
            try:
                from tavily import TavilyClient
                self._client = TavilyClient(api_key=self.api_key)
            except ImportError:
                print("⚠️ tavily-python 未安装，请运行: pip install tavily-python")
                return None
        return self._client
    
    async def search(
        self, 
        query: str, 
        search_depth: str = "advanced",
        max_results: int = 10,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None
    ) -> List[Dict]:
        """执行搜索
        
        Args:
            query: 搜索查询
            search_depth: 搜索深度 ("basic" 或 "advanced")
            max_results: 最大结果数
            include_domains: 限定搜索的域名列表
            exclude_domains: 排除的域名列表
            
        Returns:
            List[Dict]: 搜索结果列表
        """
        client = self._get_client()
        if not client:
            return []
        
        try:
            # 默认排除一些低质量来源
            default_exclude = ["zhihu.com", "baidu.com", "csdn.net"]
            if exclude_domains:
                exclude_domains = list(set(exclude_domains + default_exclude))
            else:
                exclude_domains = default_exclude
            
            response = client.search(
                query=query,
                search_depth=search_depth,
                max_results=max_results,
                include_domains=include_domains,
                exclude_domains=exclude_domains
            )
            
            results = []
            for item in response.get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                    "score": item.get("score", 0)
                })
            
            return results
            
        except Exception as e:
            print(f"搜索失败: {e}")
            return []
    
    async def search_academic(
        self, 
        query: str, 
        max_results: int = 10
    ) -> List[Dict]:
        """学术搜索 - 限定学术网站
        
        Args:
            query: 搜索查询
            max_results: 最大结果数
            
        Returns:
            List[Dict]: 搜索结果列表
        """
        academic_domains = [
            "arxiv.org",
            "scholar.google.com",
            "semanticscholar.org",
            "aclanthology.org",
            "openreview.net",
            "papers.nips.cc",
            "proceedings.mlr.press",
            "ieee.org",
            "acm.org"
        ]
        
        return await self.search(
            query=query,
            search_depth="advanced",
            max_results=max_results,
            include_domains=academic_domains
        )
    
    async def search_for_paper_context(
        self, 
        keywords: List[str],
        paper_title: str = None,
        max_results: int = 15
    ) -> List[str]:
        """根据论文关键词搜索相关上下文
        
        Args:
            keywords: 关键词列表
            paper_title: 论文标题（可选）
            max_results: 最大结果数
            
        Returns:
            List[str]: 相关URL列表
        """
        # 构建搜索查询
        if paper_title:
            query = f"{paper_title} {' '.join(keywords[:5])}"
        else:
            query = " ".join(keywords[:8])
        
        # 执行搜索
        results = await self.search(
            query=query,
            search_depth="advanced",
            max_results=max_results
        )
        
        # 过滤并返回URL
        urls = []
        seen = set()
        for result in results:
            url = result.get("url", "")
            if url and url not in seen:
                # 过滤掉一些无效URL
                if not url.endswith('/') and 'github.com' not in url:
                    urls.append(url)
                    seen.add(url)
        
        return urls
    
    async def get_page_content(self, url: str) -> Optional[str]:
        """获取网页内容摘要
        
        Args:
            url: 网页URL
            
        Returns:
            Optional[str]: 网页内容摘要
        """
        client = self._get_client()
        if not client:
            return None
        
        try:
            # 使用Tavily的extract功能获取内容
            response = client.extract(urls=[url])
            
            if response and "results" in response:
                for result in response["results"]:
                    if result.get("url") == url:
                        return result.get("raw_content", "")
            
            return None
            
        except Exception as e:
            print(f"获取页面内容失败: {e}")
            return None


# 全局实例
search_processor = SearchProcessor()

