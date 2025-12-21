"""
应用配置
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


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
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """获取设置单例"""
    return Settings()


settings = get_settings()

