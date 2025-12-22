"""
CRUD操作模块
"""
from .paper import paper_crud
from .anchor import anchor_crud
from .card import card_crud
from .skim import skim_crud

__all__ = ['paper_crud', 'anchor_crud', 'card_crud', 'skim_crud']


