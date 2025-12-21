"""
导出API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import io

from ...api.deps import get_db
from ...crud import paper_crud, anchor_crud, card_crud, skim_crud

router = APIRouter()


@router.get("/{paper_id}/markdown")
async def export_as_markdown(
    paper_id: str,
    include_cards: bool = True,
    include_skim: bool = True,
    include_checklist: bool = True,
    db: Session = Depends(get_db)
):
    """
    导出为Markdown格式
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 构建Markdown内容
    md_lines = []
    
    # 标题和元信息
    md_lines.append(f"# {paper.title}\n")
    if paper.authors:
        md_lines.append(f"**作者**: {', '.join(paper.authors)}\n")
    if paper.year:
        md_lines.append(f"**年份**: {paper.year}\n")
    if paper.venue:
        md_lines.append(f"**发表于**: {paper.venue}\n")
    md_lines.append(f"**状态**: {paper.status.value if paper.status else 'unknown'}\n")
    if paper.quality_grade:
        md_lines.append(f"**质量评级**: {paper.quality_grade}\n")
    md_lines.append("\n---\n")
    
    # 摘要
    if paper.abstract:
        md_lines.append("## 摘要\n")
        md_lines.append(f"{paper.abstract}\n\n")
    
    # SkimCard
    if include_skim:
        skim = skim_crud.get(db, paper_id)
        if skim:
            md_lines.append("## 快速阅读卡片 (SkimCard)\n")
            md_lines.append(f"### 研究问题\n{skim.research_question}\n\n")
            
            if skim.contributions:
                md_lines.append("### 主要贡献\n")
                for c in skim.contributions:
                    md_lines.append(f"- {c}\n")
                md_lines.append("\n")
            
            md_lines.append(f"### 证据强度\n**{skim.evidence_strength}** - {skim.evidence_strength_reason}\n\n")
            
            if skim.red_flags:
                md_lines.append("### 风险提示\n")
                for flag in skim.red_flags:
                    md_lines.append(f"- ⚠️ {flag}\n")
                md_lines.append("\n")
            
            md_lines.append(f"### 推荐阅读路线\n{skim.recommended_route}\n\n")
            
            if skim.recommended_sections:
                md_lines.append("### 推荐章节\n")
                for section in skim.recommended_sections:
                    md_lines.append(f"- {section}\n")
                md_lines.append("\n")
            
            md_lines.append("---\n")
    
    # 卡片
    if include_cards:
        cards = card_crud.get_by_paper(db, paper_id)
        if cards:
            md_lines.append("## 笔记卡片\n")
            
            for card in cards:
                card_type_label = {
                    'paper': '📄 Paper Card',
                    'evidence': '⚖️ Evidence Card',
                    'method': '🔧 Method Card',
                    'note': '📝 笔记'
                }.get(card.type.value if card.type else 'note', '📝 笔记')
                
                md_lines.append(f"### {card_type_label}: {card.title}\n")
                
                if card.content:
                    md_lines.append(f"{card.content}\n\n")
                
                # 类型特定字段
                if card.type and card.type.value == 'evidence':
                    if card.claim:
                        md_lines.append(f"**主张**: {card.claim}\n\n")
                    if card.evidence:
                        md_lines.append(f"**证据**: {card.evidence}\n\n")
                    if card.evidence_strength:
                        md_lines.append(f"**证据强度**: {card.evidence_strength}\n\n")
                
                elif card.type and card.type.value == 'method':
                    if card.method_name:
                        md_lines.append(f"**方法名称**: {card.method_name}\n\n")
                    if card.inputs:
                        md_lines.append(f"**输入**: {', '.join(card.inputs)}\n\n")
                    if card.outputs:
                        md_lines.append(f"**输出**: {', '.join(card.outputs)}\n\n")
                    if card.process:
                        md_lines.append(f"**流程**: {card.process}\n\n")
                
                elif card.type and card.type.value == 'paper':
                    if card.one_line_summary:
                        md_lines.append(f"**一句话总结**: {card.one_line_summary}\n\n")
                    if card.contributions:
                        md_lines.append("**贡献**:\n")
                        for c in card.contributions:
                            md_lines.append(f"- {c}\n")
                        md_lines.append("\n")
                    if card.limitations:
                        md_lines.append("**局限**:\n")
                        for l in card.limitations:
                            md_lines.append(f"- {l}\n")
                        md_lines.append("\n")
                
                if card.tags:
                    md_lines.append(f"**标签**: {', '.join(card.tags)}\n\n")
                
                md_lines.append("---\n")
    
    # 导出信息
    md_lines.append(f"\n---\n*导出时间: {datetime.now().isoformat()}*\n")
    md_lines.append("*由 FastPaperRead 生成*\n")
    
    content = "".join(md_lines)
    
    return Response(
        content=content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename={paper_id}_export.md"
        }
    )


@router.get("/{paper_id}/json")
async def export_as_json(
    paper_id: str,
    include_anchors: bool = True,
    include_cards: bool = True,
    include_skim: bool = True,
    db: Session = Depends(get_db)
):
    """
    导出为JSON格式
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    export_data = {
        "paper": {
            "id": paper.id,
            "title": paper.title,
            "authors": paper.authors,
            "year": paper.year,
            "venue": paper.venue,
            "abstract": paper.abstract,
            "keywords": paper.keywords,
            "status": paper.status.value if paper.status else None,
            "quality_grade": paper.quality_grade,
            "created_at": paper.created_at.isoformat() if paper.created_at else None,
            "updated_at": paper.updated_at.isoformat() if paper.updated_at else None,
        },
        "exported_at": datetime.now().isoformat(),
        "version": "1.0"
    }
    
    if include_skim:
        skim = skim_crud.get(db, paper_id)
        if skim:
            export_data["skim_card"] = {
                "research_question": skim.research_question,
                "contributions": skim.contributions,
                "evidence_strength": skim.evidence_strength,
                "evidence_strength_reason": skim.evidence_strength_reason,
                "red_flags": skim.red_flags,
                "recommended_route": skim.recommended_route,
                "recommended_sections": skim.recommended_sections,
                "key_figures": skim.key_figures,
            }
    
    if include_anchors:
        anchors = anchor_crud.get_by_paper(db, paper_id)
        export_data["anchors"] = [
            {
                "id": a.id,
                "type": a.type.value if a.type else None,
                "page": a.page,
                "section": a.section,
                "text": a.text,
                "caption": a.caption,
                "latex": a.latex,
            }
            for a in anchors
        ]
    
    if include_cards:
        cards = card_crud.get_by_paper(db, paper_id)
        export_data["cards"] = [
            {
                "id": c.id,
                "type": c.type.value if c.type else None,
                "title": c.title,
                "content": c.content,
                "tags": c.tags,
                "status": c.status,
                "uncertainty": c.uncertainty,
                "claim": c.claim,
                "evidence": c.evidence,
                "evidence_strength": c.evidence_strength,
                "method_name": c.method_name,
                "inputs": c.inputs,
                "outputs": c.outputs,
                "contributions": c.contributions,
                "limitations": c.limitations,
            }
            for c in cards
        ]
    
    json_content = json.dumps(export_data, ensure_ascii=False, indent=2)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={paper_id}_export.json"
        }
    )


@router.get("/{paper_id}/bibtex")
async def export_as_bibtex(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    导出为BibTeX格式
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 生成BibTeX key
    first_author = paper.authors[0].split()[-1] if paper.authors else "unknown"
    year = paper.year or "0000"
    title_word = paper.title.split()[0].lower() if paper.title else "paper"
    bib_key = f"{first_author}{year}{title_word}"
    
    # 构建BibTeX
    bib_lines = [f"@article{{{bib_key},"]
    bib_lines.append(f'  title = {{{paper.title}}},')
    
    if paper.authors:
        bib_lines.append(f'  author = {{{" and ".join(paper.authors)}}},')
    
    if paper.year:
        bib_lines.append(f'  year = {{{paper.year}}},')
    
    if paper.venue:
        bib_lines.append(f'  journal = {{{paper.venue}}},')
    
    if paper.abstract:
        bib_lines.append(f'  abstract = {{{paper.abstract[:500]}}},')
    
    if paper.keywords:
        bib_lines.append(f'  keywords = {{{", ".join(paper.keywords)}}},')
    
    bib_lines.append("}")
    
    content = "\n".join(bib_lines)
    
    return Response(
        content=content,
        media_type="application/x-bibtex",
        headers={
            "Content-Disposition": f"attachment; filename={paper_id}.bib"
        }
    )


@router.post("/batch/markdown")
async def batch_export_markdown(
    paper_ids: List[str],
    db: Session = Depends(get_db)
):
    """
    批量导出为Markdown (返回zip)
    """
    import zipfile
    
    buffer = io.BytesIO()
    
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for paper_id in paper_ids:
            paper = paper_crud.get(db, paper_id)
            if not paper:
                continue
            
            # 简化版Markdown
            md_content = f"# {paper.title}\n\n"
            if paper.authors:
                md_content += f"**作者**: {', '.join(paper.authors)}\n\n"
            if paper.abstract:
                md_content += f"## 摘要\n{paper.abstract}\n\n"
            
            # 添加到zip
            filename = f"{paper_id}_{paper.title[:30].replace(' ', '_')}.md"
            zf.writestr(filename, md_content)
    
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=papers_export_{datetime.now().strftime('%Y%m%d')}.zip"
        }
    )


@router.get("/{paper_id}/notion")
async def export_for_notion(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    导出为Notion兼容格式 (Markdown with properties)
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # Notion 数据库属性格式
    properties = []
    properties.append("---")
    properties.append(f"title: {paper.title}")
    if paper.authors:
        properties.append(f"authors: [{', '.join(paper.authors)}]")
    if paper.year:
        properties.append(f"year: {paper.year}")
    if paper.venue:
        properties.append(f"venue: {paper.venue}")
    if paper.status:
        properties.append(f"status: {paper.status.value}")
    if paper.quality_grade:
        properties.append(f"quality: {paper.quality_grade}")
    if paper.keywords:
        properties.append(f"tags: [{', '.join(paper.keywords)}]")
    properties.append("---\n")
    
    # 正文
    content_lines = properties.copy()
    content_lines.append(f"# {paper.title}\n")
    
    if paper.abstract:
        content_lines.append("## 摘要\n")
        content_lines.append(f"{paper.abstract}\n\n")
    
    # SkimCard
    skim = skim_crud.get(db, paper_id)
    if skim:
        content_lines.append("## 快速阅读\n")
        content_lines.append(f"**研究问题**: {skim.research_question}\n\n")
        content_lines.append(f"**证据强度**: {skim.evidence_strength}\n\n")
        
        if skim.contributions:
            content_lines.append("**贡献**:\n")
            for c in skim.contributions:
                content_lines.append(f"- {c}\n")
            content_lines.append("\n")
    
    # 卡片
    cards = card_crud.get_by_paper(db, paper_id)
    if cards:
        content_lines.append("## 笔记\n")
        for card in cards:
            content_lines.append(f"### {card.title}\n")
            if card.content:
                content_lines.append(f"{card.content}\n\n")
    
    content = "".join(content_lines)
    
    return Response(
        content=content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename={paper_id}_notion.md"
        }
    )
