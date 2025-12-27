"""
锚点提取器 - 从解析结果中提取结构化锚点
"""
import re
from typing import List, Dict, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ExtractedAnchor:
    """提取的锚点"""
    type: str  # paragraph, section, figure, table, equation, citation
    page: int
    sequence: int
    section: str
    section_level: int
    text: str
    caption: Optional[str] = None
    latex: Optional[str] = None
    image_path: Optional[str] = None
    figure_number: Optional[str] = None
    equation_number: Optional[str] = None
    table_data: Optional[Dict] = None
    ref_id: Optional[str] = None
    ref_text: Optional[str] = None
    bbox: Optional[List[float]] = None


class AnchorExtractor:
    """
    锚点提取器
    
    从Markdown内容和解析结果中提取结构化锚点
    """
    
    def __init__(self):
        # 章节模式匹配
        self.section_patterns = [
            (r'^#{1,6}\s+(.+)$', 'heading'),  # Markdown heading
            (r'^(\d+\.(?:\d+\.)*)\s+(.+)$', 'numbered'),  # 1. or 1.1 or 1.1.1
            (r'^(Abstract|Introduction|Related Work|Method|Experiments?|Results?|Discussion|Conclusion|References?)s?\s*$', 'keyword'),
        ]
        
        # 公式模式
        self.equation_patterns = [
            r'\$\$(.+?)\$\$',  # Display math
            r'\\\[(.+?)\\\]',  # LaTeX display
            r'\\begin\{equation\}(.+?)\\end\{equation\}',
        ]
        
        # 图表引用模式
        self.figure_ref_pattern = r'(?:Figure|Fig\.?|图)\s*(\d+(?:\.\d+)?)'
        self.table_ref_pattern = r'(?:Table|表)\s*(\d+(?:\.\d+)?)'
        
        # 引用模式
        self.citation_patterns = [
            r'\[(\d+(?:,\s*\d+)*)\]',  # [1], [1,2,3]
            r'\(([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4}(?:;\s*[A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4})*)\)',  # (Author, 2020)
        ]
    
    def extract_from_markdown(
        self,
        markdown_content: str,
        content_list: List[Dict] = None,
        figures: List[Dict] = None,
        tables: List[Dict] = None,
        equations: List[Dict] = None
    ) -> List[ExtractedAnchor]:
        """
        从Markdown内容中提取锚点
        
        Args:
            markdown_content: Markdown文本
            content_list: MinerU的content_list(可选)
            figures: 图表列表(可选)
            tables: 表格列表(可选)
            equations: 公式列表(可选)
            
        Returns:
            List[ExtractedAnchor]: 提取的锚点列表
        """
        anchors = []
        sequence = 0
        current_section = ""
        current_section_level = 0
        current_page = 1
        
        lines = markdown_content.split('\n')
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            # 检测页码标记
            page_match = re.match(r'<!--\s*Page\s+(\d+)\s*-->', line)
            if page_match:
                current_page = int(page_match.group(1))
                i += 1
                continue

            # 跳过作者行（例如多名作者 + 上标数字/符号）
            if self._is_author_line(line):
                i += 1
                continue
            
            # 检测章节
            section_anchor = self._extract_section(line, current_page, sequence)
            if section_anchor:
                # 作者行若被误判为章节也跳过
                if self._is_author_line(section_anchor.text):
                    i += 1
                    continue
                current_section = section_anchor.text
                current_section_level = section_anchor.section_level
                section_anchor.section = current_section
                anchors.append(section_anchor)
                sequence += 1
                i += 1
                continue
            
            # 检测公式（多行）
            if line.startswith('$$') or line.startswith('\\['):
                equation_lines = [line]
                i += 1
                while i < len(lines) and not (lines[i].strip().endswith('$$') or lines[i].strip().endswith('\\]')):
                    equation_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    equation_lines.append(lines[i])
                
                latex = '\n'.join(equation_lines)
                anchors.append(ExtractedAnchor(
                    type='equation',
                    page=current_page,
                    sequence=sequence,
                    section=current_section,
                    section_level=current_section_level,
                    text=latex,
                    latex=self._clean_latex(latex)
                ))
                sequence += 1
                i += 1
                continue
            
            # 检测图表引用
            if re.search(self.figure_ref_pattern, line, re.IGNORECASE):
                anchors.append(ExtractedAnchor(
                    type='figure',
                    page=current_page,
                    sequence=sequence,
                    section=current_section,
                    section_level=current_section_level,
                    text=line,
                    caption=line
                ))
                sequence += 1
            
            # 检测表格引用
            if re.search(self.table_ref_pattern, line, re.IGNORECASE):
                anchors.append(ExtractedAnchor(
                    type='table',
                    page=current_page,
                    sequence=sequence,
                    section=current_section,
                    section_level=current_section_level,
                    text=line,
                    caption=line
                ))
                sequence += 1
            
            # 检测段落
            if line and not line.startswith('#') and len(line) > 50:
                # 合并连续的段落行
                paragraph_lines = [line]
                i += 1
                while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith('#'):
                    paragraph_lines.append(lines[i].strip())
                    i += 1
                
                paragraph_text = ' '.join(paragraph_lines)
                
                # 检测段落中的引用
                citations = self._extract_citations(paragraph_text)
                
                anchors.append(ExtractedAnchor(
                    type='paragraph',
                    page=current_page,
                    sequence=sequence,
                    section=current_section,
                    section_level=current_section_level,
                    text=paragraph_text
                ))
                sequence += 1
                
                # 为引用创建单独的锚点
                for citation in citations:
                    anchors.append(ExtractedAnchor(
                        type='citation',
                        page=current_page,
                        sequence=sequence,
                        section=current_section,
                        section_level=current_section_level,
                        text=citation['text'],
                        ref_id=citation['ref_id'],
                        ref_text=citation['ref_text']
                    ))
                    sequence += 1
                
                continue
            
            i += 1
        
        # 合并MinerU的图表和公式信息
        if figures:
            anchors = self._merge_figures(anchors, figures)
            # 直接从 figures 列表创建 figure anchors（如果还没有）
            anchors = self._add_figure_anchors(anchors, figures, sequence)
        if tables:
            anchors = self._merge_tables(anchors, tables)
        if equations:
            anchors = self._merge_equations(anchors, equations)
        
        return anchors

    def _is_author_line(self, line: str) -> bool:
        """
        判断一行是否为作者列表：包含至少两个名字 + 上标/数字/逗号
        仅用于过滤出现在大纲中的作者行
        """
        import re
        # 去掉 markdown 标题符号
        line = re.sub(r'^#+\s*', '', line)
        # 需要有逗号/and/& 分隔多名作者
        if not re.search(r'(,| and | & )', line, re.IGNORECASE):
            return False
        # 含有上标/数字脚注
        if re.search(r'\^\{|\\?\\?\d|\$\\?\\?\\^', line):
            return True
        # 至少两个看似姓名的片段
        parts = re.split(r',|;| and | & ', line, flags=re.IGNORECASE)
        name_like = 0
        name_pat = re.compile(r'[A-Z][A-Za-zÀ-ÖØ-öø-ÿ\.-]+ [A-Z][A-Za-zÀ-ÖØ-öø-ÿ\.-]+')
        zh_pat = re.compile(r'[\u4e00-\u9fa5·]{2,6}')
        for p in parts:
            p = p.strip()
            if name_pat.search(p) or zh_pat.search(p):
                name_like += 1
        return name_like >= 2
    
    def _extract_section(self, line: str, page: int, sequence: int) -> Optional[ExtractedAnchor]:
        """提取章节"""
        # Markdown heading
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            return ExtractedAnchor(
                type='section',
                page=page,
                sequence=sequence,
                section=text,
                section_level=level,
                text=text
            )
        
        # Numbered section
        numbered_match = re.match(r'^(\d+(?:\.\d+)*)\s+(.+)$', line)
        if numbered_match:
            number = numbered_match.group(1)
            text = numbered_match.group(2).strip()
            level = len(number.split('.'))
            return ExtractedAnchor(
                type='section',
                page=page,
                sequence=sequence,
                section=f"{number} {text}",
                section_level=level,
                text=f"{number} {text}"
            )
        
        # Keyword section
        for keyword in ['Abstract', 'Introduction', 'Related Work', 'Method', 'Methodology',
                       'Experiments', 'Results', 'Discussion', 'Conclusion', 'References']:
            if line.lower().startswith(keyword.lower()):
                return ExtractedAnchor(
                    type='section',
                    page=page,
                    sequence=sequence,
                    section=keyword,
                    section_level=1,
                    text=line
                )
        
        return None
    
    def _extract_citations(self, text: str) -> List[Dict]:
        """提取引用"""
        citations = []
        
        # [1], [1,2,3] 格式
        for match in re.finditer(r'\[(\d+(?:,\s*\d+)*)\]', text):
            ref_ids = [r.strip() for r in match.group(1).split(',')]
            for ref_id in ref_ids:
                citations.append({
                    'ref_id': ref_id,
                    'ref_text': match.group(0),
                    'text': match.group(0)
                })
        
        # (Author, 2020) 格式
        for match in re.finditer(r'\(([A-Z][a-z]+(?:\s+et\s+al\.?)?,?\s*\d{4})\)', text):
            citations.append({
                'ref_id': match.group(1),
                'ref_text': match.group(0),
                'text': match.group(0)
            })
        
        return citations
    
    def _clean_latex(self, latex: str) -> str:
        """清理LaTeX代码"""
        # 移除$$和\[\]
        latex = re.sub(r'^\$\$|\$\$$', '', latex.strip())
        latex = re.sub(r'^\\\[|\\\]$', '', latex.strip())
        return latex.strip()
    
    def _merge_figures(self, anchors: List[ExtractedAnchor], figures: List[Dict]) -> List[ExtractedAnchor]:
        """合并图表信息"""
        figure_map = {f.get('id', str(i)): f for i, f in enumerate(figures)}
        
        for anchor in anchors:
            if anchor.type == 'figure':
                # 尝试匹配图表
                fig_num_match = re.search(r'(\d+)', anchor.text or '')
                if fig_num_match:
                    fig_num = fig_num_match.group(1)
                    for fid, fig in figure_map.items():
                        if fig_num in fid or fig_num in str(fig.get('number', '')):
                            anchor.image_path = fig.get('path', '')
                            anchor.figure_number = fig.get('number', fig_num)
                            anchor.caption = fig.get('caption', anchor.caption)
                            break
        
        return anchors
    
    def _add_figure_anchors(self, anchors: List[ExtractedAnchor], figures: List[Dict], start_sequence: int) -> List[ExtractedAnchor]:
        """
        直接从 figures 列表创建 figure anchors
        
        MinerU 解析的图片包含 path, caption, page_idx 等信息
        """
        # 获取已有的 figure image paths，避免重复
        existing_paths = {a.image_path for a in anchors if a.type == 'figure' and a.image_path}
        
        sequence = start_sequence
        for idx, fig in enumerate(figures):
            img_path = fig.get('path', '')
            
            # 跳过已存在的图片
            if img_path in existing_paths:
                continue
            
            # 获取页码（MinerU 使用 page_idx，从 0 开始）
            page = fig.get('page_idx', 0) + 1
            
            # 获取 caption
            caption = fig.get('caption', '')
            if not caption:
                captions = fig.get('image_caption', [])
                if captions:
                    caption = ' '.join(captions) if isinstance(captions, list) else str(captions)
            
            # 创建 figure anchor
            anchor = ExtractedAnchor(
                type='figure',
                page=page,
                sequence=sequence,
                section='',  # 后续可以根据页码推断所属章节
                section_level=0,
                text=caption or f'Figure {idx + 1}',
                caption=caption,
                image_path=img_path,
                figure_number=fig.get('id', f'fig_{idx + 1}'),
                bbox=fig.get('bbox')
            )
            anchors.append(anchor)
            sequence += 1
        
        return anchors
    
    def _merge_tables(self, anchors: List[ExtractedAnchor], tables: List[Dict]) -> List[ExtractedAnchor]:
        """合并表格信息"""
        for anchor in anchors:
            if anchor.type == 'table':
                # 尝试匹配表格
                table_num_match = re.search(r'(\d+)', anchor.text or '')
                if table_num_match:
                    table_num = table_num_match.group(1)
                    for table in tables:
                        if table_num in str(table.get('number', '')):
                            anchor.table_data = table.get('data')
                            anchor.caption = table.get('caption', anchor.caption)
                            break
        
        return anchors
    
    def _merge_equations(self, anchors: List[ExtractedAnchor], equations: List[Dict]) -> List[ExtractedAnchor]:
        """合并公式信息"""
        for anchor in anchors:
            if anchor.type == 'equation' and not anchor.latex:
                for eq in equations:
                    if eq.get('latex'):
                        anchor.latex = eq['latex']
                        anchor.equation_number = eq.get('number')
                        break
        
        return anchors
    
    def to_dict_list(self, anchors: List[ExtractedAnchor]) -> List[Dict]:
        """转换为字典列表，用于数据库存储"""
        return [
            {
                'type': a.type,
                'page': a.page,
                'sequence': a.sequence,
                'section': a.section,
                'section_level': a.section_level,
                'text': a.text,
                'caption': a.caption,
                'latex': a.latex,
                'image_path': a.image_path,
                'figure_number': a.figure_number,
                'equation_number': a.equation_number,
                'table_data': a.table_data,
                'ref_id': a.ref_id,
                'ref_text': a.ref_text,
                'bbox': a.bbox,
            }
            for a in anchors
        ]


# 单例实例
anchor_extractor = AnchorExtractor()
