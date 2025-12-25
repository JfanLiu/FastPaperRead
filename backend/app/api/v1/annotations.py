"""
PDF 批注/高亮 API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

from ...api.deps import get_db
from ...crud import paper_crud

router = APIRouter()


# ============================================
# Pydantic Models
# ============================================

class AnnotationCreate(BaseModel):
    """创建批注请求"""
    type: str  # 'highlight' | 'note'
    page: int
    text: Optional[str] = None  # 选中的原文
    note: Optional[str] = None  # 批注内容
    color: str = 'yellow'  # 高亮颜色: yellow, green, blue, red, purple
    # 位置信息 (相对于页面的百分比)
    rect: dict  # { x: float, y: float, width: float, height: float }
    
class AnnotationUpdate(BaseModel):
    """更新批注请求"""
    note: Optional[str] = None
    color: Optional[str] = None

class AnnotationResponse(BaseModel):
    """批注响应"""
    id: str
    type: str
    page: int
    text: Optional[str]
    note: Optional[str]
    color: str
    rect: dict
    created_at: str
    updated_at: str


# ============================================
# API Endpoints
# ============================================

@router.get("/{paper_id}", response_model=dict)
async def get_annotations(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """
    获取论文的所有批注
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 从 paper.metadata 中获取批注
    metadata = paper.metadata or {}
    annotations = metadata.get("annotations", [])
    
    return {
        "paper_id": paper_id,
        "annotations": annotations,
        "count": len(annotations)
    }


@router.post("/{paper_id}", response_model=dict)
async def create_annotation(
    paper_id: str,
    request: AnnotationCreate,
    db: Session = Depends(get_db)
):
    """
    创建新批注/高亮
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 创建批注
    annotation = {
        "id": str(uuid.uuid4()),
        "type": request.type,
        "page": request.page,
        "text": request.text,
        "note": request.note,
        "color": request.color,
        "rect": request.rect,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # 添加到 metadata
    metadata = paper.metadata or {}
    annotations = metadata.get("annotations", [])
    annotations.append(annotation)
    metadata["annotations"] = annotations
    
    paper_crud.update_metadata(db, paper_id, metadata)
    
    return {
        "annotation": annotation,
        "message": "批注创建成功"
    }


@router.put("/{paper_id}/{annotation_id}", response_model=dict)
async def update_annotation(
    paper_id: str,
    annotation_id: str,
    request: AnnotationUpdate,
    db: Session = Depends(get_db)
):
    """
    更新批注
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    metadata = paper.metadata or {}
    annotations = metadata.get("annotations", [])
    
    # 查找并更新
    updated = False
    for ann in annotations:
        if ann["id"] == annotation_id:
            if request.note is not None:
                ann["note"] = request.note
            if request.color is not None:
                ann["color"] = request.color
            ann["updated_at"] = datetime.utcnow().isoformat()
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="批注不存在")
    
    metadata["annotations"] = annotations
    paper_crud.update_metadata(db, paper_id, metadata)
    
    return {
        "message": "批注更新成功"
    }


@router.delete("/{paper_id}/{annotation_id}", response_model=dict)
async def delete_annotation(
    paper_id: str,
    annotation_id: str,
    db: Session = Depends(get_db)
):
    """
    删除批注
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    metadata = paper.metadata or {}
    annotations = metadata.get("annotations", [])
    
    # 过滤掉要删除的批注
    new_annotations = [a for a in annotations if a["id"] != annotation_id]
    
    if len(new_annotations) == len(annotations):
        raise HTTPException(status_code=404, detail="批注不存在")
    
    metadata["annotations"] = new_annotations
    paper_crud.update_metadata(db, paper_id, metadata)
    
    return {
        "message": "批注删除成功"
    }


@router.delete("/{paper_id}", response_model=dict)
async def clear_annotations(
    paper_id: str,
    page: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    清除批注（可选按页面）
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    metadata = paper.metadata or {}
    annotations = metadata.get("annotations", [])
    
    if page is not None:
        # 只删除指定页面的批注
        annotations = [a for a in annotations if a["page"] != page]
    else:
        # 删除所有批注
        annotations = []
    
    metadata["annotations"] = annotations
    paper_crud.update_metadata(db, paper_id, metadata)
    
    return {
        "message": "批注已清除"
    }

