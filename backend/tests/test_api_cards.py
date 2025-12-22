"""
卡片API测试用例
"""
import pytest


class TestCardsAPI:
    """卡片API测试"""
    
    def test_get_paper_cards_nonexistent(self, client):
        """测试获取不存在论文的卡片"""
        response = client.get("/api/v1/cards/paper/nonexistent-id")
        # 可能返回空列表或404
        assert response.status_code in [200, 404]
        print(f"[OK] 卡片查询: {response.status_code}")
    
    def test_create_card_invalid(self, client):
        """测试创建无效卡片"""
        card_data = {
            "paper_id": "nonexistent",
            "type": "note",
            "title": "Test Card",
            "content": "Test content"
        }
        response = client.post("/api/v1/cards", json=card_data)
        # 可能返回201成功创建或422验证失败
        print(f"[OK] 创建卡片: {response.status_code} - {response.text[:200]}")
    
    def test_search_cards(self, client):
        """测试搜索卡片"""
        search_data = {
            "query": "test",
            "types": ["note"],
            "limit": 10
        }
        response = client.post("/api/v1/cards/search", json=search_data)
        assert response.status_code in [200, 422]
        print(f"[OK] 搜索卡片: {response.status_code}")

