"""
论文API路由
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from typing import Optional, List
import uuid
import os

from ...schemas.paper import (
    PaperImportRequest, PaperImportResponse,
    PaperCreate, PaperUpdate, PaperResponse, PaperListResponse,
    PaperParseStatusResponse, PaperStatsResponse
)
from ...config import settings

router = APIRouter()

# 临时存储（后续替换为数据库）
_papers_db = {}
_jobs_db = {}


@router.post("/import", response_model=PaperImportResponse)
async def import_paper(
    request: PaperImportRequest,
    background_tasks: BackgroundTasks
):
    """
    导入论文
    
    支持多种方式：
    - PDF URL
    - DOI
    - arXiv ID
    """
    paper_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    # 创建任务
    _jobs_db[job_id] = {
        "paper_id": paper_id,
        "status": "pending",
        "progress": 0,
        "current_step": "初始化",
        "steps": {
            "download": "pending",
            "parse_text": "pending",
            "extract_sections": "pending",
            "extract_figures": "pending",
            "extract_equations": "pending",
            "generate_anchors": "pending"
        }
    }
    
    # 后台执行解析任务
    background_tasks.add_task(
        _parse_paper_task,
        paper_id=paper_id,
        job_id=job_id,
        request=request
    )
    
    return PaperImportResponse(
        paper_id=paper_id,
        job_id=job_id,
        status="pending",
        message="论文导入任务已创建"
    )


@router.post("/upload", response_model=PaperImportResponse)
async def upload_paper(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None
):
    """上传PDF文件"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(400, "仅支持PDF文件")
    
    paper_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    # 保存文件
    file_path = os.path.join(settings.UPLOAD_DIR, f"{paper_id}.pdf")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # 创建任务
    _jobs_db[job_id] = {
        "paper_id": paper_id,
        "status": "pending",
        "progress": 0,
        "pdf_path": file_path
    }
    
    # 后台解析
    if background_tasks:
        background_tasks.add_task(
            _parse_paper_task,
            paper_id=paper_id,
            job_id=job_id,
            pdf_path=file_path
        )
    
    return PaperImportResponse(
        paper_id=paper_id,
        job_id=job_id,
        status="pending",
        message="文件已上传，正在解析"
    )


@router.get("/import/{job_id}/status", response_model=PaperParseStatusResponse)
async def get_import_status(job_id: str):
    """获取导入任务状态"""
    if job_id not in _jobs_db:
        raise HTTPException(404, "任务不存在")
    
    job = _jobs_db[job_id]
    return PaperParseStatusResponse(
        paper_id=job["paper_id"],
        job_id=job_id,
        status=job["status"],
        progress=job.get("progress", 0),
        current_step=job.get("current_step", ""),
        steps=job.get("steps", {}),
        error_message=job.get("error_message")
    )


@router.get("", response_model=PaperListResponse)
async def list_papers(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    quality: Optional[str] = None,
    year: Optional[int] = None,
    search: Optional[str] = None
):
    """获取论文列表"""
    papers = list(_papers_db.values())
    
    # 过滤
    if status:
        papers = [p for p in papers if p.get("status") == status]
    if quality:
        papers = [p for p in papers if p.get("quality_grade") == quality]
    if year:
        papers = [p for p in papers if p.get("year") == year]
    if search:
        search_lower = search.lower()
        papers = [p for p in papers if search_lower in p.get("title", "").lower()]
    
    # 分页
    total = len(papers)
    start = (page - 1) * limit
    end = start + limit
    papers = papers[start:end]
    
    return PaperListResponse(
        items=papers,
        total=total,
        page=page,
        limit=limit,
        has_more=end < total
    )


@router.get("/{paper_id}", response_model=PaperResponse)
async def get_paper(paper_id: str):
    """获取论文详情"""
    if paper_id not in _papers_db:
        raise HTTPException(404, "论文不存在")
    
    return _papers_db[paper_id]


@router.put("/{paper_id}", response_model=PaperResponse)
async def update_paper(paper_id: str, update: PaperUpdate):
    """更新论文信息"""
    if paper_id not in _papers_db:
        raise HTTPException(404, "论文不存在")
    
    paper = _papers_db[paper_id]
    update_data = update.model_dump(exclude_unset=True)
    paper.update(update_data)
    
    return paper


@router.delete("/{paper_id}")
async def delete_paper(paper_id: str):
    """删除论文"""
    if paper_id not in _papers_db:
        raise HTTPException(404, "论文不存在")
    
    del _papers_db[paper_id]
    return {"message": "论文已删除"}


@router.get("/stats/overview", response_model=PaperStatsResponse)
async def get_paper_stats():
    """获取论文统计"""
    papers = list(_papers_db.values())
    
    stats = {
        "total": len(papers),
        "unread": len([p for p in papers if p.get("status") == "unread"]),
        "skimmed": len([p for p in papers if p.get("status") == "skimmed"]),
        "deepread": len([p for p in papers if p.get("status") == "deepread"]),
        "archived": len([p for p in papers if p.get("status") == "archived"]),
        "by_quality": {},
        "by_year": {}
    }
    
    for paper in papers:
        # 按质量
        grade = paper.get("quality_grade", "unknown")
        stats["by_quality"][grade] = stats["by_quality"].get(grade, 0) + 1
        
        # 按年份
        year = paper.get("year")
        if year:
            stats["by_year"][str(year)] = stats["by_year"].get(str(year), 0) + 1
    
    return stats


async def _parse_paper_task(
    paper_id: str,
    job_id: str,
    request: PaperImportRequest = None,
    pdf_path: str = None
):
    """后台解析论文任务"""
    job = _jobs_db[job_id]
    
    try:
        job["status"] = "running"
        
        # 1. 下载PDF (如果是URL)
        if request and request.pdf_url:
            job["current_step"] = "下载PDF"
            job["steps"]["download"] = "running"
            # TODO: 实现下载
            job["steps"]["download"] = "completed"
            job["progress"] = 20
        
        # 2. 解析PDF
        job["current_step"] = "解析文档"
        job["steps"]["parse_text"] = "running"
        # TODO: 调用PDF Parser
        job["steps"]["parse_text"] = "completed"
        job["progress"] = 40
        
        # 3. 提取章节
        job["current_step"] = "提取章节"
        job["steps"]["extract_sections"] = "running"
        job["steps"]["extract_sections"] = "completed"
        job["progress"] = 60
        
        # 4. 提取图表
        job["current_step"] = "提取图表"
        job["steps"]["extract_figures"] = "running"
        job["steps"]["extract_figures"] = "completed"
        job["progress"] = 80
        
        # 5. 生成锚点
        job["current_step"] = "生成锚点"
        job["steps"]["generate_anchors"] = "running"
        job["steps"]["generate_anchors"] = "completed"
        job["progress"] = 100
        
        # 创建论文记录
        _papers_db[paper_id] = {
            "id": paper_id,
            "title": request.title if request else "Untitled",
            "authors": request.authors if request else [],
            "year": request.year if request else None,
            "venue": request.venue if request else None,
            "status": "unread",
            "quality_grade": None,
            "read_progress": 0,
            "anchor_count": 0,
            "card_count": 0
        }
        
        job["status"] = "completed"
        job["current_step"] = "完成"
        
    except Exception as e:
        job["status"] = "failed"
        job["error_message"] = str(e)

