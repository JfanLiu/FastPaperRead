"""
SkimCard CRUD操作
"""
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from ..db.models import SkimCardModel


class SkimCRUD:
    """SkimCard CRUD"""
    
    def create(
        self,
        db: Session,
        *,
        paper_id: str,
        research_question: str = "",
        contributions: list = None,
        evidence_strength: str = "medium",
        evidence_strength_reason: str = "",
        red_flags: list = None,
        recommended_route: str = "review",
        recommended_sections: list = None,
        key_figures: list = None,
        source_anchor_ids: list = None
    ) -> SkimCardModel:
        """创建SkimCard"""
        skim = SkimCardModel(
            paper_id=paper_id,
            research_question=research_question,
            contributions=contributions or [],
            evidence_strength=evidence_strength,
            evidence_strength_reason=evidence_strength_reason,
            red_flags=red_flags or [],
            recommended_route=recommended_route,
            recommended_sections=recommended_sections or [],
            key_figures=key_figures or [],
            source_anchor_ids=source_anchor_ids or []
        )
        db.add(skim)
        db.commit()
        db.refresh(skim)
        return skim
    
    def get(self, db: Session, paper_id: str) -> Optional[SkimCardModel]:
        """获取SkimCard"""
        return db.query(SkimCardModel).filter(SkimCardModel.paper_id == paper_id).first()
    
    def update(
        self,
        db: Session,
        paper_id: str,
        **kwargs
    ) -> Optional[SkimCardModel]:
        """更新SkimCard"""
        skim = self.get(db, paper_id)
        if not skim:
            return None
        
        for key, value in kwargs.items():
            if hasattr(skim, key) and value is not None:
                setattr(skim, key, value)
        
        skim.generated_at = datetime.utcnow()
        db.commit()
        db.refresh(skim)
        return skim
    
    def create_or_update(
        self,
        db: Session,
        paper_id: str,
        **kwargs
    ) -> SkimCardModel:
        """创建或更新SkimCard"""
        existing = self.get(db, paper_id)
        if existing:
            return self.update(db, paper_id, **kwargs)
        else:
            return self.create(db, paper_id=paper_id, **kwargs)
    
    def delete(self, db: Session, paper_id: str) -> bool:
        """删除SkimCard"""
        skim = self.get(db, paper_id)
        if not skim:
            return False
        
        db.delete(skim)
        db.commit()
        return True


skim_crud = SkimCRUD()

