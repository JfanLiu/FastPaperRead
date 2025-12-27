"""
PDF解析器 - 使用MinerU进行高质量PDF解析
"""
import os
import json
import asyncio
import subprocess
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging
import zipfile
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# 缓存 MinerU 安装状态
_mineru_available: Optional[bool] = None

# 设置 HuggingFace 镜像（解决国内网络问题）
if not os.environ.get("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"


def check_mineru_installed() -> bool:
    """检查MinerU是否安装"""
    global _mineru_available
    if _mineru_available is not None:
        return _mineru_available
    
    # 检查 mineru 命令是否存在（新版本使用 mineru 命令）
    _mineru_available = shutil.which("mineru") is not None
    if _mineru_available:
        logger.info("MinerU (mineru) 已安装")
    else:
        logger.info("MinerU 未安装，将使用 PyMuPDF 备用解析器")
    return _mineru_available


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
    
    使用MinerU进行高质量PDF解析，提取：
    - 结构化文本(Markdown)
    - 图表
    - 表格
    - 公式
    """
    
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        # 启动时检查一次
        check_mineru_installed()
    
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

        # 优先使用 MinerU 官方 API（若配置了 token 且开启开关）
        api_token = settings.MINERU_API_TOKEN
        if settings.MINERU_USE_API and api_token:
            try:
                api_result = await self._run_mineru_api(pdf_path, output_path, api_token)
                if api_result and api_result.success:
                    return api_result
                logger.warning("MinerU API 解析失败，尝试本地 mineru")
            except Exception as api_err:
                logger.warning(f"MinerU API 异常: {api_err}, 将尝试本地 mineru")

        try:
            # 根据MinerU安装状态选择解析器
            if check_mineru_installed():
                result = await self._run_mineru(pdf_path, output_path)
            else:
                # 直接使用备用解析器，不等待
                result = await self._fallback_parse(pdf_path, output_path)
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
        
        MinerU 2.x 命令: mineru -p {pdf_path} -o {output_path}
        
        加速选项：
        - --device cuda: 使用 GPU 加速
        - --formula false: 关闭公式识别（可选，节省时间）
        - --table false: 关闭表格识别（可选，节省时间）
        """
        try:
            # 使用 mineru 命令行工具（新版本）
            device = "cuda" if settings.MINERU_USE_GPU else "cpu"
            cmd = [
                "mineru",
                "-p", str(pdf_path),
                "-o", str(output_path),
                "--device", device,
            ]
            
            # 快速模式：关闭公式/表格识别
            if settings.MINERU_FAST_MODE or os.environ.get("MINERU_FAST_MODE", "").lower() == "true":
                cmd.extend(["--formula", "false", "--table", "false"])
                logger.info("MinerU 快速模式：关闭公式/表格识别")
            
            logger.info(f"运行 MinerU: {' '.join(cmd)}")
            
            # 设置环境变量
            env = os.environ.copy()
            env["HF_ENDPOINT"] = env.get("HF_ENDPOINT", "https://hf-mirror.com")
            
            # 指定使用的 GPU（从配置读取，默认使用第一张）
            if "CUDA_VISIBLE_DEVICES" not in env:
                env["CUDA_VISIBLE_DEVICES"] = settings.MINERU_GPU_ID
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "未知错误"
                logger.warning(f"MinerU执行失败 (code={process.returncode}, device={device}): {error_msg[:200]}")
                # 如果GPU不可用，自动退回CPU再试一次
                if device == "cuda":
                    logger.info("尝试使用CPU重新运行 MinerU")
                    settings.MINERU_USE_GPU = False  # 避免递归时继续用GPU
                    return await self._run_mineru(pdf_path, output_path)
                logger.warning("使用备用解析器")
                return await self._fallback_parse(pdf_path, output_path)
            
            # 读取解析结果
            return self._read_mineru_output(output_path, pdf_path.stem)
            
        except Exception as e:
            logger.warning(f"MinerU异常: {e}, 使用备用解析器")
            return await self._fallback_parse(pdf_path, output_path)

    async def _run_mineru_api(self, pdf_path: Path, output_path: Path, token: str) -> ParseResult:
        """
        使用 MinerU 官方 API 解析（上传 -> 轮询 -> 下载结果 zip）
        """
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        }
        base = settings.MINERU_API_BASE.rstrip("/")
        upload_url = f"{base}/file-urls/batch"
        payload = {
            "files": [{"name": pdf_path.name}],
            "model_version": "vlm",
        }
        # 快速模式关闭公式/表格
        if settings.MINERU_FAST_MODE or os.environ.get("MINERU_FAST_MODE", "").lower() == "true":
            payload["enable_formula"] = False
            payload["enable_table"] = False

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(upload_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 0:
                raise RuntimeError(f"申请上传链接失败: {data}")
            batch_id = data["data"]["batch_id"]
            file_urls = data["data"]["file_urls"]
            if not file_urls:
                raise RuntimeError("未返回上传URL")

            # 上传文件（PUT 预签名地址）
            upload_resp = await client.put(file_urls[0], content=pdf_path.read_bytes())
            upload_resp.raise_for_status()
            logger.info(f"MinerU API 上传成功: {pdf_path.name}")

            # 轮询解析结果
            result_url = f"{base}/extract-results/batch/{batch_id}"
            full_zip_url = None
            for _ in range(30):  # 最多约 5 分钟（30*10s）
                res = await client.get(result_url, headers=headers)
                res.raise_for_status()
                res_json = res.json()
                if res_json.get("code") != 0:
                    raise RuntimeError(f"查询结果失败: {res_json}")
                extract_list = res_json.get("data", {}).get("extract_result", [])
                if not extract_list:
                    await asyncio.sleep(10)
                    continue
                state = extract_list[0].get("state")
                if state == "done":
                    full_zip_url = extract_list[0].get("full_zip_url")
                    break
                if state == "failed":
                    raise RuntimeError(f"MinerU API 解析失败: {extract_list[0].get('err_msg')}")
                await asyncio.sleep(10)

            if not full_zip_url:
                raise RuntimeError("MinerU API 结果超时")

            # 下载并解压结果
            zip_bytes = await client.get(full_zip_url)
            zip_bytes.raise_for_status()

        api_output_dir = output_path / "api"
        api_output_dir.mkdir(parents=True, exist_ok=True)
        zip_path = api_output_dir / "mineru_result.zip"
        zip_path.write_bytes(zip_bytes.content)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(api_output_dir)

        return self._read_extracted_output(api_output_dir, pdf_path.stem)
    
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
    
    def _read_extracted_output(self, base_dir: Path, pdf_name: str) -> ParseResult:
        """
        从 MinerU API 解压结果中读取 markdown / content_list
        """
        md_path = ""
        for p in base_dir.rglob("*.md"):
            md_path = str(p)
            break

        content_list = []
        cl_path = None
        for p in base_dir.rglob("*content_list*.json"):
            cl_path = p
            break
        if cl_path:
            try:
                content_list = json.loads(cl_path.read_text(encoding="utf-8"))
            except Exception as e:
                logger.warning(f"读取 content_list 失败: {e}")

        figures, tables, equations = [], [], []
        image_url_prefix = f"/output/{pdf_name}/api/"
        for idx, item in enumerate(content_list):
            item_type = item.get("type", "")
            if item_type in ("image", "figure"):
                img_path = item.get("img_path") or item.get("path")
                if img_path:
                    item["path"] = image_url_prefix + str(Path(img_path)).replace("\\", "/")
                item["id"] = item.get("id") or f"fig_{idx}"
                figures.append(item)
            elif item_type == "table":
                tables.append(item)
            elif item_type in ("equation", "interline_equation"):
                equations.append(item)

        md_content = Path(md_path).read_text(encoding="utf-8") if md_path and Path(md_path).exists() else ""
        metadata = self._extract_metadata_from_text(md_content)

        return ParseResult(
            markdown_path=md_path,
            content_list=content_list,
            figures=figures,
            tables=tables,
            equations=equations,
            metadata=metadata,
            success=bool(md_path)
        )

    def _read_mineru_output(self, output_path: Path, pdf_name: str) -> ParseResult:
        """
        读取MinerU输出结果
        
        MinerU 2.x 输出结构:
        output_path/
          pdf_name/
            auto/
              pdf_name.md
              pdf_name_content_list.json
              images/
        """
        # MinerU 2.x 输出路径
        auto_path = output_path / pdf_name / "auto"
        
        # 读取Markdown
        md_path = auto_path / f"{pdf_name}.md"
        if not md_path.exists():
            # 尝试其他可能的路径
            for p in output_path.rglob("*.md"):
                md_path = p
                break
        
        # 读取content_list（MinerU 2.x 格式）
        content_list = []
        content_list_path = auto_path / f"{pdf_name}_content_list.json"
        if not content_list_path.exists():
            # 旧版本格式
            content_list_path = auto_path / "content_list.json"
        
        if content_list_path.exists():
            try:
                content_list = json.loads(content_list_path.read_text(encoding="utf-8"))
            except Exception as e:
                logger.warning(f"读取 content_list.json 失败: {e}")
        
        # 提取各类元素，并转换图片路径为可访问的 URL
        figures = []
        tables = []
        equations = []
        
        # 计算图片的 URL 前缀：/output/{pdf_name}/{pdf_name}/auto/
        image_url_prefix = f"/output/{pdf_name}/{pdf_name}/auto/"
        
        for idx, item in enumerate(content_list):
            item_type = item.get("type", "")
            if item_type in ("image", "figure"):
                # 转换 img_path 为可访问的 URL
                img_path = item.get("img_path", "")
                if img_path:
                    # img_path 格式: images/xxx.jpg -> /output/{pdf_name}/{pdf_name}/auto/images/xxx.jpg
                    item["path"] = f"{image_url_prefix}{img_path}"
                    item["id"] = f"fig_{idx}"
                    # 提取 caption
                    captions = item.get("image_caption", [])
                    if captions:
                        item["caption"] = " ".join(captions) if isinstance(captions, list) else captions
                figures.append(item)
            elif item_type == "table":
                tables.append(item)
            elif item_type in ("equation", "interline_equation"):
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
            "keywords": [],
            "year": None,
            "venue": None
        }
        
        lines = text.strip().split("\n")
        clean_lines = []
        for line in lines:
            line = line.strip()
            # 跳过空行、页码标记、分隔线、Markdown标记
            if line and not line.startswith("<!--") and not line.startswith("---") and not re.match(r'^\d+$', line):
                # 移除 Markdown 标题标记以便处理
                clean_lines.append(line)
        
        # 寻找标题 - 跳过出版信息行（如 "To appear in..."）
        title_idx = 0
        for i, line in enumerate(clean_lines[:10]):
            # 跳过出版信息
            if re.match(r'^(To appear|Published|Accepted|Submitted|Preprint)', line, re.IGNORECASE):
                continue
            # 跳过太短的行
            if len(line) < 5:
                continue
            # 移除 Markdown 标题标记
            clean_title = re.sub(r'^#+\s*', '', line)
            # 找到看起来像标题的行
            if len(clean_title) > 5 and not re.match(r'^(Abstract|Keywords|Introduction)', clean_title, re.IGNORECASE):
                metadata["title"] = clean_title[:200]
                title_idx = i
                break
        
        # 寻找作者 - 在标题之后、摘要之前
        for i, line in enumerate(clean_lines[title_idx+1:title_idx+20]):
            # 移除 Markdown 标记
            line = re.sub(r'^#+\s*', '', line)
            
            # 遇到摘要就停止
            if re.match(r'^Abstract', line, re.IGNORECASE):
                break
            
            # 跳过机构名称（通常全大写或包含University/Institute等）
            if re.match(r'^[A-Z\s]{3,}$', line):  # 纯大写行
                continue
            if re.search(r'^(University|Institute|Laboratory|Department|NVIDIA|Google|Microsoft|Meta|Facebook|School|College)\b', line, re.IGNORECASE):
                continue
            
            # 清理特殊符号并检查是否像作者名
            clean_line = re.sub(r'[∗†‡\*\d\[\]\(\)]+', '', line).strip()
            # 处理特殊的变音符号（如 M¨uller -> Müller）
            clean_line = clean_line.replace('¨u', 'ü').replace('¨o', 'ö').replace('¨a', 'ä')
            
            # 检查是否像单个作者名（FirstName LastName 或 FirstName M. LastName）
            # 支持各种Unicode字符
            if re.match(r'^[A-Z][a-zA-Z\u00C0-\u017F]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z\u00C0-\u017F]+$', clean_line):
                metadata["authors"].append(clean_line)
                continue
            
            # 检查是否是多个作者在一行（逗号分隔）
            if ',' in line or ' and ' in line.lower():
                parts = re.split(r',\s*(?:and\s+)?|\s+and\s+', line, flags=re.IGNORECASE)
                for part in parts:
                    clean_part = re.sub(r'[∗†‡\*\d\[\]\(\)]+', '', part).strip()
                    clean_part = clean_part.replace('¨u', 'ü').replace('¨o', 'ö').replace('¨a', 'ä')
                    if re.match(r'^[A-Z][a-zA-Z\u00C0-\u017F]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-zA-Z\u00C0-\u017F]+$', clean_part):
                        metadata["authors"].append(clean_part)
        
        # 去重并限制数量
        metadata["authors"] = list(dict.fromkeys(metadata["authors"]))[:20]
        
        # 尝试提取摘要 - 支持 Markdown 格式
        abstract_match = re.search(
            r'(?:^#+\s*Abstract|^Abstract)[:\s]*\n?(.+?)(?=\n(?:CR Categories|Keywords|^#+|Introduction|1\s|1\.))',
            text,
            re.IGNORECASE | re.DOTALL | re.MULTILINE
        )
        if abstract_match:
            abstract_text = abstract_match.group(1).strip()
            # 清理换行符
            abstract_text = re.sub(r'\s+', ' ', abstract_text)
            metadata["abstract"] = abstract_text[:2000]
        
        # 尝试提取关键词
        keywords_match = re.search(
            r'Keywords?[:\s]*(.+?)(?=\n\n|\n\d\.|\nIntroduction|\n#)',
            text,
            re.IGNORECASE | re.DOTALL
        )
        if keywords_match:
            keywords_text = keywords_match.group(1).strip()
            # 清理并分割
            keywords_text = re.sub(r'\s+', ' ', keywords_text)
            metadata["keywords"] = [
                k.strip() 
                for k in re.split(r'[,;，；]', keywords_text) 
                if k.strip() and len(k.strip()) < 100 and len(k.strip()) > 2
            ][:10]
        
        # 尝试提取年份 - 按优先级排序
        # 1. 首先从出版信息中提取（如 TOG 32(4) 表示2013年）
        tog_match = re.search(r'TOG\s+(\d+)\s*\(', text[:500], re.IGNORECASE)
        if tog_match:
            vol = int(tog_match.group(1))
            year = 1981 + vol  # ACM TOG 卷1 = 1982年
            if 1990 <= year <= 2030:
                metadata["year"] = year
        
        # 2. 如果没找到，从SIGGRAPH年份提取
        if not metadata["year"]:
            siggraph_match = re.search(r'SIGGRAPH\s*(\'?(\d{2})|\d{4})', text[:1000], re.IGNORECASE)
            if siggraph_match:
                year_str = siggraph_match.group(2) or siggraph_match.group(1)
                year_str = year_str.replace("'", "")
                if len(year_str) == 2:
                    year_num = int(year_str)
                    year = 2000 + year_num if year_num < 50 else 1900 + year_num
                else:
                    year = int(year_str)
                if 1990 <= year <= 2030:
                    metadata["year"] = year
        
        # 3. 最后尝试从标题/出版信息附近找明确的年份（避免引用中的年份）
        if not metadata["year"]:
            # 只在前300个字符中找（通常是标题和出版信息）
            year_match = re.search(r'\b(20[0-2][0-9]|201[0-9])\b', text[:300])
            if year_match:
                metadata["year"] = int(year_match.group(1))
        
        # 尝试提取会议/期刊
        venue_patterns = [
            r'(SIGGRAPH\s*\d*)',
            r'(ACM\s+TOG|ACM\s+Transactions\s+on\s+Graphics)',
            r'(CVPR|ICCV|ECCV|NeurIPS|ICML|ICLR|AAAI|IJCAI|CHI)\s*\d*',
            r'(?:To appear in|Published in|Accepted by)\s+([^\n\.]+)',
        ]
        for pattern in venue_patterns:
            venue_match = re.search(pattern, text[:2000], re.IGNORECASE)
            if venue_match:
                venue = venue_match.group(1).strip()
                # 简化会议名称
                venue = re.sub(r'\s+', ' ', venue)
                metadata["venue"] = venue[:100]
                break
        
        return metadata


# 单例实例
pdf_parser = PDFParser()
