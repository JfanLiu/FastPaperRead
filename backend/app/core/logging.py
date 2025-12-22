"""
日志配置模块
"""
import logging
import sys
from datetime import datetime


def setup_logging(level: str = "INFO") -> logging.Logger:
    """配置日志"""
    # 创建格式化器
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(getattr(logging, level.upper()))
    
    # 配置根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    
    # 移除已有的处理器
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    root_logger.addHandler(console_handler)
    
    # 配置应用日志器
    app_logger = logging.getLogger("fastpaperread")
    app_logger.setLevel(getattr(logging, level.upper()))
    
    return app_logger


def get_logger(name: str) -> logging.Logger:
    """获取指定名称的日志器"""
    return logging.getLogger(f"fastpaperread.{name}")


# 初始化日志
logger = setup_logging("DEBUG")


