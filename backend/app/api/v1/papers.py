"""
论文API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks
from fastapi.responses import FileResponse
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
from ...core.metadata import enrich_paper_metadata

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
    - arXiv链接 (自动转换为PDF链接，自动获取元数据)
    - DOI链接 (自动获取元数据，尝试获取PDF)
    """
    logger.info(f"[IMPORT] 开始导入论文: {url}")
    
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
    
    # 尝试获取元数据
    metadata = None
    try:
        logger.info(f"[IMPORT] 获取元数据: source_type={source_type}, url={url}")
        metadata = await enrich_paper_metadata(source_type, url)
        if metadata:
            logger.info(f"[IMPORT] 元数据获取成功: title={metadata.get('title', '')[:50]}")
    except Exception as e:
        logger.warning(f"[IMPORT] 获取元数据失败: {e}")
    
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
        logger.info(f"[IMPORT] PDF下载成功: {file_path}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"下载PDF失败: {str(e)}")
    
    # 创建论文记录（使用元数据填充字段）
    paper_data = {
        "title": f"Importing from {url}",
        "source_type": source_type,
        "source_value": url,
        "pdf_path": file_path,
    }
    
    if metadata:
        if metadata.get("title"):
            paper_data["title"] = metadata["title"]
        if metadata.get("authors"):
            paper_data["authors"] = metadata["authors"]
        if metadata.get("year"):
            paper_data["year"] = metadata["year"]
        if metadata.get("venue"):
            paper_data["venue"] = metadata["venue"]
        if metadata.get("abstract"):
            paper_data["abstract"] = metadata["abstract"]
        if metadata.get("keywords"):
            paper_data["keywords"] = metadata["keywords"]
    
    paper = paper_crud.create(db, **paper_data)
    logger.info(f"[IMPORT] 论文记录已创建: paper_id={paper.id}, title={paper.title[:50] if paper.title else 'N/A'}")
    
    # 创建导入任务
    job = paper_crud.create_import_job(db, paper.id)
    
    # 触发后台解析任务
    background_tasks.add_task(process_paper_import, paper.id, file_path)
    
    return {
        "paper_id": paper.id,
        "job_id": job.id,
        "message": "开始导入",
        "metadata_fetched": metadata is not None
    }


def paper_to_dict(paper) -> dict:
    """将PaperModel转换为可序列化的字典"""
    return {
        "id": paper.id,
        "title": paper.title,
        "authors": paper.authors or [],
        "year": paper.year,
        "venue": paper.venue,
        "abstract": paper.abstract,
        "keywords": paper.keywords or [],
        "source_type": paper.source_type,
        "source_value": paper.source_value,
        "pdf_path": paper.pdf_path,
        "markdown_path": paper.markdown_path,
        "status": paper.status.value if paper.status else "unknown",
        "quality_grade": paper.quality_grade,
        "repro_status": paper.repro_status,
        "current_section": paper.current_section,
        "read_progress": paper.read_progress or 0.0,
        "created_at": paper.created_at.isoformat() if paper.created_at else None,
        "updated_at": paper.updated_at.isoformat() if paper.updated_at else None,
        "last_read_at": paper.last_read_at.isoformat() if paper.last_read_at else None,
    }


@router.get("", response_model=dict)
async def get_all_papers(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    page: Optional[int] = Query(None, ge=1, description="页码（从1开始），与skip二选一"),
    status: Optional[str] = None,
    quality: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取论文列表
    
    - 支持分页: 可使用 skip/limit 或 page/limit
    - 支持按状态/质量筛选
    - 支持搜索
    
    兼容性：同时返回 papers 和 items 字段
    """
    # 如果提供了page参数，转换为skip
    actual_skip = skip
    if page is not None:
        actual_skip = (page - 1) * limit
    
    logger.debug(f"[LIST] 获取论文列表: skip={actual_skip}, limit={limit}, page={page}, status={status}, search={search}")
    
    papers, total = paper_crud.get_list(
        db,
        skip=actual_skip,
        limit=limit,
        status=status,
        quality=quality,
        search=search
    )
    
    logger.info(f"[LIST] 返回论文: {len(papers)}/{total}")
    
    # 计算当前页码
    current_page = page if page is not None else (actual_skip // limit) + 1
    
    # 将PaperModel转换为可序列化的字典
    papers_list = [paper_to_dict(p) for p in papers]
    
    return {
        "papers": papers_list,  # 兼容旧格式
        "items": papers_list,   # 新格式
        "total": total,
        "skip": actual_skip,
        "limit": limit,
        "page": current_page
    }


@router.get("/stats", response_model=dict)
async def get_paper_stats(db: Session = Depends(get_db)):
    """获取论文统计信息"""
    return paper_crud.get_stats(db)


@router.get("/stats/overview", response_model=dict)
async def get_paper_stats_overview(db: Session = Depends(get_db)):
    """
    获取论文统计概览（兼容前端调用路径）
    
    与 /stats 返回相同数据
    """
    return paper_crud.get_stats(db)


@router.get("/{paper_id}", response_model=PaperInDB)
async def get_paper(paper_id: str, db: Session = Depends(get_db)):
    """获取单篇论文详情"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    return paper


@router.get("/{paper_id}/pdf")
async def get_paper_pdf(paper_id: str, db: Session = Depends(get_db)):
    """获取论文PDF文件"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    if not paper.pdf_path:
        raise HTTPException(status_code=404, detail="PDF文件路径不存在")
    
    # 处理路径 - 支持相对路径和绝对路径
    pdf_path = paper.pdf_path
    if not os.path.isabs(pdf_path):
        # 相对路径：尝试多个可能的基础目录
        possible_bases = [
            os.getcwd(),  # 当前工作目录
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),  # app目录
            settings.UPLOAD_DIR,  # 配置的上传目录
        ]
        for base in possible_bases:
            full_path = os.path.normpath(os.path.join(base, pdf_path))
            if os.path.exists(full_path):
                pdf_path = full_path
                break
        else:
            # 最后尝试直接使用原始路径
            pdf_path = os.path.normpath(pdf_path)
    
    # 检查文件是否存在
    if not os.path.exists(pdf_path):
        logger.error(f"[PDF] PDF文件不存在: {pdf_path} (原始路径: {paper.pdf_path})")
        raise HTTPException(status_code=404, detail=f"PDF文件不存在: {paper.pdf_path}")
    
    logger.info(f"[PDF] 返回PDF文件: {pdf_path}")
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{paper.title or 'paper'}.pdf"
    )


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


@router.post("/{paper_id}/fetch-metadata", response_model=dict)
async def fetch_paper_metadata(
    paper_id: str,
    source_url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    手动获取/补全论文元数据
    
    - 如果提供 source_url，使用该URL获取元数据
    - 否则使用论文的 source_value 字段
    
    支持 arXiv 和 DOI 链接
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 确定要使用的URL
    url = source_url or (paper.source_value if paper.source_value else None)
    if not url:
        raise HTTPException(status_code=400, detail="没有可用的来源URL")
    
    # 确定来源类型
    source_type_str = str(paper.source_type) if paper.source_type else "url"
    if "arxiv.org" in url:
        source_type_str = "arxiv"
    elif "doi.org" in url:
        source_type_str = "doi"
    
    # 获取元数据
    try:
        metadata = await enrich_paper_metadata(source_type_str, url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取元数据失败: {str(e)}")
    
    if not metadata:
        raise HTTPException(status_code=404, detail="无法获取元数据")
    
    # 更新论文信息
    update_data = {}
    paper_title = str(paper.title) if paper.title else ""
    if metadata.get("title") and not paper_title.startswith("Importing"):
        # 只有当当前标题是临时的才更新
        pass
    elif metadata.get("title"):
        update_data["title"] = metadata["title"]
    
    if metadata.get("authors"):
        update_data["authors"] = metadata["authors"]
    if metadata.get("year"):
        update_data["year"] = metadata["year"]
    if metadata.get("venue"):
        update_data["venue"] = metadata["venue"]
    if metadata.get("abstract") and not paper.abstract:
        update_data["abstract"] = metadata["abstract"]
    if metadata.get("keywords"):
        update_data["keywords"] = metadata["keywords"]
    
    if update_data:
        paper = paper_crud.update(db, paper_id, **update_data)
        logger.info(f"[METADATA] 论文元数据已更新: paper_id={paper_id}")
    
    return {
        "paper_id": paper_id,
        "metadata": metadata,
        "updated_fields": list(update_data.keys()),
        "message": f"已更新 {len(update_data)} 个字段"
    }


@router.post("/lookup-metadata", response_model=dict)
async def lookup_metadata(
    url: str,
):
    """
    查询URL的元数据（不创建论文）
    
    用于在导入前预览论文信息
    """
    # 确定来源类型
    source_type = "url"
    if "arxiv.org" in url:
        source_type = "arxiv"
    elif "doi.org" in url:
        source_type = "doi"
    
    # 获取元数据
    try:
        metadata = await enrich_paper_metadata(source_type, url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取元数据失败: {str(e)}")
    
    if not metadata:
        raise HTTPException(status_code=404, detail="无法获取元数据")
    
    return {
        "url": url,
        "source_type": source_type,
        "metadata": metadata
    }
