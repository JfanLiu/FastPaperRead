"""
锚点API测试用例
"""
import pytest


class TestAnchorsAPI:
    """锚点API测试"""
    
    def test_get_anchors_nonexistent_paper(self, client):
        """测试获取不存在论文的锚点"""
        response = client.get("/api/v1/anchors/paper/nonexistent-id")
        # 可能返回空列表或404
        assert response.status_code in [200, 404]
        print(f"[OK] 锚点查询: {response.status_code} - {response.json()}")
    
    def test_get_section_tree_nonexistent(self, client):
        """测试获取不存在论文的章节树"""
        response = client.get("/api/v1/anchors/paper/nonexistent-id/sections")
        assert response.status_code in [200, 404]
        print(f"[OK] 章节树查询: {response.status_code}")
    
    def test_get_anchor_detail_nonexistent(self, client):
        """测试获取不存在的锚点"""
        response = client.get("/api/v1/anchors/nonexistent-id")
        assert response.status_code == 404
        print(f"[OK] 锚点详情404: {response.json()}")

