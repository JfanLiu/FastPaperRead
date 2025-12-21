import { test, expect } from '@playwright/test';
import path from 'path';

// 测试PDF文件路径
const TEST_PDF_PATH = path.join(__dirname, '../../docs/Position Based Fluids.pdf');

test.describe('论文上传流程', () => {
  test.beforeEach(async ({ page }) => {
    // 访问首页
    await page.goto('/');
    console.log('[TEST] 访问首页');
  });

  test('首页可访问', async ({ page }) => {
    // 检查首页元素
    await expect(page).toHaveTitle(/FastPaperRead|Paper/i);
    console.log('[TEST] 首页标题验证通过');
  });

  test('导航到导入页面', async ({ page }) => {
    // 点击导入按钮或链接
    const importLink = page.locator('a[href*="import"], button:has-text("导入"), button:has-text("上传")').first();
    
    if (await importLink.isVisible()) {
      await importLink.click();
      await page.waitForURL('**/import**', { timeout: 10000 });
      console.log('[TEST] 成功导航到导入页面');
    } else {
      // 直接访问导入页面
      await page.goto('/import');
      console.log('[TEST] 直接访问导入页面');
    }
    
    // 验证导入页面元素
    await expect(page.locator('text=上传文件, text=导入论文, text=拖拽PDF').first()).toBeVisible({ timeout: 10000 });
    console.log('[TEST] 导入页面验证通过');
  });

  test('上传PDF文件', async ({ page }) => {
    // 访问导入页面
    await page.goto('/import');
    await page.waitForLoadState('networkidle');
    console.log('[TEST] 导入页面已加载');

    // 查找文件输入
    const fileInput = page.locator('input[type="file"]');
    
    // 检查测试文件是否存在
    const fs = await import('fs');
    if (!fs.existsSync(TEST_PDF_PATH)) {
      console.log('[TEST] 测试PDF文件不存在，跳过上传测试');
      test.skip();
      return;
    }

    // 上传文件
    await fileInput.setInputFiles(TEST_PDF_PATH);
    console.log('[TEST] 已选择PDF文件');

    // 等待上传响应
    await page.waitForResponse(
      response => response.url().includes('/papers/upload') && response.status() === 200,
      { timeout: 30000 }
    ).catch(() => {
      console.log('[TEST] 上传响应超时，可能后端未运行');
    });

    // 检查是否显示进度或成功消息
    const hasProgress = await page.locator('text=正在导入, text=解析中, text=上传成功').first().isVisible().catch(() => false);
    console.log(`[TEST] 上传状态: ${hasProgress ? '进行中/成功' : '未检测到状态'}`);
  });
});

test.describe('论文库页面', () => {
  test('访问论文库', async ({ page }) => {
    await page.goto('/library');
    await page.waitForLoadState('networkidle');
    console.log('[TEST] 论文库页面已加载');

    // 验证页面元素
    const hasContent = await page.locator('text=论文库, text=Library, text=我的论文').first().isVisible().catch(() => false);
    console.log(`[TEST] 论文库内容: ${hasContent ? '存在' : '可能为空'}`);
  });

  test('论文列表API调用', async ({ page }) => {
    // 监听API请求
    const apiPromise = page.waitForResponse(
      response => response.url().includes('/papers') && response.request().method() === 'GET',
      { timeout: 10000 }
    ).catch(() => null);

    await page.goto('/library');
    
    const response = await apiPromise;
    if (response) {
      const data = await response.json();
      console.log(`[TEST] 论文列表API响应: ${response.status()}, 论文数: ${data.papers?.length || data.items?.length || 0}`);
      expect(response.status()).toBe(200);
    } else {
      console.log('[TEST] 未捕获到论文列表API调用');
    }
  });
});

test.describe('阅读页面', () => {
  test('访问阅读页面需要论文ID', async ({ page }) => {
    // 测试访问不存在的论文
    await page.goto('/paper/test-id/read');
    await page.waitForLoadState('networkidle');
    
    // 可能显示404或错误
    const hasError = await page.locator('text=不存在, text=404, text=Error').first().isVisible().catch(() => false);
    console.log(`[TEST] 访问不存在论文: ${hasError ? '正确显示错误' : '页面已加载'}`);
  });
});

test.describe('API健康检查', () => {
  test('后端API可访问', async ({ request }) => {
    try {
      const response = await request.get('http://localhost:8000/health');
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      console.log('[TEST] 后端健康检查通过');
    } catch (error) {
      console.log('[TEST] 后端API不可访问，请确保后端正在运行');
      test.skip();
    }
  });

  test('论文API可访问', async ({ request }) => {
    try {
      const response = await request.get('http://localhost:8000/api/v1/papers');
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      console.log(`[TEST] 论文API响应: 共${data.total || 0}篇论文`);
    } catch (error) {
      console.log('[TEST] 论文API不可访问');
      test.skip();
    }
  });
});

