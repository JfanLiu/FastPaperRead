"""
卡片API路由
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from datetime import datetime
import uuid

from ...schemas.card import (
    CardCreate, CardUpdate, CardResponse, CardListResponse,
    CardFromAnchorRequest, CardSearchRequest
)

router = APIRouter()

# 临时存储
_cards_db = {}


@router.post("", response_model=CardResponse)
async def create_card(card: CardCreate):
    """创建卡片"""
    card_id = str(uuid.uuid4())
    now = datetime.now()
    
    card_data = card.model_dump()
    card_data.update({
        "id": card_id,
        "status": "draft",
        "version": 1,
        "created_at": now,
        "updated_at": now
    })
    
    _cards_db[card_id] = card_data
    return card_data


@router.post("/from-anchor", response_model=CardResponse)
async def create_card_from_anchor(request: CardFromAnchorRequest):
    """从锚点创建卡片"""
    # TODO: 获取锚点内容
    # TODO: 如果auto_generate，调用LLM生成内容
    
    card_id = str(uuid.uuid4())
    now = datetime.now()
    
    card_data = {
        "id": card_id,
        "paper_id": "",  # 从锚点获取
        "type": request.card_type,
        "title": "新卡片",
        "content": "",
        "source_anchor_ids": [request.anchor_id],
        "uncertainty": "from_text",
        "tags": [],
        "status": "draft",
        "version": 1,
        "created_at": now,
        "updated_at": now
    }
    
    _cards_db[card_id] = card_data
    return card_data


@router.get("/paper/{paper_id}", response_model=CardListResponse)
async def get_paper_cards(
    paper_id: str,
    type: Optional[str] = None
):
    """获取论文的所有卡片"""
    cards = [c for c in _cards_db.values() if c.get("paper_id") == paper_id]
    
    if type:
        cards = [c for c in cards if c.get("type") == type]
    
    # 统计
    by_type = {}
    for c in cards:
        t = c.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
    
    return CardListResponse(
        items=cards,
        total=len(cards),
        by_type=by_type
    )


@router.get("/{card_id}", response_model=CardResponse)
async def get_card(card_id: str):
    """获取卡片详情"""
    if card_id not in _cards_db:
        raise HTTPException(404, "卡片不存在")
    
    return _cards_db[card_id]


@router.put("/{card_id}", response_model=CardResponse)
async def update_card(card_id: str, update: CardUpdate):
    """更新卡片"""
    if card_id not in _cards_db:
        raise HTTPException(404, "卡片不存在")
    
    card = _cards_db[card_id]
    update_data = update.model_dump(exclude_unset=True)
    card.update(update_data)
    card["updated_at"] = datetime.now()
    card["version"] = card.get("version", 1) + 1
    
    return card


@router.delete("/{card_id}")
async def delete_card(card_id: str):
    """删除卡片"""
    if card_id not in _cards_db:
        raise HTTPException(404, "卡片不存在")
    
    del _cards_db[card_id]
    return {"message": "卡片已删除"}


@router.post("/search", response_model=CardListResponse)
async def search_cards(request: CardSearchRequest):
    """搜索卡片"""
    cards = list(_cards_db.values())
    
    # 过滤
    if request.types:
        cards = [c for c in cards if c.get("type") in request.types]
    if request.tags:
        cards = [c for c in cards if any(t in c.get("tags", []) for t in request.tags)]
    if request.paper_ids:
        cards = [c for c in cards if c.get("paper_id") in request.paper_ids]
    if request.status:
        cards = [c for c in cards if c.get("status") == request.status]
    
    # 关键词搜索
    query_lower = request.query.lower()
    cards = [
        c for c in cards 
        if query_lower in c.get("title", "").lower() or 
           query_lower in c.get("content", "").lower()
    ]
    
    # 分页
    total = len(cards)
    cards = cards[request.offset:request.offset + request.limit]
    
    return CardListResponse(
        items=cards,
        total=total,
        by_type={}
    )


@router.put("/{card_id}/finalize")
async def finalize_card(card_id: str):
    """将卡片标记为定稿"""
    if card_id not in _cards_db:
        raise HTTPException(404, "卡片不存在")
    
    _cards_db[card_id]["status"] = "final"
    _cards_db[card_id]["updated_at"] = datetime.now()
    
    return {"message": "卡片已定稿"}

