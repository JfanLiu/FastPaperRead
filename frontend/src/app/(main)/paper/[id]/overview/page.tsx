'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button, Badge, Progress } from '@/components/common';
import { usePaperStore } from '@/stores/paperStore';
import { paperApi, skimApi, anchorApi, getStaticUrl } from '@/lib/api';
import { getEvidenceStrengthColor, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  BookOpen,
  Archive,
  Clock,
  AlertTriangle,
  CheckCircle,
  Image,
  FileText,
  ChevronRight,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { Paper, SkimCard, Anchor } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OverviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { currentPaper, setCurrentPaper, skimCard, setSkimCard, currentAnchors, setCurrentAnchors } = usePaperStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);

  useEffect(() => {
    loadPaperData();
  }, [resolvedParams.id]);

  const loadPaperData = async () => {
    setIsLoading(true);
    try {
      // 加载论文详情
      const paper = await paperApi.get(resolvedParams.id);
      setCurrentPaper(paper);

      // 加载锚点
      const anchorsResponse = await anchorApi.getByPaper(resolvedParams.id);
      setCurrentAnchors(anchorsResponse.items);

      // 尝试加载已有的SkimCard（新论文可能还没有）
      try {
        const skim = await skimApi.get(resolvedParams.id);
        setSkimCard(skim);
      } catch (e: unknown) {
        // SkimCard不存在是正常的，不需要报错
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status !== 404) {
          console.error('加载SkimCard失败:', e);
        }
        setSkimCard(null);
      }
    } catch (error) {
      console.error('Failed to load paper:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSkimCard = async () => {
    setIsGenerating(true);
    try {
      const skim = await skimApi.generate(resolvedParams.id, true);
      setSkimCard(skim);
    } catch (error) {
      console.error('Failed to generate skim card:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDecision = async (decision: 'archive' | 'queue' | 'deepread') => {
    try {
      await skimApi.makeDecision({
        paper_id: resolvedParams.id,
        decision,
        reading_route: decision === 'deepread' ? 'review' : undefined,
      });

      if (decision === 'deepread') {
        router.push(`/paper/${resolvedParams.id}/read`);
      } else if (decision === 'archive') {
        router.push('/library');
      } else {
        router.push('/queue');
      }
    } catch (error) {
      console.error('Failed to make decision:', error);
    }
  };

  if (isLoading) {
    return (
      <MainLayout showSearch={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!currentPaper) {
    return (
      <MainLayout showSearch={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">论文不存在</p>
          <Link href="/library">
            <Button variant="ghost" className="mt-4">返回文献库</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const figures = currentAnchors.filter(a => a.type === 'figure');

  return (
    <MainLayout showSearch={false} showRightPanel>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Back button */}
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回文献库
        </Link>

        {/* Paper Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {currentPaper.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            {currentPaper.authors && currentPaper.authors.length > 0 && (
              <span>{currentPaper.authors.join(', ')}</span>
            )}
            {currentPaper.year && <span>· {currentPaper.year}</span>}
            {currentPaper.venue && <span>· {currentPaper.venue}</span>}
          </div>
          {currentPaper.abstract && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">摘要</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {currentPaper.abstract}
              </p>
            </div>
          )}
        </div>

        {/* SkimCard */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">SkimCard</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateSkimCard}
              loading={isGenerating}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {skimCard ? '重新生成' : '生成'}
            </Button>
          </div>

          {skimCard ? (
            <div className="space-y-6">
              {/* Research Question */}
              {skimCard.research_question && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">研究问题</h3>
                  <p className="text-gray-900">{skimCard.research_question}</p>
                </div>
              )}

              {/* Contributions */}
              {skimCard.contributions && skimCard.contributions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">主要贡献</h3>
                  <ul className="space-y-2">
                    {skimCard.contributions.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-gray-700">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Evidence Strength */}
              {skimCard.evidence_strength && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">证据强度</h3>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        skimCard.evidence_strength === 'strong'
                          ? 'success'
                          : skimCard.evidence_strength === 'medium'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {skimCard.evidence_strength === 'strong'
                        ? '强'
                        : skimCard.evidence_strength === 'medium'
                        ? '中'
                        : '弱'}
                    </Badge>
                    {skimCard.evidence_strength_reason && (
                      <span className="text-sm text-gray-600">
                        {skimCard.evidence_strength_reason}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {skimCard.red_flags && skimCard.red_flags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">风险提示</h3>
                  <ul className="space-y-2">
                    {skimCard.red_flags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-gray-700">{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Route */}
              {skimCard.recommended_sections && skimCard.recommended_sections.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">推荐阅读路线</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {skimCard.recommended_sections.map((section) => (
                      <Badge key={section} variant="info">
                        {section}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 mb-4">点击生成SkimCard，快速了解论文核心内容</p>
              <Button onClick={handleGenerateSkimCard} loading={isGenerating}>
                生成SkimCard
              </Button>
            </div>
          )}
        </div>

        {/* Key Figures */}
        {figures.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">关键图表</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {figures.slice(0, 6).map((fig) => (
                <div
                  key={fig.id}
                  className="border border-gray-200 rounded-lg p-2 hover:border-indigo-300 cursor-pointer transition-colors"
                >
                  <div className="aspect-video bg-gray-100 rounded flex items-center justify-center mb-2">
                    {fig.image_path ? (
                      <img
                        src={getStaticUrl(fig.image_path)}
                        alt={fig.caption || ''}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <Image className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {fig.figure_number || fig.caption || `图 ${figures.indexOf(fig) + 1}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision Buttons */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">阅读决策</h2>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => handleDecision('archive')}
              className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <Archive className="w-8 h-8 text-gray-400 mb-2" />
              <span className="font-medium text-gray-700">归档</span>
              <span className="text-xs text-gray-500 mt-1">不再阅读</span>
            </button>
            <button
              onClick={() => handleDecision('queue')}
              className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 transition-colors"
            >
              <Clock className="w-8 h-8 text-indigo-500 mb-2" />
              <span className="font-medium text-gray-700">加入队列</span>
              <span className="text-xs text-gray-500 mt-1">稍后阅读</span>
            </button>
            <button
              onClick={() => handleDecision('deepread')}
              className="flex flex-col items-center p-4 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <BookOpen className="w-8 h-8 text-white mb-2" />
              <span className="font-medium text-white">开始精读</span>
              <span className="text-xs text-indigo-200 mt-1">立即阅读</span>
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

