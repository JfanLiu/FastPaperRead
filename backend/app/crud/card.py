"""
卡片CRUD操作
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Tuple
from datetime import datetime

from ..db.models import CardModel, CardType


class CardCRUD:
    """卡片CRUD"""
    
    def create(
        self,
        db: Session,
        *,
        paper_id: str,
        type: CardType,
        title: str,
        content: str = "",
        **kwargs
    ) -> CardModel:
        """创建卡片"""
        card = CardModel(
            paper_id=paper_id,
            type=type,
            title=title,
            content=content,
            **kwargs
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        return card
    
    def get(self, db: Session, card_id: str) -> Optional[CardModel]:
        """获取卡片"""
        return db.query(CardModel).filter(CardModel.id == card_id).first()
    
    def get_by_paper(
        self,
        db: Session,
        paper_id: str,
        *,
        type: str = None
    ) -> List[CardModel]:
        """获取论文的卡片"""
        query = db.query(CardModel).filter(CardModel.paper_id == paper_id)
        
        if type:
            query = query.filter(CardModel.type == type)
        
        return query.order_by(CardModel.created_at.desc()).all()
    
    def search(
        self,
        db: Session,
        *,
        query: str = "",
        types: List[str] = None,
        tags: List[str] = None,
        paper_ids: List[str] = None,
        status: str = None,
        skip: int = 0,
        limit: int = 20
    ) -> Tuple[List[CardModel], int]:
        """搜索卡片"""
        q = db.query(CardModel)
        
        if query:
            q = q.filter(
                or_(
                    CardModel.title.ilike(f"%{query}%"),
                    CardModel.content.ilike(f"%{query}%")
                )
            )
        
        if types:
            q = q.filter(CardModel.type.in_(types))
        
        if paper_ids:
            q = q.filter(CardModel.paper_id.in_(paper_ids))
        
        if status:
            q = q.filter(CardModel.status == status)
        
        # 标签过滤需要特殊处理（JSON字段）
        # 简化处理：SQLite不支持JSON数组contains
        
        total = q.count()
        cards = q.order_by(CardModel.updated_at.desc()).offset(skip).limit(limit).all()
        
        return cards, total
    
    def update(
        self,
        db: Session,
        card_id: str,
        **kwargs
    ) -> Optional[CardModel]:
        """更新卡片"""
        card = self.get(db, card_id)
        if not card:
            return None
        
        for key, value in kwargs.items():
            if hasattr(card, key) and value is not None:
                setattr(card, key, value)
        
        card.updated_at = datetime.utcnow()
        card.version += 1
        db.commit()
        db.refresh(card)
        return card
    
    def finalize(self, db: Session, card_id: str) -> Optional[CardModel]:
        """定稿卡片"""
        return self.update(db, card_id, status="final")
    
    def delete(self, db: Session, card_id: str) -> bool:
        """删除卡片"""
        card = self.get(db, card_id)
        if not card:
            return False
        
        db.delete(card)
        db.commit()
        return True
    
    def count_by_type(self, db: Session, paper_id: str = None) -> dict:
        """按类型统计卡片数量"""
        query = db.query(CardModel)
        if paper_id:
            query = query.filter(CardModel.paper_id == paper_id)
        
        cards = query.all()
        counts = {}
        for card in cards:
            type_str = card.type.value if isinstance(card.type, CardType) else card.type
            counts[type_str] = counts.get(type_str, 0) + 1
        
        return counts


card_crud = CardCRUD()


