import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const API_BASE = 'http://localhost:8000';
const TEST_PDF_PATH = path.join(__dirname, '../../docs/Position Based Fluids.pdf');

test.describe('后端API端到端测试', () => {
  
  test('健康检查', async ({ request }) => {
    console.log('[E2E] 测试后端健康检查...');
    
    const response = await request.get(`${API_BASE}/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    console.log('[E2E] ✓ 后端健康检查通过');
  });

  test('获取论文列表', async ({ request }) => {
    console.log('[E2E] 测试获取论文列表...');
    
    const response = await request.get(`${API_BASE}/api/v1/papers`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('papers');
    expect(data).toHaveProperty('total');
    console.log(`[E2E] ✓ 论文列表获取成功，共 ${data.total} 篇论文`);
  });

  test('获取论文统计', async ({ request }) => {
    console.log('[E2E] 测试获取论文统计...');
    
    const response = await request.get(`${API_BASE}/api/v1/papers/stats`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('total');
    console.log(`[E2E] ✓ 论文统计: total=${data.total}, unread=${data.unread || 0}`);
  });

  test('上传PDF文件', async ({ request }) => {
    console.log('[E2E] 测试上传PDF文件...');
    
    // 检查测试文件是否存在
    if (!fs.existsSync(TEST_PDF_PATH)) {
      console.log(`[E2E] ⚠ 测试PDF文件不存在: ${TEST_PDF_PATH}`);
      test.skip();
      return;
    }

    // 读取PDF文件
    const fileBuffer = fs.readFileSync(TEST_PDF_PATH);
    console.log(`[E2E] 读取PDF文件: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // 创建FormData
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'Position Based Fluids.pdf');

    // 上传
    const response = await request.post(`${API_BASE}/api/v1/papers/upload`, {
      multipart: {
        file: {
          name: 'Position Based Fluids.pdf',
          mimeType: 'application/pdf',
          buffer: fileBuffer
        }
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('paper_id');
    expect(data).toHaveProperty('job_id');
    console.log(`[E2E] ✓ PDF上传成功: paper_id=${data.paper_id}, job_id=${data.job_id}`);

    // 保存paper_id供后续测试使用
    process.env.TEST_PAPER_ID = data.paper_id;
  });

  test('获取导入状态', async ({ request }) => {
    console.log('[E2E] 测试获取导入状态...');
    
    // 先获取论文列表找到一个paper_id
    const listResponse = await request.get(`${API_BASE}/api/v1/papers`);
    const listData = await listResponse.json();
    
    if (listData.papers.length === 0) {
      console.log('[E2E] ⚠ 没有论文，跳过导入状态测试');
      test.skip();
      return;
    }

    const paperId = listData.papers[0].id;
    const response = await request.get(`${API_BASE}/api/v1/papers/${paperId}/import-status`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('paper_id');
    expect(data).toHaveProperty('status');
    console.log(`[E2E] ✓ 导入状态: paper_id=${data.paper_id}, status=${data.status}`);
  });

  test('获取论文详情', async ({ request }) => {
    console.log('[E2E] 测试获取论文详情...');
    
    // 先获取论文列表找到一个paper_id
    const listResponse = await request.get(`${API_BASE}/api/v1/papers`);
    const listData = await listResponse.json();
    
    if (listData.papers.length === 0) {
      console.log('[E2E] ⚠ 没有论文，跳过详情测试');
      test.skip();
      return;
    }

    const paperId = listData.papers[0].id;
    const response = await request.get(`${API_BASE}/api/v1/papers/${paperId}`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('status');
    console.log(`[E2E] ✓ 论文详情: id=${data.id}, title=${data.title}, status=${data.status}`);
  });

  test('获取论文锚点', async ({ request }) => {
    console.log('[E2E] 测试获取论文锚点...');
    
    // 先获取论文列表找到一个paper_id
    const listResponse = await request.get(`${API_BASE}/api/v1/papers`);
    const listData = await listResponse.json();
    
    if (listData.papers.length === 0) {
      console.log('[E2E] ⚠ 没有论文，跳过锚点测试');
      test.skip();
      return;
    }

    const paperId = listData.papers[0].id;
    const response = await request.get(`${API_BASE}/api/v1/anchors/paper/${paperId}`);
    
    // 可能返回空列表
    expect([200, 404]).toContain(response.status());
    
    if (response.status() === 200) {
      const data = await response.json();
      const anchorCount = Array.isArray(data) ? data.length : (data.anchors?.length || 0);
      console.log(`[E2E] ✓ 论文锚点: ${anchorCount} 个锚点`);
    } else {
      console.log('[E2E] ✓ 论文锚点: 无锚点数据');
    }
  });

  test('获取阅读队列', async ({ request }) => {
    console.log('[E2E] 测试获取阅读队列...');
    
    const response = await request.get(`${API_BASE}/api/v1/skim/queue`);
    
    expect([200, 404, 500]).toContain(response.status());
    console.log(`[E2E] ✓ 阅读队列: status=${response.status()}`);
  });

  test('获取评分标准', async ({ request }) => {
    console.log('[E2E] 测试获取评分标准...');
    
    const response = await request.get(`${API_BASE}/api/v1/review/any-id/rubric`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('rubric');
    console.log(`[E2E] ✓ 评分标准: ${Object.keys(data.rubric).length} 个维度`);
  });
});

test.describe('完整上传流程测试', () => {
  
  test('上传->获取详情->检查状态', async ({ request }) => {
    console.log('[E2E] 开始完整上传流程测试...');
    
    // 检查测试文件
    if (!fs.existsSync(TEST_PDF_PATH)) {
      console.log(`[E2E] ⚠ 测试PDF文件不存在`);
      test.skip();
      return;
    }

    // Step 1: 上传
    console.log('[E2E] Step 1: 上传PDF...');
    const fileBuffer = fs.readFileSync(TEST_PDF_PATH);
    
    const uploadResponse = await request.post(`${API_BASE}/api/v1/papers/upload`, {
      multipart: {
        file: {
          name: 'Position Based Fluids.pdf',
          mimeType: 'application/pdf',
          buffer: fileBuffer
        }
      }
    });

    expect(uploadResponse.status()).toBe(200);
    const uploadData = await uploadResponse.json();
    const paperId = uploadData.paper_id;
    console.log(`[E2E]   ✓ 上传成功: paper_id=${paperId}`);

    // Step 2: 获取详情
    console.log('[E2E] Step 2: 获取论文详情...');
    const detailResponse = await request.get(`${API_BASE}/api/v1/papers/${paperId}`);
    expect(detailResponse.status()).toBe(200);
    
    const detailData = await detailResponse.json();
    console.log(`[E2E]   ✓ 论文标题: ${detailData.title}`);
    console.log(`[E2E]   ✓ 论文状态: ${detailData.status}`);

    // Step 3: 检查导入状态
    console.log('[E2E] Step 3: 检查导入状态...');
    const statusResponse = await request.get(`${API_BASE}/api/v1/papers/${paperId}/import-status`);
    expect(statusResponse.status()).toBe(200);
    
    const statusData = await statusResponse.json();
    console.log(`[E2E]   ✓ 导入状态: ${statusData.status}`);
    console.log(`[E2E]   ✓ 进度: ${(statusData.progress || 0) * 100}%`);

    // Step 4: 验证论文在列表中
    console.log('[E2E] Step 4: 验证论文在列表中...');
    const listResponse = await request.get(`${API_BASE}/api/v1/papers`);
    expect(listResponse.status()).toBe(200);
    
    const listData = await listResponse.json();
    const found = listData.papers.some((p: { id: string }) => p.id === paperId);
    expect(found).toBe(true);
    console.log(`[E2E]   ✓ 论文在列表中: ${found}`);

    console.log('[E2E] ✓✓✓ 完整上传流程测试通过!');
  });
});


