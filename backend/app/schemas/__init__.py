"""
Pydantic Schemas
"""
from .paper import (
    PaperBase,
    PaperCreate,
    PaperUpdate,
    PaperInDB,
    PaperListResponse,
    PaperStats,
)
from .skim import (
    SkimCardResponse,
    SkimDecisionRequest,
    SkimGenerateRequest,
)
from .enhance import (
    EnhanceRequest,
    TermExplainRequest,
    TermExplanation,
    FigureExplanation,
    EquationExplanation,
    MissingDetailItem,
    MissingDetailsResponse,
    EnhanceResponse,
)

__all__ = [
    # Paper
    'PaperBase',
    'PaperCreate',
    'PaperUpdate',
    'PaperInDB',
    'PaperListResponse',
    'PaperStats',
    # Skim
    'SkimCardResponse',
    'SkimDecisionRequest',
    'SkimGenerateRequest',
    # Enhance
    'EnhanceRequest',
    'TermExplainRequest',
    'TermExplanation',
    'FigureExplanation',
    'EquationExplanation',
    'MissingDetailItem',
    'MissingDetailsResponse',
    'EnhanceResponse',
]
