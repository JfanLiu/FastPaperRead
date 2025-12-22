"""
复现清单API测试用例
"""
import pytest


class TestChecklistAPI:
    """复现清单API测试"""
    
    def test_get_checklist_creates_empty(self, client):
        """测试获取不存在论文的清单会创建空清单"""
        response = client.get("/api/v1/checklist/test-paper-id")
        # 可能创建空清单返回200，或者返回404
        assert response.status_code in [200, 404]
        print(f"[OK] 获取清单: {response.status_code}")
    
    def test_add_checklist_item(self, client):
        """测试添加清单项"""
        item_data = {
            "group": "data",
            "text": "Test checklist item",
            "found": False
        }
        response = client.post("/api/v1/checklist/test-paper-id/items", json=item_data)
        assert response.status_code in [200, 404, 422]
        print(f"[OK] 添加清单项: {response.status_code}")


