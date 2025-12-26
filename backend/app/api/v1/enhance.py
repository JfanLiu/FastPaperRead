"""
增强引擎API端点 - 完整实现
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud, anchor_crud
from ...core.llm import ContentEnhancer
from ...schemas.enhance import (
    EnhanceRequest,
    EnhanceResponse,
    TeachingSkimGenerateRequest,
    TeachingSkimGenerateResponse,
    TeachingSkimPack,
)
from ...config import settings

router = APIRouter()


def get_paper_content(paper) -> str:
    """获取论文完整内容，优先从markdown文件读取"""
    # 尝试从markdown文件读取
    if paper.markdown_path:
        md_path = os.path.join(settings.OUTPUT_DIR, paper.markdown_path)
        if os.path.exists(md_path):
            try:
                with open(md_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception:
                pass
    
    # 回退到abstract
    return paper.abstract or ""


class UnifiedEnhanceRequest(BaseModel):
    """统一增强请求"""
    paper_id: Optional[str] = None
    anchor_id: Optional[str] = None
    enhance_type: str  # term, figure, equation, paragraph, missing_detail, method_flow, experiment_setup
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
            
            # 支持三层解释
            if request.level and request.level in ["one_liner", "plain", "strict"]:
                result = await enhancer.explain_term_leveled(term, context)
                # 返回完整结果，前端根据level选择显示
            else:
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
            # 支持三层解释
            if request.level and request.level in ["one_liner", "plain", "strict"]:
                result = await enhancer.summarize_section_leveled("段落摘要", context)
                # 根据level选择对应的摘要
                if isinstance(result, dict):
                    summary_text = result.get(request.level, result.get("plain", ""))
                    result = summary_text
            else:
                result = await enhancer.summarize_section("", context)
            response_key = "summary"
            
        elif request.enhance_type == "missing_detail":
            result = await enhancer.find_missing_details(context)
            response_key = "missing_details"
        
        elif request.enhance_type == "method_flow":
            # 获取完整论文内容用于方法流程提取
            full_content = context
            if request.paper_id:
                paper = paper_crud.get(db, request.paper_id)
                if paper and paper.full_text:
                    full_content = paper.full_text
            result = await enhancer.extract_method_flow(full_content)
            response_key = "method_flow"
        
        elif request.enhance_type == "experiment_setup":
            # 获取完整论文内容用于实验设置提取
            full_content = context
            if request.paper_id:
                paper = paper_crud.get(db, request.paper_id)
                if paper and paper.full_text:
                    full_content = paper.full_text
            result = await enhancer.extract_experiment_setup(full_content)
            response_key = "experiment_setup"
            
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


@router.post("/teaching-skim", response_model=TeachingSkimGenerateResponse)
async def generate_teaching_skim(
    request: TeachingSkimGenerateRequest,
    enhancer: ContentEnhancer = Depends(get_enhancer),
):
    """
    生成教学粗读（Teaching Skim）结构化材料

    设计目标：少而精、叙事连续、尽量带证据锚点、Next steps 可执行。
    """
    try:
        payload = request.model_dump()
        raw = await enhancer.generate_teaching_skim(payload)

        # 尽量结构化校验；如果缺字段，交给 Pydantic 报错，便于前端提示
        teaching = TeachingSkimPack(**raw)
        return {"teaching_skim": teaching}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"教学粗读生成失败: {str(e)}")


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


@router.post("/method-flow/{paper_id}", response_model=dict)
async def extract_method_flow(
    paper_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    提取方法流程
    
    - 从论文中提取方法的步骤流程
    - 包括输入、输出、创新点等
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 获取论文内容 (优先从markdown文件读取)
    content = get_paper_content(paper)
    
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足，请确保论文已解析完成")
    
    # 调用LLM
    try:
        result = await enhancer.extract_method_flow(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")
    
    return {
        "method_flow": result,
        "cached": False
    }


@router.post("/experiment-setup/{paper_id}", response_model=dict)
async def extract_experiment_setup(
    paper_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    提取实验设置
    
    - 从论文中提取实验设置信息
    - 包括数据集、基线、指标、超参数等
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 获取论文内容 (优先从markdown文件读取)
    content = get_paper_content(paper)
    
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足，请确保论文已解析完成")
    
    # 调用LLM
    try:
        result = await enhancer.extract_experiment_setup(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")
    
    return {
        "experiment_setup": result,
        "cached": False
    }


class QuoteSnippetRequest(BaseModel):
    """引用骨架请求"""
    paper_id: str
    selected_text: str
    anchor_id: Optional[str] = None


@router.post("/quote-snippet", response_model=dict)
async def generate_quote_snippet(
    request: QuoteSnippetRequest,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    生成引用骨架
    
    - 将选中文本转换为学术写作可用的引用骨架
    - 不直接复制原句，而是生成可改写的表述
    """
    paper = paper_crud.get(db, request.paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 准备作者信息
    authors = ", ".join(paper.authors[:3]) if paper.authors else "Unknown"
    if paper.authors and len(paper.authors) > 3:
        authors += " et al."
    
    try:
        result = await enhancer.generate_quote_snippet(
            selected_text=request.selected_text,
            authors=authors,
            year=str(paper.year) if paper.year else "Unknown",
            title=paper.title
        )
        
        return {
            "quote_snippet": result,
            "paper_info": {
                "title": paper.title,
                "authors": authors,
                "year": paper.year
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


class SectionSummaryLeveledRequest(BaseModel):
    """三层摘要请求"""
    section_title: str
    content: str
    level: str = "plain"  # one_liner/plain/strict


@router.post("/section-summary-leveled", response_model=dict)
async def generate_section_summary_leveled(
    request: SectionSummaryLeveledRequest,
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    生成三层摘要
    
    - one_liner: 一句话版本
    - plain: 通俗版本（默认）
    - strict: 严格版本
    """
    try:
        result = await enhancer.summarize_section_leveled(
            section_title=request.section_title,
            content=request.content
        )
        
        # 根据请求的level返回对应内容
        if request.level == "one_liner":
            summary = result.get("one_liner", "")
        elif request.level == "strict":
            summary = result.get("strict", "")
        else:
            summary = result.get("plain", "")
        
        return {
            "summary": summary,
            "level": request.level,
            "all_levels": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.post("/generate-paper-card/{paper_id}", response_model=dict)
async def generate_paper_card_full(
    paper_id: str,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    生成完整的PaperCard
    
    - 基于论文内容和已有卡片生成
    - 包含一句话总结、贡献、局限、适用范围等
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 获取论文内容
    content = get_paper_content(paper)
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足")
    
    # TODO: 获取已有卡片信息
    existing_cards = ""
    
    try:
        result = await enhancer.generate_paper_card_full(
            content=content,
            existing_cards=existing_cards
        )
        
        return {
            "paper_card": result,
            "paper_id": paper_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")
