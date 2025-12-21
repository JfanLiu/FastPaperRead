"""
对比模式API路由
"""
from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import uuid

router = APIRouter()

# 临时存储
_compare_sets_db = {}


class CompareSetCreate(BaseModel):
    """创建对比集合"""
    name: str
    paper_ids: List[str] = []


class CompareSetResponse(BaseModel):
    """对比集合响应"""
    id: str
    name: str
    paper_ids: List[str]
    created_at: datetime
    normalization_applied: bool = False


class NormalizationRequest(BaseModel):
    """归一化请求"""
    compare_set_id: str
    term_mappings: dict = {}     # {"term_a": "standard_term", ...}
    metric_mappings: dict = {}   # {"accuracy": "acc", ...}


class CompareMatrixResponse(BaseModel):
    """对比矩阵响应"""
    compare_set_id: str
    headers: List[str]  # 列名
    rows: List[dict]    # 每行数据
    conflicts: List[dict] = []  # 冲突点


@router.post("/sets", response_model=CompareSetResponse)
async def create_compare_set(request: CompareSetCreate):
    """创建对比集合"""
    set_id = str(uuid.uuid4())
    
    compare_set = {
        "id": set_id,
        "name": request.name,
        "paper_ids": request.paper_ids,
        "created_at": datetime.now(),
        "normalization_applied": False
    }
    
    _compare_sets_db[set_id] = compare_set
    return compare_set


@router.get("/sets", response_model=List[CompareSetResponse])
async def list_compare_sets():
    """获取所有对比集合"""
    return list(_compare_sets_db.values())


@router.get("/sets/{set_id}", response_model=CompareSetResponse)
async def get_compare_set(set_id: str):
    """获取对比集合详情"""
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    return _compare_sets_db[set_id]


@router.post("/sets/{set_id}/papers/{paper_id}")
async def add_paper_to_set(set_id: str, paper_id: str):
    """添加论文到对比集合"""
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    compare_set = _compare_sets_db[set_id]
    if paper_id not in compare_set["paper_ids"]:
        compare_set["paper_ids"].append(paper_id)
    
    return {"message": "已添加"}


@router.delete("/sets/{set_id}/papers/{paper_id}")
async def remove_paper_from_set(set_id: str, paper_id: str):
    """从对比集合移除论文"""
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    compare_set = _compare_sets_db[set_id]
    if paper_id in compare_set["paper_ids"]:
        compare_set["paper_ids"].remove(paper_id)
    
    return {"message": "已移除"}


@router.post("/sets/{set_id}/normalize")
async def apply_normalization(request: NormalizationRequest):
    """应用归一化"""
    set_id = request.compare_set_id
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    # TODO: 保存归一化配置并应用
    _compare_sets_db[set_id]["normalization_applied"] = True
    
    return {"message": "归一化已应用"}


@router.get("/sets/{set_id}/matrix", response_model=CompareMatrixResponse)
async def get_compare_matrix(set_id: str):
    """获取对比矩阵"""
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    compare_set = _compare_sets_db[set_id]
    
    # TODO: 生成真实的对比矩阵
    headers = ["论文", "方法", "数据集", "主要指标", "复现性"]
    rows = [
        {
            "paper_id": pid,
            "title": f"论文 {i+1}",
            "method": "-",
            "dataset": "-",
            "metric": "-",
            "reproducibility": "-"
        }
        for i, pid in enumerate(compare_set["paper_ids"])
    ]
    
    return CompareMatrixResponse(
        compare_set_id=set_id,
        headers=headers,
        rows=rows,
        conflicts=[]
    )


@router.get("/sets/{set_id}/conflicts")
async def get_conflicts(set_id: str):
    """获取结论冲突"""
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    # TODO: 分析并返回冲突
    return {"conflicts": []}


@router.post("/sets/{set_id}/export/related-work")
async def export_related_work(set_id: str, style: str = "timeline"):
    """导出Related Work骨架"""
    if set_id not in _compare_sets_db:
        raise HTTPException(404, "对比集合不存在")
    
    # TODO: 生成Related Work骨架
    return {
        "style": style,
        "content": "# Related Work\n\n## 方法A类\n\n...\n\n## 方法B类\n\n..."
    }

