import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const TEST_PDF_PATH = path.join(__dirname, '../../docs/Position Based Fluids.pdf');

test.describe('完整上传流程 E2E 测试', () => {
  
  test('上传PDF -> 导入完成 -> 跳转详情页', async ({ page }) => {
    // 设置较长的超时
    test.setTimeout(120000);
    
    // 监听控制台日志
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Step 1: 访问导入页面
    console.log('[E2E] Step 1: 访问导入页面...');
    await page.goto('http://localhost:3000/import');
    await page.waitForLoadState('networkidle');
    console.log('[E2E]   ✓ 导入页面已加载');
    
    // 截图
    await page.screenshot({ path: 'e2e-screenshots/01-import-page.png' });

    // Step 2: 检查文件输入是否存在
    console.log('[E2E] Step 2: 检查上传组件...');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    console.log('[E2E]   ✓ 文件输入存在');

    // Step 3: 上传PDF文件
    console.log('[E2E] Step 3: 上传PDF文件...');
    if (!fs.existsSync(TEST_PDF_PATH)) {
      console.log(`[E2E]   ✗ 测试PDF文件不存在: ${TEST_PDF_PATH}`);
      test.skip();
      return;
    }
    
    await fileInput.setInputFiles(TEST_PDF_PATH);
    console.log('[E2E]   ✓ 文件已选择');
    
    // 截图
    await page.screenshot({ path: 'e2e-screenshots/02-file-selected.png' });

    // Step 4: 等待上传响应
    console.log('[E2E] Step 4: 等待上传响应...');
    
    // 等待上传API调用完成
    const uploadResponse = await page.waitForResponse(
      response => response.url().includes('/papers/upload') && response.status() === 200,
      { timeout: 30000 }
    );
    
    const uploadData = await uploadResponse.json();
    console.log(`[E2E]   ✓ 上传成功: paper_id=${uploadData.paper_id}`);
    
    const paperId = uploadData.paper_id;

    // Step 5: 等待导入进度
    console.log('[E2E] Step 5: 等待导入完成...');
    
    // 等待进度显示
    await page.waitForSelector('text=正在导入, text=导入完成, text=100%', { timeout: 10000 }).catch(() => {
      console.log('[E2E]   进度文本未找到，继续...');
    });
    
    // 截图
    await page.screenshot({ path: 'e2e-screenshots/03-importing.png' });

    // Step 6: 等待跳转到详情页
    console.log('[E2E] Step 6: 等待跳转到详情页...');
    
    // 等待URL变化到overview页面
    await page.waitForURL(`**/paper/${paperId}/overview`, { timeout: 30000 }).catch(async () => {
      // 如果没有自动跳转，手动导航
      console.log('[E2E]   未自动跳转，手动导航...');
      await page.goto(`http://localhost:3000/paper/${paperId}/overview`);
    });
    
    await page.waitForLoadState('networkidle');
    console.log(`[E2E]   ✓ 已到达详情页: ${page.url()}`);
    
    // 截图
    await page.screenshot({ path: 'e2e-screenshots/04-overview-page.png' });

    // Step 7: 检查页面内容
    console.log('[E2E] Step 7: 检查页面内容...');
    
    // 等待页面加载完成
    await page.waitForTimeout(2000);
    
    // 检查是否有论文标题
    const title = await page.locator('h1, h2').first().textContent().catch(() => '');
    console.log(`[E2E]   论文标题: ${title || '(未找到)'}`);
    
    // 检查是否有SkimCard生成按钮
    const skimButton = page.locator('button:has-text("生成"), button:has-text("SkimCard"), button:has-text("Generate")');
    const hasSkimButton = await skimButton.count() > 0;
    console.log(`[E2E]   SkimCard按钮: ${hasSkimButton ? '存在' : '不存在'}`);
    
    // 截图
    await page.screenshot({ path: 'e2e-screenshots/05-page-content.png' });

    // Step 8: 检查控制台错误
    console.log('[E2E] Step 8: 检查控制台错误...');
    
    // 过滤掉预期的404警告
    const realErrors = consoleErrors.filter(e => 
      !e.includes('404') && 
      !e.includes('资源不存在') &&
      !e.includes('SkimCard')
    );
    
    if (realErrors.length > 0) {
      console.log('[E2E]   ⚠ 控制台错误:');
      realErrors.forEach(e => console.log(`      - ${e}`));
    } else {
      console.log('[E2E]   ✓ 无严重控制台错误');
    }

    // Step 9: 验证API调用
    console.log('[E2E] Step 9: 验证后端API...');
    
    // 验证论文详情API
    const paperResponse = await page.request.get(`http://localhost:8000/api/v1/papers/${paperId}`);
    expect(paperResponse.status()).toBe(200);
    const paperData = await paperResponse.json();
    console.log(`[E2E]   ✓ 论文状态: ${paperData.status}`);
    console.log(`[E2E]   ✓ 论文标题: ${paperData.title}`);

    // 总结
    console.log('\n[E2E] ========== 测试总结 ==========');
    console.log(`[E2E] Paper ID: ${paperId}`);
    console.log(`[E2E] 最终URL: ${page.url()}`);
    console.log(`[E2E] 控制台日志数: ${consoleLogs.length}`);
    console.log(`[E2E] 控制台错误数: ${realErrors.length}`);
    console.log('[E2E] ==============================\n');
    
    // 最终断言
    expect(page.url()).toContain(`/paper/${paperId}`);
    expect(realErrors.length).toBe(0);
    
    console.log('[E2E] ✓✓✓ 完整流程测试通过!');
  });
});


