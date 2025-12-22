'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button, Badge, Progress } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Paper } from '@/types';
import {
  FileEdit,
  RefreshCw,
  Download,
  Star,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface RubricScore {
  score: number;
  reason: string;
}

interface ReviewDraft {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  questions: string[];
  minor_issues: string[];
  recommendation: string;
}

const RUBRIC_ITEMS = [
  { key: 'novelty', label: '新颖性', description: '方法/想法是否新颖' },
  { key: 'soundness', label: '严谨性', description: '技术和实验是否可靠' },
  { key: 'clarity', label: '清晰度', description: '写作是否清晰易懂' },
  { key: 'significance', label: '重要性', description: '对领域的潜在影响' },
  { key: 'reproducibility', label: '可复现性', description: '是否提供足够信息复现' },
];

export default function ReviewPage() {
  const params = useParams();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [scores, setScores] = useState<Record<string, RubricScore>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['strengths', 'weaknesses']));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadPaper();
  }, [paperId]);

  const loadPaper = async () => {
    // Mock data
    setPaper({
      id: paperId,
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer'],
      year: 2017,
      venue: 'NeurIPS',
      abstract: 'The dominant sequence transduction models...',
      status: 'deepread',
      read_progress: 1,
      keywords: [],
      source_type: 'arxiv',
      source_value: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 初始化分数
    const initialScores: Record<string, RubricScore> = {};
    for (const item of RUBRIC_ITEMS) {
      initialScores[item.key] = { score: 3, reason: '' };
    }
    setScores(initialScores);
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    
    // 模拟生成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setDraft({
      summary: '本文提出了Transformer架构，完全基于自注意力机制，摒弃了传统的循环和卷积结构。该方法在机器翻译任务上取得了SOTA结果，并且训练效率更高。',
      strengths: [
        '提出了一种全新的序列建模架构，具有开创性意义',
        '自注意力机制允许长距离依赖的直接建模',
        '并行计算能力强，训练效率高',
        '实验充分，在多个翻译任务上验证了有效性',
      ],
      weaknesses: [
        '计算复杂度与序列长度呈二次关系，限制了处理长序列的能力',
        '缺少对位置编码选择的消融实验',
        '未充分讨论在其他NLP任务上的泛化能力',
      ],
      questions: [
        '为什么选择正弦位置编码而非学习的位置编码？',
        '在更长序列(>512)上的性能如何？',
        '多头注意力的头数选择依据是什么？',
      ],
      minor_issues: [
        '部分公式符号未定义',
        '图1的标注可以更清晰',
      ],
      recommendation: 'accept',
    });
    
    setIsGenerating(false);
  };

  const handleScoreChange = (key: string, score: number) => {
    setScores({
      ...scores,
      [key]: { ...scores[key], score }
    });
  };

  const handleReasonChange = (key: string, reason: string) => {
    setScores({
      ...scores,
      [key]: { ...scores[key], reason }
    });
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getTotalScore = () => {
    const values = Object.values(scores).map(s => s.score);
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  const handleCopyReview = async () => {
    if (!draft) return;
    
    const text = `
# 审稿意见: ${paper?.title}

## 总体评价
${draft.summary}

## 主要优点
${draft.strengths.map(s => `- ${s}`).join('\n')}

## 主要问题
${draft.weaknesses.map(w => `- ${w}`).join('\n')}

## 问题
${draft.questions.map(q => `- ${q}`).join('\n')}

## 小问题
${draft.minor_issues.map(m => `- ${m}`).join('\n')}

## 评分
${RUBRIC_ITEMS.map(item => `- ${item.label}: ${scores[item.key]?.score || 3}/5`).join('\n')}

总分: ${getTotalScore()}/5
建议: ${draft.recommendation}
    `.trim();
    
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileEdit className="w-6 h-6 text-indigo-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">审稿模式</h1>
                <p className="text-sm text-gray-500">{paper.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleCopyReview}
                disabled={!draft}
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? '已复制' : '复制'}
              </Button>
              <Button variant="secondary">
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-8">
        {/* Left: Review Draft */}
        <div className="col-span-2 space-y-6">
          {/* Generate Button */}
          {!draft && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FileEdit className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">生成审稿意见</h3>
              <p className="text-gray-500 mb-4">
                基于SkimCard、笔记卡片和论文内容自动生成结构化审稿意见
              </p>
              <Button onClick={handleGenerateDraft} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    生成中...
                  </>
                ) : (
                  '开始生成'
                )}
              </Button>
            </div>
          )}

          {/* Draft Content */}
          {draft && (
            <>
              {/* Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">总体评价</h2>
                <p className="text-gray-700 leading-relaxed">{draft.summary}</p>
              </div>

              {/* Strengths */}
              <CollapsibleSection
                title="主要优点"
                icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                items={draft.strengths}
                isExpanded={expandedSections.has('strengths')}
                onToggle={() => toggleSection('strengths')}
                itemColor="text-emerald-600"
              />

              {/* Weaknesses */}
              <CollapsibleSection
                title="主要问题"
                icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
                items={draft.weaknesses}
                isExpanded={expandedSections.has('weaknesses')}
                onToggle={() => toggleSection('weaknesses')}
                itemColor="text-amber-600"
              />

              {/* Questions */}
              <CollapsibleSection
                title="问题"
                icon={<HelpCircle className="w-5 h-5 text-blue-500" />}
                items={draft.questions}
                isExpanded={expandedSections.has('questions')}
                onToggle={() => toggleSection('questions')}
                itemColor="text-blue-600"
              />

              {/* Minor Issues */}
              <CollapsibleSection
                title="小问题"
                items={draft.minor_issues}
                isExpanded={expandedSections.has('minor')}
                onToggle={() => toggleSection('minor')}
              />
            </>
          )}
        </div>

        {/* Right: Rubric */}
        <div className="space-y-6">
          {/* Score Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">评分</h2>
              <div className="text-2xl font-bold text-indigo-600">
                {getTotalScore()}<span className="text-sm font-normal text-gray-400">/5</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {RUBRIC_ITEMS.map((item) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    <span className="text-sm text-gray-500">{scores[item.key]?.score || 3}/5</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleScoreChange(item.key, n)}
                        className={cn(
                          'flex-1 h-2 rounded-full transition-colors',
                          n <= (scores[item.key]?.score || 3)
                            ? 'bg-indigo-500'
                            : 'bg-gray-200 hover:bg-gray-300'
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">建议</h2>
            <div className="space-y-2">
              {[
                { value: 'accept', label: 'Accept', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                { value: 'weak_accept', label: 'Weak Accept', color: 'bg-green-100 text-green-700 border-green-200' },
                { value: 'weak_reject', label: 'Weak Reject', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                { value: 'reject', label: 'Reject', color: 'bg-red-100 text-red-700 border-red-200' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => draft && setDraft({ ...draft, recommendation: option.value })}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                    draft?.recommendation === option.value
                      ? option.color
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button className="w-full" onClick={handleGenerateDraft} disabled={isGenerating}>
              <RefreshCw className={cn('w-4 h-4 mr-1', isGenerating && 'animate-spin')} />
              重新生成
            </Button>
            <Button variant="secondary" className="w-full">
              保存审稿
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  items,
  isExpanded,
  onToggle,
  itemColor = 'text-gray-600',
}: {
  title: string;
  icon?: React.ReactNode;
  items: string[];
  isExpanded: boolean;
  onToggle: () => void;
  itemColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-900">{title}</span>
          <Badge variant="default" size="sm">{items.length}</Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-6 pb-4">
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index} className={cn('flex items-start gap-2 text-sm', itemColor)}>
                <span className="mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


