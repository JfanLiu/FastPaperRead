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
  MethodFlowResult,
  ExperimentSetupResult,
  EvidenceLedger,
  Claim,
  ChatMessage,
  ChatMode,
  ChatHistory,
  QuoteSnippet,
  SectionSummaryLeveled,
  PaperCardFull,
  TeachingSkimPack,
  // 新增统一包类型
  SkimPack,
  SkimPackRequest,
  SkimPackResponse,
  DeepPack,
  DeepPackRequest,
  DeepPackResponse,
  BatchSectionSummaryRequest,
  BatchSectionSummaryResponse,
} from '@/types';
import { apiLogger } from './logger';

// API基础配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const BACKEND_BASE_URL = API_BASE_URL.replace('/api/v1', '');

// 导出用于构建资源URL的辅助函数
export const getApiUrl = (path: string) => `${API_BASE_URL}${path}`;
export const getPdfUrl = (paperId: string) => `${API_BASE_URL}/papers/${paperId}/pdf`;
// 获取静态资源URL（图片等）
export const getStaticUrl = (path: string) => {
  if (!path) return '';
  // 如果已经是完整URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  // 拼接后端基础URL
  return `${BACKEND_BASE_URL}${path}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加日志
api.interceptors.request.use(
  (config) => {
    apiLogger.info(`[REQ] ${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      data: config.data instanceof FormData ? '(FormData)' : config.data
    });
    return config;
  },
  (error) => {
    apiLogger.error('[REQ ERROR]', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 添加日志
api.interceptors.response.use(
  (response) => {
    apiLogger.info(`[RES] ${response.status} ${response.config.url}`, {
      data: response.data
    });
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    
    // 404 是预期的（资源不存在），使用 warn 而不是 error
    if (status === 404) {
      apiLogger.warn(`[RES] 404 ${url} (资源不存在)`);
    } else {
      apiLogger.error(`[RES ERROR] ${status || 'NETWORK'} ${url}`, {
        message: error.message,
        response: error.response?.data
      });
    }
    return Promise.reject(error);
  }
);

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

  // 获取导入状态 (使用paper_id而非job_id)
  getImportStatus: async (paperId: string): Promise<ImportJobStatus> => {
    const res = await api.get(`/papers/${paperId}/import-status`);
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
    const res = await api.post(`/skim/${paperId}/generate?force=${forceRegenerate}`);
    // 后端返回 { skim_card: {...}, cached: bool }
    return res.data.skim_card;
  },

  // 获取SkimCard
  get: async (paperId: string): Promise<SkimCard> => {
    const res = await api.get(`/skim/${paperId}`);
    // 后端返回 { skim_card: {...} }
    return res.data.skim_card;
  },

  // 做出阅读决策
  makeDecision: async (data: SkimDecisionRequest) => {
    const res = await api.post(`/skim/${data.paper_id}/decision`, data);
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

  // 提取方法流程
  extractMethodFlow: async (paperId: string): Promise<{ method_flow: MethodFlowResult; cached: boolean }> => {
    const res = await api.post(`/enhance/method-flow/${paperId}`);
    return res.data;
  },

  // 提取实验设置
  extractExperimentSetup: async (paperId: string): Promise<{ experiment_setup: ExperimentSetupResult; cached: boolean }> => {
    const res = await api.post(`/enhance/experiment-setup/${paperId}`);
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

// ============================================
// 复现清单 API
// ============================================

export const checklistApi = {
  // 获取清单模板
  getTemplates: async () => {
    const res = await api.get('/checklist/templates');
    return res.data;
  },

  // 生成清单
  generate: async (paperId: string, templateId: string = 'ml_reproducibility') => {
    const res = await api.post(`/checklist/${paperId}/generate`, null, {
      params: { template_id: templateId }
    });
    return res.data;
  },

  // 获取清单
  get: async (paperId: string) => {
    const res = await api.get(`/checklist/${paperId}`);
    return res.data;
  },

  // 更新清单项
  updateItem: async (paperId: string, itemId: string, data: {
    found?: boolean;
    note?: string;
    inferred_value?: string;
  }) => {
    const res = await api.put(`/checklist/${paperId}/item/${itemId}`, null, { params: data });
    return res.data;
  },

  // 设置判定
  setVerdict: async (paperId: string, verdict: string) => {
    const res = await api.post(`/checklist/${paperId}/verdict`, null, { params: { verdict } });
    return res.data;
  },
};

// ============================================
// 对比 API
// ============================================

export const compareApi = {
  // 创建对比集合
  createSet: async (name: string, paperIds: string[]) => {
    const res = await api.post('/compare/sets', { name, paper_ids: paperIds });
    return res.data;
  },

  // 获取对比集合列表
  listSets: async (skip: number = 0, limit: number = 20) => {
    const res = await api.get('/compare/sets', { params: { skip, limit } });
    return res.data;
  },

  // 获取对比集合
  getSet: async (setId: string) => {
    const res = await api.get(`/compare/sets/${setId}`);
    return res.data;
  },

  // 删除对比集合
  deleteSet: async (setId: string) => {
    const res = await api.delete(`/compare/sets/${setId}`);
    return res.data;
  },

  // 生成对比矩阵
  generateMatrix: async (setId: string, dimensions?: string[]) => {
    const res = await api.post(`/compare/sets/${setId}/matrix`, { dimensions });
    return res.data;
  },

  // 快速对比
  quickCompare: async (paperIds: string[], dimensions?: string[]) => {
    const res = await api.post('/compare/quick-compare', null, {
      params: { paper_ids: paperIds, dimensions }
    });
    return res.data;
  },
};

// ============================================
// 审稿 API
// ============================================

export const reviewApi = {
  // 生成审稿草稿
  generateDraft: async (paperId: string) => {
    const res = await api.post(`/review/${paperId}/draft`);
    return res.data;
  },

  // 获取审稿草稿
  getDraft: async (paperId: string) => {
    const res = await api.get(`/review/${paperId}/draft`);
    return res.data;
  },

  // 提交审稿反馈
  submitFeedback: async (paperId: string, feedback: {
    novelty_score: number;
    novelty_reason: string;
    soundness_score: number;
    soundness_reason: string;
    clarity_score: number;
    clarity_reason: string;
    significance_score: number;
    significance_reason: string;
    reproducibility_score: number;
    reproducibility_reason: string;
    overall_recommendation: string;
    questions: string[];
    minor_issues: string[];
  }) => {
    const res = await api.post(`/review/${paperId}/feedback`, feedback);
    return res.data;
  },

  // 导出审稿意见
  exportReview: async (paperId: string, format: string = 'markdown') => {
    const res = await api.get(`/review/${paperId}/export-review`, { params: { format } });
    return res.data;
  },

  // 获取评分标准
  getRubric: async (paperId: string) => {
    const res = await api.get(`/review/${paperId}/rubric`);
    return res.data;
  },

  // 获取审稿列表
  list: async (skip: number = 0, limit: number = 20) => {
    const res = await api.get('/review/list', { params: { skip, limit } });
    return res.data;
  },
};

// ============================================
// Evidence Ledger API
// ============================================

export const evidenceLedgerApi = {
  // 生成证据台账
  generate: async (paperId: string, force: boolean = false): Promise<{ evidence_ledger: EvidenceLedger; cached: boolean }> => {
    const res = await api.post(`/evidence-ledger/${paperId}/generate`, null, { params: { force } });
    return res.data;
  },

  // 获取证据台账
  get: async (paperId: string): Promise<{ evidence_ledger: EvidenceLedger | null }> => {
    const res = await api.get(`/evidence-ledger/${paperId}`);
    return res.data;
  },

  // 更新证据台账
  update: async (paperId: string, data: EvidenceLedger): Promise<{ evidence_ledger: EvidenceLedger }> => {
    const res = await api.put(`/evidence-ledger/${paperId}`, data);
    return res.data;
  },

  // 更新单条主张
  updateClaim: async (paperId: string, claimId: string, updates: Partial<Claim>): Promise<{ claim: Claim }> => {
    const res = await api.put(`/evidence-ledger/${paperId}/claim`, { claim_id: claimId, ...updates });
    return res.data;
  },

  // 添加主张
  addClaim: async (paperId: string, text: string, evidenceAnchors: string[] = [], strength: string = 'medium'): Promise<{ claim: Claim }> => {
    const res = await api.post(`/evidence-ledger/${paperId}/claim`, {
      text,
      evidence_anchors: evidenceAnchors,
      strength
    });
    return res.data;
  },

  // 删除主张
  deleteClaim: async (paperId: string, claimId: string): Promise<void> => {
    await api.delete(`/evidence-ledger/${paperId}/claim/${claimId}`);
  },

  // 主张转卡片
  claimToCard: async (paperId: string, claimId: string): Promise<{ card_data: Partial<Card> }> => {
    const res = await api.post(`/evidence-ledger/${paperId}/to-card`, { claim_id: claimId });
    return res.data;
  },
};

// ============================================
// Chat API
// ============================================

export const chatApi = {
  // 发送消息
  sendMessage: async (
    paperId: string,
    message: string,
    mode: ChatMode = 'seminar',
    context?: string,
    contextAnchors: string[] = []
  ): Promise<{ message: ChatMessage; mode: ChatMode }> => {
    const res = await api.post(`/chat/${paperId}`, {
      message,
      mode,
      context,
      context_anchors: contextAnchors
    });
    return res.data;
  },

  // 获取聊天历史
  getHistory: async (paperId: string, limit: number = 50): Promise<{ history: ChatHistory }> => {
    const res = await api.get(`/chat/${paperId}/history`, { params: { limit } });
    return res.data;
  },

  // 清空聊天历史
  clearHistory: async (paperId: string): Promise<void> => {
    await api.delete(`/chat/${paperId}/history`);
  },

  // 切换模式
  switchMode: async (paperId: string, mode: ChatMode): Promise<{ mode: ChatMode; description: string }> => {
    const res = await api.put(`/chat/${paperId}/mode`, null, { params: { mode } });
    return res.data;
  },
};

// ============================================
// 扩展增强 API
// ============================================

export const enhanceApiExtended = {
  // 生成引用骨架
  generateQuoteSnippet: async (
    paperId: string,
    selectedText: string,
    anchorId?: string
  ): Promise<{ quote_snippet: QuoteSnippet }> => {
    const res = await api.post('/enhance/quote-snippet', {
      paper_id: paperId,
      selected_text: selectedText,
      anchor_id: anchorId
    });
    return res.data;
  },

  // 生成三层摘要
  generateSectionSummaryLeveled: async (
    sectionTitle: string,
    content: string,
    level: 'one_liner' | 'plain' | 'strict' = 'plain'
  ): Promise<{ summary: string; level: string; all_levels: SectionSummaryLeveled }> => {
    const res = await api.post('/enhance/section-summary-leveled', {
      section_title: sectionTitle,
      content,
      level
    });
    return res.data;
  },

  // 生成完整 PaperCard
  generatePaperCardFull: async (paperId: string): Promise<{ paper_card: PaperCardFull }> => {
    const res = await api.post(`/enhance/generate-paper-card/${paperId}`);
    return res.data;
  },

  // 生成教学粗读（结构化带读）
  generateTeachingSkim: async (payload: {
    paper_id: string;
    route_scope: { type: 'route' | 'full'; sections: string[] };
    paper_meta: Record<string, unknown>;
    skim_card: Record<string, unknown>;
    key_figures: Record<string, unknown>[];
    section_summaries: Record<string, unknown>;
    evidence_anchor_candidates: {
      anchor_id: string;
      type?: string;
      section?: string;
      page?: number;
      snippet?: string;
    }[];
  }): Promise<{ teaching_skim: TeachingSkimPack }> => {
    const res = await api.post('/enhance/teaching-skim', payload);
    return res.data;
  },

  // ===== 统一粗读包 =====
  // 一次生成完整粗读材料（skim_card + key_figures + teaching_skim）
  generateSkimPack: async (
    paperId: string,
    request: SkimPackRequest
  ): Promise<SkimPackResponse> => {
    const res = await api.post(`/enhance/skim-pack/${paperId}`, request);
    return res.data;
  },

  // ===== 统一精读包 =====
  // 一次生成完整精读材料（paper_card + evidence_ledger + method_flow + experiment_setup + section_summaries）
  generateDeepPack: async (
    paperId: string,
    request: DeepPackRequest
  ): Promise<DeepPackResponse> => {
    const res = await api.post(`/enhance/deep-pack/${paperId}`, request);
    return res.data;
  },

  // ===== 批量章节摘要 =====
  // 一次生成所有章节的三层摘要
  generateBatchSectionSummary: async (
    request: BatchSectionSummaryRequest
  ): Promise<BatchSectionSummaryResponse> => {
    const res = await api.post('/enhance/batch-section-summary', request);
    return res.data;
  },
};

// ============================================
// Annotations API (PDF批注/高亮)
// ============================================

import type { Annotation, AnnotationType, HighlightColor, AnnotationRect } from '@/types';

export const annotationsApi = {
  // 获取论文的所有批注
  getAll: async (paperId: string): Promise<{ annotations: Annotation[]; count: number }> => {
    const res = await api.get(`/annotations/${paperId}`);
    return res.data;
  },

  // 创建批注/高亮
  create: async (
    paperId: string,
    data: {
      type: AnnotationType;
      page: number;
      text?: string;
      note?: string;
      color?: HighlightColor;
      rect: AnnotationRect;
    }
  ): Promise<{ annotation: Annotation }> => {
    const res = await api.post(`/annotations/${paperId}`, data);
    return res.data;
  },

  // 更新批注
  update: async (
    paperId: string,
    annotationId: string,
    data: { note?: string; color?: HighlightColor }
  ): Promise<void> => {
    await api.put(`/annotations/${paperId}/${annotationId}`, data);
  },

  // 删除批注
  delete: async (paperId: string, annotationId: string): Promise<void> => {
    await api.delete(`/annotations/${paperId}/${annotationId}`);
  },

  // 清除批注
  clear: async (paperId: string, page?: number): Promise<void> => {
    const params = page !== undefined ? { page } : {};
    await api.delete(`/annotations/${paperId}`, { params });
  },
};

export default api;

