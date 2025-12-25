"""
Chat（对话协作）API端点
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud
from ...core.llm import ContentEnhancer

router = APIRouter()


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str  # user/assistant
    content: str
    timestamp: Optional[str] = None
    context_anchors: List[str] = []  # 关联的锚点ID


class SendMessageRequest(BaseModel):
    """发送消息请求"""
    message: str
    mode: str = "seminar"  # seminar/writing/reproduction/design
    context: Optional[str] = None  # 选中的上下文文本
    context_anchors: List[str] = []  # 关联的锚点ID


class ChatHistory(BaseModel):
    """聊天历史"""
    paper_id: str
    messages: List[ChatMessage] = []
    current_mode: str = "seminar"


# 内存存储聊天历史
_chat_histories = {}


@router.post("/{paper_id}", response_model=dict)
async def send_message(
    paper_id: str,
    request: SendMessageRequest,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    发送对话消息
    
    支持四种模式：
    - seminar: 组会模式，帮助准备讲解
    - writing: 写作模式，输出段落骨架
    - reproduction: 复现模式，关注实验细节
    - design: 方案设计模式，讨论改进方向
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 初始化或获取聊天历史
    if paper_id not in _chat_histories:
        _chat_histories[paper_id] = ChatHistory(
            paper_id=paper_id,
            messages=[],
            current_mode=request.mode
        ).model_dump()
    
    history = _chat_histories[paper_id]
    
    # 更新模式
    history["current_mode"] = request.mode
    
    # 添加用户消息
    user_message = ChatMessage(
        role="user",
        content=request.message,
        timestamp=datetime.now().isoformat(),
        context_anchors=request.context_anchors
    )
    history["messages"].append(user_message.model_dump())
    
    # 准备历史消息格式
    chat_history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in history["messages"][-10:]  # 只取最近10条
    ]
    
    # 准备作者信息
    authors = ", ".join(paper.authors[:3]) if paper.authors else "Unknown"
    if paper.authors and len(paper.authors) > 3:
        authors += " et al."
    
    try:
        # 调用LLM
        response = await enhancer.chat_with_paper(
            message=request.message,
            title=paper.title,
            authors=authors,
            year=str(paper.year) if paper.year else "Unknown",
            mode=request.mode,
            context=request.context or "",
            history=chat_history[:-1]  # 不包含最后一条（当前消息）
        )
        
        # 添加助手消息
        assistant_message = ChatMessage(
            role="assistant",
            content=response,
            timestamp=datetime.now().isoformat(),
            context_anchors=[]
        )
        history["messages"].append(assistant_message.model_dump())
        
        return {
            "message": assistant_message.model_dump(),
            "mode": request.mode
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对话失败: {str(e)}")


@router.get("/{paper_id}/history", response_model=dict)
async def get_chat_history(
    paper_id: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """获取聊天历史"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    if paper_id not in _chat_histories:
        return {
            "history": ChatHistory(paper_id=paper_id).model_dump(),
            "message": "暂无聊天记录"
        }
    
    history = _chat_histories[paper_id]
    
    # 限制返回数量
    if limit and len(history["messages"]) > limit:
        history_copy = history.copy()
        history_copy["messages"] = history["messages"][-limit:]
        return {"history": history_copy}
    
    return {"history": history}


@router.delete("/{paper_id}/history", response_model=dict)
async def clear_chat_history(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """清空聊天历史"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    if paper_id in _chat_histories:
        _chat_histories[paper_id] = ChatHistory(paper_id=paper_id).model_dump()
    
    return {"message": "聊天历史已清空"}


@router.put("/{paper_id}/mode", response_model=dict)
async def switch_mode(
    paper_id: str,
    mode: str,
    db: Session = Depends(get_db)
):
    """切换对话模式"""
    valid_modes = ["seminar", "writing", "reproduction", "design"]
    if mode not in valid_modes:
        raise HTTPException(
            status_code=400, 
            detail=f"无效的模式，支持的模式: {', '.join(valid_modes)}"
        )
    
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    if paper_id not in _chat_histories:
        _chat_histories[paper_id] = ChatHistory(
            paper_id=paper_id,
            current_mode=mode
        ).model_dump()
    else:
        _chat_histories[paper_id]["current_mode"] = mode
    
    # 添加系统消息提示模式切换
    mode_descriptions = {
        "seminar": "组会模式：我会帮助你准备论文讲解，追问关键细节，提出可能被问到的问题。",
        "writing": "写作模式：我会帮助你理解如何在论文中引用和对比这篇工作，输出段落骨架。",
        "reproduction": "复现模式：我会关注实验细节、超参数、数据处理等复现相关信息。",
        "design": "方案设计模式：我会基于论文内容，讨论可能的改进方向和研究方案。"
    }
    
    system_message = ChatMessage(
        role="assistant",
        content=f"已切换到{mode_descriptions[mode]}",
        timestamp=datetime.now().isoformat(),
        context_anchors=[]
    )
    _chat_histories[paper_id]["messages"].append(system_message.model_dump())
    
    return {
        "mode": mode,
        "description": mode_descriptions[mode]
    }

