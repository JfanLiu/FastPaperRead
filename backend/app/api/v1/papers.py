"""
论文API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import shutil
import httpx
import logging

from ...api.deps import get_db
from ...crud import paper_crud
from ...db.models import PaperStatus
from ...schemas.paper import PaperCreate, PaperUpdate, PaperInDB, PaperListResponse
from ...config import settings
from ...tasks import process_paper_import

logger = logging.getLogger("fastpaperread.api.papers")
router = APIRouter()


@router.post("/upload", response_model=dict)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    上传PDF文件
    
    - 保存PDF到服务器
    - 创建论文记录
    - 触发后台解析任务
    """
    logger.info(f"[UPLOAD] 开始上传文件: {file.filename}")
    
    # 验证文件类型
    if not file.filename.endswith('.pdf'):
        logger.warning(f"[UPLOAD] 文件类型错误: {file.filename}")
        raise HTTPException(status_code=400, detail="只支持PDF文件")
    
    # 生成文件路径
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.pdf"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    logger.debug(f"[UPLOAD] 生成文件路径: {file_path}")
    
    # 保存文件
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = os.path.getsize(file_path)
    logger.info(f"[UPLOAD] 文件已保存: {file_path}, 大小: {file_size/1024/1024:.2f}MB")
    
    # 创建论文记录
    paper = paper_crud.create(
        db,
        title=file.filename.replace('.pdf', ''),
        source_type="pdf",
        source_value=file.filename,
        pdf_path=file_path
    )
    logger.info(f"[UPLOAD] 论文记录已创建: paper_id={paper.id}")
    
    # 创建导入任务
    job = paper_crud.create_import_job(db, paper.id)
    logger.info(f"[UPLOAD] 导入任务已创建: job_id={job.id}")
    
    # 触发后台解析任务
    background_tasks.add_task(process_paper_import, paper.id, file_path)
    logger.info(f"[UPLOAD] 后台解析任务已触发: paper_id={paper.id}")
    
    return {
        "paper_id": paper.id,
        "job_id": job.id,
        "message": "上传成功，开始解析"
    }


@router.post("/import", response_model=dict)
async def import_paper_from_url(
    url: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    从URL导入论文（arXiv/DOI/URL）
    
    支持:
    - PDF直链
    - arXiv链接 (自动转换为PDF链接)
    - DOI链接 (尝试获取PDF)
    """
    # 解析URL类型
    source_type = "url"
    pdf_url = url
    
    if "arxiv.org" in url:
        source_type = "arxiv"
        # 转换arXiv链接为PDF链接
        if "/abs/" in url:
            pdf_url = url.replace("/abs/", "/pdf/") + ".pdf"
        elif not url.endswith(".pdf"):
            pdf_url = url + ".pdf"
    elif "doi.org" in url:
        source_type = "doi"
        # DOI需要特殊处理，暂时保留原链接
    
    # 下载PDF
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.pdf"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            response = await client.get(pdf_url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; FastPaperRead/1.0)"
            })
            response.raise_for_status()
            
            with open(file_path, "wb") as f:
                f.write(response.content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"下载PDF失败: {str(e)}")
    
    # 创建论文记录
    paper = paper_crud.create(
        db,
        title=f"Importing from {url}",
        source_type=source_type,
        source_value=url,
        pdf_path=file_path
    )
    
    # 创建导入任务
    job = paper_crud.create_import_job(db, paper.id)
    
    # 触发后台解析任务
    background_tasks.add_task(process_paper_import, paper.id, file_path)
    
    return {
        "paper_id": paper.id,
        "job_id": job.id,
        "message": "开始导入"
    }


@router.get("", response_model=PaperListResponse)
async def get_all_papers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    quality: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取论文列表
    
    - 支持分页
    - 支持按状态/质量筛选
    - 支持搜索
    """
    logger.debug(f"[LIST] 获取论文列表: skip={skip}, limit={limit}, status={status}, search={search}")
    
    papers, total = paper_crud.get_list(
        db,
        skip=skip,
        limit=limit,
        status=status,
        quality=quality,
        search=search
    )
    
    logger.info(f"[LIST] 返回论文: {len(papers)}/{total}")
    
    return {
        "papers": papers,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/stats", response_model=dict)
async def get_paper_stats(db: Session = Depends(get_db)):
    """获取论文统计信息"""
    return paper_crud.get_stats(db)


@router.get("/{paper_id}", response_model=PaperInDB)
async def get_paper(paper_id: str, db: Session = Depends(get_db)):
    """获取单篇论文详情"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return paper


@router.get("/{paper_id}/import-status", response_model=dict)
async def get_import_status(paper_id: str, db: Session = Depends(get_db)):
    """获取导入任务状态"""
    logger.debug(f"[IMPORT-STATUS] 查询论文状态: {paper_id}")
    
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 将论文状态映射为导入任务状态
    paper_status = paper.status.value if paper.status else "unknown"
    
    # 映射关系:
    # importing -> running (进行中)
    # parsing -> running (进行中)
    # unread/skimmed/deepread/archived -> completed (已完成)
    if paper_status in ["importing", "parsing"]:
        job_status = "running"
        progress = 0.5 if paper_status == "parsing" else 0.1
        current_step = "解析PDF中..." if paper_status == "parsing" else "上传中..."
    else:
        job_status = "completed"
        progress = 1.0
        current_step = "导入完成"
    
    logger.info(f"[IMPORT-STATUS] paper_id={paper_id}, paper_status={paper_status}, job_status={job_status}")
    
    return {
        "paper_id": paper_id,
        "status": job_status,  # running/completed/failed
        "paper_status": paper_status,  # 实际论文状态
        "progress": progress,
        "current_step": current_step
    }


@router.patch("/{paper_id}", response_model=PaperInDB)
async def update_paper(
    paper_id: str,
    update_data: PaperUpdate,
    db: Session = Depends(get_db)
):
    """更新论文信息"""
    paper = paper_crud.update(db, paper_id, **update_data.model_dump(exclude_unset=True))
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return paper


@router.delete("/{paper_id}")
async def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    """删除论文"""
    success = paper_crud.delete(db, paper_id)
    if not success:
        raise HTTPException(status_code=404, detail="论文不存在")
    return {"message": "删除成功"}


@router.post("/{paper_id}/archive")
async def archive_paper(paper_id: str, db: Session = Depends(get_db)):
    """归档论文"""
    paper = paper_crud.update_status(db, paper_id, PaperStatus.ARCHIVED)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return {"message": "归档成功"}


@router.post("/{paper_id}/unarchive")
async def unarchive_paper(paper_id: str, db: Session = Depends(get_db)):
    """取消归档"""
    paper = paper_crud.update_status(db, paper_id, PaperStatus.UNREAD)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return {"message": "已恢复"}


@router.put("/{paper_id}/progress")
async def update_read_progress(
    paper_id: str,
    progress: float = Query(..., ge=0.0, le=1.0),
    current_section: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """更新阅读进度"""
    paper = paper_crud.update_read_progress(db, paper_id, progress, current_section)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return {"message": "进度已更新", "progress": progress}
