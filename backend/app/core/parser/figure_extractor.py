"""
图表提取器

专门用于提取和处理论文中的图表
"""
import os
import re
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from ...models.anchor import Anchor, AnchorType


class FigureExtractor:
    """图表提取器"""
    
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.image_dir = self.output_dir / "images"
        self.image_dir.mkdir(parents=True, exist_ok=True)
    
    def extract_figures_from_pdf(
        self, 
        pdf_path: str
    ) -> List[Dict[str, Any]]:
        """
        从PDF中提取图表
        
        Returns:
            图表信息列表
        """
        try:
            import fitz
            
            doc = fitz.open(pdf_path)
            figures = []
            
            for page_num, page in enumerate(doc, 1):
                # 提取图片
                images = page.get_images()
                
                for img_idx, img in enumerate(images):
                    try:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]
                        
                        # 保存图片
                        img_filename = f"fig_p{page_num}_{img_idx}.{image_ext}"
                        img_path = self.image_dir / img_filename
                        
                        with open(img_path, "wb") as f:
                            f.write(image_bytes)
                        
                        # 获取图片位置
                        img_rect = page.get_image_rects(xref)
                        bbox = None
                        if img_rect:
                            rect = img_rect[0]
                            bbox = [rect.x0, rect.y0, rect.x1, rect.y1]
                        
                        figures.append({
                            "page": page_num,
                            "image_path": str(img_path),
                            "bbox": bbox,
                            "width": base_image.get("width"),
                            "height": base_image.get("height"),
                            "format": image_ext,
                            "caption": ""  # 需要后续匹配
                        })
                        
                    except Exception as e:
                        continue
            
            doc.close()
            
            # 匹配caption
            figures = self._match_captions(pdf_path, figures)
            
            return figures
            
        except ImportError:
            return []
    
    def _match_captions(
        self, 
        pdf_path: str, 
        figures: List[Dict]
    ) -> List[Dict]:
        """匹配图表caption"""
        try:
            import fitz
            
            doc = fitz.open(pdf_path)
            
            # 收集所有caption候选
            caption_pattern = re.compile(
                r'(Figure|Fig\.?|Table|图|表)\s*(\d+)[.:]?\s*(.+?)(?=\n|$)',
                re.IGNORECASE | re.MULTILINE
            )
            
            captions_by_page = {}
            
            for page_num, page in enumerate(doc, 1):
                text = page.get_text()
                matches = caption_pattern.findall(text)
                
                captions_by_page[page_num] = [
                    {
                        "type": match[0],
                        "number": match[1],
                        "text": f"{match[0]} {match[1]}: {match[2].strip()}"
                    }
                    for match in matches
                ]
            
            doc.close()
            
            # 匹配caption到图片
            for fig in figures:
                page = fig["page"]
                if page in captions_by_page:
                    # 简单策略：按顺序匹配
                    captions = captions_by_page[page]
                    if captions:
                        fig["caption"] = captions[0]["text"]
                        fig["figure_number"] = f"{captions[0]['type']} {captions[0]['number']}"
                        captions_by_page[page] = captions[1:]  # 移除已使用的
            
            return figures
            
        except:
            return figures
    
    def get_key_figures(
        self, 
        figures: List[Dict], 
        top_n: int = 5
    ) -> List[Dict]:
        """
        获取关键图表（用于粗读展示）
        
        策略：
        1. 优先选择有caption的图
        2. 优先选择较大的图
        3. 优先选择前几页的图
        """
        # 计算分数
        scored_figures = []
        for fig in figures:
            score = 0
            
            # 有caption加分
            if fig.get("caption"):
                score += 10
            
            # 图片大小
            width = fig.get("width", 0)
            height = fig.get("height", 0)
            if width > 500 and height > 300:
                score += 5
            
            # 页码（前几页的图更重要）
            page = fig.get("page", 100)
            if page <= 3:
                score += 3
            elif page <= 6:
                score += 1
            
            scored_figures.append((score, fig))
        
        # 排序并返回
        scored_figures.sort(key=lambda x: -x[0])
        return [f[1] for f in scored_figures[:top_n]]

