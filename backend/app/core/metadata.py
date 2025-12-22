"""
论文元数据获取服务

支持从以下来源获取元数据：
- arXiv API
- Crossref API
- OpenAlex API (可选)
"""
import httpx
import re
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
import xml.etree.ElementTree as ET

logger = logging.getLogger("fastpaperread.metadata")


@dataclass
class PaperMetadata:
    """论文元数据"""
    title: Optional[str] = None
    authors: Optional[list] = None
    year: Optional[int] = None
    venue: Optional[str] = None
    abstract: Optional[str] = None
    keywords: Optional[list] = None
    doi: Optional[str] = None
    arxiv_id: Optional[str] = None
    pdf_url: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "authors": self.authors or [],
            "year": self.year,
            "venue": self.venue,
            "abstract": self.abstract,
            "keywords": self.keywords or [],
            "doi": self.doi,
            "arxiv_id": self.arxiv_id,
            "pdf_url": self.pdf_url,
        }


class MetadataService:
    """元数据获取服务"""
    
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": "FastPaperRead/1.0 (mailto:contact@example.com)"
        }
    
    async def fetch_metadata(self, source_type: str, source_value: str) -> Optional[PaperMetadata]:
        """
        根据来源类型获取元数据
        
        Args:
            source_type: arxiv, doi, url
            source_value: arXiv ID, DOI, 或 URL
        """
        if source_type == "arxiv":
            return await self.fetch_arxiv_metadata(source_value)
        elif source_type == "doi":
            return await self.fetch_doi_metadata(source_value)
        elif source_type == "url":
            # 尝试从URL识别类型
            if "arxiv.org" in source_value:
                arxiv_id = self._extract_arxiv_id(source_value)
                if arxiv_id:
                    return await self.fetch_arxiv_metadata(arxiv_id)
            elif "doi.org" in source_value:
                doi = self._extract_doi(source_value)
                if doi:
                    return await self.fetch_doi_metadata(doi)
        
        return None
    
    def _extract_arxiv_id(self, url: str) -> Optional[str]:
        """从arXiv URL提取ID"""
        # 匹配格式: arxiv.org/abs/2301.12345 或 arxiv.org/pdf/2301.12345
        patterns = [
            r'arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}(?:v\d+)?)',
            r'arxiv\.org/(?:abs|pdf)/([a-z-]+/\d{7})',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None
    
    def _extract_doi(self, url: str) -> Optional[str]:
        """从DOI URL提取DOI"""
        # 匹配格式: doi.org/10.xxxx/xxxxx
        match = re.search(r'doi\.org/(10\.\d{4,}/[^\s]+)', url)
        if match:
            return match.group(1)
        return None
    
    async def fetch_arxiv_metadata(self, arxiv_id: str) -> Optional[PaperMetadata]:
        """
        从arXiv API获取元数据
        
        API: http://export.arxiv.org/api/query?id_list=ARXIV_ID
        """
        # 清理ID
        arxiv_id = arxiv_id.replace("arxiv:", "").strip()
        if arxiv_id.endswith(".pdf"):
            arxiv_id = arxiv_id[:-4]
        
        url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                return self._parse_arxiv_response(response.text, arxiv_id)
        except Exception as e:
            logger.error(f"获取arXiv元数据失败: {arxiv_id}, 错误: {e}")
            return None
    
    def _parse_arxiv_response(self, xml_content: str, arxiv_id: str) -> Optional[PaperMetadata]:
        """解析arXiv API响应"""
        try:
            # 定义命名空间
            ns = {
                'atom': 'http://www.w3.org/2005/Atom',
                'arxiv': 'http://arxiv.org/schemas/atom'
            }
            
            root = ET.fromstring(xml_content)
            entry = root.find('atom:entry', ns)
            
            if entry is None:
                return None
            
            # 提取字段
            title_elem = entry.find('atom:title', ns)
            title = title_elem.text.strip().replace('\n', ' ') if title_elem is not None else None
            
            # 作者
            authors = []
            for author in entry.findall('atom:author', ns):
                name_elem = author.find('atom:name', ns)
                if name_elem is not None:
                    authors.append(name_elem.text.strip())
            
            # 摘要
            summary_elem = entry.find('atom:summary', ns)
            abstract = summary_elem.text.strip().replace('\n', ' ') if summary_elem is not None else None
            
            # 发表日期
            published_elem = entry.find('atom:published', ns)
            year = None
            if published_elem is not None:
                year_match = re.match(r'(\d{4})', published_elem.text)
                if year_match:
                    year = int(year_match.group(1))
            
            # 分类/关键词
            categories = []
            for category in entry.findall('atom:category', ns):
                term = category.get('term')
                if term:
                    categories.append(term)
            
            # PDF链接
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
            
            return PaperMetadata(
                title=title,
                authors=authors,
                year=year,
                venue="arXiv",
                abstract=abstract,
                keywords=categories,
                arxiv_id=arxiv_id,
                pdf_url=pdf_url,
            )
        except Exception as e:
            logger.error(f"解析arXiv响应失败: {e}")
            return None
    
    async def fetch_doi_metadata(self, doi: str) -> Optional[PaperMetadata]:
        """
        从Crossref API获取DOI元数据
        
        API: https://api.crossref.org/works/DOI
        """
        # 清理DOI
        doi = doi.strip()
        if doi.startswith("https://doi.org/"):
            doi = doi[16:]
        elif doi.startswith("http://doi.org/"):
            doi = doi[15:]
        
        url = f"https://api.crossref.org/works/{doi}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                data = response.json()
                return self._parse_crossref_response(data, doi)
        except Exception as e:
            logger.error(f"获取DOI元数据失败: {doi}, 错误: {e}")
            return None
    
    def _parse_crossref_response(self, data: dict, doi: str) -> Optional[PaperMetadata]:
        """解析Crossref API响应"""
        try:
            if data.get("status") != "ok":
                return None
            
            message = data.get("message", {})
            
            # 标题
            titles = message.get("title", [])
            title = titles[0] if titles else None
            
            # 作者
            authors = []
            for author in message.get("author", []):
                given = author.get("given", "")
                family = author.get("family", "")
                name = f"{given} {family}".strip()
                if name:
                    authors.append(name)
            
            # 年份
            year = None
            published = message.get("published-print") or message.get("published-online") or message.get("created")
            if published:
                date_parts = published.get("date-parts", [[]])
                if date_parts and date_parts[0]:
                    year = date_parts[0][0]
            
            # 期刊/会议
            venue = None
            container = message.get("container-title", [])
            if container:
                venue = container[0]
            elif message.get("publisher"):
                venue = message.get("publisher")
            
            # 摘要
            abstract = message.get("abstract", "")
            if abstract:
                # 清理HTML标签
                abstract = re.sub(r'<[^>]+>', '', abstract)
            
            # 关键词
            keywords = message.get("subject", [])
            
            return PaperMetadata(
                title=title,
                authors=authors,
                year=year,
                venue=venue,
                abstract=abstract or None,
                keywords=keywords,
                doi=doi,
            )
        except Exception as e:
            logger.error(f"解析Crossref响应失败: {e}")
            return None
    
    async def fetch_openalex_metadata(self, doi: str) -> Optional[PaperMetadata]:
        """
        从OpenAlex API获取元数据（备用）
        
        API: https://api.openalex.org/works/doi:DOI
        """
        url = f"https://api.openalex.org/works/doi:{doi}"
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                data = response.json()
                return self._parse_openalex_response(data, doi)
        except Exception as e:
            logger.error(f"获取OpenAlex元数据失败: {doi}, 错误: {e}")
            return None
    
    def _parse_openalex_response(self, data: dict, doi: str) -> Optional[PaperMetadata]:
        """解析OpenAlex API响应"""
        try:
            # 标题
            title = data.get("title")
            
            # 作者
            authors = []
            for authorship in data.get("authorships", []):
                author = authorship.get("author", {})
                name = author.get("display_name")
                if name:
                    authors.append(name)
            
            # 年份
            year = data.get("publication_year")
            
            # 期刊
            venue = None
            primary_location = data.get("primary_location", {})
            source = primary_location.get("source", {})
            if source:
                venue = source.get("display_name")
            
            # 摘要 - OpenAlex返回倒排索引格式，需要重建
            abstract = None
            abstract_inverted_index = data.get("abstract_inverted_index")
            if abstract_inverted_index:
                # 重建摘要
                words = []
                for word, positions in abstract_inverted_index.items():
                    for pos in positions:
                        while len(words) <= pos:
                            words.append("")
                        words[pos] = word
                abstract = " ".join(words)
            
            # 关键词
            keywords = [c.get("display_name") for c in data.get("concepts", [])[:5]]
            
            return PaperMetadata(
                title=title,
                authors=authors,
                year=year,
                venue=venue,
                abstract=abstract,
                keywords=keywords,
                doi=doi,
            )
        except Exception as e:
            logger.error(f"解析OpenAlex响应失败: {e}")
            return None


# 全局实例
metadata_service = MetadataService()


async def enrich_paper_metadata(source_type: str, source_value: str) -> Optional[Dict[str, Any]]:
    """
    便捷函数：获取并返回论文元数据
    
    Returns:
        包含元数据的字典，如果获取失败则返回 None
    """
    metadata = await metadata_service.fetch_metadata(source_type, source_value)
    if metadata:
        return metadata.to_dict()
    return None

