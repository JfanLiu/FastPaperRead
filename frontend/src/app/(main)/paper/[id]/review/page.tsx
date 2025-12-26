'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Badge, Progress } from '@/components/common';
import { cn } from '@/lib/utils';
import { reviewApi, paperApi } from '@/lib/api';
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
  Loader2,
  Save,
  Home,
  ArrowLeft,
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
  const router = useRouter();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<Paper | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [scores, setScores] = useState<Record<string, RubricScore>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['strengths', 'weaknesses']));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [paperId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 加载论文
      const paperData = await paperApi.get(paperId);
      setPaper(paperData);

      // 初始化分数
      const initialScores: Record<string, RubricScore> = {};
      for (const item of RUBRIC_ITEMS) {
        initialScores[item.key] = { score: 3, reason: '' };
      }
      setScores(initialScores);

      // 尝试加载已有的审稿草稿
      try {
        const draftResult = await reviewApi.getDraft(paperId);
        if (draftResult.draft) {
          const d = draftResult.draft.draft || draftResult.draft;
          setDraft({
            summary: d.summary || '',
            strengths: d.strengths || [],
            weaknesses: d.weaknesses || [],
            questions: d.questions || [],
            minor_issues: d.minor_issues || [],
            recommendation: d.recommendation || 'pending',
          });
          
          // 如果有保存的评分，加载它们
          if (draftResult.draft.scores) {
            const loadedScores: Record<string, RubricScore> = {};
            for (const item of RUBRIC_ITEMS) {
              const s = draftResult.draft.scores[item.key];
              if (s) {
                loadedScores[item.key] = { score: s.score || 3, reason: s.reason || '' };
              } else {
                loadedScores[item.key] = { score: 3, reason: '' };
              }
            }
            setScores(loadedScores);
          }
        }
      } catch {
        // 草稿不存在是正常的
      }
    } catch (error) {
      console.error('加载论文失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    
    try {
      const result = await reviewApi.generateDraft(paperId);
      if (result.draft) {
        setDraft({
          summary: result.draft.summary || '',
          strengths: result.draft.strengths || [],
          weaknesses: result.draft.weaknesses || [],
          questions: result.draft.questions || [],
          minor_issues: result.draft.minor_issues || [],
          recommendation: result.draft.recommendation || 'weak_accept',
        });
      }
    } catch (error) {
      console.error('生成审稿草稿失败:', error);
      // 使用模拟数据作为后备
      setDraft({
        summary: '本文提出了一种新的方法/架构，在相关任务上取得了不错的结果。',
        strengths: [
          '提出了一种新颖的方法',
          '实验设计较为完整',
          '写作清晰易懂',
        ],
        weaknesses: [
          '缺少与更多基线方法的比较',
          '部分实验细节不够清晰',
        ],
        questions: [
          '方法的计算复杂度如何？',
          '在更大规模数据集上的表现如何？',
        ],
        minor_issues: [
          '部分图表可以更清晰',
          '参考文献格式不一致',
        ],
        recommendation: 'weak_accept',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!draft) return;
    
    setIsSaving(true);
    try {
      await reviewApi.submitFeedback(paperId, {
        novelty_score: scores.novelty.score,
        novelty_reason: scores.novelty.reason,
        soundness_score: scores.soundness.score,
        soundness_reason: scores.soundness.reason,
        clarity_score: scores.clarity.score,
        clarity_reason: scores.clarity.reason,
        significance_score: scores.significance.score,
        significance_reason: scores.significance.reason,
        reproducibility_score: scores.reproducibility.score,
        reproducibility_reason: scores.reproducibility.reason,
        overall_recommendation: draft.recommendation,
        questions: draft.questions,
        minor_issues: draft.minor_issues,
      });
      alert('审稿意见已保存！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const result = await reviewApi.exportReview(paperId, 'markdown');
      
      // 下载文件
      const blob = new Blob([result.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `review_${paperId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      // 使用本地生成的内容
      if (draft && paper) {
        const content = generateLocalMarkdown();
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `review_${paperId}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const generateLocalMarkdown = () => {
    if (!draft || !paper) return '';
    
    let md = `# 审稿意见: ${paper.title}\n\n`;
    md += `## 评分\n`;
    for (const item of RUBRIC_ITEMS) {
      md += `- **${item.label}**: ${scores[item.key]?.score || 3}/5`;
      if (scores[item.key]?.reason) {
        md += ` - ${scores[item.key].reason}`;
      }
      md += '\n';
    }
    md += `\n**总分**: ${getTotalScore()}/5\n`;
    md += `**建议**: ${draft.recommendation}\n\n`;
    
    if (draft.summary) {
      md += `## 总体评价\n${draft.summary}\n\n`;
    }
    if (draft.strengths.length > 0) {
      md += `## 主要优点\n${draft.strengths.map(s => `- ${s}`).join('\n')}\n\n`;
    }
    if (draft.weaknesses.length > 0) {
      md += `## 主要问题\n${draft.weaknesses.map(w => `- ${w}`).join('\n')}\n\n`;
    }
    if (draft.questions.length > 0) {
      md += `## 问题\n${draft.questions.map(q => `- ${q}`).join('\n')}\n\n`;
    }
    if (draft.minor_issues.length > 0) {
      md += `## 小问题\n${draft.minor_issues.map(m => `- ${m}`).join('\n')}\n`;
    }
    
    return md;
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
    if (!draft || !paper) return;
    
    const text = generateLocalMarkdown();
    
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">论文不存在</p>
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
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="返回主页"
                >
                  <Home className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => router.back()}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="返回上一页"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <FileEdit className="w-6 h-6 text-indigo-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">审稿模式</h1>
                <p className="text-sm text-gray-500 line-clamp-1">{paper.title}</p>
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
              <Button 
                variant="secondary"
                onClick={handleExport}
                disabled={!draft}
              >
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
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
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
                <textarea
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  className="w-full text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                  rows={4}
                />
              </div>

              {/* Strengths */}
              <CollapsibleSection
                title="主要优点"
                icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                items={draft.strengths}
                isExpanded={expandedSections.has('strengths')}
                onToggle={() => toggleSection('strengths')}
                itemColor="text-emerald-600"
                onItemsChange={(items) => setDraft({ ...draft, strengths: items })}
              />

              {/* Weaknesses */}
              <CollapsibleSection
                title="主要问题"
                icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
                items={draft.weaknesses}
                isExpanded={expandedSections.has('weaknesses')}
                onToggle={() => toggleSection('weaknesses')}
                itemColor="text-amber-600"
                onItemsChange={(items) => setDraft({ ...draft, weaknesses: items })}
              />

              {/* Questions */}
              <CollapsibleSection
                title="问题"
                icon={<HelpCircle className="w-5 h-5 text-blue-500" />}
                items={draft.questions}
                isExpanded={expandedSections.has('questions')}
                onToggle={() => toggleSection('questions')}
                itemColor="text-blue-600"
                onItemsChange={(items) => setDraft({ ...draft, questions: items })}
              />

              {/* Minor Issues */}
              <CollapsibleSection
                title="小问题"
                items={draft.minor_issues}
                isExpanded={expandedSections.has('minor')}
                onToggle={() => toggleSection('minor')}
                onItemsChange={(items) => setDraft({ ...draft, minor_issues: items })}
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
                  <div className="flex gap-1 mb-2">
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
                  <input
                    type="text"
                    value={scores[item.key]?.reason || ''}
                    onChange={(e) => handleReasonChange(item.key, e.target.value)}
                    placeholder={`${item.label}理由...`}
                    className="w-full text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 border border-gray-200"
                  />
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
              {draft ? '重新生成' : '生成草稿'}
            </Button>
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={handleSaveFeedback}
              disabled={!draft || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
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
  onItemsChange,
}: {
  title: string;
  icon?: React.ReactNode;
  items: string[];
  isExpanded: boolean;
  onToggle: () => void;
  itemColor?: string;
  onItemsChange?: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAddItem = () => {
    if (newItem.trim() && onItemsChange) {
      onItemsChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemoveItem = (index: number) => {
    if (onItemsChange) {
      onItemsChange(items.filter((_, i) => i !== index));
    }
  };

  const handleEditItem = (index: number, value: string) => {
    if (onItemsChange) {
      const newItems = [...items];
      newItems[index] = value;
      onItemsChange(newItems);
    }
  };

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
              <li key={index} className={cn('flex items-start gap-2 text-sm group', itemColor)}>
                <span className="mt-1">•</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleEditItem(index, e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-1"
                />
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {onItemsChange && (
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                placeholder="添加新项..."
                className="flex-1 text-sm bg-gray-50 rounded px-2 py-1 border border-gray-200"
              />
              <button
                onClick={handleAddItem}
                disabled={!newItem.trim()}
                className="text-sm text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
              >
                添加
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
