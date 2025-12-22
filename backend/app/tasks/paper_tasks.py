"""
论文处理后台任务
"""
import asyncio
import logging
from typing import Optional
from datetime import datetime

from sqlalchemy.orm import Session

from ..db.base import SessionLocal
from ..db.models import PaperModel, AnchorModel, PaperStatus, AnchorType, ImportJobModel
from ..core.parser.pdf_parser import pdf_parser
from ..core.parser.anchor_extractor import anchor_extractor
from ..core.websocket import send_import_progress

logger = logging.getLogger(__name__)


def get_db_session() -> Session:
    """获取数据库会话"""
    return SessionLocal()


def process_paper_import(paper_id: str, pdf_path: str):
    """
    处理论文导入 - 同步版本（用于BackgroundTasks）
    
    步骤:
    1. 下载/验证PDF
    2. 解析PDF为Markdown
    3. 提取锚点
    4. 生成章节树
    5. 提取元数据
    """
    # 在新线程中运行异步任务
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_process_paper_import_async(paper_id, pdf_path))
    finally:
        loop.close()


async def _process_paper_import_async(paper_id: str, pdf_path: str):
    """异步处理论文导入"""
    db = get_db_session()
    
    try:
        # 获取论文记录
        paper = db.query(PaperModel).filter(PaperModel.id == paper_id).first()
        if not paper:
            logger.error(f"论文不存在: {paper_id}")
            return
        
        # 获取导入任务
        job = db.query(ImportJobModel).filter(ImportJobModel.paper_id == paper_id).order_by(ImportJobModel.created_at.desc()).first()
        
        # 更新状态为解析中
        paper.status = PaperStatus.PARSING
        db.commit()
        
        # Step 1: 解析PDF
        await _update_job_progress(db, job, paper_id, 10, "download", "completed", "正在解析PDF...")
        
        parse_result = await pdf_parser.parse(pdf_path)
        
        if not parse_result.success:
            await _update_job_error(db, job, paper, paper_id, f"PDF解析失败: {parse_result.error}")
            return
        
        await _update_job_progress(db, job, paper_id, 30, "parse_text", "completed", "正在提取章节...")
        
        # 保存Markdown路径
        paper.markdown_path = parse_result.markdown_path
        db.commit()
        
        # Step 2: 读取Markdown内容
        markdown_content = ""
        if parse_result.markdown_path:
            try:
                with open(parse_result.markdown_path, 'r', encoding='utf-8') as f:
                    markdown_content = f.read()
            except Exception as e:
                logger.warning(f"读取Markdown失败: {e}")
        
        await _update_job_progress(db, job, paper_id, 50, "extract_sections", "completed", "正在提取图表...")
        
        # Step 3: 提取锚点
        anchors = anchor_extractor.extract_from_markdown(
            markdown_content,
            content_list=parse_result.content_list,
            figures=parse_result.figures,
            tables=parse_result.tables,
            equations=parse_result.equations
        )
        
        await _update_job_progress(db, job, paper_id, 70, "extract_figures", "completed", "正在生成锚点...")
        
        # Step 4: 保存锚点到数据库
        for anchor_data in anchor_extractor.to_dict_list(anchors):
            anchor = AnchorModel(
                paper_id=paper_id,
                type=AnchorType(anchor_data['type']) if anchor_data['type'] in [e.value for e in AnchorType] else AnchorType.PARAGRAPH,
                page=anchor_data.get('page', 1),
                sequence=anchor_data.get('sequence', 0),
                section=anchor_data.get('section', ''),
                section_level=anchor_data.get('section_level', 0),
                text=anchor_data.get('text', ''),
                caption=anchor_data.get('caption'),
                latex=anchor_data.get('latex'),
                image_path=anchor_data.get('image_path'),
                figure_number=anchor_data.get('figure_number'),
                equation_number=anchor_data.get('equation_number'),
                table_data=anchor_data.get('table_data'),
                ref_id=anchor_data.get('ref_id'),
                ref_text=anchor_data.get('ref_text'),
                bbox=anchor_data.get('bbox'),
            )
            db.add(anchor)
        
        db.commit()
        
        await _update_job_progress(db, job, paper_id, 90, "generate_anchors", "completed", "正在提取元数据...")
        
        # Step 5: 更新元数据
        metadata = parse_result.metadata
        logger.info(f"提取的元数据: {metadata}")
        
        # 更新标题（如果当前标题是文件名或导入中的占位标题）
        if metadata.get('title'):
            current_title = paper.title or ""
            if current_title.startswith('Importing') or current_title.endswith('.pdf') or not current_title:
                paper.title = metadata['title']
        
        # 更新作者
        if metadata.get('authors'):
            paper.authors = metadata['authors']
        
        # 更新年份
        if metadata.get('year'):
            paper.year = metadata['year']
        
        # 更新会议/期刊
        if metadata.get('venue'):
            paper.venue = metadata['venue']
        
        # 更新摘要
        if metadata.get('abstract'):
            paper.abstract = metadata['abstract']
        
        # 更新关键词
        if metadata.get('keywords'):
            paper.keywords = metadata['keywords']
        
        # 完成
        paper.status = PaperStatus.UNREAD
        
        if job:
            job.status = "completed"
            job.progress = 100.0
            job.current_step = "完成"
            job.completed_at = datetime.utcnow()
            job.steps = {
                "download": "completed",
                "parse_text": "completed",
                "extract_sections": "completed",
                "extract_figures": "completed",
                "extract_equations": "completed",
                "generate_anchors": "completed"
            }
        
        db.commit()
        
        # 发送完成消息
        await send_import_progress(
            paper_id=paper_id,
            progress=100,
            step="completed",
            message="导入完成",
            status="completed"
        )
        
        logger.info(f"论文导入完成: {paper_id}, 提取了 {len(anchors)} 个锚点")
        
    except Exception as e:
        logger.exception(f"论文处理失败: {paper_id}")
        await _update_job_error(db, None, None, paper_id, str(e))
        
        # 尝试更新状态
        try:
            paper = db.query(PaperModel).filter(PaperModel.id == paper_id).first()
            if paper:
                paper.status = PaperStatus.UNREAD  # 即使失败也设为未读，允许重试
                db.commit()
        except:
            pass
    
    finally:
        db.close()


async def _update_job_progress(
    db: Session,
    job: Optional[ImportJobModel],
    paper_id: str,
    progress: float,
    step: str,
    step_status: str,
    message: str
):
    """更新任务进度并发送WebSocket通知"""
    if job:
        job.progress = progress
        job.current_step = message
        if job.steps:
            job.steps[step] = step_status
        db.commit()
    
    # 发送WebSocket进度更新
    await send_import_progress(
        paper_id=paper_id,
        progress=progress,
        step=step,
        message=message,
        status="running"
    )
    
    logger.info(f"任务进度: {progress}% - {message}")


async def _update_job_error(
    db: Session,
    job: Optional[ImportJobModel],
    paper: Optional[PaperModel],
    paper_id: str,
    error_message: str
):
    """更新任务错误并发送WebSocket通知"""
    logger.error(f"任务失败: {error_message}")
    
    if job:
        job.status = "failed"
        job.error_message = error_message
        job.completed_at = datetime.utcnow()
    
    if paper:
        paper.status = PaperStatus.UNREAD  # 设为未读而非失败，允许重试
    
    if db:
        try:
            db.commit()
        except:
            pass
    
    # 发送WebSocket错误通知
    await send_import_progress(
        paper_id=paper_id,
        progress=0,
        step="error",
        message=error_message,
        status="failed"
    )

