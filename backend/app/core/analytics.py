"""
埋点分析服务

记录用户行为事件，提供统计分析功能
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

logger = logging.getLogger("fastpaperread.analytics")


class AnalyticsService:
    """埋点分析服务"""
    
    # 事件类型常量
    class EventType:
        PAGE_VIEW = "page_view"       # 页面浏览
        USER_ACTION = "user_action"   # 用户操作
        PAPER_ACTION = "paper_action" # 论文操作
        CARD_ACTION = "card_action"   # 卡片操作
        SYSTEM = "system"             # 系统事件
        PERFORMANCE = "performance"   # 性能指标
    
    # 预定义事件名称
    class EventName:
        # 页面浏览
        VIEW_HOME = "view_home"
        VIEW_SKIM = "view_skim"
        VIEW_READ = "view_read"
        VIEW_NOTES = "view_notes"
        VIEW_COMPARE = "view_compare"
        VIEW_REVIEW = "view_review"
        VIEW_STATS = "view_stats"
        
        # 论文操作
        PAPER_UPLOAD = "paper_upload"
        PAPER_IMPORT = "paper_import"
        PAPER_DELETE = "paper_delete"
        PAPER_ARCHIVE = "paper_archive"
        SKIM_GENERATE = "skim_generate"
        SKIM_DECIDE = "skim_decide"
        
        # 卡片操作
        CARD_CREATE = "card_create"
        CARD_UPDATE = "card_update"
        CARD_DELETE = "card_delete"
        CARD_SEARCH = "card_search"
        
        # 增强操作
        ENHANCE_REQUEST = "enhance_request"
        ENHANCE_COMPLETE = "enhance_complete"
        
        # 审稿操作
        REVIEW_GENERATE = "review_generate"
        REVIEW_SUBMIT = "review_submit"
        
        # 系统事件
        APP_START = "app_start"
        ERROR_OCCURRED = "error_occurred"
    
    def track(
        self,
        db: Session,
        event_type: str,
        event_name: str,
        paper_id: Optional[str] = None,
        card_id: Optional[str] = None,
        anchor_id: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        value: Optional[float] = None,
        page: Optional[str] = None,
        session_id: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> str:
        """
        记录事件
        
        Args:
            db: 数据库会话
            event_type: 事件类型
            event_name: 事件名称
            paper_id: 关联论文ID
            card_id: 关联卡片ID
            anchor_id: 关联锚点ID
            properties: 事件属性
            value: 数值（如时长、计数）
            page: 页面
            session_id: 会话ID
            user_agent: 用户代理
        
        Returns:
            事件ID
        """
        from ..db.models import AnalyticsEventModel
        
        event = AnalyticsEventModel(
            event_type=event_type,
            event_name=event_name,
            paper_id=paper_id,
            card_id=card_id,
            anchor_id=anchor_id,
            properties=properties or {},
            value=value,
            page=page,
            session_id=session_id,
            user_agent=user_agent,
            timestamp=datetime.utcnow()
        )
        
        db.add(event)
        db.commit()
        
        logger.debug(f"事件记录: {event_type}/{event_name}, paper={paper_id}")
        return event.id
    
    def get_stats(
        self,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        获取统计数据
        
        Args:
            db: 数据库会话
            start_date: 开始日期
            end_date: 结束日期
        
        Returns:
            统计数据
        """
        from ..db.models import (
            AnalyticsEventModel, PaperModel, CardModel, 
            ReviewModel, PaperStatus
        )
        
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()
        
        # 基础统计
        total_papers = db.query(func.count(PaperModel.id)).scalar() or 0
        total_cards = db.query(func.count(CardModel.id)).scalar() or 0
        total_reviews = db.query(func.count(ReviewModel.id)).scalar() or 0
        
        # 论文状态分布
        paper_status_counts = dict(
            db.query(PaperModel.status, func.count(PaperModel.id))
            .group_by(PaperModel.status)
            .all()
        )
        
        # 卡片类型分布
        card_type_counts = dict(
            db.query(CardModel.type, func.count(CardModel.id))
            .group_by(CardModel.type)
            .all()
        )
        
        # 事件统计（时间范围内）
        event_query = db.query(AnalyticsEventModel).filter(
            AnalyticsEventModel.timestamp >= start_date,
            AnalyticsEventModel.timestamp <= end_date
        )
        
        total_events = event_query.count()
        
        # 事件类型分布
        event_type_counts = dict(
            event_query
            .with_entities(AnalyticsEventModel.event_type, func.count(AnalyticsEventModel.id))
            .group_by(AnalyticsEventModel.event_type)
            .all()
        )
        
        # 热门事件
        top_events = (
            event_query
            .with_entities(
                AnalyticsEventModel.event_name,
                func.count(AnalyticsEventModel.id).label("count")
            )
            .group_by(AnalyticsEventModel.event_name)
            .order_by(desc("count"))
            .limit(10)
            .all()
        )
        
        # 每日事件趋势
        daily_events = (
            event_query
            .with_entities(
                func.date(AnalyticsEventModel.timestamp).label("date"),
                func.count(AnalyticsEventModel.id).label("count")
            )
            .group_by(func.date(AnalyticsEventModel.timestamp))
            .order_by("date")
            .all()
        )
        
        # 活跃论文（有事件的论文）
        active_papers = (
            event_query
            .filter(AnalyticsEventModel.paper_id.isnot(None))
            .with_entities(AnalyticsEventModel.paper_id)
            .distinct()
            .count()
        )
        
        return {
            "summary": {
                "total_papers": total_papers,
                "total_cards": total_cards,
                "total_reviews": total_reviews,
                "total_events": total_events,
                "active_papers": active_papers,
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                }
            },
            "paper_status_distribution": {
                k.value if hasattr(k, 'value') else str(k): v 
                for k, v in paper_status_counts.items()
            },
            "card_type_distribution": {
                k.value if hasattr(k, 'value') else str(k): v 
                for k, v in card_type_counts.items()
            },
            "event_type_distribution": event_type_counts,
            "top_events": [
                {"event_name": name, "count": count}
                for name, count in top_events
            ],
            "daily_trend": [
                {"date": str(date), "count": count}
                for date, count in daily_events
            ]
        }
    
    def get_paper_analytics(
        self,
        db: Session,
        paper_id: str
    ) -> Dict[str, Any]:
        """
        获取特定论文的分析数据
        """
        from ..db.models import AnalyticsEventModel, CardModel
        
        # 论文相关事件
        events = (
            db.query(AnalyticsEventModel)
            .filter(AnalyticsEventModel.paper_id == paper_id)
            .order_by(desc(AnalyticsEventModel.timestamp))
            .limit(50)
            .all()
        )
        
        # 事件统计
        event_counts = {}
        for event in events:
            event_counts[event.event_name] = event_counts.get(event.event_name, 0) + 1
        
        # 卡片数量
        card_count = db.query(func.count(CardModel.id)).filter(
            CardModel.paper_id == paper_id
        ).scalar() or 0
        
        return {
            "paper_id": paper_id,
            "event_count": len(events),
            "event_breakdown": event_counts,
            "card_count": card_count,
            "recent_events": [
                {
                    "id": e.id,
                    "type": e.event_type,
                    "name": e.event_name,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                    "properties": e.properties
                }
                for e in events[:10]
            ]
        }
    
    def get_usage_report(
        self,
        db: Session,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        获取使用报告
        """
        from ..db.models import AnalyticsEventModel, PaperModel
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # 新增论文
        new_papers = db.query(func.count(PaperModel.id)).filter(
            PaperModel.created_at >= start_date
        ).scalar() or 0
        
        # 完成阅读的论文
        completed_papers = db.query(func.count(PaperModel.id)).filter(
            PaperModel.updated_at >= start_date,
            PaperModel.status.in_(["deepread", "archived"])
        ).scalar() or 0
        
        # 事件统计
        events = db.query(
            AnalyticsEventModel.event_name,
            func.count(AnalyticsEventModel.id).label("count")
        ).filter(
            AnalyticsEventModel.timestamp >= start_date
        ).group_by(
            AnalyticsEventModel.event_name
        ).all()
        
        return {
            "period": f"last_{days}_days",
            "new_papers": new_papers,
            "completed_papers": completed_papers,
            "event_summary": {name: count for name, count in events}
        }


# 全局实例
analytics_service = AnalyticsService()


# 便捷函数
def track_event(
    db: Session,
    event_type: str,
    event_name: str,
    **kwargs
) -> str:
    """便捷函数：记录事件"""
    return analytics_service.track(db, event_type, event_name, **kwargs)


def track_page_view(db: Session, page: str, **kwargs) -> str:
    """便捷函数：记录页面浏览"""
    return analytics_service.track(
        db,
        AnalyticsService.EventType.PAGE_VIEW,
        f"view_{page}",
        page=page,
        **kwargs
    )


def track_paper_action(db: Session, action: str, paper_id: str, **kwargs) -> str:
    """便捷函数：记录论文操作"""
    return analytics_service.track(
        db,
        AnalyticsService.EventType.PAPER_ACTION,
        action,
        paper_id=paper_id,
        **kwargs
    )


def track_card_action(db: Session, action: str, card_id: str, **kwargs) -> str:
    """便捷函数：记录卡片操作"""
    return analytics_service.track(
        db,
        AnalyticsService.EventType.CARD_ACTION,
        action,
        card_id=card_id,
        **kwargs
    )

