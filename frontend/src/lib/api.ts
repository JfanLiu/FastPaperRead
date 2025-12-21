import axios from 'axios';
import type {
  Paper,
  PaperImportRequest,
  PaperImportResponse,
  ImportJobStatus,
  Anchor,
  SectionTree,
  SkimCard,
  SkimDecisionRequest,
  Card,
  EnhanceRequest,
  EnhanceResponse,
  PaginatedResponse,
} from '@/types';

// API基础配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// 论文 API
// ============================================

export const paperApi = {
  // 导入论文
  import: async (data: PaperImportRequest): Promise<PaperImportResponse> => {
    const res = await api.post('/papers/import', data);
    return res.data;
  },

  // 上传PDF
  upload: async (file: File): Promise<PaperImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/papers/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // 获取导入状态
  getImportStatus: async (jobId: string): Promise<ImportJobStatus> => {
    const res = await api.get(`/papers/import/${jobId}/status`);
    return res.data;
  },

  // 获取论文列表
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    quality?: string;
    search?: string;
  }): Promise<PaginatedResponse<Paper>> => {
    const res = await api.get('/papers', { params });
    return res.data;
  },

  // 获取论文详情
  get: async (paperId: string): Promise<Paper> => {
    const res = await api.get(`/papers/${paperId}`);
    return res.data;
  },

  // 更新论文
  update: async (paperId: string, data: Partial<Paper>): Promise<Paper> => {
    const res = await api.put(`/papers/${paperId}`, data);
    return res.data;
  },

  // 删除论文
  delete: async (paperId: string): Promise<void> => {
    await api.delete(`/papers/${paperId}`);
  },

  // 获取统计
  getStats: async () => {
    const res = await api.get('/papers/stats/overview');
    return res.data;
  },
};

// ============================================
// 锚点 API
// ============================================

export const anchorApi = {
  // 获取论文锚点
  getByPaper: async (paperId: string, params?: {
    type?: string;
    page?: number;
  }): Promise<{ items: Anchor[]; total: number; by_type: Record<string, number> }> => {
    const res = await api.get(`/anchors/paper/${paperId}`, { params });
    return res.data;
  },

  // 获取章节树
  getSectionTree: async (paperId: string): Promise<SectionTree> => {
    const res = await api.get(`/anchors/paper/${paperId}/sections`);
    return res.data;
  },

  // 获取阅读路线
  getReadingRoute: async (paperId: string, routeName: string) => {
    const res = await api.get(`/anchors/paper/${paperId}/routes/${routeName}`);
    return res.data;
  },

  // 获取单个锚点
  get: async (anchorId: string): Promise<Anchor> => {
    const res = await api.get(`/anchors/${anchorId}`);
    return res.data;
  },

  // 标记已读
  markRead: async (anchorId: string, isRead: boolean = true): Promise<void> => {
    await api.put(`/anchors/${anchorId}/read`, null, { params: { is_read: isRead } });
  },
};

// ============================================
// 粗读 API
// ============================================

export const skimApi = {
  // 生成SkimCard
  generate: async (paperId: string, forceRegenerate: boolean = false): Promise<SkimCard> => {
    const res = await api.post('/skim/generate', {
      paper_id: paperId,
      force_regenerate: forceRegenerate,
    });
    return res.data;
  },

  // 获取SkimCard
  get: async (paperId: string): Promise<SkimCard> => {
    const res = await api.get(`/skim/${paperId}`);
    return res.data;
  },

  // 做出阅读决策
  makeDecision: async (data: SkimDecisionRequest) => {
    const res = await api.post('/skim/decision', data);
    return res.data;
  },

  // 获取关键图表
  getKeyFigures: async (paperId: string, limit: number = 5) => {
    const res = await api.get(`/skim/${paperId}/key-figures`, { params: { limit } });
    return res.data;
  },

  // 获取待读队列
  getQueue: async () => {
    const res = await api.get('/skim/queue');
    return res.data;
  },

  // 从队列移除
  removeFromQueue: async (paperId: string) => {
    await api.delete(`/skim/queue/${paperId}`);
  },
};

// ============================================
// 卡片 API
// ============================================

export const cardApi = {
  // 创建卡片
  create: async (data: Partial<Card>): Promise<Card> => {
    const res = await api.post('/cards', data);
    return res.data;
  },

  // 从锚点创建卡片
  createFromAnchor: async (anchorId: string, cardType: string, autoGenerate: boolean = true): Promise<Card> => {
    const res = await api.post('/cards/from-anchor', {
      anchor_id: anchorId,
      card_type: cardType,
      auto_generate: autoGenerate,
    });
    return res.data;
  },

  // 获取论文卡片
  getByPaper: async (paperId: string, type?: string): Promise<{ items: Card[]; total: number }> => {
    const res = await api.get(`/cards/paper/${paperId}`, { params: { type } });
    return res.data;
  },

  // 获取卡片详情
  get: async (cardId: string): Promise<Card> => {
    const res = await api.get(`/cards/${cardId}`);
    return res.data;
  },

  // 更新卡片
  update: async (cardId: string, data: Partial<Card>): Promise<Card> => {
    const res = await api.put(`/cards/${cardId}`, data);
    return res.data;
  },

  // 删除卡片
  delete: async (cardId: string): Promise<void> => {
    await api.delete(`/cards/${cardId}`);
  },

  // 定稿
  finalize: async (cardId: string): Promise<void> => {
    await api.put(`/cards/${cardId}/finalize`);
  },

  // 搜索卡片
  search: async (params: {
    query: string;
    types?: string[];
    tags?: string[];
    limit?: number;
    offset?: number;
  }) => {
    const res = await api.post('/cards/search', params);
    return res.data;
  },
};

// ============================================
// 增强引擎 API
// ============================================

export const enhanceApi = {
  // 增强内容
  enhance: async (data: EnhanceRequest): Promise<EnhanceResponse> => {
    const res = await api.post('/enhance', data);
    return res.data;
  },

  // 批量增强
  batchEnhance: async (paperId: string, items: Array<{ anchor_id: string; enhance_type: string; level?: string }>) => {
    const res = await api.post('/enhance/batch', { paper_id: paperId, items });
    return res.data;
  },

  // 扫描缺失细节
  scanMissingDetails: async (paperId: string, categories?: string[]) => {
    const res = await api.post('/enhance/missing-details/scan', {
      paper_id: paperId,
      categories,
      full_scan: true,
    });
    return res.data;
  },
};

// ============================================
// 导出 API
// ============================================

export const exportApi = {
  // 导出内容
  export: async (objectType: string, objectIds: string[], format: string = 'markdown') => {
    const res = await api.post('/export', {
      object_type: objectType,
      object_ids: objectIds,
      format,
      include_sources: true,
    });
    return res.data;
  },

  // 导出BibTeX
  exportBibtex: async (paperId: string) => {
    const res = await api.get(`/export/paper/${paperId}/bibtex`);
    return res.data;
  },

  // 导出论文笔记
  exportNotes: async (paperId: string, format: string = 'markdown') => {
    const res = await api.get(`/export/paper/${paperId}/notes`, { params: { format } });
    return res.data;
  },
};

export default api;

