"""
论文CRUD操作
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Tuple
from datetime import datetime

from ..db.models import PaperModel, PaperStatus, ImportJobModel


class PaperCRUD:
    """论文CRUD"""
    
    def create(
        self,
        db: Session,
        *,
        title: str,
        authors: List[str] = None,
        year: int = None,
        venue: str = None,
        abstract: str = None,
        source_type: str = "pdf",
        source_value: str = "",
        pdf_path: str = None
    ) -> PaperModel:
        """创建论文"""
        paper = PaperModel(
            title=title,
            authors=authors or [],
            year=year,
            venue=venue,
            abstract=abstract,
            source_type=source_type,
            source_value=source_value,
            pdf_path=pdf_path,
            status=PaperStatus.IMPORTING
        )
        db.add(paper)
        db.commit()
        db.refresh(paper)
        return paper
    
    def get(self, db: Session, paper_id: str) -> Optional[PaperModel]:
        """获取论文"""
        return db.query(PaperModel).filter(PaperModel.id == paper_id).first()
    
    def get_list(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 20,
        status: str = None,
        quality: str = None,
        search: str = None
    ) -> Tuple[List[PaperModel], int]:
        """获取论文列表"""
        query = db.query(PaperModel)
        
        if status:
            query = query.filter(PaperModel.status == status)
        if quality:
            query = query.filter(PaperModel.quality_grade == quality)
        if search:
            query = query.filter(
                or_(
                    PaperModel.title.ilike(f"%{search}%"),
                    PaperModel.abstract.ilike(f"%{search}%")
                )
            )
        
        total = query.count()
        papers = query.order_by(PaperModel.created_at.desc()).offset(skip).limit(limit).all()
        
        return papers, total
    
    def update(
        self,
        db: Session,
        paper_id: str,
        **kwargs
    ) -> Optional[PaperModel]:
        """更新论文"""
        paper = self.get(db, paper_id)
        if not paper:
            return None
        
        for key, value in kwargs.items():
            if hasattr(paper, key) and value is not None:
                setattr(paper, key, value)
        
        paper.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(paper)
        return paper
    
    def delete(self, db: Session, paper_id: str) -> bool:
        """删除论文"""
        paper = self.get(db, paper_id)
        if not paper:
            return False
        
        db.delete(paper)
        db.commit()
        return True
    
    def update_status(
        self,
        db: Session,
        paper_id: str,
        status: PaperStatus
    ) -> Optional[PaperModel]:
        """更新论文状态"""
        return self.update(db, paper_id, status=status)
    
    def update_read_progress(
        self,
        db: Session,
        paper_id: str,
        progress: float,
        current_section: str = None
    ) -> Optional[PaperModel]:
        """更新阅读进度"""
        kwargs = {"read_progress": progress, "last_read_at": datetime.utcnow()}
        if current_section:
            kwargs["current_section"] = current_section
        return self.update(db, paper_id, **kwargs)
    
    def update_metadata(
        self,
        db: Session,
        paper_id: str,
        metadata: dict
    ) -> Optional[PaperModel]:
        """更新论文元数据"""
        return self.update(db, paper_id, metadata=metadata)
    
    def get_stats(self, db: Session) -> dict:
        """获取统计信息"""
        total = db.query(PaperModel).count()
        
        stats = {
            "total": total,
            "unread": db.query(PaperModel).filter(PaperModel.status == PaperStatus.UNREAD).count(),
            "skimmed": db.query(PaperModel).filter(PaperModel.status == PaperStatus.SKIMMED).count(),
            "deepread": db.query(PaperModel).filter(PaperModel.status == PaperStatus.DEEPREAD).count(),
            "archived": db.query(PaperModel).filter(PaperModel.status == PaperStatus.ARCHIVED).count(),
            "by_quality": {},
            "by_year": {}
        }
        
        # 按质量统计
        for grade in ['A', 'B', 'C', 'D']:
            count = db.query(PaperModel).filter(PaperModel.quality_grade == grade).count()
            if count > 0:
                stats["by_quality"][grade] = count
        
        return stats
    
    # 导入任务相关
    def create_import_job(
        self,
        db: Session,
        paper_id: str
    ) -> ImportJobModel:
        """创建导入任务"""
        job = ImportJobModel(
            paper_id=paper_id,
            status="pending",
            steps={
                "download": "pending",
                "parse_text": "pending",
                "extract_sections": "pending",
                "extract_figures": "pending",
                "extract_equations": "pending",
                "generate_anchors": "pending"
            }
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job
    
    def get_import_job(self, db: Session, job_id: str) -> Optional[ImportJobModel]:
        """获取导入任务"""
        return db.query(ImportJobModel).filter(ImportJobModel.id == job_id).first()
    
    def update_import_job(
        self,
        db: Session,
        job_id: str,
        **kwargs
    ) -> Optional[ImportJobModel]:
        """更新导入任务"""
        job = self.get_import_job(db, job_id)
        if not job:
            return None
        
        for key, value in kwargs.items():
            if hasattr(job, key) and value is not None:
                setattr(job, key, value)
        
        db.commit()
        db.refresh(job)
        return job


paper_crud = PaperCRUD()

