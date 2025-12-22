"""
导出API测试用例
"""
import pytest


class TestExportAPI:
    """导出API测试"""
    
    def test_export_markdown_nonexistent(self, client):
        """测试导出不存在论文的Markdown"""
        response = client.get("/api/v1/export/nonexistent-id/markdown")
        assert response.status_code == 404
        print(f"[OK] 导出Markdown 404")
    
    def test_export_json_nonexistent(self, client):
        """测试导出不存在论文的JSON"""
        response = client.get("/api/v1/export/nonexistent-id/json")
        assert response.status_code == 404
        print(f"[OK] 导出JSON 404")
    
    def test_export_bibtex_nonexistent(self, client):
        """测试导出不存在论文的BibTeX"""
        response = client.get("/api/v1/export/nonexistent-id/bibtex")
        assert response.status_code == 404
        print(f"[OK] 导出BibTeX 404")

