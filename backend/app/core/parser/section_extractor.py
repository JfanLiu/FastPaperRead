"""
章节提取器

提取论文的章节结构和层次关系
"""
import re
from typing import List, Dict, Optional, Tuple
from ...models.anchor import SectionTree, SectionNode


class SectionExtractor:
    """章节提取器"""
    
    # 标准章节名称映射
    STANDARD_SECTIONS = {
        # 英文
        "abstract": "Abstract",
        "introduction": "Introduction",
        "related work": "Related Work",
        "background": "Background",
        "method": "Method",
        "methodology": "Methodology",
        "approach": "Approach",
        "proposed method": "Proposed Method",
        "model": "Model",
        "architecture": "Architecture",
        "experiment": "Experiments",
        "experiments": "Experiments",
        "experimental setup": "Experimental Setup",
        "results": "Results",
        "analysis": "Analysis",
        "discussion": "Discussion",
        "conclusion": "Conclusion",
        "conclusions": "Conclusion",
        "future work": "Future Work",
        "acknowledgement": "Acknowledgement",
        "acknowledgements": "Acknowledgement",
        "references": "References",
        "appendix": "Appendix",
        # 中文
        "摘要": "Abstract",
        "引言": "Introduction",
        "相关工作": "Related Work",
        "背景": "Background",
        "方法": "Method",
        "实验": "Experiments",
        "结果": "Results",
        "分析": "Analysis",
        "讨论": "Discussion",
        "结论": "Conclusion",
        "参考文献": "References",
    }
    
    # 必读章节
    MUST_READ_SECTIONS = {
        "Abstract", "Introduction", "Method", "Methodology",
        "Approach", "Experiments", "Results", "Conclusion"
    }
    
    # 阅读路线模板
    READING_ROUTES = {
        "quick_repro": {
            "name": "快速复现路线",
            "description": "快速了解方法和实验设置，准备复现",
            "sections": ["Abstract", "Method", "Experiments", "Appendix"],
            "estimated_time": 20  # 分钟
        },
        "review": {
            "name": "审稿路线",
            "description": "评估论文质量和贡献",
            "sections": ["Abstract", "Introduction", "Method", "Experiments", "Results", "Conclusion"],
            "estimated_time": 40
        },
        "full": {
            "name": "全文路线",
            "description": "完整阅读论文",
            "sections": None,  # 全部
            "estimated_time": 60
        },
        "skim": {
            "name": "快速浏览",
            "description": "快速判断是否值得深读",
            "sections": ["Abstract", "Introduction", "Conclusion"],
            "estimated_time": 10
        }
    }
    
    def __init__(self):
        pass
    
    def extract_sections(
        self, 
        text: str, 
        page_mapping: Dict[str, int] = None
    ) -> List[Dict]:
        """
        从文本中提取章节
        
        Args:
            text: 论文文本
            page_mapping: 文本位置到页码的映射
            
        Returns:
            章节列表
        """
        sections = []
        
        # 多种章节标题模式
        patterns = [
            # 1. Introduction, 2. Method 等
            r'^(\d+)[.\s]+([A-Z][A-Za-z\s]+)$',
            # I. Introduction, II. Method 等
            r'^([IVX]+)[.\s]+([A-Z][A-Za-z\s]+)$',
            # 全大写: INTRODUCTION, METHOD 等
            r'^([A-Z][A-Z\s]+)$',
            # 中文: 一、引言, 1. 引言 等
            r'^([一二三四五六七八九十\d]+)[.、\s]+(.+)$',
        ]
        
        lines = text.split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or len(line) > 100:
                continue
            
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    # 判断层级
                    level = self._detect_level(match, pattern)
                    title = self._normalize_title(match.groups()[-1] if len(match.groups()) > 1 else match.group(0))
                    
                    if title:
                        sections.append({
                            "title": title,
                            "original_title": line,
                            "level": level,
                            "line_number": i,
                            "page": page_mapping.get(str(i), 1) if page_mapping else 1,
                            "is_must_read": self._is_must_read(title)
                        })
                    break
        
        return sections
    
    def _detect_level(self, match, pattern: str) -> int:
        """检测章节层级"""
        groups = match.groups()
        
        if len(groups) >= 2:
            prefix = groups[0]
            # 检查数字格式
            if re.match(r'^\d+$', prefix):
                if '.' in prefix:
                    return prefix.count('.') + 1
                return 1
            # 检查罗马数字
            if re.match(r'^[IVX]+$', prefix):
                return 1
        
        # 全大写通常是顶级
        if match.group(0).isupper():
            return 1
        
        return 2
    
    def _normalize_title(self, title: str) -> str:
        """标准化章节标题"""
        title = title.strip()
        title_lower = title.lower()
        
        # 查找标准名称
        for key, standard in self.STANDARD_SECTIONS.items():
            if key in title_lower:
                return standard
        
        # 首字母大写
        return title.title()
    
    def _is_must_read(self, title: str) -> bool:
        """判断是否为必读章节"""
        title_normalized = self._normalize_title(title)
        return title_normalized in self.MUST_READ_SECTIONS
    
    def build_section_tree(
        self, 
        sections: List[Dict],
        paper_id: str
    ) -> SectionTree:
        """构建章节树"""
        import uuid
        
        nodes = []
        for section in sections:
            node = SectionNode(
                id=str(uuid.uuid4()),
                title=section["title"],
                level=section["level"],
                anchor_id="",  # 需要后续关联
                page=section.get("page", 1),
                children=[],
                is_read=False,
                is_must_read=section.get("is_must_read", False)
            )
            nodes.append(node)
        
        # 构建层级关系
        root_nodes = []
        stack = []
        
        for node in nodes:
            while stack and stack[-1].level >= node.level:
                stack.pop()
            
            if stack:
                stack[-1].children.append(node)
            else:
                root_nodes.append(node)
            
            stack.append(node)
        
        return SectionTree(paper_id=paper_id, sections=root_nodes)
    
    def get_reading_route(
        self, 
        route_name: str,
        section_tree: SectionTree
    ) -> List[SectionNode]:
        """
        获取阅读路线
        
        Args:
            route_name: 路线名称 (quick_repro/review/full/skim)
            section_tree: 章节树
            
        Returns:
            按路线排序的章节列表
        """
        route = self.READING_ROUTES.get(route_name, self.READING_ROUTES["full"])
        target_sections = route.get("sections")
        
        if target_sections is None:
            # 全部章节
            return self._flatten_tree(section_tree.sections)
        
        # 过滤并排序
        all_sections = self._flatten_tree(section_tree.sections)
        result = []
        
        for target in target_sections:
            for section in all_sections:
                if target.lower() in section.title.lower():
                    result.append(section)
                    break
        
        return result
    
    def _flatten_tree(self, nodes: List[SectionNode]) -> List[SectionNode]:
        """将树展平为列表"""
        result = []
        for node in nodes:
            result.append(node)
            if node.children:
                result.extend(self._flatten_tree(node.children))
        return result
    
    def estimate_reading_time(
        self, 
        section_tree: SectionTree,
        words_per_minute: int = 200
    ) -> Dict[str, int]:
        """
        估算阅读时间
        
        Returns:
            各路线的估算时间（分钟）
        """
        # 简化估算
        total_sections = len(self._flatten_tree(section_tree.sections))
        
        return {
            "skim": min(10, total_sections * 2),
            "quick_repro": min(25, total_sections * 4),
            "review": min(45, total_sections * 6),
            "full": min(90, total_sections * 8)
        }


