"""
Evidence Ledger（主张-证据台账）API端点 - 数据库持久化实现
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from ...api.deps import get_db, get_enhancer
from ...crud import paper_crud
from ...core.llm import ContentEnhancer
from ...config import settings
from ...db.models import EvidenceLedgerModel

router = APIRouter()


class Claim(BaseModel):
    """单条主张"""
    id: str
    text: str
    evidence_summary: Optional[str] = None
    evidence_anchors: List[str] = []
    evidence_type: str = "experimental"  # experimental/theoretical/empirical/citation
    strength: str = "medium"  # strong/medium/weak
    uncertainty: str = "from_text"  # from_text/inferred/needs_verify
    alternative_explanations: List[str] = []
    risks: List[str] = []
    source_sections: List[str] = []


class EvidenceLedgerData(BaseModel):
    """证据台账数据"""
    claims: List[Claim] = []
    overall_evidence_quality: str = "medium"
    key_assumptions: List[str] = []
    methodology_concerns: List[str] = []


class UpdateClaimRequest(BaseModel):
    """更新主张请求"""
    claim_id: str
    text: Optional[str] = None
    evidence_anchors: Optional[List[str]] = None
    strength: Optional[str] = None
    uncertainty: Optional[str] = None
    alternative_explanations: Optional[List[str]] = None
    risks: Optional[List[str]] = None


class AddClaimRequest(BaseModel):
    """添加主张请求"""
    text: str
    evidence_anchors: List[str] = []
    strength: str = "medium"


class ClaimToCardRequest(BaseModel):
    """主张转卡片请求"""
    claim_id: str


def get_paper_content(paper) -> str:
    """获取论文完整内容"""
    if paper.markdown_path:
        md_path = os.path.join(settings.OUTPUT_DIR, paper.markdown_path)
        if os.path.exists(md_path):
            try:
                with open(md_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except Exception:
                pass
    return paper.abstract or ""


def ledger_model_to_dict(ledger: EvidenceLedgerModel) -> dict:
    """将数据库模型转换为字典"""
    return {
        "claims": ledger.claims or [],
        "overall_evidence_quality": ledger.overall_evidence_quality or "medium",
        "key_assumptions": ledger.key_assumptions or [],
        "methodology_concerns": ledger.methodology_concerns or []
    }


@router.post("/{paper_id}/generate", response_model=dict)
async def generate_evidence_ledger(
    paper_id: str,
    force: bool = False,
    db: Session = Depends(get_db),
    enhancer: ContentEnhancer = Depends(get_enhancer)
):
    """
    自动生成主张-证据台账
    
    - 从论文结论和摘要中提取核心主张
    - 分析每个主张的证据强度
    - 识别替代解释和潜在风险
    """
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    # 检查是否已存在且不强制重新生成
    existing = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if existing and not force:
        return {
            "evidence_ledger": ledger_model_to_dict(existing),
            "cached": True
        }
    
    # 获取论文内容
    content = get_paper_content(paper)
    if not content:
        raise HTTPException(status_code=400, detail="论文内容不足")
    
    try:
        result = await enhancer.generate_evidence_ledger(content)
        
        # 转换格式
        claims = []
        for i, claim_data in enumerate(result.get("claims", [])):
            claim = {
                "id": claim_data.get("id", f"claim_{i+1}"),
                "text": claim_data.get("text", ""),
                "evidence_summary": claim_data.get("evidence_summary", ""),
                "evidence_anchors": claim_data.get("evidence_anchors", []),
                "evidence_type": claim_data.get("evidence_type", "experimental"),
                "strength": claim_data.get("strength", "medium"),
                "uncertainty": claim_data.get("uncertainty", "from_text"),
                "alternative_explanations": claim_data.get("alternative_explanations", []),
                "risks": claim_data.get("risks", []),
                "source_sections": claim_data.get("source_sections", [])
            }
            claims.append(claim)
        
        # 保存到数据库
        if existing:
            existing.claims = claims
            existing.overall_evidence_quality = result.get("overall_evidence_quality", "medium")
            existing.key_assumptions = result.get("key_assumptions", [])
            existing.methodology_concerns = result.get("methodology_concerns", [])
            existing.updated_at = datetime.utcnow()
        else:
            existing = EvidenceLedgerModel(
                paper_id=paper_id,
                claims=claims,
                overall_evidence_quality=result.get("overall_evidence_quality", "medium"),
                key_assumptions=result.get("key_assumptions", []),
                methodology_concerns=result.get("methodology_concerns", [])
            )
            db.add(existing)
        
        db.commit()
        db.refresh(existing)
        
        return {
            "evidence_ledger": ledger_model_to_dict(existing),
            "cached": False
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.get("/{paper_id}", response_model=dict)
async def get_evidence_ledger(
    paper_id: str,
    db: Session = Depends(get_db)
):
    """获取主张-证据台账"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    ledger = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if not ledger:
        return {
            "evidence_ledger": None,
            "message": "尚未生成证据台账"
        }
    
    return {
        "evidence_ledger": ledger_model_to_dict(ledger)
    }


@router.put("/{paper_id}", response_model=dict)
async def update_evidence_ledger(
    paper_id: str,
    data: EvidenceLedgerData,
    db: Session = Depends(get_db)
):
    """更新整个证据台账"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    ledger = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if not ledger:
        ledger = EvidenceLedgerModel(paper_id=paper_id)
        db.add(ledger)
    
    ledger.claims = [c.model_dump() for c in data.claims]
    ledger.overall_evidence_quality = data.overall_evidence_quality
    ledger.key_assumptions = data.key_assumptions
    ledger.methodology_concerns = data.methodology_concerns
    ledger.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(ledger)
    
    return {
        "evidence_ledger": ledger_model_to_dict(ledger),
        "message": "更新成功"
    }


@router.put("/{paper_id}/claim", response_model=dict)
async def update_claim(
    paper_id: str,
    request: UpdateClaimRequest,
    db: Session = Depends(get_db)
):
    """更新单条主张"""
    ledger = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if not ledger:
        raise HTTPException(status_code=404, detail="证据台账不存在")
    
    claims = ledger.claims or []
    
    # 找到并更新主张
    found = False
    updated_claim = None
    for claim in claims:
        if claim["id"] == request.claim_id:
            if request.text is not None:
                claim["text"] = request.text
            if request.evidence_anchors is not None:
                claim["evidence_anchors"] = request.evidence_anchors
            if request.strength is not None:
                claim["strength"] = request.strength
            if request.uncertainty is not None:
                claim["uncertainty"] = request.uncertainty
            if request.alternative_explanations is not None:
                claim["alternative_explanations"] = request.alternative_explanations
            if request.risks is not None:
                claim["risks"] = request.risks
            found = True
            updated_claim = claim
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="主张不存在")
    
    ledger.claims = claims
    ledger.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "claim": updated_claim,
        "message": "更新成功"
    }


@router.post("/{paper_id}/claim", response_model=dict)
async def add_claim(
    paper_id: str,
    request: AddClaimRequest,
    db: Session = Depends(get_db)
):
    """添加新主张"""
    paper = paper_crud.get(db, paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="论文不存在")
    
    ledger = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if not ledger:
        ledger = EvidenceLedgerModel(paper_id=paper_id)
        db.add(ledger)
        db.commit()
        db.refresh(ledger)
    
    claims = ledger.claims or []
    
    # 生成新ID
    existing_ids = [c["id"] for c in claims]
    new_id = f"claim_{len(existing_ids) + 1}"
    counter = len(existing_ids) + 1
    while new_id in existing_ids:
        counter += 1
        new_id = f"claim_{counter}"
    
    new_claim = {
        "id": new_id,
        "text": request.text,
        "evidence_summary": "",
        "evidence_anchors": request.evidence_anchors,
        "evidence_type": "experimental",
        "strength": request.strength,
        "uncertainty": "from_text",
        "alternative_explanations": [],
        "risks": [],
        "source_sections": []
    }
    
    claims.append(new_claim)
    ledger.claims = claims
    ledger.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "claim": new_claim,
        "message": "添加成功"
    }


@router.delete("/{paper_id}/claim/{claim_id}", response_model=dict)
async def delete_claim(
    paper_id: str,
    claim_id: str,
    db: Session = Depends(get_db)
):
    """删除主张"""
    ledger = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if not ledger:
        raise HTTPException(status_code=404, detail="证据台账不存在")
    
    claims = ledger.claims or []
    original_count = len(claims)
    claims = [c for c in claims if c["id"] != claim_id]
    
    if len(claims) == original_count:
        raise HTTPException(status_code=404, detail="主张不存在")
    
    ledger.claims = claims
    ledger.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "删除成功"}


@router.post("/{paper_id}/to-card", response_model=dict)
async def claim_to_evidence_card(
    paper_id: str,
    request: ClaimToCardRequest,
    db: Session = Depends(get_db)
):
    """将主张转换为EvidenceCard"""
    ledger = db.query(EvidenceLedgerModel).filter(
        EvidenceLedgerModel.paper_id == paper_id
    ).first()
    
    if not ledger:
        raise HTTPException(status_code=404, detail="证据台账不存在")
    
    claims = ledger.claims or []
    claim = next((c for c in claims if c["id"] == request.claim_id), None)
    
    if not claim:
        raise HTTPException(status_code=404, detail="主张不存在")
    
    # 创建卡片数据
    card_data = {
        "paper_id": paper_id,
        "type": "evidence",
        "title": claim["text"][:50] + "..." if len(claim["text"]) > 50 else claim["text"],
        "content": claim["text"],
        "claim": claim["text"],
        "evidence": claim.get("evidence_summary", ""),
        "evidence_strength": claim["strength"],
        "alternative_explanations": claim.get("alternative_explanations", []),
        "risks": claim.get("risks", []),
        "source_anchor_ids": claim.get("evidence_anchors", []),
        "uncertainty": claim["uncertainty"],
        "tags": ["from_ledger"],
        "status": "draft"
    }
    
    return {
        "card_data": card_data,
        "message": "请使用此数据创建卡片"
    }
