'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Anchor, Paper, PaperCardFull, SectionSummaryLeveled, SkimCard as SkimCardType } from '@/types';
import { Button, Badge } from '@/components/common';
import { SkimCard } from '@/components/cards/SkimCard';
import { ChecklistPanel } from './ChecklistPanel';
import { EvidenceLedger } from './EvidenceLedger';
import { cardApi, checklistApi, enhanceApiExtended, evidenceLedgerApi, skimApi } from '@/lib/api';

type WorkspaceTab = 'skim' | 'deep';

interface MaterialsWorkspaceProps {
  paperId: string;
  paper: Paper;
  anchors: Anchor[];
  currentRoute?: string[];
  onOpenPdfAtAnchorId?: (anchorId: string) => void;
  className?: string;
}

type KeyFigureItem = {
  anchor_id: string;
  type: 'figure';
  page?: number;
  figure_number?: string;
  caption?: string;
  image_path?: string;
  section?: string;
};

type ChecklistItem = {
  id: string;
  group: 'data' | 'preprocess' | 'training' | 'eval' | 'env';
  text: string;
  source_anchor?: string;
  missing: boolean;
  needs_verify: boolean;
  value?: string;
};

function getSectionName(a: Anchor) {
  return a.text || a.section || '';
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

function buildSectionContent(params: { paper: Paper; anchors: Anchor[]; sectionName: string }) {
  const { paper, anchors, sectionName } = params;
  const sectionLower = normalizeName(sectionName);

  const parts: string[] = [];
  if (sectionLower.includes('abstract') && paper.abstract) {
    parts.push(paper.abstract);
  }

  anchors
    .filter(a => a.type !== 'section' && (a.section || '') === sectionName)
    .forEach(a => {
      const snippet = (a.caption || a.text || '').trim();
      if (snippet) parts.push(snippet);
    });

  const content = parts.join('\n');
  // 避免 token 爆炸，做一个保守截断（仍足够用于章节摘要）
  return content.length > 12000 ? content.slice(0, 12000) : content;
}

export function MaterialsWorkspace({
  paperId,
  paper,
  anchors,
  currentRoute = [],
  onOpenPdfAtAnchorId,
  className,
}: MaterialsWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>('skim');

  // ========= 粗读包（Skim Pack） =========
  const [skimCard, setSkimCard] = useState<SkimCardType | null>(null);
  const [skimLoading, setSkimLoading] = useState(false);
  const [keyFigures, setKeyFigures] = useState<KeyFigureItem[]>([]);
  const [figuresLoading, setFiguresLoading] = useState(false);
  const [skimError, setSkimError] = useState<string | null>(null);

  // ========= 精读包（Deep Pack） =========
  const [paperCard, setPaperCard] = useState<PaperCardFull | null>(null);
  const [paperCardLoading, setPaperCardLoading] = useState(false);
  const [paperCardSaving, setPaperCardSaving] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);

  // ========= 章节摘要（按路线范围） =========
  const sectionAnchors = useMemo(() => anchors.filter(a => a.type === 'section'), [anchors]);

  const sectionNameToAnchor = useMemo(() => {
    const map = new Map<string, Anchor>();
    for (const a of sectionAnchors) {
      const name = getSectionName(a);
      if (!name) continue;
      map.set(normalizeName(name), a);
    }
    return map;
  }, [sectionAnchors]);

  const scopedSections = useMemo(() => {
    if (!currentRoute || currentRoute.length === 0) {
      return sectionAnchors
        .map(a => getSectionName(a))
        .filter(Boolean);
    }
    // 路线包含全文子集：尽量按“名称精确匹配”选章节
    const want = currentRoute.map(normalizeName);
    const picked: string[] = [];
    for (const nameLower of want) {
      const a = sectionNameToAnchor.get(nameLower);
      if (a) picked.push(getSectionName(a));
    }
    // 若匹配不到，退化为全章节，避免空材料
    return picked.length > 0
      ? picked
      : sectionAnchors.map(a => getSectionName(a)).filter(Boolean);
  }, [currentRoute, sectionAnchors, sectionNameToAnchor]);

  const [sectionSummaries, setSectionSummaries] = useState<Record<string, SectionSummaryLeveled>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState<{ done: number; total: number; current?: string }>({ done: 0, total: 0 });
  const cancelSummariesRef = useRef(false);

  const loadExistingSkim = useCallback(async () => {
    try {
      const res = await skimApi.get(paperId);
      setSkimCard(res);
    } catch {
      // 未生成是正常的
    }
  }, [paperId]);

  const loadKeyFigures = useCallback(async () => {
    setFiguresLoading(true);
    try {
      const res = await skimApi.getKeyFigures(paperId, 6);
      setKeyFigures(res.figures || []);
    } catch (e) {
      console.error('加载关键图表失败:', e);
    } finally {
      setFiguresLoading(false);
    }
  }, [paperId]);

  const generateSkimPack = useCallback(async (force: boolean = false) => {
    setSkimError(null);
    setSkimLoading(true);
    try {
      const card = await skimApi.generate(paperId, force);
      setSkimCard(card);
      await loadKeyFigures();
    } catch (e) {
      console.error('生成粗读包失败:', e);
      setSkimError('生成粗读包失败，请重试');
    } finally {
      setSkimLoading(false);
    }
  }, [paperId, loadKeyFigures]);

  const generatePaperCard = useCallback(async () => {
    setDeepError(null);
    setPaperCardLoading(true);
    try {
      const res = await enhanceApiExtended.generatePaperCardFull(paperId);
      setPaperCard(res.paper_card);
    } catch (e) {
      console.error('生成 PaperCard 失败:', e);
      setDeepError('生成 PaperCard 失败，请重试');
    } finally {
      setPaperCardLoading(false);
    }
  }, [paperId]);

  const savePaperCardAsCard = useCallback(async () => {
    if (!paperCard) return;
    setPaperCardSaving(true);
    setDeepError(null);
    try {
      await cardApi.create({
        paper_id: paperId,
        type: 'paper',
        title: paperCard.one_line_summary,
        content: JSON.stringify(paperCard),
        tags: ['paper-card', 'auto-generated'],
        status: 'final',
      });
    } catch (e) {
      console.error('保存 PaperCard 失败:', e);
      setDeepError('保存失败，请重试');
    } finally {
      setPaperCardSaving(false);
    }
  }, [paperCard, paperId]);

  const loadChecklist = useCallback(async () => {
    try {
      const result = await checklistApi.get(paperId);
      if (result.items) {
        const items: ChecklistItem[] = result.items.map((item: { id: string; group: string; text: string; found: boolean; needs_verify: boolean; inferred_value?: string; source_anchor_id?: string }) => ({
          id: item.id,
          group: item.group as ChecklistItem['group'],
          text: item.text,
          missing: !item.found,
          needs_verify: item.needs_verify,
          source_anchor: item.source_anchor_id,
          value: item.inferred_value,
        }));
        setChecklistItems(items);
      }
    } catch {
      // 不存在是正常的
    }
  }, [paperId]);

  const generateChecklist = useCallback(async () => {
    setChecklistLoading(true);
    setDeepError(null);
    try {
      const result = await checklistApi.generate(paperId);
      if (result.items) {
        const items: ChecklistItem[] = result.items.map((item: { id: string; group: string; text: string; found: boolean; needs_verify: boolean; inferred_value?: string }) => ({
          id: item.id,
          group: item.group as ChecklistItem['group'],
          text: item.text,
          missing: !item.found,
          needs_verify: item.needs_verify,
          value: item.inferred_value,
        }));
        setChecklistItems(items);
      }
    } catch (e) {
      console.error('生成复现清单失败:', e);
      setDeepError('生成复现清单失败，请重试');
    } finally {
      setChecklistLoading(false);
    }
  }, [paperId]);

  const updateChecklistItem = useCallback(async (itemId: string, updates: Partial<ChecklistItem>) => {
    setChecklistItems(prev => prev.map(i => (i.id === itemId ? { ...i, ...updates } : i)));
    if (itemId.startsWith('checklist_')) return;
    try {
      await checklistApi.updateItem(paperId, itemId, {
        found: updates.missing === false,
        note: updates.value,
        inferred_value: updates.value,
      });
    } catch (e) {
      console.error('同步清单项失败:', e);
    }
  }, [paperId]);

  const deleteChecklistItem = useCallback((itemId: string) => {
    setChecklistItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const generateSectionSummaries = useCallback(async (level: 'one_liner' | 'plain' | 'strict') => {
    setSummaryLoading(true);
    setDeepError(null);
    setSkimError(null);
    cancelSummariesRef.current = false;

    const targets = scopedSections;
    setSummaryProgress({ done: 0, total: targets.length });

    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelSummariesRef.current) break;
        const sectionName = targets[i];
        setSummaryProgress({ done: i, total: targets.length, current: sectionName });

        const content = buildSectionContent({ paper, anchors, sectionName });
        if (!content.trim()) continue;

        const res = await enhanceApiExtended.generateSectionSummaryLeveled(sectionName, content, level);
        setSectionSummaries(prev => ({ ...prev, [sectionName]: res.all_levels }));
      }
    } catch (e) {
      console.error('生成章节摘要失败:', e);
      const msg = '生成章节摘要失败，请重试';
      if (tab === 'skim') setSkimError(msg);
      else setDeepError(msg);
    } finally {
      setSummaryLoading(false);
      setSummaryProgress(prev => ({ ...prev, done: prev.total, current: undefined }));
    }
  }, [anchors, paper, scopedSections, tab]);

  const cancelSectionSummaries = useCallback(() => {
    cancelSummariesRef.current = true;
  }, []);

  const generateDeepPack = useCallback(async () => {
    setDeepError(null);
    // 顺序执行：PaperCard -> Ledger -> Checklist -> Strict summaries（路线范围）
    await generatePaperCard();
    try {
      await evidenceLedgerApi.generate(paperId, false);
    } catch {
      // EvidenceLedger 组件内还能再点生成，这里不强依赖
    }
    await generateChecklist();
    await generateSectionSummaries('strict');
  }, [generateChecklist, generatePaperCard, generateSectionSummaries, paperId]);

  useEffect(() => {
    loadExistingSkim();
    loadChecklist();
    loadKeyFigures();
  }, [loadExistingSkim, loadChecklist, loadKeyFigures]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 顶部 Tabs */}
      <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 line-clamp-1">{paper.title}</div>
          <div className="text-xs text-gray-500">
            范围：{currentRoute && currentRoute.length > 0 ? `路线(${currentRoute.length} 章)` : '全文'}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTab('skim')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              tab === 'skim' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            <BookOpen className="w-4 h-4 inline mr-1" />
            粗读包
          </button>
          <button
            onClick={() => setTab('deep')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
              tab === 'deep' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            <FileText className="w-4 h-4 inline mr-1" />
            精读包
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 space-y-4">
        {/* 错误提示 */}
        {(tab === 'skim' ? skimError : deepError) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {tab === 'skim' ? skimError : deepError}
          </div>
        )}

        {/* ========== 粗读包 ========== */}
        {tab === 'skim' && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-900">一键生成粗读包</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => generateSkimPack(false)}
                    disabled={skimLoading}
                  >
                    {skimLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {skimCard ? '刷新粗读包' : '生成粗读包'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => generateSectionSummaries('plain')}
                    disabled={summaryLoading}
                    title="按路线范围生成章节“通俗版”摘要"
                  >
                    {summaryLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    生成章节摘要
                  </Button>
                  {summaryLoading && (
                    <Button size="sm" variant="secondary" onClick={cancelSectionSummaries}>
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                  )}
                </div>
              </div>

              {summaryLoading && (
                <div className="mt-3 text-xs text-gray-500">
                  正在生成章节摘要：{summaryProgress.done}/{summaryProgress.total}
                  {summaryProgress.current ? `（${summaryProgress.current}）` : ''}
                </div>
              )}
            </div>

            {skimCard ? (
              <SkimCard skimCard={skimCard} onRegenerate={() => generateSkimPack(true)} isLoading={skimLoading} />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
                还没有粗读材料，点击上方“生成粗读包”即可自动产出（研究问题、贡献、证据强度、红旗、推荐章节）。
              </div>
            )}

            {/* 关键图表 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">关键图表（粗读）</div>
                <Button size="sm" variant="secondary" onClick={loadKeyFigures} disabled={figuresLoading}>
                  {figuresLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  刷新
                </Button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="text-left py-2 pr-3">图</th>
                      <th className="text-left py-2 pr-3">Caption</th>
                      <th className="text-left py-2 pr-3">页码</th>
                      <th className="text-right py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyFigures.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-gray-500 text-sm">
                          暂无关键图表（或尚未解析图表锚点）。
                        </td>
                      </tr>
                    ) : (
                      keyFigures.map(fig => (
                        <tr key={fig.anchor_id} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{fig.figure_number || '-'}</td>
                          <td className="py-2 pr-3 text-gray-700">
                            <div className="line-clamp-2">{fig.caption || '-'}</div>
                            {fig.section && <div className="text-xs text-gray-400 mt-0.5">{fig.section}</div>}
                          </td>
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{fig.page ? `P${fig.page}` : '-'}</td>
                          <td className="py-2 text-right">
                            <button
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm"
                              onClick={() => onOpenPdfAtAnchorId?.(fig.anchor_id)}
                              disabled={!onOpenPdfAtAnchorId}
                              title="跳回原文定位"
                            >
                              <ExternalLink className="w-4 h-4" />
                              原文
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 章节摘要（粗读展示 one_liner/plain） */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-medium text-gray-900">章节粗读摘要（按路线范围）</div>
              <div className="mt-3 space-y-3">
                {scopedSections.map(sectionName => {
                  const s = sectionSummaries[sectionName];
                  return (
                    <div key={sectionName} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-gray-800">{sectionName}</div>
                        {s ? (
                          <Badge variant="secondary" size="sm">已生成</Badge>
                        ) : (
                          <Badge variant="outline" size="sm">未生成</Badge>
                        )}
                      </div>
                      {s ? (
                        <div className="mt-2 space-y-2">
                          <div className="p-2 bg-indigo-50 rounded text-sm text-indigo-900">
                            <div className="text-xs text-indigo-600 mb-1">一句话</div>
                            {s.one_liner}
                          </div>
                          <div className="p-2 bg-gray-50 rounded text-sm text-gray-800">
                            <div className="text-xs text-gray-500 mb-1">通俗</div>
                            {s.plain}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-500">点击上方“生成章节摘要”批量生成。</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ========== 精读包 ========== */}
        {tab === 'deep' && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-900">一键生成精读包</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={generateDeepPack} disabled={paperCardLoading || checklistLoading || summaryLoading}>
                    {(paperCardLoading || checklistLoading || summaryLoading) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    生成精读包
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => generateSectionSummaries('strict')}
                    disabled={summaryLoading}
                    title="按路线范围生成章节“严格版”摘要"
                  >
                    {summaryLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    生成严格摘要
                  </Button>
                  {summaryLoading && (
                    <Button size="sm" variant="secondary" onClick={cancelSectionSummaries}>
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                  )}
                </div>
              </div>
              {summaryLoading && (
                <div className="mt-3 text-xs text-gray-500">
                  正在生成章节摘要：{summaryProgress.done}/{summaryProgress.total}
                  {summaryProgress.current ? `（${summaryProgress.current}）` : ''}
                </div>
              )}
            </div>

            {/* PaperCard（卡片化展示） */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-900">PaperCard（整篇精读结论）</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={generatePaperCard} disabled={paperCardLoading}>
                    {paperCardLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {paperCard ? '重新生成' : '生成 PaperCard'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={savePaperCardAsCard} disabled={!paperCard || paperCardSaving}>
                    {paperCardSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    保存为卡片
                  </Button>
                </div>
              </div>

              {!paperCard ? (
                <div className="mt-3 text-sm text-gray-600">
                  还没有 PaperCard。点击“生成 PaperCard”即可产出：一句话总结、贡献、局限、适用范围、复现风险。
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="text-xs text-indigo-600 mb-1">一句话总结</div>
                    <div className="text-sm text-indigo-900 font-medium leading-relaxed">{paperCard.one_line_summary}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs text-green-700 mb-2">主要贡献</div>
                      <ul className="space-y-1 text-sm text-green-900">
                        {paperCard.contributions.map((c, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="font-bold">{idx + 1}.</span>
                            <span className="flex-1">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-xs text-amber-700 mb-2">局限性</div>
                      <ul className="space-y-1 text-sm text-amber-900">
                        {paperCard.limitations.map((l, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="font-bold">{idx + 1}.</span>
                            <span className="flex-1">{l}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-blue-700 mb-1">适用范围</div>
                      <div className="text-sm text-blue-900 leading-relaxed">{paperCard.applicable_scope}</div>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-xs text-red-700 mb-1">复现风险</div>
                      <div className="text-sm text-red-900 leading-relaxed">{paperCard.repro_risk}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Ledger（表格化） */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-900">主张-证据台账（全文/路线范围）</div>
                <div className="text-xs text-gray-500 mt-1">
                  点击“生成台账”后，你可以逐条编辑主张、调整证据强度，并跳回原文锚点核对。
                </div>
              </div>
              <div className="p-2">
                <EvidenceLedger
                  paperId={paperId}
                  defaultOpen
                  onAnchorClick={(anchorId) => onOpenPdfAtAnchorId?.(anchorId)}
                />
              </div>
            </div>

            {/* Checklist（表格/清单） */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">复现清单（全文）</div>
                  <div className="text-xs text-gray-500 mt-1">建议用于精读后的“可复现性核对与缺失项追踪”。</div>
                </div>
                <Button size="sm" onClick={generateChecklist} disabled={checklistLoading}>
                  {checklistLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {checklistItems.length > 0 ? '重新生成' : '生成清单'}
                </Button>
              </div>
              <div className="h-[520px]">
                <ChecklistPanel
                  items={checklistItems}
                  paperId={paperId}
                  onAddItem={(item) => {
                    const newItem: ChecklistItem = { id: `checklist_${Date.now()}`, ...item } as ChecklistItem;
                    setChecklistItems(prev => [...prev, newItem]);
                  }}
                  onUpdateItem={updateChecklistItem}
                  onDeleteItem={deleteChecklistItem}
                  onJumpToAnchor={(anchorId) => onOpenPdfAtAnchorId?.(anchorId)}
                  onFindMissing={generateChecklist}
                />
              </div>
            </div>

            {/* 章节严格摘要 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-medium text-gray-900">章节严格摘要（按路线范围）</div>
              <div className="mt-3 space-y-3">
                {scopedSections.map(sectionName => {
                  const s = sectionSummaries[sectionName];
                  return (
                    <div key={sectionName} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-gray-800">{sectionName}</div>
                        {s ? (
                          <Badge variant="secondary" size="sm">已生成</Badge>
                        ) : (
                          <Badge variant="outline" size="sm">未生成</Badge>
                        )}
                      </div>
                      {s ? (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-800">
                          <div className="text-xs text-gray-500 mb-1">严格</div>
                          {s.strict}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-gray-500">点击上方“一键生成精读包 / 生成严格摘要”批量生成。</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 提示：原文回跳 */}
            {!onOpenPdfAtAnchorId && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                当前上下文未提供“跳回原文”的回调；如果你希望材料里的表格/图表能一键定位到 PDF，请在外层传入 `onOpenPdfAtAnchorId`。
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


