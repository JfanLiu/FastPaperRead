"""
FastAPI 主应用入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from .config import settings
from .api.v1 import papers, anchors, cards, skim, enhance, compare, review, export, checklist, ws, analytics, evidence_ledger, chat, annotations


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    import logging
    logger = logging.getLogger("uvicorn")
    
    # 启动时
    logger.info("FastPaperRead API starting...")
    
    # 确保目录存在
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    
    # 初始化数据库
    from .db.base import init_db
    init_db()
    logger.info("Database initialized")
    
    yield
    
    # 关闭时
    logger.info("FastPaperRead API shutting down")


# 创建应用
app = FastAPI(
    title="FastPaperRead API",
    description="AI驱动的论文阅读与知识资产化平台",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/files", StaticFiles(directory=settings.UPLOAD_DIR), name="files")

# 挂载 output 目录用于图片访问
if os.path.exists(settings.OUTPUT_DIR):
    app.mount("/output", StaticFiles(directory=settings.OUTPUT_DIR), name="output")

# 注册路由
app.include_router(papers.router, prefix="/api/v1/papers", tags=["Papers"])
app.include_router(anchors.router, prefix="/api/v1/anchors", tags=["Anchors"])
app.include_router(cards.router, prefix="/api/v1/cards", tags=["Cards"])
app.include_router(skim.router, prefix="/api/v1/skim", tags=["Skim"])
app.include_router(enhance.router, prefix="/api/v1/enhance", tags=["Enhance"])
app.include_router(compare.router, prefix="/api/v1/compare", tags=["Compare"])
app.include_router(review.router, prefix="/api/v1/review", tags=["Review"])
app.include_router(export.router, prefix="/api/v1/export", tags=["Export"])
app.include_router(checklist.router, prefix="/api/v1/checklist", tags=["Checklist"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(evidence_ledger.router, prefix="/api/v1/evidence-ledger", tags=["Evidence Ledger"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["Chat"])
app.include_router(annotations.router, prefix="/api/v1/annotations", tags=["Annotations"])
app.include_router(ws.router, prefix="/ws", tags=["WebSocket"])


@app.get("/")
async def root():
    """API根路径"""
    return {
        "name": "FastPaperRead API",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

