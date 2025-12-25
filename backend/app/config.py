"""
应用配置
"""
import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


def find_env_file() -> str:
    """查找.env文件，优先从项目根目录加载"""
    # 当前文件所在目录
    current_dir = Path(__file__).resolve().parent
    
    # 尝试的路径列表（按优先级）
    possible_paths = [
        current_dir.parent.parent.parent / ".env",  # 项目根目录 (FastPaperRead/.env)
        current_dir.parent.parent / ".env",  # backend/.env
        Path.cwd() / ".env",  # 当前工作目录
        Path.cwd().parent / ".env",  # 上级目录
    ]
    
    for path in possible_paths:
        if path.exists():
            return str(path)
    
    return ".env"  # 默认值


class Settings(BaseSettings):
    """应用设置"""
    
    # 应用配置
    APP_NAME: str = "FastPaperRead"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # 目录配置
    TEMP_DIR: str = "temp"
    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "output"
    
    # 数据库 (后续启用)
    # DATABASE_URL: str = "postgresql://user:pass@localhost/fastpaperread"
    
    # Redis (后续启用)
    # REDIS_URL: str = "redis://localhost:6379/0"
    
    # LLM配置
    LLM_API_KEY: Optional[str] = None
    LLM_BASE_URL: str = "https://api.deepseek.com/v1"
    LLM_MODEL: str = "deepseek-chat"
    
    # 备用LLM
    LLM_BACKUP_API_KEY: Optional[str] = None
    LLM_BACKUP_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    LLM_BACKUP_MODEL: str = "qwen-plus"
    
    # 搜索配置
    TAVILY_API_KEY: Optional[str] = None
    
    # PDF解析配置
    MINERU_USE_GPU: bool = True
    MINERU_FAST_MODE: bool = False  # 快速模式：关闭公式/表格识别，速度提升2倍
    MINERU_GPU_ID: str = "0"  # 使用的GPU编号
    
    class Config:
        env_file = find_env_file()
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # 忽略额外的环境变量


@lru_cache()
def get_settings() -> Settings:
    """获取设置单例"""
    import logging
    logger = logging.getLogger(__name__)
    
    env_path = find_env_file()
    logger.info(f"Loading settings from: {env_path}")
    
    s = Settings()
    
    # 打印关键配置（不打印敏感信息）
    if s.LLM_API_KEY:
        logger.info(f"LLM configured: model={s.LLM_MODEL}, base_url={s.LLM_BASE_URL}")
    else:
        logger.warning("LLM_API_KEY not found in environment")
    
    return s


settings = get_settings()

