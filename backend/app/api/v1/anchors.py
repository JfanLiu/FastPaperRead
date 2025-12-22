"""
锚点API路由
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from ...schemas.anchor import (
    AnchorResponse, AnchorListResponse, 
    SectionTreeResponse, ReadingRouteResponse,
    AnchorSearchRequest
)

router = APIRouter()

# 临时存储
_anchors_db = {}


@router.get("/paper/{paper_id}", response_model=AnchorListResponse)
async def get_paper_anchors(
    paper_id: str,
    type: Optional[str] = None,
    page: Optional[int] = None
):
    """获取论文的所有锚点"""
    anchors = [a for a in _anchors_db.values() if a.get("paper_id") == paper_id]
    
    # 过滤
    if type:
        anchors = [a for a in anchors if a.get("type") == type]
    if page:
        anchors = [a for a in anchors if a.get("page") == page]
    
    # 统计
    by_type = {}
    for a in anchors:
        t = a.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
    
    return AnchorListResponse(
        items=anchors,
        total=len(anchors),
        by_type=by_type
    )


@router.get("/paper/{paper_id}/sections", response_model=SectionTreeResponse)
async def get_section_tree(paper_id: str):
    """获取章节树"""
    # 获取章节锚点
    section_anchors = [
        a for a in _anchors_db.values() 
        if a.get("paper_id") == paper_id and a.get("type") == "section"
    ]
    
    # 构建树（简化版）
    sections = []
    for anchor in sorted(section_anchors, key=lambda x: x.get("sequence", 0)):
        sections.append({
            "id": anchor["id"],
            "title": anchor.get("text", ""),
            "level": anchor.get("section_level", 1),
            "anchor_id": anchor["id"],
            "page": anchor.get("page", 1),
            "children": [],
            "is_read": False,
            "is_must_read": _is_must_read_section(anchor.get("text", ""))
        })
    
    return SectionTreeResponse(
        paper_id=paper_id,
        sections=sections
    )


@router.get("/paper/{paper_id}/routes/{route_name}", response_model=ReadingRouteResponse)
async def get_reading_route(paper_id: str, route_name: str):
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
    
    # 获取章节
    section_anchors = [
        a for a in _anchors_db.values() 
        if a.get("paper_id") == paper_id and a.get("type") == "section"
    ]
    
    # 过滤必读章节
    if route["must_sections"]:
        filtered = []
        for section in section_anchors:
            title = section.get("text", "").lower()
            for must in route["must_sections"]:
                if must.lower() in title:
                    filtered.append(section)
                    break
        section_anchors = filtered
    
    sections = [
        {
            "id": a["id"],
            "title": a.get("text", ""),
            "level": a.get("section_level", 1),
            "anchor_id": a["id"],
            "page": a.get("page", 1),
            "children": [],
            "is_read": False,
            "is_must_read": True
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
async def get_anchor(anchor_id: str):
    """获取单个锚点"""
    if anchor_id not in _anchors_db:
        raise HTTPException(404, "锚点不存在")
    
    return _anchors_db[anchor_id]


@router.post("/search")
async def search_anchors(request: AnchorSearchRequest):
    """搜索锚点"""
    anchors = list(_anchors_db.values())
    
    # 按类型过滤
    if request.types:
        anchors = [a for a in anchors if a.get("type") in request.types]
    
    # 按页码范围过滤
    if request.page_range:
        start, end = request.page_range
        anchors = [a for a in anchors if start <= a.get("page", 0) <= end]
    
    # 关键词搜索
    query_lower = request.query.lower()
    anchors = [
        a for a in anchors 
        if query_lower in a.get("text", "").lower() or 
           query_lower in a.get("caption", "").lower()
    ]
    
    return {
        "items": anchors[:request.limit],
        "total": len(anchors)
    }


@router.put("/{anchor_id}/read")
async def mark_anchor_read(anchor_id: str, is_read: bool = True):
    """标记锚点已读"""
    if anchor_id not in _anchors_db:
        raise HTTPException(404, "锚点不存在")
    
    _anchors_db[anchor_id]["is_read"] = is_read
    return {"message": "已更新"}


def _is_must_read_section(title: str) -> bool:
    """判断是否为必读章节"""
    must_read = ["abstract", "introduction", "method", "experiment", "conclusion"]
    return any(kw in title.lower() for kw in must_read)


