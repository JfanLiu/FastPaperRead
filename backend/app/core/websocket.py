"""
WebSocket连接管理

提供实时进度推送功能
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger("fastpaperread.websocket")


@dataclass
class ProgressUpdate:
    """进度更新消息"""
    paper_id: str
    progress: float  # 0-100
    step: str
    message: str
    status: str = "running"  # running, completed, failed
    timestamp: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "progress",
            "paper_id": self.paper_id,
            "progress": self.progress,
            "step": self.step,
            "message": self.message,
            "status": self.status,
            "timestamp": self.timestamp or datetime.utcnow().isoformat(),
        }


class ConnectionManager:
    """
    WebSocket连接管理器
    
    管理多个客户端连接，支持按paper_id分组推送消息
    """
    
    def __init__(self):
        # paper_id -> Set[WebSocket]
        self.paper_connections: Dict[str, Set[WebSocket]] = {}
        # 所有活跃连接
        self.active_connections: Set[WebSocket] = set()
        # 锁，用于线程安全操作
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, paper_id: str):
        """
        接受WebSocket连接
        """
        await websocket.accept()
        
        async with self._lock:
            # 添加到全局连接集
            self.active_connections.add(websocket)
            
            # 添加到特定paper的连接集
            if paper_id not in self.paper_connections:
                self.paper_connections[paper_id] = set()
            self.paper_connections[paper_id].add(websocket)
        
        logger.info(f"WebSocket连接已建立: paper_id={paper_id}, 当前连接数={len(self.active_connections)}")
        
        # 发送连接确认消息
        await self.send_to_connection(websocket, {
            "type": "connected",
            "paper_id": paper_id,
            "message": "连接成功，等待进度更新"
        })
    
    async def disconnect(self, websocket: WebSocket, paper_id: str):
        """
        断开WebSocket连接
        """
        async with self._lock:
            # 从全局集合移除
            self.active_connections.discard(websocket)
            
            # 从paper集合移除
            if paper_id in self.paper_connections:
                self.paper_connections[paper_id].discard(websocket)
                
                # 如果没有连接了，移除这个paper的记录
                if not self.paper_connections[paper_id]:
                    del self.paper_connections[paper_id]
        
        logger.info(f"WebSocket连接已断开: paper_id={paper_id}, 当前连接数={len(self.active_connections)}")
    
    async def send_to_connection(self, websocket: WebSocket, data: Dict[str, Any]):
        """
        向单个连接发送消息
        """
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.warning(f"发送消息失败: {e}")
    
    async def broadcast_to_paper(self, paper_id: str, data: Dict[str, Any]):
        """
        向订阅特定paper的所有连接广播消息
        """
        async with self._lock:
            connections = self.paper_connections.get(paper_id, set()).copy()
        
        if not connections:
            return
        
        # 并发发送给所有连接
        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.warning(f"广播消息失败: {e}")
                disconnected.append(connection)
        
        # 清理断开的连接
        if disconnected:
            async with self._lock:
                for conn in disconnected:
                    self.active_connections.discard(conn)
                    if paper_id in self.paper_connections:
                        self.paper_connections[paper_id].discard(conn)
    
    async def send_progress(self, update: ProgressUpdate):
        """
        发送进度更新
        """
        await self.broadcast_to_paper(update.paper_id, update.to_dict())
        logger.debug(f"进度更新已发送: paper_id={update.paper_id}, progress={update.progress}%")
    
    def get_connection_count(self, paper_id: Optional[str] = None) -> int:
        """
        获取连接数量
        """
        if paper_id:
            return len(self.paper_connections.get(paper_id, set()))
        return len(self.active_connections)


# 全局连接管理器实例
ws_manager = ConnectionManager()


async def send_import_progress(
    paper_id: str,
    progress: float,
    step: str,
    message: str,
    status: str = "running"
):
    """
    便捷函数：发送导入进度更新
    
    可以从任务处理代码中调用此函数
    """
    update = ProgressUpdate(
        paper_id=paper_id,
        progress=progress,
        step=step,
        message=message,
        status=status,
    )
    await ws_manager.send_progress(update)


def send_import_progress_sync(
    paper_id: str,
    progress: float,
    step: str,
    message: str,
    status: str = "running"
):
    """
    同步版本：发送导入进度更新
    
    用于在非异步上下文中调用
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 如果事件循环正在运行，创建一个任务
            asyncio.create_task(send_import_progress(paper_id, progress, step, message, status))
        else:
            loop.run_until_complete(send_import_progress(paper_id, progress, step, message, status))
    except RuntimeError:
        # 没有事件循环，创建一个新的
        asyncio.run(send_import_progress(paper_id, progress, step, message, status))

