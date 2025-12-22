"""
WebSocket API端点

提供实时进度推送功能
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from ...core.websocket import ws_manager

logger = logging.getLogger("fastpaperread.api.ws")

router = APIRouter()


@router.websocket("/papers/{paper_id}/progress")
async def paper_progress_ws(
    websocket: WebSocket,
    paper_id: str
):
    """
    论文导入/解析进度 WebSocket
    
    客户端连接后，将收到进度更新消息：
    
    ```json
    {
        "type": "progress",
        "paper_id": "xxx",
        "progress": 50.0,
        "step": "parse_text",
        "message": "正在解析PDF...",
        "status": "running",
        "timestamp": "2025-12-22T10:30:00Z"
    }
    ```
    
    状态值：
    - running: 进行中
    - completed: 完成
    - failed: 失败
    """
    await ws_manager.connect(websocket, paper_id)
    
    try:
        while True:
            # 保持连接，等待客户端消息（如心跳）
            data = await websocket.receive_text()
            
            # 处理心跳
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "status":
                # 返回当前连接状态
                await websocket.send_json({
                    "type": "status",
                    "paper_id": paper_id,
                    "connections": ws_manager.get_connection_count(paper_id)
                })
    
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, paper_id)
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        await ws_manager.disconnect(websocket, paper_id)


@router.websocket("/enhance/{request_id}")
async def enhance_progress_ws(
    websocket: WebSocket,
    request_id: str
):
    """
    增强任务进度 WebSocket（流式输出）
    
    客户端连接后，将收到流式输出消息：
    
    ```json
    {
        "type": "chunk",
        "request_id": "xxx",
        "content": "部分生成的内容...",
        "done": false
    }
    ```
    
    完成时：
    ```json
    {
        "type": "complete",
        "request_id": "xxx",
        "content": "完整内容",
        "done": true
    }
    ```
    """
    await ws_manager.connect(websocket, f"enhance_{request_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_text("pong")
    
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket, f"enhance_{request_id}")
    except Exception as e:
        logger.error(f"WebSocket错误: {e}")
        await ws_manager.disconnect(websocket, f"enhance_{request_id}")


@router.get("/connections")
async def get_connections():
    """获取当前WebSocket连接数"""
    return {
        "total_connections": ws_manager.get_connection_count(),
        "message": "WebSocket连接统计"
    }

