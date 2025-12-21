"""
导出API路由
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import os
import json

from ...config import settings

router = APIRouter()


class ExportRequest(BaseModel):
    """导出请求"""
    object_type: str  # skim_card/cards/checklist/review/compare
    object_ids: List[str]
    format: str = "markdown"  # markdown/json/bibtex
    include_sources: bool = True  # 是否包含来源引用


class ExportResponse(BaseModel):
    """导出响应"""
    format: str
    content: str
    filename: str


@router.post("/")
async def export_content(request: ExportRequest):
    """导出内容"""
    content = ""
    filename = f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    if request.object_type == "skim_card":
        content = _export_skim_cards(request.object_ids, request.format)
        filename += "_skim"
    elif request.object_type == "cards":
        content = _export_cards(request.object_ids, request.format)
        filename += "_cards"
    elif request.object_type == "checklist":
        content = _export_checklist(request.object_ids, request.format)
        filename += "_checklist"
    elif request.object_type == "review":
        content = _export_review(request.object_ids, request.format)
        filename += "_review"
    elif request.object_type == "compare":
        content = _export_compare(request.object_ids, request.format)
        filename += "_compare"
    else:
        raise HTTPException(400, "不支持的导出类型")
    
    # 添加扩展名
    if request.format == "markdown":
        filename += ".md"
    elif request.format == "json":
        filename += ".json"
    elif request.format == "bibtex":
        filename += ".bib"
    
    return ExportResponse(
        format=request.format,
        content=content,
        filename=filename
    )


@router.get("/paper/{paper_id}/bibtex")
async def export_bibtex(paper_id: str):
    """导出论文的BibTeX"""
    # TODO: 从数据库获取论文信息
    bibtex = f"""@article{{{paper_id},
    title = {{论文标题}},
    author = {{作者}},
    year = {{2024}},
    journal = {{期刊}}
}}"""
    
    return Response(
        content=bibtex,
        media_type="application/x-bibtex",
        headers={"Content-Disposition": f"attachment; filename={paper_id}.bib"}
    )


@router.get("/paper/{paper_id}/notes")
async def export_paper_notes(paper_id: str, format: str = "markdown"):
    """导出论文的所有笔记"""
    # TODO: 获取论文相关的所有卡片和清单
    content = f"# 论文笔记\n\n导出时间: {datetime.now()}\n\n## 卡片\n\n...\n\n## 复现清单\n\n..."
    
    return ExportResponse(
        format=format,
        content=content,
        filename=f"notes_{paper_id}.md"
    )


def _export_skim_cards(ids: List[str], format: str) -> str:
    """导出SkimCard"""
    if format == "markdown":
        return "# Skim Cards\n\n..."
    elif format == "json":
        return json.dumps({"skim_cards": []}, ensure_ascii=False)
    return ""


def _export_cards(ids: List[str], format: str) -> str:
    """导出卡片"""
    if format == "markdown":
        return "# Cards\n\n..."
    elif format == "json":
        return json.dumps({"cards": []}, ensure_ascii=False)
    return ""


def _export_checklist(ids: List[str], format: str) -> str:
    """导出清单"""
    if format == "markdown":
        return """# Reproducibility Checklist

## Data
- [ ] 数据集名称
- [ ] 数据划分

## Training
- [ ] 学习率
- [ ] Batch size
..."""
    elif format == "json":
        return json.dumps({"checklists": []}, ensure_ascii=False)
    return ""


def _export_review(ids: List[str], format: str) -> str:
    """导出审稿"""
    if format == "markdown":
        return "# Review Report\n\n..."
    elif format == "json":
        return json.dumps({"reviews": []}, ensure_ascii=False)
    return ""


def _export_compare(ids: List[str], format: str) -> str:
    """导出对比"""
    if format == "markdown":
        return "# Comparison Matrix\n\n| Paper | Method | Dataset | Result |\n|-------|--------|---------|--------|"
    elif format == "json":
        return json.dumps({"compare_sets": []}, ensure_ascii=False)
    return ""

