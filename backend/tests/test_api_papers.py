"""
论文API测试用例
"""
import pytest
import os
from pathlib import Path
from io import BytesIO

# 测试用PDF文件路径
TEST_PDF_PATH = Path(__file__).parent.parent.parent / "docs" / "Position Based Fluids.pdf"


class TestHealthCheck:
    """健康检查测试"""
    
    def test_health_check(self, client):
        """测试健康检查端点"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"[OK] 健康检查: {data}")
    
    def test_root_endpoint(self, client):
        """测试根路径"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "FastPaperRead API"
        assert data["status"] == "running"
        print(f"[OK] 根路径: {data}")


class TestPaperUpload:
    """论文上传测试"""
    
    def test_upload_invalid_file_type(self, client):
        """测试上传非PDF文件"""
        content = b"This is not a PDF file"
        files = {"file": ("test.txt", BytesIO(content), "text/plain")}
        
        response = client.post("/api/v1/papers/upload", files=files)
        assert response.status_code == 400
        assert "PDF" in response.json()["detail"]
        print(f"[OK] 拒绝非PDF文件: {response.json()}")
    
    def test_upload_pdf_file(self, client, sample_pdf_path):
        """测试上传PDF文件"""
        if not sample_pdf_path or not os.path.exists(sample_pdf_path):
            pytest.skip("测试PDF文件不存在")
        
        with open(sample_pdf_path, "rb") as f:
            files = {"file": ("Position Based Fluids.pdf", f, "application/pdf")}
            response = client.post("/api/v1/papers/upload", files=files)
        
        print(f"[DEBUG] 上传响应: {response.status_code} - {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "paper_id" in data
        assert "job_id" in data
        assert data["message"] == "上传成功，开始解析"
        
        print(f"[OK] PDF上传成功: paper_id={data['paper_id']}, job_id={data['job_id']}")
        return data["paper_id"]


class TestPaperList:
    """论文列表测试"""
    
    def test_get_papers_empty(self, client):
        """测试获取空论文列表"""
        response = client.get("/api/v1/papers")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data or "papers" in data
        print(f"[OK] 获取论文列表: total={data.get('total', len(data.get('items', data.get('papers', []))))}")
    
    def test_get_papers_with_pagination(self, client):
        """测试分页"""
        response = client.get("/api/v1/papers?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        print(f"[OK] 分页测试: skip=0, limit=10, result={data}")


class TestPaperDetail:
    """论文详情测试"""
    
    def test_get_nonexistent_paper(self, client):
        """测试获取不存在的论文"""
        response = client.get("/api/v1/papers/nonexistent-id")
        assert response.status_code == 404
        print(f"[OK] 404响应正确: {response.json()}")


class TestPaperImportStatus:
    """导入状态测试"""
    
    def test_get_import_status_nonexistent(self, client):
        """测试获取不存在论文的导入状态"""
        response = client.get("/api/v1/papers/nonexistent-id/import-status")
        assert response.status_code == 404
        print(f"[OK] 导入状态404: {response.json()}")


class TestPaperStats:
    """论文统计测试"""
    
    def test_get_stats(self, client):
        """测试获取统计信息"""
        response = client.get("/api/v1/papers/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        print(f"[OK] 统计信息: {data}")


class TestIntegration:
    """集成测试 - 完整上传流程"""
    
    def test_full_upload_flow(self, client, sample_pdf_path):
        """测试完整上传流程"""
        if not sample_pdf_path or not os.path.exists(sample_pdf_path):
            pytest.skip("测试PDF文件不存在")
        
        # Step 1: 上传PDF
        print("\n[Step 1] 上传PDF...")
        with open(sample_pdf_path, "rb") as f:
            files = {"file": ("Position Based Fluids.pdf", f, "application/pdf")}
            response = client.post("/api/v1/papers/upload", files=files)
        
        assert response.status_code == 200
        upload_data = response.json()
        paper_id = upload_data["paper_id"]
        print(f"  -> 上传成功: paper_id={paper_id}")
        
        # Step 2: 获取论文详情
        print("\n[Step 2] 获取论文详情...")
        response = client.get(f"/api/v1/papers/{paper_id}")
        assert response.status_code == 200
        paper_data = response.json()
        print(f"  -> 论文标题: {paper_data.get('title', 'N/A')}")
        print(f"  -> 状态: {paper_data.get('status', 'N/A')}")
        
        # Step 3: 获取导入状态
        print("\n[Step 3] 获取导入状态...")
        response = client.get(f"/api/v1/papers/{paper_id}/import-status")
        assert response.status_code == 200
        status_data = response.json()
        print(f"  -> 进度: {status_data.get('progress', 0) * 100:.1f}%")
        print(f"  -> 当前步骤: {status_data.get('current_step', 'N/A')}")
        
        # Step 4: 获取论文列表确认
        print("\n[Step 4] 确认论文在列表中...")
        response = client.get("/api/v1/papers")
        assert response.status_code == 200
        list_data = response.json()
        papers = list_data.get("items", list_data.get("papers", []))
        paper_ids = [p["id"] for p in papers]
        assert paper_id in paper_ids
        print(f"  -> 论文在列表中: True (共{len(papers)}篇)")
        
        print("\n[OK] 完整上传流程测试通过!")
        return paper_id


