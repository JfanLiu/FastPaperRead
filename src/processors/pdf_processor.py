"""
PDF处理器 - 使用 MinerU (magic-pdf) 进行PDF解析
"""
import requests
import re
import os
import shutil
import json
from typing import Optional, Tuple
from pathlib import Path
from config import config


class PDFProcessor:
    """PDF处理器，使用MinerU进行PDF转Markdown"""
    
    def __init__(self):
        self.temp_dir = config.TEMP_DIR
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # 尝试导入 MinerU
        self._mineru_available = False
        try:
            from magic_pdf.data.data_reader_writer import FileBasedDataWriter, FileBasedDataReader
            from magic_pdf.pipe.OCRPipe import OCRPipe
            from magic_pdf.pipe.TXTPipe import TXTPipe
            self._mineru_available = True
        except ImportError:
            print("⚠️ MinerU (magic-pdf) 未安装，将使用简化模式")
    
    async def download_pdf(self, pdf_url: str, target_dir: str = None) -> str:
        """下载PDF文件到指定目录
        
        Args:
            pdf_url: PDF下载链接
            target_dir: 目标目录，如果为None则使用默认temp目录
            
        Returns:
            str: 下载的PDF文件路径
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(pdf_url, stream=True, timeout=60, headers=headers)
            response.raise_for_status()
            
            # 确定保存目录
            save_dir = target_dir if target_dir else self.temp_dir
            os.makedirs(save_dir, exist_ok=True)
            
            # 生成文件名
            url_hash = abs(hash(pdf_url)) % (10 ** 8)
            file_path = os.path.join(save_dir, f"paper_{url_hash}.pdf")
            
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            return file_path
            
        except Exception as e:
            raise Exception(f"PDF下载失败: {str(e)}")
    
    def convert_pdf_to_markdown(self, pdf_path: str) -> str:
        """使用MinerU将PDF转换为Markdown
        
        Args:
            pdf_path: PDF文件路径
            
        Returns:
            str: 生成的Markdown文件路径
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")
        
        if not self._mineru_available:
            return self._fallback_convert(pdf_path)
        
        try:
            from magic_pdf.data.data_reader_writer import FileBasedDataWriter, FileBasedDataReader
            from magic_pdf.model.doc_analyze_by_custom_model import doc_analyze
            from magic_pdf.pipe.OCRPipe import OCRPipe
            
            # 准备输出目录
            pdf_name = Path(pdf_path).stem
            output_dir = Path(self.temp_dir) / f"mineru_{pdf_name}"
            output_dir.mkdir(parents=True, exist_ok=True)
            
            image_dir = output_dir / "images"
            image_dir.mkdir(exist_ok=True)
            
            # 读取PDF
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()
            
            # 创建数据读写器
            image_writer = FileBasedDataWriter(str(image_dir))
            md_writer = FileBasedDataWriter(str(output_dir))
            
            # 使用OCR模式解析 (对学术论文效果更好)
            pipe = OCRPipe(
                pdf_bytes,
                model_list=[],
                image_writer=image_writer
            )
            
            # 执行解析
            pipe.pipe_classify()
            pipe.pipe_analyze()
            pipe.pipe_parse()
            
            # 获取Markdown内容
            md_content = pipe.pipe_mk_markdown(
                image_dir.name,
                drop_mode="none"
            )
            
            # 保存Markdown文件
            md_path = output_dir / f"{pdf_name}.md"
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_content)
            
            return str(md_path)
            
        except Exception as e:
            print(f"MinerU转换失败，使用fallback: {e}")
            return self._fallback_convert(pdf_path)
    
    def _fallback_convert(self, pdf_path: str) -> str:
        """简化的PDF转换（当MinerU不可用时）"""
        try:
            import fitz  # PyMuPDF
            
            pdf_name = Path(pdf_path).stem
            output_dir = Path(self.temp_dir) / f"fallback_{pdf_name}"
            output_dir.mkdir(parents=True, exist_ok=True)
            
            doc = fitz.open(pdf_path)
            text_content = []
            
            for page_num, page in enumerate(doc):
                text = page.get_text()
                text_content.append(f"## Page {page_num + 1}\n\n{text}")
            
            doc.close()
            
            md_path = output_dir / f"{pdf_name}.md"
            with open(md_path, "w", encoding="utf-8") as f:
                f.write("\n\n".join(text_content))
            
            return str(md_path)
            
        except ImportError:
            # 如果连PyMuPDF都没有，创建一个占位文件
            pdf_name = Path(pdf_path).stem
            md_path = Path(self.temp_dir) / f"{pdf_name}.md"
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(f"# {pdf_name}\n\n[PDF内容待解析，请安装 magic-pdf 或 PyMuPDF]")
            return str(md_path)
    
    def extract_git_url(self, text: str) -> Optional[str]:
        """从文本中提取Git仓库链接"""
        git_patterns = [
            r'https://github\.com/[\w\-_./]+',
            r'https://gitlab\.com/[\w\-_./]+',
            r'https://bitbucket\.org/[\w\-_./]+',
            r'git@github\.com:[\w\-_./]+\.git',
        ]
        
        for pattern in git_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                url = matches[0].rstrip('.,;:')
                # 清理URL末尾可能的多余字符
                if url.endswith('/tree') or url.endswith('/blob'):
                    url = '/'.join(url.split('/')[:-1])
                return url
        
        return None
    
    def process_pdf_to_tex(self, pdf_path: str) -> Tuple[str, Optional[str]]:
        """处理PDF文件，返回Markdown文件路径和Git链接
        
        注意：此方法名保持兼容性，实际输出为Markdown格式
        
        Args:
            pdf_path: PDF文件路径
            
        Returns:
            tuple: (markdown_file_path, git_url)
        """
        try:
            # 转换PDF
            md_path = self.convert_pdf_to_markdown(pdf_path)
            
            # 读取内容并提取Git链接
            with open(md_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            git_url = self.extract_git_url(content)
            
            return md_path, git_url
            
        except Exception as e:
            raise Exception(f"PDF处理失败: {str(e)}")
    
    def get_paper_content(self, md_path: str) -> str:
        """读取论文Markdown内容"""
        if not os.path.exists(md_path):
            raise FileNotFoundError(f"文件不存在: {md_path}")
        
        with open(md_path, 'r', encoding='utf-8') as f:
            return f.read()
