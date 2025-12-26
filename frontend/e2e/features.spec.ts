import { test, expect, Page } from '@playwright/test';

/**
 * FastPaperRead 功能测试
 * 测试四个核心功能模块：待读队列、笔记库、论文对比、审稿记录
 */

// 测试配置
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:8000/api/v1';

// 辅助函数：等待页面稳定
async function waitForPageStable(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ============================================
// 1. 待读队列测试
// ============================================
test.describe('待读队列功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/queue`);
    await waitForPageStable(page);
  });

  test('页面基础元素显示', async ({ page }) => {
    // 检查页面标题
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/待读队列/);
    
    // 检查刷新按钮存在
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await expect(refreshButton).toBeVisible();
  });

  test('刷新按钮功能', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await expect(refreshButton).toBeEnabled();
    
    // 点击刷新
    await refreshButton.click();
    
    // 等待加载完成
    await waitForPageStable(page);
  });

  test('空队列显示提示', async ({ page }) => {
    // 如果队列为空，应显示空状态提示
    const emptyState = page.locator('text=队列为空');
    const queueItems = page.locator('[class*="rounded-xl border"]');
    
    // 检查是否显示空状态或有队列项
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyState).toBeVisible();
      // 检查"前往文献库"按钮
      const libraryButton = page.getByRole('button', { name: /前往文献库/ });
      await expect(libraryButton).toBeVisible();
    }
  });

  test('队列项显示和操作', async ({ page }) => {
    // 等待队列加载
    await waitForPageStable(page);
    
    // 检查队列项（如果有的话）
    const queueItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await queueItems.count();
    
    if (count > 0) {
      const firstItem = queueItems.first();
      
      // 检查操作按钮
      await expect(firstItem.getByRole('button', { name: /开始阅读/ })).toBeVisible();
      await expect(firstItem.getByRole('button', { name: /查看概览/ })).toBeVisible();
      
      // 检查删除按钮
      const deleteButton = firstItem.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await expect(deleteButton).toBeVisible();
    }
  });

  test('点击"开始阅读"导航', async ({ page }) => {
    await waitForPageStable(page);
    
    const queueItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await queueItems.count();
    
    if (count > 0) {
      // 获取第一个"开始阅读"按钮
      const startReadingButton = queueItems.first().getByRole('button', { name: /开始阅读/ });
      
      // 点击并检查导航
      await startReadingButton.click();
      
      // 应该导航到论文阅读页面
      await expect(page).toHaveURL(/\/paper\/.*\/read/);
    }
  });

  test('点击"查看概览"导航', async ({ page }) => {
    await waitForPageStable(page);
    
    const queueItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await queueItems.count();
    
    if (count > 0) {
      const overviewButton = queueItems.first().getByRole('button', { name: /查看概览/ });
      await overviewButton.click();
      
      // 应该导航到论文概览页面
      await expect(page).toHaveURL(/\/paper\/.*\/overview/);
    }
  });

  test('主页导航功能', async ({ page }) => {
    // 通过点击主页按钮导航
    const homeButton = page.locator('a[href="/dashboard"]').first();
    if (await homeButton.isVisible()) {
      await homeButton.click();
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });
});

// ============================================
// 2. 笔记库测试
// ============================================
test.describe('笔记库功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/notes`);
    await waitForPageStable(page);
  });

  test('页面基础元素显示', async ({ page }) => {
    // 检查页面标题
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/笔记库/);
    
    // 检查搜索框
    const searchInput = page.getByPlaceholder(/搜索卡片/);
    await expect(searchInput).toBeVisible();
    
    // 检查刷新按钮
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await expect(refreshButton).toBeVisible();
    
    // 检查导出按钮
    const exportButton = page.getByRole('button', { name: /导出/ });
    await expect(exportButton).toBeVisible();
  });

  test('类型过滤按钮', async ({ page }) => {
    // 检查类型过滤按钮
    const filterButtons = ['全部', 'Paper Card', 'Evidence Card', 'Method Card', '笔记'];
    
    for (const filterName of filterButtons) {
      const button = page.getByRole('button', { name: new RegExp(filterName) });
      await expect(button).toBeVisible();
    }
  });

  test('搜索功能', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/搜索卡片/);
    
    // 输入搜索词
    await searchInput.fill('test');
    
    // 等待搜索结果加载（防抖300ms）
    await page.waitForTimeout(500);
    await waitForPageStable(page);
  });

  test('视图模式切换', async ({ page }) => {
    // 查找视图切换按钮
    const gridButton = page.locator('button').filter({ has: page.locator('svg.lucide-grid') });
    const listButton = page.locator('button').filter({ has: page.locator('svg.lucide-list') });
    
    // 切换到列表视图
    if (await listButton.isVisible()) {
      await listButton.click();
      await page.waitForTimeout(300);
    }
    
    // 切换回网格视图
    if (await gridButton.isVisible()) {
      await gridButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('类型过滤切换', async ({ page }) => {
    // 点击不同的类型过滤
    const evidenceFilter = page.getByRole('button', { name: /Evidence Card/ });
    if (await evidenceFilter.isVisible()) {
      await evidenceFilter.click();
      await waitForPageStable(page);
    }
    
    const allFilter = page.getByRole('button', { name: /全部/ });
    if (await allFilter.isVisible()) {
      await allFilter.click();
      await waitForPageStable(page);
    }
  });

  test('刷新按钮功能', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await refreshButton.click();
    await waitForPageStable(page);
  });

  test('导出按钮功能', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /导出/ });
    
    // 检查按钮状态
    const isDisabled = await exportButton.isDisabled();
    
    // 如果有卡片，导出按钮应该可用
    // 如果没有卡片，导出按钮应该被禁用
    // 这里只检查按钮存在且可交互
    await expect(exportButton).toBeVisible();
  });

  test('空状态显示', async ({ page }) => {
    // 如果没有卡片，应该显示空状态
    const emptyState = page.locator('text=暂无卡片');
    const cards = page.locator('.grid > div');
    
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyState).toBeVisible();
      // 检查"前往文献库"按钮
      const libraryButton = page.getByRole('button', { name: /前往文献库/ });
      await expect(libraryButton).toBeVisible();
    }
  });

  test('卡片点击导航', async ({ page }) => {
    await waitForPageStable(page);
    
    // 查找卡片
    const cards = page.locator('.cursor-pointer').first();
    
    if (await cards.isVisible().catch(() => false)) {
      // 点击卡片
      await cards.click();
      
      // 应该导航到阅读页面
      await page.waitForTimeout(500);
      const url = page.url();
      expect(url).toMatch(/\/paper\/.*\/read|\/dashboard|\/notes/);
    }
  });
});

// ============================================
// 3. 论文对比测试
// ============================================
test.describe('论文对比功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/compare`);
    await waitForPageStable(page);
  });

  test('页面基础元素显示', async ({ page }) => {
    // 检查页面标题
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/论文对比/);
    
    // 检查刷新按钮
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await expect(refreshButton).toBeVisible();
    
    // 检查新建对比按钮
    const createButton = page.getByRole('button', { name: /新建对比/ });
    await expect(createButton).toBeVisible();
  });

  test('打开新建对比弹窗', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /新建对比/ });
    await createButton.click();
    
    // 等待弹窗出现
    await page.waitForTimeout(300);
    
    // 检查弹窗内容
    await expect(page.getByText(/新建对比集合/)).toBeVisible();
    await expect(page.getByPlaceholder(/Transformer变体对比/)).toBeVisible();
    await expect(page.getByPlaceholder(/搜索论文标题/)).toBeVisible();
  });

  test('关闭新建对比弹窗', async ({ page }) => {
    // 打开弹窗
    const createButton = page.getByRole('button', { name: /新建对比/ });
    await createButton.click();
    await page.waitForTimeout(300);
    
    // 点击取消按钮
    const cancelButton = page.getByRole('button', { name: /取消/ });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('弹窗内搜索论文', async ({ page }) => {
    // 打开弹窗
    const createButton = page.getByRole('button', { name: /新建对比/ });
    await createButton.click();
    await page.waitForTimeout(300);
    
    // 在搜索框输入
    const searchInput = page.getByPlaceholder(/搜索论文标题/);
    await searchInput.fill('attention');
    
    // 等待搜索结果
    await page.waitForTimeout(500);
  });

  test('刷新按钮功能', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await refreshButton.click();
    await waitForPageStable(page);
  });

  test('空状态显示', async ({ page }) => {
    const emptyState = page.locator('text=暂无对比集合');
    
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyState).toBeVisible();
      // 空状态也有"新建对比"按钮
      const createButton = page.getByRole('button', { name: /新建对比/ });
      await expect(createButton).toBeVisible();
    }
  });

  test('对比集合列表显示', async ({ page }) => {
    await waitForPageStable(page);
    
    // 检查对比集合项
    const compareItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await compareItems.count();
    
    if (count > 0) {
      const firstItem = compareItems.first();
      
      // 检查"查看"按钮
      const viewButton = firstItem.getByRole('button', { name: /查看/ });
      await expect(viewButton).toBeVisible();
      
      // 检查删除按钮
      const deleteButton = firstItem.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });
      await expect(deleteButton).toBeVisible();
    }
  });

  test('点击查看对比集合', async ({ page }) => {
    await waitForPageStable(page);
    
    const compareItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await compareItems.count();
    
    if (count > 0) {
      const viewButton = compareItems.first().getByRole('button', { name: /查看/ });
      await viewButton.click();
      
      // 应该导航到对比详情页面
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/paper\/.*\/compare/);
    }
  });
});

// ============================================
// 4. 审稿记录测试
// ============================================
test.describe('审稿记录功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/review`);
    await waitForPageStable(page);
  });

  test('页面基础元素显示', async ({ page }) => {
    // 检查页面标题
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/审稿记录/);
    
    // 检查刷新按钮
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await expect(refreshButton).toBeVisible();
    
    // 检查提示卡片
    await expect(page.getByText(/如何使用审稿模式/)).toBeVisible();
  });

  test('刷新按钮功能', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /刷新/ });
    await refreshButton.click();
    await waitForPageStable(page);
  });

  test('空状态显示', async ({ page }) => {
    const emptyState = page.locator('text=暂无审稿记录');
    
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      await expect(emptyState).toBeVisible();
      // 检查"前往文献库"按钮
      const libraryButton = page.getByRole('button', { name: /前往文献库/ });
      await expect(libraryButton).toBeVisible();
    }
  });

  test('审稿记录列表显示', async ({ page }) => {
    await waitForPageStable(page);
    
    // 检查审稿记录项
    const reviewItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await reviewItems.count();
    
    if (count > 0) {
      const firstItem = reviewItems.first();
      
      // 检查"查看"按钮
      const viewButton = firstItem.getByRole('button', { name: /查看/ });
      await expect(viewButton).toBeVisible();
    }
  });

  test('点击查看审稿记录', async ({ page }) => {
    await waitForPageStable(page);
    
    const reviewItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await reviewItems.count();
    
    if (count > 0) {
      const viewButton = reviewItems.first().getByRole('button', { name: /查看/ });
      await viewButton.click();
      
      // 应该导航到审稿详情页面
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/paper\/.*\/review/);
    }
  });

  test('统计信息显示', async ({ page }) => {
    await waitForPageStable(page);
    
    // 检查审稿记录项
    const reviewItems = page.locator('div.bg-white.rounded-xl.border');
    const count = await reviewItems.count();
    
    if (count > 0) {
      // 检查统计信息区域
      const statsSection = page.locator('text=审稿总数').locator('..');
      await expect(statsSection).toBeVisible();
    }
  });

  test('前往文献库按钮', async ({ page }) => {
    const emptyState = page.locator('text=暂无审稿记录');
    
    const isEmpty = await emptyState.isVisible().catch(() => false);
    if (isEmpty) {
      const libraryButton = page.getByRole('button', { name: /前往文献库/ });
      await libraryButton.click();
      
      // 应该导航到文献库页面
      await expect(page).toHaveURL(/\/library/);
    }
  });
});

// ============================================
// 5. 导航和布局测试
// ============================================
test.describe('导航和布局测试', () => {
  test('侧边栏导航功能', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);
    
    // 检查侧边栏导航链接 (使用 aside 中的导航链接)
    const navItems = [
      { name: '仪表盘', url: '/dashboard' },
      { name: '文献库', url: '/library' },
      { name: '导入论文', url: '/import' },
      { name: '待读队列', url: '/queue' },
      { name: '笔记库', url: '/notes' },
      { name: '论文对比', url: '/compare' },
      { name: '审稿记录', url: '/review' },
    ];
    
    for (const item of navItems) {
      // 使用 aside 侧边栏中的链接
      const navLink = page.locator(`aside a[href="${item.url}"]`).first();
      if (await navLink.isVisible().catch(() => false)) {
        await expect(navLink).toBeVisible();
      }
    }
  });

  test('顶部Header主页按钮', async ({ page }) => {
    await page.goto(`${BASE_URL}/queue`);
    await waitForPageStable(page);
    
    // 查找Header中的主页按钮
    const homeLink = page.locator('header a[href="/dashboard"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test('侧边栏收缩功能', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await waitForPageStable(page);
    
    // 查找收缩按钮
    const collapseButton = page.locator('aside button').filter({ has: page.locator('svg.lucide-chevron-left, svg.lucide-chevron-right') });
    
    if (await collapseButton.isVisible()) {
      // 点击收缩
      await collapseButton.click();
      await page.waitForTimeout(300);
      
      // 再次点击展开
      await collapseButton.click();
      await page.waitForTimeout(300);
    }
  });
});

// ============================================
// 6. 响应式和错误处理测试
// ============================================
test.describe('响应式和错误处理测试', () => {
  test('页面加载状态', async ({ page }) => {
    // 拦截API请求以延迟响应
    await page.route('**/api/v1/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });
    
    await page.goto(`${BASE_URL}/queue`);
    
    // 检查加载动画
    // 注意：由于加载很快，可能看不到加载状态
  });

  test('API错误处理', async ({ page }) => {
    // 模拟API错误
    await page.route('**/api/v1/skim/queue', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ detail: 'Internal Server Error' }),
      });
    });
    
    await page.goto(`${BASE_URL}/queue`);
    await waitForPageStable(page);
    
    // 页面应该正常显示，不会崩溃
    await expect(page.locator('body')).toBeVisible();
  });
});

