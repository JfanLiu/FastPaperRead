"""
PDF解析器

使用MinerU进行PDF解析，提取结构化内容
"""
import os
import json
import asyncio
from typing import Dict, Any, Optional, Tuple, List
from pathlib import Path
import logging

from ...models.paper import Paper, PaperStatus, PaperSource
from ...models.anchor import Anchor, SectionTree
from .anchor_extractor import AnchorExtractor

logger = logging.getLogger(__name__)


class PDFParser:
    """PDF解析器 - 使用MinerU"""
    
    def __init__(self, temp_dir: str = "temp"):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # 检查MinerU是否可用
        self._mineru_available = False
        try:
            from magic_pdf.data.data_reader_writer import FileBasedDataWriter
            self._mineru_available = True
        except ImportError:
            logger.warning("MinerU (magic-pdf) 未安装，将使用简化解析")
    
    async def parse_pdf(
        self, 
        pdf_path: str,
        paper_id: str
    ) -> Tuple[Paper, List[Anchor], SectionTree]:
        """
        解析PDF文件
        
        Args:
            pdf_path: PDF文件路径
            paper_id: 论文ID
            
        Returns:
            (Paper对象, 锚点列表, 章节树)
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")
        
        # 创建输出目录
        output_dir = self.temp_dir / f"parsed_{paper_id}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 解析PDF
        if self._mineru_available:
            parsed_content = await self._parse_with_mineru(pdf_path, output_dir)
        else:
            parsed_content = await self._parse_fallback(pdf_path, output_dir)
        
        # 提取元数据
        metadata = self._extract_metadata(parsed_content)
        
        # 创建Paper对象
        paper = Paper(
            id=paper_id,
            title=metadata.get("title", "Untitled"),
            authors=metadata.get("authors", []),
            year=metadata.get("year"),
            abstract=metadata.get("abstract"),
            pdf_path=pdf_path,
            markdown_path=str(output_dir / "output.md"),
            status=PaperStatus.UNREAD
        )
        
        # 提取锚点
        extractor = AnchorExtractor(paper_id)
        anchors, section_tree = extractor.extract_all(parsed_content, pdf_path)
        
        # 更新Paper的锚点ID
        paper.anchor_ids = [a.id for a in anchors]
        
        # 保存解析结果
        self._save_parsed_result(output_dir, parsed_content, anchors, section_tree)
        
        return paper, anchors, section_tree
    
    async def _parse_with_mineru(
        self, 
        pdf_path: str, 
        output_dir: Path
    ) -> Dict[str, Any]:
        """使用MinerU解析PDF"""
        try:
            from magic_pdf.data.data_reader_writer import FileBasedDataWriter, FileBasedDataReader
            from magic_pdf.pipe.OCRPipe import OCRPipe
            from magic_pdf.pipe.TXTPipe import TXTPipe
            
            # 读取PDF
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            
            # 创建输出目录
            image_dir = output_dir / "images"
            image_dir.mkdir(exist_ok=True)
            
            # 创建数据写入器
            image_writer = FileBasedDataWriter(str(image_dir))
            
            # 使用OCR管道解析
            pipe = OCRPipe(
                pdf_bytes,
                model_list=[],
                image_writer=image_writer
            )
            
            # 执行解析
            pipe.pipe_classify()
            pipe.pipe_analyze()
            pipe.pipe_parse()
            
            # 获取解析结果
            content_list = pipe.pipe_mk_uni_format(str(image_dir), drop_mode="none")
            md_content = pipe.pipe_mk_markdown(str(image_dir), drop_mode="none")
            
            # 保存Markdown
            md_path = output_dir / "output.md"
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            
            # 转换为标准格式
            return self._convert_mineru_output(content_list, image_dir)
            
        except Exception as e:
            logger.error(f"MinerU解析失败: {e}")
            return await self._parse_fallback(pdf_path, output_dir)
    
    async def _parse_fallback(
        self, 
        pdf_path: str, 
        output_dir: Path
    ) -> Dict[str, Any]:
        """简化的PDF解析（当MinerU不可用时）"""
        try:
            import fitz  # PyMuPDF
            
            doc = fitz.open(pdf_path)
            
            paragraphs = []
            figures = []
            sections = []
            
            for page_num, page in enumerate(doc, 1):
                # 提取文本块
                blocks = page.get_text("dict")["blocks"]
                
                for block in blocks:
                    if block["type"] == 0:  # 文本块
                        text = ""
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                text += span.get("text", "")
                            text += "\n"
                        
                        text = text.strip()
                        if len(text) > 20:
                            # 检测是否为标题
                            if self._is_section_title(text, block):
                                sections.append({
                                    "title": text,
                                    "page": page_num,
                                    "level": self._detect_heading_level(block),
                                    "bbox": block.get("bbox")
                                })
                            else:
                                paragraphs.append({
                                    "text": text,
                                    "page": page_num,
                                    "bbox": block.get("bbox")
                                })
                    
                    elif block["type"] == 1:  # 图片块
                        # 保存图片
                        img_path = output_dir / "images" / f"fig_{page_num}_{len(figures)}.png"
                        img_path.parent.mkdir(exist_ok=True)
                        
                        try:
                            pix = fitz.Pixmap(doc, block.get("image"))
                            pix.save(str(img_path))
                            
                            figures.append({
                                "page": page_num,
                                "bbox": block.get("bbox"),
                                "image_path": str(img_path),
                                "caption": ""  # 需要后续提取
                            })
                        except:
                            pass
            
            doc.close()
            
            # 创建Markdown
            md_content = self._create_markdown(paragraphs, sections)
            md_path = output_dir / "output.md"
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            
            return {
                "paragraphs": paragraphs,
                "sections": sections,
                "figures": figures,
                "tables": [],
                "equations": [],
                "references": []
            }
            
        except ImportError:
            logger.error("PyMuPDF未安装，无法解析PDF")
            return {
                "paragraphs": [],
                "sections": [],
                "figures": [],
                "tables": [],
                "equations": [],
                "references": []
            }
    
    def _convert_mineru_output(
        self, 
        content_list: List[Dict], 
        image_dir: Path
    ) -> Dict[str, Any]:
        """转换MinerU输出为标准格式"""
        paragraphs = []
        figures = []
        tables = []
        equations = []
        sections = []
        
        for item in content_list:
            item_type = item.get("type", "")
            
            if item_type == "text":
                paragraphs.append({
                    "text": item.get("text", ""),
                    "page": item.get("page_idx", 0) + 1,
                    "bbox": item.get("bbox")
                })
            
            elif item_type == "image":
                figures.append({
                    "page": item.get("page_idx", 0) + 1,
                    "bbox": item.get("bbox"),
                    "image_path": str(image_dir / item.get("img_path", "")),
                    "caption": item.get("img_caption", "")
                })
            
            elif item_type == "table":
                tables.append({
                    "page": item.get("page_idx", 0) + 1,
                    "bbox": item.get("bbox"),
                    "caption": item.get("table_caption", ""),
                    "data": item.get("table_body")
                })
            
            elif item_type == "equation":
                equations.append({
                    "page": item.get("page_idx", 0) + 1,
                    "bbox": item.get("bbox"),
                    "latex": item.get("text", ""),
                    "text": item.get("text", ""),
                    "is_inline": item.get("inline", False)
                })
            
            elif item_type in ["title", "section"]:
                sections.append({
                    "title": item.get("text", ""),
                    "page": item.get("page_idx", 0) + 1,
                    "level": item.get("level", 1),
                    "bbox": item.get("bbox")
                })
        
        return {
            "paragraphs": paragraphs,
            "sections": sections,
            "figures": figures,
            "tables": tables,
            "equations": equations,
            "references": []
        }
    
    def _extract_metadata(self, parsed_content: Dict[str, Any]) -> Dict[str, Any]:
        """提取论文元数据"""
        metadata = {
            "title": "",
            "authors": [],
            "year": None,
            "abstract": ""
        }
        
        # 从章节中找标题
        sections = parsed_content.get("sections", [])
        if sections:
            # 第一个章节可能是标题
            first_section = sections[0]
            if first_section.get("level", 1) == 1:
                metadata["title"] = first_section.get("title", "")
        
        # 从段落中找摘要
        paragraphs = parsed_content.get("paragraphs", [])
        for para in paragraphs:
            text = para.get("text", "").lower()
            if "abstract" in text[:50]:
                # 下一个段落可能是摘要内容
                idx = paragraphs.index(para)
                if idx + 1 < len(paragraphs):
                    metadata["abstract"] = paragraphs[idx + 1].get("text", "")
                break
        
        return metadata
    
    def _is_section_title(self, text: str, block: Dict) -> bool:
        """判断文本是否为章节标题"""
        # 简单启发式规则
        if len(text) > 100:
            return False
        
        # 检查是否以数字开头（如 "1. Introduction"）
        if text[0].isdigit() and "." in text[:5]:
            return True
        
        # 检查是否为全大写
        if text.isupper() and len(text) < 50:
            return True
        
        # 检查字体大小（如果有的话）
        if block.get("lines"):
            first_span = block["lines"][0].get("spans", [{}])[0]
            font_size = first_span.get("size", 12)
            if font_size > 14:
                return True
        
        return False
    
    def _detect_heading_level(self, block: Dict) -> int:
        """检测标题级别"""
        # 基于字体大小判断
        if block.get("lines"):
            first_span = block["lines"][0].get("spans", [{}])[0]
            font_size = first_span.get("size", 12)
            
            if font_size >= 18:
                return 1
            elif font_size >= 14:
                return 2
            else:
                return 3
        
        return 2
    
    def _create_markdown(
        self, 
        paragraphs: List[Dict], 
        sections: List[Dict]
    ) -> str:
        """创建Markdown内容"""
        lines = []
        
        # 按页码排序
        all_items = []
        for s in sections:
            all_items.append(("section", s))
        for p in paragraphs:
            all_items.append(("para", p))
        
        all_items.sort(key=lambda x: (x[1].get("page", 0), x[1].get("bbox", [0])[1] if x[1].get("bbox") else 0))
        
        for item_type, item in all_items:
            if item_type == "section":
                level = item.get("level", 2)
                lines.append(f"{'#' * level} {item.get('title', '')}\n")
            else:
                lines.append(f"{item.get('text', '')}\n")
        
        return "\n".join(lines)
    
    def _save_parsed_result(
        self,
        output_dir: Path,
        parsed_content: Dict[str, Any],
        anchors: List[Anchor],
        section_tree: SectionTree
    ) -> None:
        """保存解析结果"""
        # 保存解析内容
        with open(output_dir / "parsed_content.json", "w", encoding="utf-8") as f:
            json.dump(parsed_content, f, ensure_ascii=False, indent=2)
        
        # 保存锚点
        anchors_data = [a.model_dump() for a in anchors]
        with open(output_dir / "anchors.json", "w", encoding="utf-8") as f:
            json.dump(anchors_data, f, ensure_ascii=False, indent=2, default=str)
        
        # 保存章节树
        with open(output_dir / "section_tree.json", "w", encoding="utf-8") as f:
            json.dump(section_tree.model_dump(), f, ensure_ascii=False, indent=2)

