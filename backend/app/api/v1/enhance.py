"""
增强引擎API端点 - 完整实现
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, anchor_crud
from ...core.llm import ContentEnhancer
from ...schemas.enhance import EnhanceRequest, EnhanceResponse

router = APIRouter()


class UnifiedEnhanceRequest(BaseModel):
    """统一增强请求"""
    paper_id: Optional[str] = None
    anchor_id: Optional[str] = None
    enhance_type: str  # term, figure, equation, paragraph, missing_detail
    selected_text: Optional[str] = None
    level: Optional[str] = "plain"  # plain, strict
    use_cache: bool = True


@router.post("", response_model=dict)
async def enhance_content(
    request: UnifiedEnhanceRequest,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    统一增强接口
    
    支持:
    - term: 术语解释
    - figure: 图表解释
    - equation: 公式解释
    - paragraph: 段落总结
    - missing_detail: 缺失细节
    """
    context = ""
    
    # 获取锚点上下文
    if request.anchor_id:
        anchor = anchor_crud.get(db, request.anchor_id)
        if anchor:
            context = anchor.text or anchor.caption or ""
            
            # 检查缓存
            if request.use_cache and anchor.explanation_cache:
                cache_key = request.enhance_type
                if request.enhance_type == "term" and request.selected_text:
                    cache_key = f"term:{request.selected_text}"
                    if "terms" in anchor.explanation_cache and request.selected_text in anchor.explanation_cache["terms"]:
                        return {
                            "term": anchor.explanation_cache["terms"][request.selected_text],
                            "cached": True
                        }
                elif cache_key in anchor.explanation_cache:
                    return {
                        request.enhance_type: anchor.explanation_cache[cache_key],
                        "cached": True
                    }
    
    # 如果没有上下文，尝试从论文获取
    if not context and request.paper_id:
        paper = paper_crud.get(db, request.paper_id)
        if paper:
            context = paper.abstract or ""
    
    if not context:
        raise HTTPException(status_code=400, detail="无法获取上下文内容")
    
    try:
        result = None
        response_key = request.enhance_type
        
        if request.enhance_type == "term":
            term = request.selected_text or ""
            if not term:
                raise HTTPException(status_code=400, detail="请提供要解释的术语")
            result = await enhancer.explain_term(term, context)
            response_key = "term"
            
            # 缓存
            if request.anchor_id:
                anchor = anchor_crud.get(db, request.anchor_id)
                if anchor:
                    cache = anchor.explanation_cache or {}
                    if "terms" not in cache:
                        cache["terms"] = {}
                    cache["terms"][term] = result
                    anchor_crud.update_explanation_cache(db, request.anchor_id, cache)
                    
        elif request.enhance_type == "figure":
            result = await enhancer.explain_figure("", context)
            response_key = "figure"
            
        elif request.enhance_type == "equation":
            anchor = anchor_crud.get(db, request.anchor_id) if request.anchor_id else None
            latex = anchor.latex if anchor else context
            result = await enhancer.explain_equation(latex or context, context)
            response_key = "equation"
            
        elif request.enhance_type == "paragraph":
            result = await enhancer.summarize_section("", context)
            response_key = "summary"
            
        elif request.enhance_type == "missing_detail":
            result = await enhancer.find_missing_details(context)
            response_key = "missing_details"
            
        else:
            raise HTTPException(status_code=400, detail=f"不支持的增强类型: {request.enhance_type}")
        
        return {
            response_key: result,
            "cached": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"增强失败: {str(e)}")


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
