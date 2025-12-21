"""
PDF解析器 - 使用MinerU进行高质量PDF解析
"""
import os
import json
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ParseResult:
    """解析结果"""
    markdown_path: str
    content_list: List[Dict]
    figures: List[Dict]
    tables: List[Dict]
    equations: List[Dict]
    metadata: Dict
    success: bool
    error: Optional[str] = None


class PDFParser:
    """
    PDF解析器
    
    使用MinerU(magic-pdf)进行高质量PDF解析，提取：
    - 结构化文本(Markdown)
    - 图表
    - 表格
    - 公式
    """
    
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    async def parse(self, pdf_path: str) -> ParseResult:
        """
        解析PDF文件
        
        Args:
            pdf_path: PDF文件路径
            
        Returns:
            ParseResult: 解析结果
        """
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            return ParseResult(
                markdown_path="",
                content_list=[],
                figures=[],
                tables=[],
                equations=[],
                metadata={},
                success=False,
                error=f"PDF文件不存在: {pdf_path}"
            )
        
        # 创建输出目录
        output_name = pdf_path.stem
        output_path = self.output_dir / output_name
        output_path.mkdir(parents=True, exist_ok=True)
        
        try:
            # 调用MinerU进行解析
            result = await self._run_mineru(pdf_path, output_path)
            return result
        except Exception as e:
            logger.error(f"PDF解析失败: {e}")
            return ParseResult(
                markdown_path="",
                content_list=[],
                figures=[],
                tables=[],
                equations=[],
                metadata={},
                success=False,
                error=str(e)
            )
    
    async def _run_mineru(self, pdf_path: Path, output_path: Path) -> ParseResult:
        """
        运行MinerU进行解析
        
        MinerU命令: magic-pdf -p {pdf_path} -o {output_path} -m auto
        """
        try:
            # 尝试使用magic-pdf命令行工具
            cmd = [
                "magic-pdf",
                "-p", str(pdf_path),
                "-o", str(output_path),
                "-m", "auto"  # 自动选择OCR或文本模式
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                # MinerU未安装或执行失败，使用备用方案
                logger.warning(f"MinerU执行失败: {stderr.decode()}, 使用备用解析器")
                return await self._fallback_parse(pdf_path, output_path)
            
            # 读取解析结果
            return self._read_mineru_output(output_path, pdf_path.stem)
            
        except FileNotFoundError:
            # magic-pdf命令不存在，使用备用方案
            logger.warning("MinerU未安装，使用备用解析器")
            return await self._fallback_parse(pdf_path, output_path)
    
    async def _fallback_parse(self, pdf_path: Path, output_path: Path) -> ParseResult:
        """
        备用解析方案 - 使用PyMuPDF提取基础内容
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            # 创建一个最简单的文本提取
            return await self._simple_text_extract(pdf_path, output_path)
        
        doc = fitz.open(str(pdf_path))
        
        # 提取文本
        markdown_content = []
        figures = []
        tables = []
        equations = []
        content_list = []
        
        for page_num, page in enumerate(doc, 1):
            text = page.get_text("text")
            markdown_content.append(f"<!-- Page {page_num} -->\n\n{text}\n\n---\n")
            
            # 简单的内容块
            content_list.append({
                "type": "text",
                "page": page_num,
                "content": text
            })
            
            # 提取图片
            for img_index, img in enumerate(page.get_images()):
                xref = img[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    img_filename = f"figure_p{page_num}_{img_index}.png"
                    img_path = output_path / "images" / img_filename
                    img_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    if pix.n < 5:  # GRAY or RGB
                        pix.save(str(img_path))
                    else:  # CMYK
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                        pix.save(str(img_path))
                    
                    figures.append({
                        "id": f"fig_{page_num}_{img_index}",
                        "page": page_num,
                        "path": str(img_path),
                        "caption": ""
                    })
                except Exception as e:
                    logger.warning(f"提取图片失败: {e}")
        
        doc.close()
        
        # 保存Markdown
        md_path = output_path / f"{pdf_path.stem}.md"
        md_content = "\n".join(markdown_content)
        md_path.write_text(md_content, encoding="utf-8")
        
        # 提取元数据
        metadata = self._extract_metadata_from_text(md_content)
        
        return ParseResult(
            markdown_path=str(md_path),
            content_list=content_list,
            figures=figures,
            tables=tables,
            equations=equations,
            metadata=metadata,
            success=True
        )
    
    async def _simple_text_extract(self, pdf_path: Path, output_path: Path) -> ParseResult:
        """
        最简单的文本提取 - 作为最后手段
        """
        try:
            import pypdf
            
            reader = pypdf.PdfReader(str(pdf_path))
            markdown_content = []
            content_list = []
            
            for page_num, page in enumerate(reader.pages, 1):
                text = page.extract_text() or ""
                markdown_content.append(f"<!-- Page {page_num} -->\n\n{text}\n\n---\n")
                content_list.append({
                    "type": "text",
                    "page": page_num,
                    "content": text
                })
            
            md_path = output_path / f"{pdf_path.stem}.md"
            md_content = "\n".join(markdown_content)
            md_path.write_text(md_content, encoding="utf-8")
            
            metadata = self._extract_metadata_from_text(md_content)
            
            return ParseResult(
                markdown_path=str(md_path),
                content_list=content_list,
                figures=[],
                tables=[],
                equations=[],
                metadata=metadata,
                success=True
            )
        except Exception as e:
            return ParseResult(
                markdown_path="",
                content_list=[],
                figures=[],
                tables=[],
                equations=[],
                metadata={},
                success=False,
                error=f"文本提取失败: {e}"
            )
    
    def _read_mineru_output(self, output_path: Path, pdf_name: str) -> ParseResult:
        """
        读取MinerU输出结果
        """
        # MinerU输出结构:
        # output_path/
        #   pdf_name/
        #     auto/
        #       pdf_name.md
        #       content_list.json
        #       images/
        
        auto_path = output_path / pdf_name / "auto"
        
        # 读取Markdown
        md_path = auto_path / f"{pdf_name}.md"
        if not md_path.exists():
            # 尝试其他可能的路径
            for p in output_path.rglob("*.md"):
                md_path = p
                break
        
        # 读取content_list
        content_list = []
        content_list_path = auto_path / "content_list.json"
        if content_list_path.exists():
            content_list = json.loads(content_list_path.read_text(encoding="utf-8"))
        
        # 提取各类元素
        figures = []
        tables = []
        equations = []
        
        for item in content_list:
            item_type = item.get("type", "")
            if item_type == "image":
                figures.append(item)
            elif item_type == "table":
                tables.append(item)
            elif item_type == "equation":
                equations.append(item)
        
        # 读取元数据
        md_content = md_path.read_text(encoding="utf-8") if md_path.exists() else ""
        metadata = self._extract_metadata_from_text(md_content)
        
        return ParseResult(
            markdown_path=str(md_path) if md_path.exists() else "",
            content_list=content_list,
            figures=figures,
            tables=tables,
            equations=equations,
            metadata=metadata,
            success=True
        )
    
    def _extract_metadata_from_text(self, text: str) -> Dict:
        """
        从文本中提取元数据
        """
        import re
        
        metadata = {
            "title": "",
            "authors": [],
            "abstract": "",
            "keywords": []
        }
        
        # 尝试提取标题（通常是第一个非空行）
        lines = text.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line and not line.startswith("#") and not line.startswith("<!--"):
                metadata["title"] = line[:200]  # 限制长度
                break
        
        # 尝试提取摘要
        abstract_match = re.search(
            r'(?:Abstract|摘要)[:\s]*(.+?)(?=\n\n|\n#|Introduction|1\.|Keywords)',
            text,
            re.IGNORECASE | re.DOTALL
        )
        if abstract_match:
            metadata["abstract"] = abstract_match.group(1).strip()[:2000]
        
        # 尝试提取关键词
        keywords_match = re.search(
            r'(?:Keywords?|关键词)[:\s]*(.+?)(?=\n\n|\n#)',
            text,
            re.IGNORECASE
        )
        if keywords_match:
            keywords_text = keywords_match.group(1)
            metadata["keywords"] = [
                k.strip() 
                for k in re.split(r'[,;，；]', keywords_text) 
                if k.strip()
            ][:10]
        
        return metadata


# 单例实例
pdf_parser = PDFParser()
