"""
锚点CRUD操作
"""
from sqlalchemy.orm import Session
from typing import List, Optional, Dict

from ..db.models import AnchorModel, AnchorType


class AnchorCRUD:
    """锚点CRUD"""
    
    def create(
        self,
        db: Session,
        *,
        paper_id: str,
        type: AnchorType,
        page: int = 1,
        text: str = "",
        **kwargs
    ) -> AnchorModel:
        """创建锚点"""
        anchor = AnchorModel(
            paper_id=paper_id,
            type=type,
            page=page,
            text=text,
            **kwargs
        )
        db.add(anchor)
        db.commit()
        db.refresh(anchor)
        return anchor
    
    def create_batch(
        self,
        db: Session,
        paper_id: str,
        anchors_data: List[dict]
    ) -> List[AnchorModel]:
        """批量创建锚点"""
        anchors = []
        for data in anchors_data:
            anchor = AnchorModel(paper_id=paper_id, **data)
            db.add(anchor)
            anchors.append(anchor)
        
        db.commit()
        for anchor in anchors:
            db.refresh(anchor)
        
        return anchors
    
    def get(self, db: Session, anchor_id: str) -> Optional[AnchorModel]:
        """获取锚点"""
        return db.query(AnchorModel).filter(AnchorModel.id == anchor_id).first()
    
    def get_by_paper(
        self,
        db: Session,
        paper_id: str,
        *,
        type: str = None,
        page: int = None
    ) -> List[AnchorModel]:
        """获取论文的锚点"""
        query = db.query(AnchorModel).filter(AnchorModel.paper_id == paper_id)
        
        if type:
            query = query.filter(AnchorModel.type == type)
        if page:
            query = query.filter(AnchorModel.page == page)
        
        return query.order_by(AnchorModel.sequence).all()
    
    def get_sections(self, db: Session, paper_id: str) -> List[AnchorModel]:
        """获取章节锚点"""
        return db.query(AnchorModel).filter(
            AnchorModel.paper_id == paper_id,
            AnchorModel.type == AnchorType.SECTION
        ).order_by(AnchorModel.sequence).all()
    
    def get_figures(self, db: Session, paper_id: str) -> List[AnchorModel]:
        """获取图表锚点"""
        return db.query(AnchorModel).filter(
            AnchorModel.paper_id == paper_id,
            AnchorModel.type == AnchorType.FIGURE
        ).order_by(AnchorModel.sequence).all()
    
    def get_equations(self, db: Session, paper_id: str) -> List[AnchorModel]:
        """获取公式锚点"""
        return db.query(AnchorModel).filter(
            AnchorModel.paper_id == paper_id,
            AnchorModel.type == AnchorType.EQUATION
        ).order_by(AnchorModel.sequence).all()
    
    def update(
        self,
        db: Session,
        anchor_id: str,
        **kwargs
    ) -> Optional[AnchorModel]:
        """更新锚点"""
        anchor = self.get(db, anchor_id)
        if not anchor:
            return None
        
        for key, value in kwargs.items():
            if hasattr(anchor, key) and value is not None:
                setattr(anchor, key, value)
        
        db.commit()
        db.refresh(anchor)
        return anchor
    
    def update_explanation_cache(
        self,
        db: Session,
        anchor_id: str,
        explanation: Dict
    ) -> Optional[AnchorModel]:
        """更新解释缓存"""
        anchor = self.get(db, anchor_id)
        if not anchor:
            return None
        
        if anchor.explanation_cache is None:
            anchor.explanation_cache = {}
        
        anchor.explanation_cache.update(explanation)
        db.commit()
        db.refresh(anchor)
        return anchor
    
    def delete(self, db: Session, anchor_id: str) -> bool:
        """删除锚点"""
        anchor = self.get(db, anchor_id)
        if not anchor:
            return False
        
        db.delete(anchor)
        db.commit()
        return True
    
    def delete_by_paper(self, db: Session, paper_id: str) -> int:
        """删除论文的所有锚点"""
        count = db.query(AnchorModel).filter(AnchorModel.paper_id == paper_id).delete()
        db.commit()
        return count
    
    def count_by_type(self, db: Session, paper_id: str) -> Dict[str, int]:
        """按类型统计锚点数量"""
        anchors = db.query(AnchorModel).filter(AnchorModel.paper_id == paper_id).all()
        
        counts = {}
        for anchor in anchors:
            type_str = anchor.type.value if isinstance(anchor.type, AnchorType) else anchor.type
            counts[type_str] = counts.get(type_str, 0) + 1
        
        return counts


anchor_crud = AnchorCRUD()

