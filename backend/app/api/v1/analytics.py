"""
统计分析API - 埋点与看板
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel

from ...api.deps import get_db
from ...core.analytics import (
    analytics_service, 
    track_event,
    AnalyticsService
)

router = APIRouter()


class TrackEventRequest(BaseModel):
    """事件跟踪请求"""
    event_type: str
    event_name: str
    paper_id: Optional[str] = None
    card_id: Optional[str] = None
    anchor_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None
    value: Optional[float] = None
    page: Optional[str] = None
    session_id: Optional[str] = None


class BatchTrackRequest(BaseModel):
    """批量事件跟踪请求"""
    events: List[TrackEventRequest]


@router.post("/track", response_model=dict)
async def track(
    request: TrackEventRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    """
    记录单个事件
    
    用于前端埋点调用
    """
    user_agent = req.headers.get("user-agent", "")
    
    event_id = track_event(
        db,
        event_type=request.event_type,
        event_name=request.event_name,
        paper_id=request.paper_id,
        card_id=request.card_id,
        anchor_id=request.anchor_id,
        properties=request.properties,
        value=request.value,
        page=request.page,
        session_id=request.session_id,
        user_agent=user_agent
    )
    
    return {"event_id": event_id, "success": True}


@router.post("/track/batch", response_model=dict)
async def track_batch(
    request: BatchTrackRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    """
    批量记录事件
    
    用于一次性提交多个事件，减少网络请求
    """
    user_agent = req.headers.get("user-agent", "")
    event_ids = []
    
    for event in request.events:
        event_id = track_event(
            db,
            event_type=event.event_type,
            event_name=event.event_name,
            paper_id=event.paper_id,
            card_id=event.card_id,
            anchor_id=event.anchor_id,
            properties=event.properties,
            value=event.value,
            page=event.page,
            session_id=event.session_id,
            user_agent=user_agent
        )
        event_ids.append(event_id)
    
    return {
        "event_ids": event_ids,
        "count": len(event_ids),
        "success": True
    }


@router.get("/stats", response_model=dict)
async def get_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    获取统计看板数据
    
    Args:
        days: 统计天数范围
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    end_date = datetime.utcnow()
    
    stats = analytics_service.get_stats(db, start_date, end_date)
    return stats


@router.get("/stats/paper/{paper_id}", response_model=dict)
async def get_paper_analytics(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    获取特定论文的分析数据
    """
    return analytics_service.get_paper_analytics(db, paper_id)


@router.get("/report", response_model=dict)
async def get_usage_report(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """
    获取使用报告
    
    提供简洁的使用概览
    """
    return analytics_service.get_usage_report(db, days)


@router.get("/events", response_model=dict)
async def list_events(
    event_type: Optional[str] = None,
    event_name: Optional[str] = None,
    paper_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    列出事件记录
    
    支持按类型、名称、论文、时间范围过滤
    """
    from ...db.models import AnalyticsEventModel
    from sqlalchemy import desc
    
    query = db.query(AnalyticsEventModel)
    
    if event_type:
        query = query.filter(AnalyticsEventModel.event_type == event_type)
    if event_name:
        query = query.filter(AnalyticsEventModel.event_name == event_name)
    if paper_id:
        query = query.filter(AnalyticsEventModel.paper_id == paper_id)
    if start_date:
        query = query.filter(AnalyticsEventModel.timestamp >= start_date)
    if end_date:
        query = query.filter(AnalyticsEventModel.timestamp <= end_date)
    
    total = query.count()
    events = query.order_by(desc(AnalyticsEventModel.timestamp)).offset(offset).limit(limit).all()
    
    return {
        "items": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "event_name": e.event_name,
                "paper_id": e.paper_id,
                "card_id": e.card_id,
                "properties": e.properties,
                "value": e.value,
                "page": e.page,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            }
            for e in events
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/event-types", response_model=dict)
async def list_event_types():
    """
    获取所有事件类型定义
    """
    return {
        "event_types": {
            "page_view": "页面浏览",
            "user_action": "用户操作",
            "paper_action": "论文操作",
            "card_action": "卡片操作",
            "system": "系统事件",
            "performance": "性能指标"
        },
        "event_names": {
            # 页面浏览
            "view_home": "查看首页",
            "view_skim": "查看速览页",
            "view_read": "查看阅读页",
            "view_notes": "查看笔记库",
            "view_compare": "查看对比页",
            "view_review": "查看审稿页",
            "view_stats": "查看统计页",
            # 论文操作
            "paper_upload": "上传论文",
            "paper_import": "导入论文",
            "paper_delete": "删除论文",
            "paper_archive": "归档论文",
            "skim_generate": "生成速览",
            "skim_decide": "做出决策",
            # 卡片操作
            "card_create": "创建卡片",
            "card_update": "更新卡片",
            "card_delete": "删除卡片",
            "card_search": "搜索卡片",
            # 增强操作
            "enhance_request": "请求增强",
            "enhance_complete": "增强完成",
            # 审稿操作
            "review_generate": "生成审稿",
            "review_submit": "提交审稿"
        }
    }


@router.get("/dashboard", response_model=dict)
async def get_dashboard(
    db: Session = Depends(get_db)
):
    """
    获取仪表盘数据
    
    综合展示关键指标
    """
    from ...db.models import PaperModel, CardModel, ReviewModel, PaperStatus
    from sqlalchemy import func
    
    # 今日统计
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    
    from ...db.models import AnalyticsEventModel
    
    today_events = db.query(func.count(AnalyticsEventModel.id)).filter(
        AnalyticsEventModel.timestamp >= today_start
    ).scalar() or 0
    
    today_papers = db.query(func.count(PaperModel.id)).filter(
        PaperModel.created_at >= today_start
    ).scalar() or 0
    
    today_cards = db.query(func.count(CardModel.id)).filter(
        CardModel.created_at >= today_start
    ).scalar() or 0
    
    # 总体统计
    total_papers = db.query(func.count(PaperModel.id)).scalar() or 0
    total_cards = db.query(func.count(CardModel.id)).scalar() or 0
    total_reviews = db.query(func.count(ReviewModel.id)).scalar() or 0
    
    # 待阅读论文
    pending_papers = db.query(func.count(PaperModel.id)).filter(
        PaperModel.status.in_([PaperStatus.UNREAD, PaperStatus.SKIMMED])
    ).scalar() or 0
    
    # 本周趋势
    week_start = today_start - timedelta(days=7)
    weekly_trend = db.query(
        func.date(AnalyticsEventModel.timestamp).label("date"),
        func.count(AnalyticsEventModel.id).label("count")
    ).filter(
        AnalyticsEventModel.timestamp >= week_start
    ).group_by(
        func.date(AnalyticsEventModel.timestamp)
    ).order_by("date").all()
    
    return {
        "today": {
            "events": today_events,
            "papers": today_papers,
            "cards": today_cards
        },
        "totals": {
            "papers": total_papers,
            "cards": total_cards,
            "reviews": total_reviews,
            "pending_papers": pending_papers
        },
        "weekly_trend": [
            {"date": str(date), "count": count}
            for date, count in weekly_trend
        ]
    }

