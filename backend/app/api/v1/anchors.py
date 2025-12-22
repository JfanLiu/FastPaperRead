"""
锚点API路由
"""
import re
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import Optional, List

from ...schemas.anchor import (
    AnchorResponse, AnchorListResponse, 
    SectionTreeResponse, ReadingRouteResponse,
    AnchorSearchRequest
)
from ...db.base import get_db
from ...crud import anchor_crud
from ...db.models import AnchorType

router = APIRouter()


def _anchor_to_dict(anchor) -> dict:
    """将AnchorModel转换为字典，与AnchorResponse schema匹配"""
    return {
        "id": anchor.id,
        "paper_id": anchor.paper_id,
        "type": anchor.type.value if isinstance(anchor.type, AnchorType) else anchor.type,
        "page": anchor.page or 1,
        "bbox": anchor.bbox,
        "section": anchor.section,
        "section_level": anchor.section_level or 0,
        "sequence": anchor.sequence or 0,
        "text": anchor.text or "",
        "caption": anchor.caption,
        "image_path": anchor.image_path,
        "figure_number": anchor.figure_number,
        "latex": anchor.latex,
        "equation_number": anchor.equation_number,
        "symbols": anchor.symbols or [],
        "table_data": anchor.table_data,
        "ref_id": anchor.ref_id,
        "card_ids": [],  # 暂未实现关联卡片
        "cached_explanation": anchor.explanation_cache,
    }


@router.get("/paper/{paper_id}", response_model=AnchorListResponse)
async def get_paper_anchors(
    paper_id: str,
    type: Optional[str] = None,
    page: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取论文的所有锚点"""
    # 从数据库获取锚点
    anchors_models = anchor_crud.get_by_paper(db, paper_id, type=type, page=page)
    
    # 转换为字典列表
    anchors = [_anchor_to_dict(a) for a in anchors_models]
    
    # 统计各类型数量
    by_type = anchor_crud.count_by_type(db, paper_id)
    
    return AnchorListResponse(
        items=anchors,
        total=len(anchors),
        by_type=by_type
    )


@router.get("/paper/{paper_id}/sections", response_model=SectionTreeResponse)
async def get_section_tree(paper_id: str, db: Session = Depends(get_db)):
    """获取章节树"""
    # 从数据库获取章节锚点
    section_anchors = anchor_crud.get_sections(db, paper_id)
    
    # 构建树（简化版）
    sections = []
    for anchor in section_anchors:
        sections.append({
            "id": anchor.id,
            "title": anchor.text or "",
            "level": anchor.section_level or 1,
            "anchor_id": anchor.id,
            "page": anchor.page or 1,
            "children": [],
            "is_read": getattr(anchor, 'is_read', False),
            "is_must_read": _is_must_read_section(anchor.text or "")
        })
    
    return SectionTreeResponse(
        paper_id=paper_id,
        sections=sections
    )


@router.get("/paper/{paper_id}/routes/{route_name}", response_model=ReadingRouteResponse)
async def get_reading_route(paper_id: str, route_name: str, db: Session = Depends(get_db)):
    """获取阅读路线"""
    routes = {
        "quick_repro": {
            "name": "快速复现路线",
            "description": "快速了解方法和实验设置",
            "estimated_time": 20,
            "must_sections": ["Abstract", "Method", "Experiments"]
        },
        "review": {
            "name": "审稿路线",
            "description": "评估论文质量",
            "estimated_time": 40,
            "must_sections": ["Abstract", "Introduction", "Method", "Experiments", "Conclusion"]
        },
        "full": {
            "name": "全文路线",
            "description": "完整阅读",
            "estimated_time": 60,
            "must_sections": None  # 全部
        }
    }
    
    if route_name not in routes:
        raise HTTPException(404, "路线不存在")
    
    route = routes[route_name]
    must_section_list = route["must_sections"]
    
    # 从数据库获取章节锚点
    section_anchors = anchor_crud.get_sections(db, paper_id)
    
    # 过滤必读章节（仅对特定路线进行过滤）
    # 使用单词边界匹配避免误匹配（如 "Method" 匹配 "Methodology"）
    if must_section_list:
        filtered = []
        for anchor in section_anchors:
            title = str(anchor.text or "")
            for must in must_section_list:
                # 使用正则表达式单词边界匹配
                if re.search(r'\b' + re.escape(must) + r'\b', title, re.IGNORECASE):
                    filtered.append(anchor)
                    break
        section_anchors = filtered
    
    def _check_must_read(title: str) -> bool:
        """根据路线判断章节是否为必读"""
        if must_section_list:
            # 特定路线：被过滤保留的章节都是必读的
            return True
        else:
            # 全文路线：使用通用必读判断逻辑
            return _is_must_read_section(title)
    
    sections = [
        {
            "id": a.id,
            "title": a.text or "",
            "level": a.section_level or 1,
            "anchor_id": a.id,
            "page": a.page or 1,
            "children": [],
            "is_read": getattr(a, 'is_read', False),
            "is_must_read": _check_must_read(a.text or "")
        }
        for a in section_anchors
    ]
    
    return ReadingRouteResponse(
        name=route["name"],
        description=route["description"],
        sections=sections,
        estimated_time=route["estimated_time"],
        total_sections=len(sections)
    )


@router.get("/{anchor_id}", response_model=AnchorResponse)
async def get_anchor(anchor_id: str, db: Session = Depends(get_db)):
    """获取单个锚点"""
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(404, "锚点不存在")
    
    return _anchor_to_dict(anchor)


@router.post("/search")
async def search_anchors(request: AnchorSearchRequest, db: Session = Depends(get_db)):
    """搜索锚点"""
    from ...db.models import AnchorModel
    query = db.query(AnchorModel)
    
    # 按类型过滤
    if request.types:
        query = query.filter(AnchorModel.type.in_(request.types))
    
    # 按页码范围过滤
    if request.page_range:
        start, end = request.page_range
        query = query.filter(AnchorModel.page >= start, AnchorModel.page <= end)
    
    anchors = query.all()
    
    # 关键词搜索
    query_lower = request.query.lower()
    filtered = [
        a for a in anchors 
        if query_lower in (a.text or "").lower() or 
           query_lower in (a.caption or "").lower()
    ]
    
    return {
        "items": [_anchor_to_dict(a) for a in filtered[:request.limit]],
        "total": len(filtered)
    }


@router.put("/{anchor_id}/read")
async def mark_anchor_read(anchor_id: str, is_read: bool = True, db: Session = Depends(get_db)):
    """标记锚点已读"""
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(404, "锚点不存在")
    
    anchor_crud.update(db, anchor_id, is_read=is_read)
    return {"message": "已更新"}


def _is_must_read_section(title: str) -> bool:
    """判断是否为必读章节（使用单词边界匹配避免误匹配）"""
    must_read = ["abstract", "introduction", "method", "experiment", "conclusion"]
    return any(re.search(r'\b' + kw + r'\b', title, re.IGNORECASE) for kw in must_read)

