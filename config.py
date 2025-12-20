import os
from typing import Optional
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(encoding="utf-8")

class Config:
    # ==================== LLM API配置 ====================
    # 统一使用 OpenAI 兼容接口，支持 DeepSeek, Qwen, OpenAI 等
    LLM_API_KEY: Optional[str] = os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.deepseek.com/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-chat")
    
    # 备用 LLM 配置 (可选)
    LLM_BACKUP_API_KEY: Optional[str] = os.getenv("LLM_BACKUP_API_KEY")
    LLM_BACKUP_BASE_URL: str = os.getenv("LLM_BACKUP_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    LLM_BACKUP_MODEL: str = os.getenv("LLM_BACKUP_MODEL", "qwen-plus")
    
    # ==================== 搜索 API 配置 ====================
    # Tavily 搜索
    TAVILY_API_KEY: Optional[str] = os.getenv("TAVILY_API_KEY")
    
    # ==================== PDF 处理配置 ====================
    # MinerU 配置
    MINERU_USE_GPU: bool = os.getenv("MINERU_USE_GPU", "true").lower() == "true"
    MINERU_MODEL_DIR: str = os.getenv("MINERU_MODEL_DIR", "")  # 模型目录，空则使用默认
    
    # ==================== 应用配置 ====================
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "7860"))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # ==================== 文件配置 ====================
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    OUTPUT_DIR: str = os.getenv("OUTPUT_DIR", "output")
    TEMP_DIR: str = os.getenv("TEMP_DIR", "temp")
    
    # ==================== 兼容性配置 (保留旧配置名) ====================
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    PDFDEAL_API_KEY: Optional[str] = os.getenv("PDFDEAL_API_KEY")  # 已废弃，保留兼容
    CLAUDE_CODE_COMMAND: str = os.getenv("CLAUDE_CODE_COMMAND", "claude -p")  # 已废弃
    
    @classmethod
    def ensure_directories(cls):
        """确保必要的目录存在"""
        for dir_path in [cls.UPLOAD_DIR, cls.OUTPUT_DIR, cls.TEMP_DIR]:
            os.makedirs(dir_path, exist_ok=True)
    
    @classmethod
    def validate(cls) -> list:
        """验证必要的配置是否存在，返回缺失的配置项"""
        missing = []
        if not cls.LLM_API_KEY:
            missing.append("LLM_API_KEY (或 OPENAI_API_KEY)")
        if not cls.TAVILY_API_KEY:
            missing.append("TAVILY_API_KEY")
        return missing
    
    @classmethod
    def get_llm_config(cls, use_backup: bool = False) -> dict:
        """获取LLM配置"""
        if use_backup and cls.LLM_BACKUP_API_KEY:
            return {
                "api_key": cls.LLM_BACKUP_API_KEY,
                "base_url": cls.LLM_BACKUP_BASE_URL,
                "model": cls.LLM_BACKUP_MODEL
            }
        return {
            "api_key": cls.LLM_API_KEY,
            "base_url": cls.LLM_BASE_URL,
            "model": cls.LLM_MODEL
        }

config = Config()
