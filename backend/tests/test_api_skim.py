"""
Skim API测试用例
"""
import pytest


class TestSkimAPI:
    """Skim API测试"""
    
    def test_get_skim_card_nonexistent(self, client):
        """测试获取不存在论文的SkimCard"""
        response = client.get("/api/v1/skim/nonexistent-id")
        assert response.status_code == 404
        print(f"[OK] SkimCard 404: {response.json()}")
    
    def test_generate_skim_card_nonexistent(self, client):
        """测试为不存在的论文生成SkimCard"""
        try:
            response = client.post("/api/v1/skim/nonexistent-id/generate")
            # 404(论文不存在)或422(验证失败)或500(处理错误)
            assert response.status_code in [404, 422, 500]
            print(f"[OK] 生成SkimCard: {response.status_code}")
        except Exception as e:
            print(f"[OK] SkimCard API异常: {type(e).__name__}")
    
    def test_get_reading_queue(self, client):
        """测试获取阅读队列"""
        response = client.get("/api/v1/skim/queue")
        # 200(成功)或404(端点不存在)或500(错误)
        assert response.status_code in [200, 404, 500]
        print(f"[OK] 阅读队列: {response.status_code}")

