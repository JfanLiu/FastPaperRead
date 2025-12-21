"""
粗读(Skim)API路由
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional, List
from datetime import datetime

from ...schemas.skim import (
    SkimCardResponse, SkimDecisionRequest, SkimDecisionResponse,
    KeyFigureResponse, LiteratureMapResponse, SkimGenerateRequest,
    QueueItemResponse
)

router = APIRouter()

# 临时存储
_skim_cards_db = {}
_queue_db = {}


@router.post("/generate", response_model=SkimCardResponse)
async def generate_skim_card(
    request: SkimGenerateRequest,
    background_tasks: BackgroundTasks
):
    """生成SkimCard"""
    paper_id = request.paper_id
    
    # 检查是否已存在
    if paper_id in _skim_cards_db and not request.force_regenerate:
        return _skim_cards_db[paper_id]
    
    # TODO: 调用LLM生成SkimCard
    skim_card = {
        "paper_id": paper_id,
        "research_question": "待生成...",
        "contributions": ["贡献1", "贡献2", "贡献3"],
        "evidence_strength": "medium",
        "evidence_strength_reason": "实验覆盖范围有限",
        "red_flags": [],
        "recommended_route": "review",
        "recommended_sections": ["Abstract", "Method", "Experiments"],
        "key_figures": [],
        "generated_at": datetime.now(),
        "source_anchor_ids": []
    }
    
    _skim_cards_db[paper_id] = skim_card
    return skim_card


@router.get("/{paper_id}", response_model=SkimCardResponse)
async def get_skim_card(paper_id: str):
    """获取SkimCard"""
    if paper_id not in _skim_cards_db:
        raise HTTPException(404, "SkimCard不存在，请先生成")
    
    return _skim_cards_db[paper_id]


@router.post("/decision", response_model=SkimDecisionResponse)
async def make_skim_decision(request: SkimDecisionRequest):
    """做出粗读决策"""
    paper_id = request.paper_id
    decision = request.decision
    
    if decision == "archive":
        # 归档
        status = "archived"
        message = "论文已归档"
        next_action = "返回文献库"
        
        # 记录归档原因
        # TODO: 保存到数据库
        
    elif decision == "queue":
        # 加入队列
        status = "skimmed"
        message = "论文已加入待读队列"
        next_action = "查看待读队列"
        
        # 添加到队列
        _queue_db[paper_id] = {
            "paper_id": paper_id,
            "priority": request.queue_priority or "medium",
            "estimated_time": request.estimated_time or 30,
            "reading_goal": request.reading_goal or "method",
            "added_at": datetime.now()
        }
        
    elif decision == "deepread":
        # 开始精读
        status = "deepread"
        message = "进入精读模式"
        next_action = f"按{request.reading_route or 'review'}路线阅读"
        
    else:
        raise HTTPException(400, "无效的决策")
    
    return SkimDecisionResponse(
        paper_id=paper_id,
        decision=decision,
        status=status,
        message=message,
        next_action=next_action
    )


@router.get("/{paper_id}/key-figures", response_model=List[KeyFigureResponse])
async def get_key_figures(paper_id: str, limit: int = 5):
    """获取关键图表"""
    # TODO: 从锚点中获取图表并排序
    return []


@router.get("/{paper_id}/literature-map", response_model=LiteratureMapResponse)
async def get_literature_map(paper_id: str):
    """获取文献地图"""
    # TODO: 搜索相关论文
    return LiteratureMapResponse(
        paper_id=paper_id,
        classic=[],
        recent=[],
        similar=[],
        contrasting=[],
        total_related=0
    )


@router.get("/queue", response_model=List[QueueItemResponse])
async def get_reading_queue():
    """获取待读队列"""
    items = []
    for paper_id, queue_item in _queue_db.items():
        items.append(QueueItemResponse(
            paper_id=paper_id,
            title="",  # TODO: 从papers获取
            authors=[],
            priority=queue_item["priority"],
            estimated_time=queue_item["estimated_time"],
            reading_goal=queue_item["reading_goal"],
            added_at=queue_item["added_at"]
        ))
    
    # 按优先级排序
    priority_order = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda x: priority_order.get(x.priority, 1))
    
    return items


@router.delete("/queue/{paper_id}")
async def remove_from_queue(paper_id: str):
    """从队列中移除"""
    if paper_id in _queue_db:
        del _queue_db[paper_id]
    return {"message": "已从队列移除"}

