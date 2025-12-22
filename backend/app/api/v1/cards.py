"""
卡片API路由 - 完整实现
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid

from ...api.deps import get_db, get_enhancer
from ...crud import card_crud, anchor_crud, paper_crud
from ...db.models import CardType, CardAnchorLinkModel
from ...core.llm import ContentEnhancer
from ...core.vector_store import vector_store, add_card_to_vector_store, delete_card_from_vector_store, semantic_search
from ...schemas.card import (
    CardCreate, CardUpdate, CardResponse, CardListResponse,
    CardFromAnchorRequest, CardSearchRequest
)

router = APIRouter()


def create_card_anchor_links(db: Session, card_id: str, anchor_ids: List[str], link_type: str = "source"):
    """创建卡片-锚点关联"""
    for anchor_id in anchor_ids:
        # 检查是否已存在
        existing = db.query(CardAnchorLinkModel).filter(
            CardAnchorLinkModel.card_id == card_id,
            CardAnchorLinkModel.anchor_id == anchor_id
        ).first()
        
        if not existing:
            link = CardAnchorLinkModel(
                card_id=card_id,
                anchor_id=anchor_id,
                link_type=link_type
            )
            db.add(link)
    
    db.commit()


def card_to_response(card) -> dict:
    """转换卡片模型为响应格式"""
    return {
        "id": card.id,
        "paper_id": card.paper_id,
        "type": card.type.value if hasattr(card.type, 'value') else card.type,
        "title": card.title,
        "content": card.content,
        "source_anchor_ids": card.source_anchor_ids or [],
        "uncertainty": card.uncertainty or "from_text",
        "tags": card.tags or [],
        "status": card.status or "draft",
        "version": card.version or 1,
        "created_at": card.created_at,
        "updated_at": card.updated_at,
        # 特定类型字段
        "one_line_summary": card.one_line_summary,
        "contributions": card.contributions,
        "limitations": card.limitations,
        "applicable_scope": card.applicable_scope,
        "claim": card.claim,
        "evidence": card.evidence,
        "evidence_strength": card.evidence_strength,
        "alternative_explanations": card.alternative_explanations,
        "risks": card.risks,
        "method_name": card.method_name,
        "inputs": card.inputs,
        "outputs": card.outputs,
        "assumptions": card.assumptions,
        "process": card.process,
        "pseudocode": card.pseudocode,
        "complexity": card.complexity,
    }


@router.post("", response_model=dict)
async def create_card(
    card: CardCreate,
    db: Session = Depends(get_db)
):
    """创建卡片"""
    try:
        card_type = CardType(card.type) if isinstance(card.type, str) else card.type
    except ValueError:
        card_type = CardType.NOTE
    
    new_card = card_crud.create(
        db,
        paper_id=card.paper_id,
        type=card_type,
        title=card.title,
        content=card.content or "",
        source_anchor_ids=card.source_anchor_ids,
        uncertainty=card.uncertainty,
        tags=card.tags,
        one_line_summary=getattr(card, 'one_line_summary', None),
        contributions=getattr(card, 'contributions', None),
        limitations=getattr(card, 'limitations', None),
        applicable_scope=getattr(card, 'applicable_scope', None),
        claim=getattr(card, 'claim', None),
        evidence=getattr(card, 'evidence', None),
        evidence_strength=getattr(card, 'evidence_strength', None),
        alternative_explanations=getattr(card, 'alternative_explanations', None),
        risks=getattr(card, 'risks', None),
        method_name=getattr(card, 'method_name', None),
        inputs=getattr(card, 'inputs', None),
        outputs=getattr(card, 'outputs', None),
        assumptions=getattr(card, 'assumptions', None),
        process=getattr(card, 'process', None),
        pseudocode=getattr(card, 'pseudocode', None),
        complexity=getattr(card, 'complexity', None),
    )
    
    # 创建卡片-锚点关联
    if card.source_anchor_ids:
        create_card_anchor_links(db, new_card.id, card.source_anchor_ids, "source")
    
    # 同步到向量存储
    add_card_to_vector_store(
        card_id=new_card.id,
        title=new_card.title or "",
        content=new_card.content or "",
        paper_id=new_card.paper_id,
        card_type=card_type.value if hasattr(card_type, 'value') else str(card_type),
        tags=card.tags
    )
    
    return card_to_response(new_card)


@router.post("/from-anchor", response_model=dict)
async def create_card_from_anchor(
    request: CardFromAnchorRequest,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """从锚点创建卡片，支持自动生成内容"""
    anchor = anchor_crud.get(db, request.anchor_id)
    if not anchor:
        raise HTTPException(404, "锚点不存在")
    
    try:
        card_type = CardType(request.card_type)
    except ValueError:
        card_type = CardType.NOTE
    
    # 准备卡片数据
    card_data = {
        "paper_id": anchor.paper_id,
        "type": card_type,
        "title": f"从{anchor.type.value if hasattr(anchor.type, 'value') else anchor.type}创建的卡片",
        "content": anchor.text or anchor.caption or "",
        "source_anchor_ids": [request.anchor_id],
        "uncertainty": "from_text",
        "tags": [],
    }
    
    # 如果需要自动生成
    if request.auto_generate:
        context = anchor.text or anchor.caption or ""
        
        try:
            if card_type == CardType.PAPER:
                result = await enhancer.generate_paper_card(context)
                card_data.update({
                    "title": result.get("one_line_summary", card_data["title"])[:200],
                    "one_line_summary": result.get("one_line_summary", ""),
                    "contributions": result.get("contributions", []),
                    "limitations": result.get("limitations", []),
                    "applicable_scope": result.get("applicable_scope", ""),
                })
                
            elif card_type == CardType.EVIDENCE:
                result = await enhancer.generate_evidence_card(context)
                card_data.update({
                    "title": (result.get("claim", "") or "证据卡片")[:200],
                    "claim": result.get("claim", ""),
                    "evidence": result.get("evidence", ""),
                    "evidence_strength": result.get("evidence_strength", "medium"),
                    "alternative_explanations": result.get("alternative_explanations", []),
                    "risks": result.get("risks", []),
                })
                
            elif card_type == CardType.METHOD:
                result = await enhancer.generate_method_card(context)
                card_data.update({
                    "title": result.get("method_name", "方法卡片")[:200],
                    "method_name": result.get("method_name", ""),
                    "inputs": result.get("inputs", []),
                    "outputs": result.get("outputs", []),
                    "assumptions": result.get("assumptions", []),
                    "process": result.get("process", ""),
                    "pseudocode": result.get("pseudocode", ""),
                    "complexity": result.get("complexity", ""),
                })
        except Exception as e:
            # 生成失败，使用基础内容
            card_data["content"] = f"自动生成失败: {str(e)}\n\n原文:\n{context}"
    
    # 创建卡片
    new_card = card_crud.create(db, **card_data)
    
    # 创建卡片-锚点关联
    create_card_anchor_links(db, new_card.id, [request.anchor_id], "source")
    
    # 同步到向量存储
    add_card_to_vector_store(
        card_id=new_card.id,
        title=new_card.title or "",
        content=new_card.content or "",
        paper_id=new_card.paper_id,
        card_type=card_type.value if hasattr(card_type, 'value') else str(card_type),
        tags=card_data.get("tags", [])
    )
    
    return card_to_response(new_card)


@router.get("/{card_id}/anchors", response_model=dict)
async def get_card_anchors(
    card_id: str,
    db: Session = Depends(get_db)
):
    """
    获取卡片关联的所有锚点
    
    返回与该卡片关联的所有锚点详情
    """
    card = card_crud.get(db, card_id)
    if not card:
        raise HTTPException(404, "卡片不存在")
    
    # 从关联表获取锚点
    links = db.query(CardAnchorLinkModel).filter(
        CardAnchorLinkModel.card_id == card_id
    ).all()
    
    anchors = []
    for link in links:
        anchor = anchor_crud.get(db, link.anchor_id)
        if anchor:
            anchors.append({
                "id": anchor.id,
                "type": anchor.type.value if hasattr(anchor.type, 'value') else anchor.type,
                "page": anchor.page,
                "section": anchor.section,
                "text": (anchor.text or "")[:200],
                "link_type": link.link_type,
            })
    
    return {
        "card_id": card_id,
        "anchors": anchors,
        "total": len(anchors)
    }


@router.post("/{card_id}/link-anchor", response_model=dict)
async def link_card_to_anchor(
    card_id: str,
    anchor_id: str,
    link_type: str = "reference",
    db: Session = Depends(get_db)
):
    """
    将卡片与锚点关联
    
    - link_type: source=来源锚点, reference=引用锚点
    """
    card = card_crud.get(db, card_id)
    if not card:
        raise HTTPException(404, "卡片不存在")
    
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(404, "锚点不存在")
    
    # 检查是否已存在
    existing = db.query(CardAnchorLinkModel).filter(
        CardAnchorLinkModel.card_id == card_id,
        CardAnchorLinkModel.anchor_id == anchor_id
    ).first()
    
    if existing:
        return {"message": "关联已存在", "link_id": existing.id}
    
    # 创建关联
    link = CardAnchorLinkModel(
        card_id=card_id,
        anchor_id=anchor_id,
        link_type=link_type
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    
    return {"message": "关联已创建", "link_id": link.id}


@router.delete("/{card_id}/unlink-anchor/{anchor_id}")
async def unlink_card_from_anchor(
    card_id: str,
    anchor_id: str,
    db: Session = Depends(get_db)
):
    """取消卡片与锚点的关联"""
    link = db.query(CardAnchorLinkModel).filter(
        CardAnchorLinkModel.card_id == card_id,
        CardAnchorLinkModel.anchor_id == anchor_id
    ).first()
    
    if not link:
        raise HTTPException(404, "关联不存在")
    
    db.delete(link)
    db.commit()
    
    return {"message": "关联已删除"}


@router.get("/paper/{paper_id}", response_model=dict)
async def get_paper_cards(
    paper_id: str,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取论文的所有卡片"""
    cards = card_crud.get_by_paper(db, paper_id, type=type)
    by_type = card_crud.count_by_type(db, paper_id)
    
    return {
        "items": [card_to_response(c) for c in cards],
        "total": len(cards),
        "by_type": by_type
    }


@router.get("/{card_id}", response_model=dict)
async def get_card(
    card_id: str,
    db: Session = Depends(get_db)
):
    """获取卡片详情"""
    card = card_crud.get(db, card_id)
    if not card:
        raise HTTPException(404, "卡片不存在")
    
    return card_to_response(card)


@router.put("/{card_id}", response_model=dict)
async def update_card(
    card_id: str,
    update: CardUpdate,
    db: Session = Depends(get_db)
):
    """更新卡片"""
    update_data = update.model_dump(exclude_unset=True)
    
    card = card_crud.update(db, card_id, **update_data)
    if not card:
        raise HTTPException(404, "卡片不存在")
    
    # 同步更新向量存储
    add_card_to_vector_store(
        card_id=card.id,
        title=card.title or "",
        content=card.content or "",
        paper_id=card.paper_id,
        card_type=card.type.value if hasattr(card.type, 'value') else str(card.type),
        tags=card.tags
    )
    
    return card_to_response(card)


@router.delete("/{card_id}")
async def delete_card(
    card_id: str,
    db: Session = Depends(get_db)
):
    """删除卡片"""
    success = card_crud.delete(db, card_id)
    if not success:
        raise HTTPException(404, "卡片不存在")
    
    # 从向量存储删除
    delete_card_from_vector_store(card_id)
    
    return {"message": "卡片已删除"}


@router.post("/search", response_model=dict)
async def search_cards(
    request: CardSearchRequest,
    db: Session = Depends(get_db)
):
    """搜索卡片（关键词匹配）"""
    cards, total = card_crud.search(
        db,
        query=request.query,
        types=request.types,
        tags=request.tags,
        paper_ids=request.paper_ids,
        status=request.status,
        skip=request.offset,
        limit=request.limit
    )
    
    by_type = card_crud.count_by_type(db)
    
    return {
        "items": [card_to_response(c) for c in cards],
        "total": total,
        "by_type": by_type
    }


@router.post("/semantic-search", response_model=dict)
async def semantic_search_cards(
    query: str,
    limit: int = Query(10, ge=1, le=100),
    paper_id: Optional[str] = None,
    types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db)
):
    """
    语义搜索卡片
    
    使用向量相似度进行语义搜索，能找到概念相关的卡片
    例如：搜索 "attention mechanism" 能找到包含 "自注意力"、"Transformer" 的卡片
    
    Args:
        query: 搜索查询
        limit: 返回结果数量
        paper_id: 限制特定论文
        types: 限制卡片类型
    """
    if not vector_store.is_available:
        raise HTTPException(
            status_code=503,
            detail="语义搜索不可用（ChromaDB未安装或初始化失败）"
        )
    
    # 执行语义搜索
    results = semantic_search(
        query=query,
        limit=limit,
        paper_id=paper_id,
        card_types=types
    )
    
    # 获取完整卡片信息
    cards = []
    for result in results:
        card = card_crud.get(db, result.card_id)
        if card:
            card_dict = card_to_response(card)
            card_dict["similarity_score"] = result.score
            cards.append(card_dict)
    
    return {
        "items": cards,
        "total": len(cards),
        "query": query,
        "search_type": "semantic"
    }


@router.get("/vector-store/stats", response_model=dict)
async def get_vector_store_stats():
    """获取向量存储统计信息"""
    return vector_store.get_stats()


@router.post("/vector-store/rebuild", response_model=dict)
async def rebuild_vector_index(
    db: Session = Depends(get_db)
):
    """
    重建向量索引
    
    从数据库读取所有卡片，重新建立向量索引
    """
    if not vector_store.is_available:
        raise HTTPException(
            status_code=503,
            detail="向量存储不可用"
        )
    
    # 获取所有卡片
    from ...db.models import CardModel
    all_cards = db.query(CardModel).all()
    
    cards_data = []
    for card in all_cards:
        cards_data.append({
            "id": card.id,
            "title": card.title or "",
            "content": card.content or "",
            "paper_id": card.paper_id,
            "type": card.type.value if hasattr(card.type, 'value') else str(card.type),
            "tags": card.tags or []
        })
    
    count = vector_store.rebuild_index(cards_data)
    
    return {
        "message": "索引重建完成",
        "total_cards": len(cards_data),
        "indexed": count
    }


@router.put("/{card_id}/finalize")
async def finalize_card(
    card_id: str,
    db: Session = Depends(get_db)
):
    """将卡片标记为定稿"""
    card = card_crud.finalize(db, card_id)
    if not card:
        raise HTTPException(404, "卡片不存在")
    
    return {"message": "卡片已定稿", "card_id": card_id}


@router.post("/batch-create", response_model=dict)
async def batch_create_cards(
    paper_id: str,
    card_types: List[str],
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """批量创建卡片（基于论文内容）"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(404, "论文不存在")
    
    content = paper.abstract or ""
    if paper.markdown_path:
        try:
            with open(paper.markdown_path, 'r', encoding='utf-8') as f:
                content = f.read()[:8000]
        except:
            pass
    
    created_cards = []
    
    for card_type_str in card_types:
        try:
            card_type = CardType(card_type_str)
        except ValueError:
            continue
        
        card_data = {
            "paper_id": paper_id,
            "type": card_type,
            "title": f"{paper.title}的{card_type_str}卡片",
            "content": "",
            "source_anchor_ids": [],
        }
        
        try:
            if card_type == CardType.PAPER:
                result = await enhancer.generate_paper_card(content)
                card_data.update({
                    "title": result.get("one_line_summary", card_data["title"])[:200],
                    "one_line_summary": result.get("one_line_summary", ""),
                    "contributions": result.get("contributions", []),
                    "limitations": result.get("limitations", []),
                    "applicable_scope": result.get("applicable_scope", ""),
                })
            elif card_type == CardType.EVIDENCE:
                result = await enhancer.generate_evidence_card(content)
                card_data.update({
                    "title": (result.get("claim", "") or "证据卡片")[:200],
                    "claim": result.get("claim", ""),
                    "evidence": result.get("evidence", ""),
                    "evidence_strength": result.get("evidence_strength", "medium"),
                    "alternative_explanations": result.get("alternative_explanations", []),
                    "risks": result.get("risks", []),
                })
            elif card_type == CardType.METHOD:
                result = await enhancer.generate_method_card(content)
                card_data.update({
                    "title": result.get("method_name", "方法卡片")[:200],
                    "method_name": result.get("method_name", ""),
                    "inputs": result.get("inputs", []),
                    "outputs": result.get("outputs", []),
                    "assumptions": result.get("assumptions", []),
                    "process": result.get("process", ""),
                })
        except Exception as e:
            card_data["content"] = f"生成失败: {str(e)}"
        
        new_card = card_crud.create(db, **card_data)
        created_cards.append(card_to_response(new_card))
    
    return {
        "created": len(created_cards),
        "cards": created_cards
    }
