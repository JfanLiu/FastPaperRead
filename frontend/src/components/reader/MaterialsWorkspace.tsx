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
import { cardApi, enhanceApiExtended, skimApi } from '@/lib/api';

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
  // keep key figures in state for teaching skim prompt inputs; not shown in UI
  const [keyFigures, setKeyFigures] = useState<KeyFigureItem[]>([]);
  const [skimError, setSkimError] = useState<string | null>(null);
  const [teachingSkim, setTeachingSkim] = useState<TeachingSkimPack | null>(null);
  const [teachingSkimLoading, setTeachingSkimLoading] = useState(false);
  const [skimPack, setSkimPack] = useState<SkimPack | null>(null);  // 统一粗读包

  // ========= 精读包（Deep Pack） =========
  const [paperCardSaving, setPaperCardSaving] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [deepPack, setDeepPack] = useState<DeepPack | null>(null);  // 统一精读包
  const [deepPackLoading, setDeepPackLoading] = useState(false);  // 统一精读包加载状态

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
    try {
      const res = await skimApi.getKeyFigures(paperId, 6);
      setKeyFigures(res.figures || []);
    } catch (e) {
      console.error('加载关键图表失败:', e);
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

      const res = await enhanceApiExtended.generateSkimPack(
        paperId,
        { sections_outline: sectionsOutline },
        { force: Boolean(skimPack) }
      );
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
      // keep key figures in state for teaching skim prompt inputs; not shown in UI
      await loadKeyFigures();
    } catch (e) {
      console.error('生成粗读包失败:', e);
      setSkimError('生成粗读包失败，请重试');
    } finally {
      setSkimLoading(false);
    }
  }, [paperId, loadKeyFigures]);

  const savePaperCardAsCard = useCallback(async (card?: PaperCardFull | null) => {
    const paperCard = card ?? deepPack?.paper_card;
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
  }, [deepPack, paperId]);

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

      const res = await enhanceApiExtended.generateDeepPack(
        paperId,
        { sections: sectionsData },
        { force: Boolean(deepPack) }
      );
      const pack = res.deep_pack;
      
      // 解包设置状态
      setDeepPack(pack);
      // 设置章节摘要
      setSectionSummaries(pack.section_summaries || {});
      
    } catch (e) {
      console.error('生成精读包失败:', e);
      setDeepError('生成精读包失败，请重试');
    } finally {
      setDeepPackLoading(false);
    }
  }, [paperId, scopedSections, paper, anchors]);

  useEffect(() => {
    loadExistingSkim();
    loadKeyFigures();
  }, [loadExistingSkim, loadKeyFigures]);

  const loadExistingUnifiedPacks = useCallback(async () => {
    try {
      const res = await enhanceApiExtended.getSkimPack(paperId);
      if (res?.skim_pack) {
        const pack = res.skim_pack;
        setSkimPack(pack);
        setSkimCard(pack.skim_card as unknown as SkimCardType);
        setKeyFigures(
          (pack.key_figures || []).map((f: KeyFigure, idx: number) => ({
            anchor_id: f.id || `fig_${idx}`,
            type: 'figure' as const,
            caption: f.caption,
            figure_number: f.id,
            section: f.importance,
          }))
        );
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
      }
    } catch {
      // no cached skim pack
    }

    try {
      const res = await enhanceApiExtended.getDeepPack(paperId);
      if (res?.deep_pack) {
        setDeepPack(res.deep_pack);
        setSectionSummaries(res.deep_pack.section_summaries || {});
      }
    } catch {
      // no cached deep pack
    }
  }, [paperId, scopedSections]);

  useEffect(() => {
    loadExistingUnifiedPacks();
  }, [loadExistingUnifiedPacks]);

  const groupOrder: TeachingSkimGroup[] = ['why', 'insight', 'what', 'how', 'results', 'takeaways'];
  const groupLabels: Record<TeachingSkimGroup, string> = {
    why: 'Why（问题）',
    insight: 'Insight（关键观察）',
    what: 'What（核心方法）',
    how: 'How（实现）',
    results: 'Results（结果）',
    takeaways: 'Takeaways（带走点）',
  };

  function DeepNarrative({ pack }: { pack: DeepPack }) {
    const pc = pack.paper_card || {};
    const el = pack.evidence_ledger || {};
    const mf = pack.method_flow || {};
    const ex = pack.experiment_setup || {};

    const claims = Array.isArray(el.claims) ? el.claims : [];
    const sectionSummaries = pack.section_summaries || {};
    const sectionTitles = Object.keys(sectionSummaries);

    return (
      <article className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <header className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">连续精读稿</div>
              <div className="text-xs text-gray-600 mt-1">PaperCard → Evidence → Method → Experiments → Takeaways</div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => savePaperCardAsCard(pack.paper_card)}
              disabled={!pack.paper_card || paperCardSaving}
            >
              {paperCardSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              保存为卡片
            </Button>
          </div>
        </header>

        <div className="p-5 space-y-6 leading-relaxed">
          <section>
            <h3 className="text-base font-semibold text-gray-900">1) PaperCard（核心结论）</h3>
            {pc.one_line_summary && (
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="text-xs text-indigo-600 mb-1">一句话总结</div>
                <div className="text-sm text-indigo-950 font-medium">{pc.one_line_summary}</div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.isArray(pc.contributions) && pc.contributions.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-xs text-green-700 mb-2">贡献</div>
                  <ul className="space-y-1 text-sm text-green-950">
                    {pc.contributions.slice(0, 8).map((c: string, idx: number) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-bold">{idx + 1}.</span>
                        <span className="flex-1">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(pc.limitations) && pc.limitations.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-xs text-amber-700 mb-2">局限</div>
                  <ul className="space-y-1 text-sm text-amber-950">
                    {pc.limitations.slice(0, 8).map((l: string, idx: number) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-bold">{idx + 1}.</span>
                        <span className="flex-1">{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {(pc.applicable_scope || pc.repro_risk) && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {pc.applicable_scope && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">适用范围</div>
                    <div className="text-sm text-gray-900">{pc.applicable_scope}</div>
                  </div>
                )}
                {pc.repro_risk && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-xs text-red-700 mb-1">复现风险</div>
                    <div className="text-sm text-red-950">{pc.repro_risk}</div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-900">2) Evidence Ledger（主张-证据）</h3>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-gray-600">整体证据质量：</span>
              <Badge
                variant={
                  el.overall_evidence_quality === 'strong'
                    ? 'default'
                    : el.overall_evidence_quality === 'weak'
                      ? 'danger'
                      : 'secondary'
                }
                size="sm"
              >
                {el.overall_evidence_quality === 'strong' ? '强' : el.overall_evidence_quality === 'weak' ? '弱' : '中'}
              </Badge>
            </div>
            {Array.isArray(el.key_assumptions) && el.key_assumptions.length > 0 && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
                <span className="text-gray-500">关键假设：</span>
                {el.key_assumptions.join('；')}
              </div>
            )}
            {claims.length > 0 ? (
              <div className="mt-3 space-y-2">
                {claims.slice(0, 8).map((claim: any) => (
                  <div key={claim.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{claim.text}</div>
                        {claim.evidence_summary && <div className="text-xs text-gray-600 mt-1">{claim.evidence_summary}</div>}
                        {Array.isArray(claim.source_sections) && claim.source_sections.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">来源：{claim.source_sections.join('、')}</div>
                        )}
                      </div>
                      <Badge
                        variant={claim.strength === 'strong' ? 'default' : claim.strength === 'weak' ? 'danger' : 'secondary'}
                        size="sm"
                      >
                        {claim.strength === 'strong' ? '强' : claim.strength === 'weak' ? '弱' : '中'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-500">暂无主张-证据条目。</div>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-900">3) Method Flow（方法流程）</h3>
            {mf.method_name && (
              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-xs text-purple-700 mb-1">方法名称</div>
                <div className="text-sm text-purple-950 font-medium">{mf.method_name}</div>
                {mf.overview && <div className="text-sm text-purple-900 mt-1">{mf.overview}</div>}
              </div>
            )}
            {Array.isArray(mf.steps) && mf.steps.length > 0 && (
              <div className="mt-3 space-y-2">
                {mf.steps.slice(0, 12).map((step: any, idx: number) => (
                  <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold shrink-0">
                        {step.step ?? idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{step.name || `Step ${idx + 1}`}</div>
                        {step.description && <div className="text-sm text-gray-700 mt-1">{step.description}</div>}
                        {Array.isArray(step.inputs) && step.inputs.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">输入：{step.inputs.join('、')}</div>
                        )}
                        {Array.isArray(step.outputs) && step.outputs.length > 0 && (
                          <div className="text-xs text-gray-500">输出：{step.outputs.join('、')}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {Array.isArray(mf.key_innovations) && mf.key_innovations.length > 0 && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-green-700 mb-2">关键创新点</div>
                <ul className="space-y-1 text-sm text-green-950">
                  {mf.key_innovations.slice(0, 8).map((i: string, idx: number) => (
                    <li key={idx}>• {i}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-900">4) Experiments（实验设置与结果要点）</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.isArray(ex.datasets) && ex.datasets.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs text-blue-700 mb-2">数据集</div>
                  <ul className="space-y-1 text-sm text-blue-950">
                    {ex.datasets.slice(0, 8).map((d: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{d.name}</span>
                        {d.size && <span className="text-xs text-blue-700 ml-1">({d.size})</span>}
                        {d.split && <span className="text-xs text-blue-700 ml-1">[{d.split}]</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(ex.baselines) && ex.baselines.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-xs text-amber-700 mb-2">基线方法</div>
                  <div className="text-sm text-amber-950">{ex.baselines.join('、')}</div>
                </div>
              )}
              {Array.isArray(ex.metrics) && ex.metrics.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-xs text-green-700 mb-2">评估指标</div>
                  <ul className="space-y-1 text-sm text-green-950">
                    {ex.metrics.slice(0, 10).map((m: any, idx: number) => (
                      <li key={idx}>{m.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {ex.training_details && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-xs text-purple-700 mb-2">训练细节</div>
                  <div className="text-sm text-purple-950 space-y-1">
                    {ex.training_details.optimizer && <div>优化器：{ex.training_details.optimizer}</div>}
                    {ex.training_details.learning_rate && <div>学习率：{ex.training_details.learning_rate}</div>}
                    {ex.training_details.batch_size && <div>批次大小：{ex.training_details.batch_size}</div>}
                    {ex.training_details.epochs && <div>轮数：{ex.training_details.epochs}</div>}
                    {ex.training_details.hardware && <div>硬件：{ex.training_details.hardware}</div>}
                  </div>
                </div>
              )}
            </div>
            {ex.reproducibility_notes && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs text-red-700 mb-1">复现注意事项</div>
                <div className="text-sm text-red-950">{ex.reproducibility_notes}</div>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-900">5) Takeaways（你应该带走的）</h3>
            {Array.isArray(pc.key_takeaways) && pc.key_takeaways.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-gray-900">
                {pc.key_takeaways.slice(0, 10).map((t: string, idx: number) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-indigo-600 font-bold">•</span>
                    <span className="flex-1">{t}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 text-sm text-gray-500">暂无 takeaways。</div>
            )}

            {sectionTitles.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-sm font-medium text-gray-900">章节严格摘要（压缩）</div>
                <div className="mt-2 space-y-2">
                  {sectionTitles.slice(0, 10).map((title) => (
                    <details key={title} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <summary className="cursor-pointer text-sm font-medium text-gray-900">{title}</summary>
                      <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                        {sectionSummaries[title]?.strict || ''}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </article>
    );
  }

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
                  <div className="text-sm font-medium text-gray-900">生成粗读（推荐）</div>
                  <div className="text-xs text-gray-500 mt-0.5">1 次 LLM 调用，产出 SkimCard + 教学粗读（叙事连续）+ Next steps</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={generateSkimPackUnified}
                    disabled={skimLoading}
                  >
                    {skimLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {skimPack ? '重新生成' : '生成'}
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

            {/* 教学粗读（结构化带读，叙事连续 + Next steps） */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">教学粗读（带读稿 · 结构化）</div>
                  <div className="text-xs text-gray-500 mt-1">
                    少而精、叙事连续（Why→Insight→What→How→Results→Takeaways），并自动生成可选探索方向（Next steps）。
                    <br />已整合到上方「生成粗读」中。
                  </div>
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
                </div>
              </div>
            </div>

            {deepPack ? (
              <DeepNarrative pack={deepPack} />
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-600">
                还没有精读稿。点击上方“一键生成”即可生成一份连续叙事精读稿（PaperCard→Evidence→Method→Experiments→Takeaways）。
              </div>
            )}

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




