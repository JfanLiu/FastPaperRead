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
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Anchor,
  Paper,
  PaperCardFull,
  SectionSummaryLeveled,
  SkimCard as SkimCardType,
  TeachingSkimPack,
  TeachingSkimGroup,
  SkimPack,
  DeepPack,
  KeyFigure,
  EvidenceLedgerData,
  MethodFlowData,
  ExperimentSetupData,
} from '@/types';
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
  const [teachingSkim, setTeachingSkim] = useState<TeachingSkimPack | null>(null);
  const [teachingSkimLoading, setTeachingSkimLoading] = useState(false);
  const [skimPack, setSkimPack] = useState<SkimPack | null>(null);  // 统一粗读包

  // ========= 精读包（Deep Pack） =========
  const [paperCard, setPaperCard] = useState<PaperCardFull | null>(null);
  const [paperCardLoading, setPaperCardLoading] = useState(false);
  const [paperCardSaving, setPaperCardSaving] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [deepPack, setDeepPack] = useState<DeepPack | null>(null);  // 统一精读包
  const [deepPackLoading, setDeepPackLoading] = useState(false);  // 统一精读包加载状态

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

  // 使用统一 API 生成完整粗读包（1 次 LLM 调用）
  const generateSkimPackUnified = useCallback(async () => {
    setSkimError(null);
    setSkimLoading(true);
    try {
      // 准备章节大纲
      const sectionsOutline = sectionAnchors.map(a => ({
        title: getSectionName(a),
        level: a.section_level || 1,
      }));

      const res = await enhanceApiExtended.generateSkimPack(paperId, { sections_outline: sectionsOutline });
      const pack = res.skim_pack;
      
      // 解包设置状态
      setSkimPack(pack);
      setSkimCard(pack.skim_card);
      // 转换 key_figures 格式
      setKeyFigures(pack.key_figures?.map((f: KeyFigure, idx: number) => ({
        anchor_id: f.id || `fig_${idx}`,
        type: 'figure' as const,
        caption: f.caption,
        figure_number: f.id,
        section: f.importance,
      })) || []);
      // 设置 teaching_skim
      if (pack.teaching_skim) {
        setTeachingSkim({
          version: pack.version,
          paper_id: pack.paper_id,
          route_scope: { type: 'full', sections: scopedSections },
          cards: pack.teaching_skim.cards || [],
          tables: pack.teaching_skim.tables || [],
          next_steps: pack.teaching_skim.next_steps || [],
        });
      }
    } catch (e) {
      console.error('生成粗读包失败:', e);
      setSkimError('生成粗读包失败，请重试');
    } finally {
      setSkimLoading(false);
    }
  }, [paperId, sectionAnchors, scopedSections]);

  // 保留原有的分步生成（兼容）
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

  const buildAnchorCandidates = useCallback(() => {
    // 尽量提供证据锚点，但控制体积：只给 section/figure/table/equation + 少量 paragraph
    const candidates: {
      anchor_id: string;
      type?: string;
      section?: string;
      page?: number;
      snippet?: string;
    }[] = [];

    const push = (a: Anchor, snippet?: string) => {
      candidates.push({
        anchor_id: a.id,
        type: a.type,
        section: a.section || a.text,
        page: a.page,
        snippet: (snippet || a.caption || a.text || '').slice(0, 160) || undefined,
      });
    };

    const primary = anchors.filter(a => ['section', 'figure', 'table', 'equation'].includes(a.type || ''));
    primary.slice(0, 120).forEach(a => push(a));

    // 每个 scoped section 取 2 条 paragraph 作为“可引用证据”
    for (const sectionName of scopedSections.slice(0, 20)) {
      const ps = anchors
        .filter(a => a.type === 'paragraph' && (a.section || '') === sectionName)
        .slice(0, 2);
      ps.forEach(a => push(a, a.text));
    }

    // 去重
    const seen = new Set<string>();
    return candidates.filter(c => {
      if (seen.has(c.anchor_id)) return false;
      seen.add(c.anchor_id);
      return true;
    }).slice(0, 160);
  }, [anchors, scopedSections]);

  const generateTeachingSkim = useCallback(async () => {
    setTeachingSkimLoading(true);
    setSkimError(null);
    try {
      // 依赖输入：skimCard + keyFigures + plain summaries
      let ensuredSkim = skimCard;
      if (!ensuredSkim) {
        ensuredSkim = await skimApi.generate(paperId, false);
        setSkimCard(ensuredSkim);
      }

      if (Object.keys(sectionSummaries).length === 0) {
        await generateSectionSummaries('plain');
      }

      const route_scope =
        currentRoute && currentRoute.length > 0
          ? { type: 'route' as const, sections: currentRoute }
          : { type: 'full' as const, sections: scopedSections };

      const paper_meta = {
        title: paper.title,
        authors: paper.authors,
        venue: paper.venue,
        year: paper.year,
      };

      const section_summaries: Record<string, SectionSummaryLeveled> = {};
      scopedSections.forEach(name => {
        if (sectionSummaries[name]) section_summaries[name] = sectionSummaries[name];
      });

      const res = await enhanceApiExtended.generateTeachingSkim({
        paper_id: paperId,
        route_scope,
        paper_meta,
        skim_card: ensuredSkim as unknown as Record<string, unknown>,
        key_figures: keyFigures as unknown as Record<string, unknown>[],
        section_summaries: section_summaries as unknown as Record<string, unknown>,
        evidence_anchor_candidates: buildAnchorCandidates(),
      });

      setTeachingSkim(res.teaching_skim);
    } catch (e) {
      console.error('生成教学粗读失败:', e);
      setSkimError('生成教学粗读失败，请重试');
    } finally {
      setTeachingSkimLoading(false);
    }
  }, [
    buildAnchorCandidates,
    currentRoute,
    generateSectionSummaries,
    keyFigures,
    paper,
    paperId,
    scopedSections,
    sectionSummaries,
    skimCard,
  ]);

  const cancelSectionSummaries = useCallback(() => {
    cancelSummariesRef.current = true;
  }, []);

  // 使用统一 API 生成完整精读包（1 次 LLM 调用）
  const generateDeepPackUnified = useCallback(async () => {
    setDeepError(null);
    setDeepPackLoading(true);
    try {
      // 准备章节数据
      const sectionsData = scopedSections.map(sectionName => ({
        title: sectionName,
        content: buildSectionContent({ paper, anchors, sectionName }),
      }));

      const res = await enhanceApiExtended.generateDeepPack(paperId, { sections: sectionsData });
      const pack = res.deep_pack;
      
      // 解包设置状态
      setDeepPack(pack);
      setPaperCard(pack.paper_card);
      // 设置章节摘要
      setSectionSummaries(pack.section_summaries || {});
      
    } catch (e) {
      console.error('生成精读包失败:', e);
      setDeepError('生成精读包失败，请重试');
    } finally {
      setDeepPackLoading(false);
    }
  }, [paperId, scopedSections, paper, anchors]);

  // 保留原有的分步生成（兼容）
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

  const groupOrder: TeachingSkimGroup[] = ['why', 'insight', 'what', 'how', 'results', 'takeaways'];
  const groupLabels: Record<TeachingSkimGroup, string> = {
    why: 'Why（问题）',
    insight: 'Insight（关键观察）',
    what: 'What（核心方法）',
    how: 'How（实现）',
    results: 'Results（结果）',
    takeaways: 'Takeaways（带走点）',
  };

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
                <div>
                  <div className="text-sm font-medium text-gray-900">一键生成粗读包（推荐）</div>
                  <div className="text-xs text-gray-500 mt-0.5">1 次 LLM 调用，包含决策卡 + 关键图表 + 教学粗读</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={generateSkimPackUnified}
                    disabled={skimLoading}
                  >
                    {skimLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {skimPack ? '重新生成' : '一键生成'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => generateSkimPack(false)}
                    disabled={skimLoading}
                    title="分步生成（兼容旧版）"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    分步生成
                  </Button>
                </div>
              </div>
            </div>

            {skimCard ? (
              <SkimCard skimCard={skimCard} onRegenerate={() => generateSkimPack(true)} isLoading={skimLoading} />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
                还没有粗读材料，点击上方“生成粗读包”即可自动产出（研究问题、贡献、证据强度、红旗、推荐章节）。
              </div>
            )}

            {/* 教学粗读（结构化带读） */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">教学粗读（带读稿 · 结构化）</div>
                  <div className="text-xs text-gray-500 mt-1">
                    少而精、叙事连续（Why→Insight→What→How→Results→Takeaways），并自动生成可选探索方向（Next steps）。
                    <br />已整合到「一键生成粗读包」中。或可单独生成：
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={generateTeachingSkim} disabled={teachingSkimLoading || summaryLoading}>
                    {teachingSkimLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                    {teachingSkim ? '重新生成' : '单独生成'}
                  </Button>
                </div>
              </div>

              {!teachingSkim ? (
                <div className="mt-3 text-sm text-gray-600">
                  还没有教学粗读。点击“生成”后会得到 6 张主线卡片 + 可选探索方向。
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {groupOrder.map(g => {
                    const card = teachingSkim.cards.find(c => c.group === g);
                    if (!card) return null;
                    return (
                      <div key={g} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-gray-500 mb-1">{groupLabels[g]}</div>
                            <div className="font-medium text-gray-900">{card.title}</div>
                            <div className="text-sm text-gray-700 mt-1">{card.one_liner}</div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <Badge variant="secondary" size="sm">
                              {card.confidence === 'from_text' ? '原文' : card.confidence === 'needs_verify' ? '待核对' : '推断'}
                            </Badge>
                          </div>
                        </div>

                        {card.key_points?.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm text-gray-800">
                            {card.key_points.map((p, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-gray-400">-</span>
                                <span className="flex-1">{p}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {card.why_it_matters && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                            {card.why_it_matters}
                          </div>
                        )}

                        {card.evidence_anchors?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {card.evidence_anchors.map(aid => (
                              <button
                                key={aid}
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                onClick={() => onOpenPdfAtAnchorId?.(aid)}
                                disabled={!onOpenPdfAtAnchorId}
                                title="跳回原文锚点"
                              >
                                <ExternalLink className="w-3 h-3" />
                                证据
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {teachingSkim.tables?.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-gray-900 mb-2">补充表格</div>
                      <div className="space-y-3">
                        {teachingSkim.tables.map(t => (
                          <div key={t.id} className="border border-gray-200 rounded-md p-2">
                            <div className="text-sm font-medium text-gray-800 mb-2">{t.title}</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-500 border-b">
                                    {t.columns.map((c, idx) => (
                                      <th key={idx} className="text-left py-2 pr-3">{c}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.rows.map((row, ridx) => (
                                    <tr key={ridx} className="border-b last:border-b-0">
                                      {row.map((cell, cidx) => (
                                        <td key={cidx} className="py-2 pr-3 text-gray-700">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {teachingSkim.next_steps?.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-gray-900 mb-2">可选探索方向（Next steps）</div>
                      <div className="space-y-2">
                        {teachingSkim.next_steps.map(ns => (
                          <div key={ns.id} className="p-2 bg-amber-50 border border-amber-100 rounded-md">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-medium text-amber-900">{ns.title}</div>
                              <Badge variant="warning" size="sm">{ns.estimated_time || ns.type}</Badge>
                            </div>
                            {ns.goal && <div className="text-sm text-amber-800 mt-1">{ns.goal}</div>}
                            <div className="text-xs text-amber-700 mt-1">
                              产物：{ns.deliverable || '—'}
                            </div>
                            {ns.inputs_required?.length > 0 && (
                              <div className="text-xs text-amber-700 mt-1">
                                需要：{ns.inputs_required.join('、')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                <div>
                  <div className="text-sm font-medium text-gray-900">一键生成精读包（推荐）</div>
                  <div className="text-xs text-gray-500 mt-0.5">1 次 LLM 调用，包含 PaperCard + 证据台账 + 方法流程 + 实验设置 + 章节摘要</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={generateDeepPackUnified} disabled={deepPackLoading}>
                    {deepPackLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    {deepPack ? '重新生成' : '一键生成'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={generateDeepPack}
                    disabled={paperCardLoading || checklistLoading || summaryLoading}
                    title="分步生成（兼容旧版，多次 LLM 调用）"
                  >
                    {(paperCardLoading || checklistLoading || summaryLoading) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    分步生成
                  </Button>
                </div>
              </div>
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

            {/* 方法流程（从 DeepPack 解包） */}
            {deepPack?.method_flow && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">方法流程</div>
                <div className="space-y-3">
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-xs text-purple-600 mb-1">方法名称</div>
                    <div className="text-sm text-purple-900 font-medium">{deepPack.method_flow.method_name}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">概述</div>
                    <div className="text-sm text-gray-800">{deepPack.method_flow.overview}</div>
                  </div>
                  {deepPack.method_flow.steps?.length > 0 && (
                    <div className="p-3 border border-gray-200 rounded-lg">
                      <div className="text-xs text-gray-500 mb-2">步骤流程</div>
                      <div className="space-y-2">
                        {deepPack.method_flow.steps.map((step, idx) => (
                          <div key={idx} className="flex gap-3 p-2 bg-white border border-gray-100 rounded">
                            <div className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium shrink-0">
                              {step.step}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm">{step.name}</div>
                              <div className="text-xs text-gray-600 mt-1">{step.description}</div>
                              {step.inputs?.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">输入：{step.inputs.join('、')}</div>
                              )}
                              {step.outputs?.length > 0 && (
                                <div className="text-xs text-gray-500">输出：{step.outputs.join('、')}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {deepPack.method_flow.key_innovations?.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs text-green-700 mb-1">关键创新点</div>
                      <ul className="space-y-1 text-sm text-green-900">
                        {deepPack.method_flow.key_innovations.map((i, idx) => (
                          <li key={idx}>• {i}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 实验设置（从 DeepPack 解包） */}
            {deepPack?.experiment_setup && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">实验设置</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {deepPack.experiment_setup.datasets?.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-xs text-blue-700 mb-2">数据集</div>
                      <ul className="space-y-1 text-sm text-blue-900">
                        {deepPack.experiment_setup.datasets.map((d, idx) => (
                          <li key={idx}>
                            <span className="font-medium">{d.name}</span>
                            {d.size && <span className="text-xs text-blue-700 ml-1">({d.size})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deepPack.experiment_setup.baselines?.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-xs text-amber-700 mb-2">基线方法</div>
                      <div className="text-sm text-amber-900">{deepPack.experiment_setup.baselines.join('、')}</div>
                    </div>
                  )}
                  {deepPack.experiment_setup.metrics?.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-xs text-green-700 mb-2">评估指标</div>
                      <ul className="space-y-1 text-sm text-green-900">
                        {deepPack.experiment_setup.metrics.map((m, idx) => (
                          <li key={idx}>{m.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deepPack.experiment_setup.training_details && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="text-xs text-purple-700 mb-2">训练细节</div>
                      <div className="text-sm text-purple-900 space-y-1">
                        {deepPack.experiment_setup.training_details.optimizer && (
                          <div>优化器：{deepPack.experiment_setup.training_details.optimizer}</div>
                        )}
                        {deepPack.experiment_setup.training_details.learning_rate && (
                          <div>学习率：{deepPack.experiment_setup.training_details.learning_rate}</div>
                        )}
                        {deepPack.experiment_setup.training_details.batch_size && (
                          <div>批次大小：{deepPack.experiment_setup.training_details.batch_size}</div>
                        )}
                        {deepPack.experiment_setup.training_details.hardware && (
                          <div>硬件：{deepPack.experiment_setup.training_details.hardware}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {deepPack.experiment_setup.reproducibility_notes && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-xs text-red-700 mb-1">复现注意事项</div>
                    <div className="text-sm text-red-900">{deepPack.experiment_setup.reproducibility_notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* 证据台账（从 DeepPack 解包 + EvidenceLedger 组件） */}
            {deepPack?.evidence_ledger && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-sm font-medium text-gray-900 mb-3">证据台账（来自精读包）</div>
                <div className="p-3 bg-gray-50 rounded-lg mb-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">整体证据质量：</span>
                    <Badge 
                      variant={deepPack.evidence_ledger.overall_evidence_quality === 'strong' ? 'default' : 
                               deepPack.evidence_ledger.overall_evidence_quality === 'weak' ? 'danger' : 'secondary'}
                    >
                      {deepPack.evidence_ledger.overall_evidence_quality === 'strong' ? '强' : 
                       deepPack.evidence_ledger.overall_evidence_quality === 'weak' ? '弱' : '中等'}
                    </Badge>
                  </div>
                  {deepPack.evidence_ledger.key_assumptions?.length > 0 && (
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="text-gray-500">关键假设：</span>
                      {deepPack.evidence_ledger.key_assumptions.join('；')}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {deepPack.evidence_ledger.claims?.slice(0, 5).map(claim => (
                    <div key={claim.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm text-gray-900 font-medium">{claim.text}</div>
                          {claim.evidence_summary && (
                            <div className="text-xs text-gray-600 mt-1">{claim.evidence_summary}</div>
                          )}
                        </div>
                        <Badge 
                          variant={claim.strength === 'strong' ? 'default' : 
                                   claim.strength === 'weak' ? 'danger' : 'secondary'}
                          size="sm"
                        >
                          {claim.strength === 'strong' ? '强' : claim.strength === 'weak' ? '弱' : '中'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Ledger（独立组件，支持交互编辑） */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-medium text-gray-900">主张-证据台账（可编辑）</div>
                <div className="text-xs text-gray-500 mt-1">
                  点击"生成台账"后，你可以逐条编辑主张、调整证据强度，并跳回原文锚点核对。
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




