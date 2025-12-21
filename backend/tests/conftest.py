"""
Pytest 配置和固件
"""
import pytest
import os
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base, get_db
from app.config import settings

# 测试数据库
TEST_DATABASE_URL = "sqlite:///./test_fastpaperread.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """覆盖数据库依赖"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """初始化测试数据库"""
    Base.metadata.create_all(bind=engine)
    yield
    # 清理
    Base.metadata.drop_all(bind=engine)
    engine.dispose()  # 释放连接
    try:
        if os.path.exists("./test_fastpaperread.db"):
            os.remove("./test_fastpaperread.db")
    except PermissionError:
        pass  # Windows可能无法删除


@pytest.fixture
def client():
    """测试客户端"""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db_session():
    """数据库会话"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def sample_pdf_path():
    """测试PDF文件路径"""
    pdf_path = Path(__file__).parent.parent.parent / "docs" / "Position Based Fluids.pdf"
    if pdf_path.exists():
        return str(pdf_path)
    # 备用路径
    return None


@pytest.fixture
def temp_upload_dir(tmp_path):
    """临时上传目录"""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    return str(upload_dir)

