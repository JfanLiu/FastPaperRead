"""
向量存储服务 - 基于ChromaDB的语义检索

提供卡片的向量化存储和语义搜索功能
"""
import logging
import os
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger("fastpaperread.vector_store")

# 延迟导入chromadb，允许在没有安装时优雅降级
_chromadb = None
_client = None
_collection = None


def _get_chromadb():
    """延迟加载chromadb"""
    global _chromadb
    if _chromadb is None:
        try:
            import chromadb
            _chromadb = chromadb
        except ImportError:
            logger.warning("chromadb未安装，语义搜索功能不可用")
            return None
    return _chromadb


def _get_collection():
    """获取或创建ChromaDB collection"""
    global _client, _collection
    
    chromadb = _get_chromadb()
    if chromadb is None:
        return None
    
    if _collection is None:
        try:
            # 使用持久化存储
            db_path = os.getenv("CHROMA_DB_PATH", "./chroma_db")
            os.makedirs(db_path, exist_ok=True)
            
            _client = chromadb.PersistentClient(path=db_path)
            _collection = _client.get_or_create_collection(
                name="cards",
                metadata={"description": "FastPaperRead card embeddings"}
            )
            logger.info(f"ChromaDB初始化成功: {db_path}, 当前文档数: {_collection.count()}")
        except Exception as e:
            logger.error(f"ChromaDB初始化失败: {e}")
            return None
    
    return _collection


@dataclass
class SearchResult:
    """搜索结果"""
    card_id: str
    score: float  # 相似度分数 (0-1, 越高越相似)
    metadata: Dict[str, Any]


class VectorStore:
    """向量存储服务"""
    
    def __init__(self):
        self._collection = None
    
    @property
    def collection(self):
        if self._collection is None:
            self._collection = _get_collection()
        return self._collection
    
    @property
    def is_available(self) -> bool:
        """检查向量存储是否可用"""
        return self.collection is not None
    
    def add_card(
        self,
        card_id: str,
        title: str,
        content: str,
        paper_id: str,
        card_type: str,
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        添加卡片到向量存储
        
        Args:
            card_id: 卡片ID
            title: 卡片标题
            content: 卡片内容
            paper_id: 所属论文ID
            card_type: 卡片类型 (paper/evidence/method/note)
            tags: 标签列表
        
        Returns:
            是否成功
        """
        if not self.is_available:
            return False
        
        try:
            # 组合文档内容
            document = f"{title}\n{content}"
            if tags:
                document += f"\n标签: {', '.join(tags)}"
            
            # 检查是否已存在
            existing = self.collection.get(ids=[card_id])
            if existing and existing['ids']:
                # 更新
                self.collection.update(
                    ids=[card_id],
                    documents=[document],
                    metadatas=[{
                        "paper_id": paper_id,
                        "type": card_type,
                        "title": title[:200],
                        "tags": ",".join(tags) if tags else ""
                    }]
                )
                logger.debug(f"更新卡片向量: {card_id}")
            else:
                # 新增
                self.collection.add(
                    ids=[card_id],
                    documents=[document],
                    metadatas=[{
                        "paper_id": paper_id,
                        "type": card_type,
                        "title": title[:200],
                        "tags": ",".join(tags) if tags else ""
                    }]
                )
                logger.debug(f"添加卡片向量: {card_id}")
            
            return True
        except Exception as e:
            logger.error(f"添加卡片向量失败: {card_id}, 错误: {e}")
            return False
    
    def delete_card(self, card_id: str) -> bool:
        """
        从向量存储删除卡片
        """
        if not self.is_available:
            return False
        
        try:
            self.collection.delete(ids=[card_id])
            logger.debug(f"删除卡片向量: {card_id}")
            return True
        except Exception as e:
            logger.error(f"删除卡片向量失败: {card_id}, 错误: {e}")
            return False
    
    def search(
        self,
        query: str,
        limit: int = 10,
        paper_id: Optional[str] = None,
        card_types: Optional[List[str]] = None
    ) -> List[SearchResult]:
        """
        语义搜索
        
        Args:
            query: 搜索查询
            limit: 返回结果数量限制
            paper_id: 限制特定论文
            card_types: 限制卡片类型
        
        Returns:
            搜索结果列表
        """
        if not self.is_available:
            return []
        
        if not query.strip():
            return []
        
        try:
            # 构建过滤条件
            where = None
            where_conditions = []
            
            if paper_id:
                where_conditions.append({"paper_id": paper_id})
            
            if card_types:
                where_conditions.append({"type": {"$in": card_types}})
            
            if len(where_conditions) == 1:
                where = where_conditions[0]
            elif len(where_conditions) > 1:
                where = {"$and": where_conditions}
            
            # 执行搜索
            results = self.collection.query(
                query_texts=[query],
                n_results=limit,
                where=where,
                include=["metadatas", "distances"]
            )
            
            # 转换结果
            search_results = []
            if results and results['ids'] and results['ids'][0]:
                ids = results['ids'][0]
                distances = results['distances'][0] if results.get('distances') else [0] * len(ids)
                metadatas = results['metadatas'][0] if results.get('metadatas') else [{}] * len(ids)
                
                for i, card_id in enumerate(ids):
                    # ChromaDB返回的是距离，转换为相似度分数
                    # 距离越小，相似度越高
                    distance = distances[i] if i < len(distances) else 0
                    score = max(0, 1 - distance / 2)  # 简单转换
                    
                    search_results.append(SearchResult(
                        card_id=card_id,
                        score=score,
                        metadata=metadatas[i] if i < len(metadatas) else {}
                    ))
            
            logger.debug(f"语义搜索: query='{query[:50]}', 结果数={len(search_results)}")
            return search_results
            
        except Exception as e:
            logger.error(f"语义搜索失败: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """获取向量存储统计信息"""
        if not self.is_available:
            return {"available": False, "message": "ChromaDB不可用"}
        
        try:
            count = self.collection.count()
            return {
                "available": True,
                "total_documents": count,
                "collection_name": "cards"
            }
        except Exception as e:
            return {"available": False, "error": str(e)}
    
    def rebuild_index(self, cards: List[Dict[str, Any]]) -> int:
        """
        重建索引
        
        Args:
            cards: 卡片列表，每个卡片包含 id, title, content, paper_id, type, tags
        
        Returns:
            成功索引的卡片数量
        """
        if not self.is_available:
            return 0
        
        success_count = 0
        for card in cards:
            if self.add_card(
                card_id=card['id'],
                title=card.get('title', ''),
                content=card.get('content', ''),
                paper_id=card.get('paper_id', ''),
                card_type=card.get('type', 'note'),
                tags=card.get('tags', [])
            ):
                success_count += 1
        
        logger.info(f"重建索引完成: {success_count}/{len(cards)}")
        return success_count


# 全局实例
vector_store = VectorStore()


# 便捷函数
def add_card_to_vector_store(
    card_id: str,
    title: str,
    content: str,
    paper_id: str,
    card_type: str,
    tags: Optional[List[str]] = None
) -> bool:
    """便捷函数：添加卡片到向量存储"""
    return vector_store.add_card(card_id, title, content, paper_id, card_type, tags)


def delete_card_from_vector_store(card_id: str) -> bool:
    """便捷函数：从向量存储删除卡片"""
    return vector_store.delete_card(card_id)


def semantic_search(
    query: str,
    limit: int = 10,
    paper_id: Optional[str] = None,
    card_types: Optional[List[str]] = None
) -> List[SearchResult]:
    """便捷函数：语义搜索"""
    return vector_store.search(query, limit, paper_id, card_types)

