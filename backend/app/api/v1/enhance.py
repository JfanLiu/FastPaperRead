"""
增强引擎API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, anchor_crud
from ...core.llm import ContentEnhancer
from ...schemas.enhance import EnhanceRequest, EnhanceResponse

router = APIRouter()


@router.post("/term/{anchor_id}", response_model=dict)
async def explain_term(
    anchor_id: str,
    term: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    解释术语
    
    - 基于上下文解释选中的术语
    - 结果缓存到anchor的explanation_cache
    """
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="锚点不存在")
    
    # 检查缓存
    if anchor.explanation_cache and term in anchor.explanation_cache.get("terms", {}):
        return {
            "explanation": anchor.explanation_cache["terms"][term],
            "cached": True
        }
    
    # 调用LLM
    try:
        result = await enhancer.explain_term(term, anchor.text or "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解释失败: {str(e)}")
    
    # 缓存结果
    cache = anchor.explanation_cache or {}
    if "terms" not in cache:
        cache["terms"] = {}
    cache["terms"][term] = result
    anchor_crud.update_explanation_cache(db, anchor_id, cache)
    
    return {
        "explanation": result,
        "cached": False
    }


@router.post("/figure/{anchor_id}", response_model=dict)
async def explain_figure(
    anchor_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    解释图表
    
    - 分析图表内容和含义
    """
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="锚点不存在")
    
    if anchor.type.value != "figure":
        raise HTTPException(status_code=400, detail="该锚点不是图表类型")
    
    # 检查缓存
    if anchor.explanation_cache and "figure" in anchor.explanation_cache:
        return {
            "explanation": anchor.explanation_cache["figure"],
            "cached": True
        }
    
    # 调用LLM
    try:
        result = await enhancer.explain_figure(
            anchor.caption or "",
            anchor.text or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解释失败: {str(e)}")
    
    # 缓存结果
    anchor_crud.update_explanation_cache(db, anchor_id, {"figure": result})
    
    return {
        "explanation": result,
        "cached": False
    }


@router.post("/equation/{anchor_id}", response_model=dict)
async def explain_equation(
    anchor_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    解释公式
    
    - 解释公式含义和符号
    """
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="锚点不存在")
    
    if anchor.type.value != "equation":
        raise HTTPException(status_code=400, detail="该锚点不是公式类型")
    
    # 检查缓存
    if anchor.explanation_cache and "equation" in anchor.explanation_cache:
        return {
            "explanation": anchor.explanation_cache["equation"],
            "cached": True
        }
    
    # 调用LLM
    try:
        result = await enhancer.explain_equation(
            anchor.latex or anchor.text or "",
            anchor.text or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解释失败: {str(e)}")
    
    # 缓存结果
    anchor_crud.update_explanation_cache(db, anchor_id, {"equation": result})
    
    return {
        "explanation": result,
        "cached": False
    }


@router.post("/missing/{paper_id}", response_model=dict)
async def find_missing_details(
    paper_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    查找复现缺失细节
    
    - 分析论文中可能缺失的实验/方法细节
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 获取论文内容
    content = paper.abstract or ""
    # TODO: 从markdown文件读取更多内容
    
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足")
    
    # 调用LLM
    try:
        result = await enhancer.find_missing_details(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")
    
    return {
        "missing_details": result
    }


@router.post("/section-summary/{anchor_id}", response_model=dict)
async def summarize_section(
    anchor_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    总结章节
    """
    anchor = anchor_crud.get(db, anchor_id)
    if not anchor:
        raise HTTPException(status_code=404, detail="锚点不存在")
    
    if anchor.type.value != "section":
        raise HTTPException(status_code=400, detail="该锚点不是章节类型")
    
    # 检查缓存
    if anchor.explanation_cache and "summary" in anchor.explanation_cache:
        return {
            "summary": anchor.explanation_cache["summary"],
            "cached": True
        }
    
    # 调用LLM
    try:
        result = await enhancer.summarize_section(
            anchor.section or "Section",
            anchor.text or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"总结失败: {str(e)}")
    
    # 缓存结果
    anchor_crud.update_explanation_cache(db, anchor_id, {"summary": result})
    
    return {
        "summary": result,
        "cached": False
    }
