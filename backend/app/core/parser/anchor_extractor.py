"""
锚点提取器

从解析后的PDF内容中提取各类锚点：
- 段落锚点
- 图表锚点
- 公式锚点
- 表格锚点
- 章节锚点
- 引用锚点
"""
import re
import uuid
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from ...models.anchor import (
    Anchor, AnchorType, BoundingBox, 
    SectionTree, SectionNode
)


class AnchorExtractor:
    """锚点提取器"""
    
    def __init__(self, paper_id: str):
        self.paper_id = paper_id
        self.anchors: List[Anchor] = []
        self.section_tree: Optional[SectionTree] = None
        self._sequence_counter = 0
    
    def _next_sequence(self) -> int:
        """获取下一个序号"""
        self._sequence_counter += 1
        return self._sequence_counter
    
    def extract_all(
        self, 
        parsed_content: Dict[str, Any],
        pdf_path: Optional[str] = None
    ) -> Tuple[List[Anchor], SectionTree]:
        """
        从解析内容中提取所有锚点
        
        Args:
            parsed_content: MinerU解析后的内容
            pdf_path: PDF文件路径（用于提取图片）
            
        Returns:
            (锚点列表, 章节树)
        """
        self.anchors = []
        self._sequence_counter = 0
        
        # 1. 提取章节
        sections = parsed_content.get("sections", [])
        self._extract_sections(sections)
        
        # 2. 提取段落
        paragraphs = parsed_content.get("paragraphs", [])
        self._extract_paragraphs(paragraphs)
        
        # 3. 提取图表
        figures = parsed_content.get("figures", [])
        self._extract_figures(figures)
        
        # 4. 提取表格
        tables = parsed_content.get("tables", [])
        self._extract_tables(tables)
        
        # 5. 提取公式
        equations = parsed_content.get("equations", [])
        self._extract_equations(equations)
        
        # 6. 提取引用
        references = parsed_content.get("references", [])
        self._extract_references(references)
        
        # 7. 构建章节树
        self.section_tree = self._build_section_tree()
        
        return self.anchors, self.section_tree
    
    def _extract_sections(self, sections: List[Dict]) -> None:
        """提取章节锚点"""
        for section in sections:
            anchor = Anchor(
                id=str(uuid.uuid4()),
                paper_id=self.paper_id,
                type=AnchorType.SECTION,
                page=section.get("page", 1),
                bbox=self._parse_bbox(section.get("bbox")),
                section=section.get("title", ""),
                section_level=section.get("level", 1),
                sequence=self._next_sequence(),
                text=section.get("title", ""),
                metadata={
                    "level": section.get("level", 1),
                    "parent": section.get("parent"),
                }
            )
            self.anchors.append(anchor)
    
    def _extract_paragraphs(self, paragraphs: List[Dict]) -> None:
        """提取段落锚点"""
        current_section = None
        
        for para in paragraphs:
            # 跳过太短的段落
            text = para.get("text", "").strip()
            if len(text) < 20:
                continue
            
            # 更新当前章节
            if para.get("section"):
                current_section = para.get("section")
            
            anchor = Anchor(
                id=str(uuid.uuid4()),
                paper_id=self.paper_id,
                type=AnchorType.PARAGRAPH,
                page=para.get("page", 1),
                bbox=self._parse_bbox(para.get("bbox")),
                section=current_section,
                sequence=self._next_sequence(),
                text=text,
                metadata={
                    "word_count": len(text.split()),
                    "has_citations": bool(re.search(r'\[\d+\]|\([A-Z][a-z]+.*?\d{4}\)', text)),
                }
            )
            self.anchors.append(anchor)
    
    def _extract_figures(self, figures: List[Dict]) -> None:
        """提取图表锚点"""
        for fig in figures:
            # 提取图号
            caption = fig.get("caption", "")
            figure_number = self._extract_figure_number(caption)
            
            anchor = Anchor(
                id=str(uuid.uuid4()),
                paper_id=self.paper_id,
                type=AnchorType.FIGURE,
                page=fig.get("page", 1),
                bbox=self._parse_bbox(fig.get("bbox")),
                sequence=self._next_sequence(),
                text=caption,
                caption=caption,
                image_path=fig.get("image_path"),
                figure_number=figure_number,
                metadata={
                    "width": fig.get("width"),
                    "height": fig.get("height"),
                    "format": fig.get("format", "png"),
                }
            )
            self.anchors.append(anchor)
    
    def _extract_tables(self, tables: List[Dict]) -> None:
        """提取表格锚点"""
        for table in tables:
            caption = table.get("caption", "")
            
            anchor = Anchor(
                id=str(uuid.uuid4()),
                paper_id=self.paper_id,
                type=AnchorType.TABLE,
                page=table.get("page", 1),
                bbox=self._parse_bbox(table.get("bbox")),
                sequence=self._next_sequence(),
                text=caption,
                caption=caption,
                table_data=table.get("data"),  # 表格结构化数据
                metadata={
                    "rows": table.get("rows", 0),
                    "cols": table.get("cols", 0),
                    "has_header": table.get("has_header", True),
                }
            )
            self.anchors.append(anchor)
    
    def _extract_equations(self, equations: List[Dict]) -> None:
        """提取公式锚点"""
        for eq in equations:
            latex = eq.get("latex", eq.get("text", ""))
            
            # 提取符号
            symbols = self._extract_symbols(latex)
            
            # 提取公式编号
            eq_number = eq.get("number") or self._extract_equation_number(eq.get("text", ""))
            
            anchor = Anchor(
                id=str(uuid.uuid4()),
                paper_id=self.paper_id,
                type=AnchorType.EQUATION,
                page=eq.get("page", 1),
                bbox=self._parse_bbox(eq.get("bbox")),
                sequence=self._next_sequence(),
                text=eq.get("text", latex),
                latex=latex,
                equation_number=eq_number,
                symbols=symbols,
                metadata={
                    "is_inline": eq.get("is_inline", False),
                    "is_numbered": bool(eq_number),
                }
            )
            self.anchors.append(anchor)
    
    def _extract_references(self, references: List[Dict]) -> None:
        """提取引用锚点"""
        for i, ref in enumerate(references):
            anchor = Anchor(
                id=str(uuid.uuid4()),
                paper_id=self.paper_id,
                type=AnchorType.CITATION,
                page=ref.get("page", 1),
                bbox=self._parse_bbox(ref.get("bbox")),
                sequence=self._next_sequence(),
                text=ref.get("text", ""),
                ref_id=ref.get("id", f"ref_{i+1}"),
                ref_text=ref.get("text", ""),
                metadata={
                    "authors": ref.get("authors", []),
                    "title": ref.get("title"),
                    "year": ref.get("year"),
                    "venue": ref.get("venue"),
                    "doi": ref.get("doi"),
                }
            )
            self.anchors.append(anchor)
    
    def _build_section_tree(self) -> SectionTree:
        """构建章节树"""
        section_anchors = [a for a in self.anchors if a.type == AnchorType.SECTION]
        section_anchors.sort(key=lambda x: x.sequence)
        
        root_nodes: List[SectionNode] = []
        node_stack: List[Tuple[int, SectionNode]] = []  # (level, node)
        
        for anchor in section_anchors:
            node = SectionNode(
                id=str(uuid.uuid4()),
                title=anchor.text,
                level=anchor.section_level,
                anchor_id=anchor.id,
                page=anchor.page,
                children=[],
                is_read=False,
                is_must_read=self._is_must_read_section(anchor.text)
            )
            
            # 找到父节点
            while node_stack and node_stack[-1][0] >= node.level:
                node_stack.pop()
            
            if node_stack:
                # 添加到父节点
                parent_level, parent_node = node_stack[-1]
                parent_node.children.append(node)
            else:
                # 顶级节点
                root_nodes.append(node)
            
            node_stack.append((node.level, node))
        
        return SectionTree(paper_id=self.paper_id, sections=root_nodes)
    
    def _is_must_read_section(self, title: str) -> bool:
        """判断是否为必读章节"""
        must_read_keywords = [
            "abstract", "introduction", "method", "approach",
            "experiment", "result", "conclusion", "related work",
            "摘要", "引言", "方法", "实验", "结果", "结论"
        ]
        title_lower = title.lower()
        return any(kw in title_lower for kw in must_read_keywords)
    
    def _parse_bbox(self, bbox_data: Any) -> Optional[BoundingBox]:
        """解析边界框"""
        if not bbox_data:
            return None
        
        if isinstance(bbox_data, (list, tuple)) and len(bbox_data) >= 4:
            return BoundingBox(
                x1=float(bbox_data[0]),
                y1=float(bbox_data[1]),
                x2=float(bbox_data[2]),
                y2=float(bbox_data[3])
            )
        elif isinstance(bbox_data, dict):
            return BoundingBox(
                x1=float(bbox_data.get("x1", 0)),
                y1=float(bbox_data.get("y1", 0)),
                x2=float(bbox_data.get("x2", 1)),
                y2=float(bbox_data.get("y2", 1))
            )
        return None
    
    def _extract_figure_number(self, caption: str) -> Optional[str]:
        """从caption中提取图号"""
        patterns = [
            r'(Figure|Fig\.?|图)\s*(\d+)',
            r'(Table|表)\s*(\d+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, caption, re.IGNORECASE)
            if match:
                return f"{match.group(1)} {match.group(2)}"
        return None
    
    def _extract_equation_number(self, text: str) -> Optional[str]:
        """从文本中提取公式编号"""
        match = re.search(r'\((\d+)\)$', text.strip())
        if match:
            return match.group(1)
        return None
    
    def _extract_symbols(self, latex: str) -> List[str]:
        """从LaTeX中提取符号"""
        # 简化的符号提取
        symbols = set()
        
        # 提取单字母变量
        for match in re.finditer(r'(?<!\\)([a-zA-Z])(?![a-zA-Z])', latex):
            symbols.add(match.group(1))
        
        # 提取希腊字母
        greek_pattern = r'\\(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|phi|psi|omega)'
        for match in re.finditer(greek_pattern, latex, re.IGNORECASE):
            symbols.add(f"\\{match.group(1)}")
        
        return list(symbols)
    
    def get_anchors_by_type(self, anchor_type: AnchorType) -> List[Anchor]:
        """按类型获取锚点"""
        return [a for a in self.anchors if a.type == anchor_type]
    
    def get_anchors_by_page(self, page: int) -> List[Anchor]:
        """按页码获取锚点"""
        return [a for a in self.anchors if a.page == page]
    
    def get_anchor_by_id(self, anchor_id: str) -> Optional[Anchor]:
        """根据ID获取锚点"""
        for anchor in self.anchors:
            if anchor.id == anchor_id:
                return anchor
        return None

