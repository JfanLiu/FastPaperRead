'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/common';
import { enhanceApi } from '@/lib/api';
import type { Anchor } from '@/types';
import {
  Sparkles,
  BookOpen,
  Calculator,
  Image,
  MessageSquare,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText,
  Search,
  Layers,
  Zap,
  GraduationCap,
  ExternalLink,
  HelpCircle,
  Plus,
  ListChecks,
} from 'lucide-react';

interface EnhancePanelProps {
  anchor: Anchor | null;
  paperId?: string;
  onCreateCard?: (text: string, type: string) => void;
  onAddToChecklist?: (text: string) => void;
  className?: string;
}

interface TermExplanation {
  definition: string;
  explanation: string;
  examples: string[];
  related_terms: string[];
}

interface FigureExplanation {
  description: string;
  key_findings: string[];
  interpretation: string;
  limitations: string[];
  related_content?: string;
}

interface EquationExplanation {
  explanation: string;
  symbols: { symbol: string; meaning: string }[];
  derivation_hint?: string;
  usage: string;
  related_equations?: string[];
}

type ExplanationType = 'term' | 'figure' | 'equation' | 'section';
type ExplanationLevel = 'one_liner' | 'plain' | 'strict';

const levelConfig: Record<ExplanationLevel, { label: string; icon: React.ElementType; description: string }> = {
  one_liner: { label: '一句话', icon: Zap, description: '简明扼要的定义' },
  plain: { label: '通俗版', icon: BookOpen, description: '易懂的解释，适合入门' },
  strict: { label: '严格版', icon: GraduationCap, description: '学术精确的定义' },
};

export function EnhancePanel({
  anchor,
  paperId,
  onCreateCard,
  onAddToChecklist,
  className,
}: EnhancePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 解释级别
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>('plain');
  
  // 解释结果
  const [termExplanation, setTermExplanation] = useState<TermExplanation | null>(null);
  const [figureExplanation, setFigureExplanation] = useState<FigureExplanation | null>(null);
  const [equationExplanation, setEquationExplanation] = useState<EquationExplanation | null>(null);
  const [sectionSummary, setSectionSummary] = useState<string | null>(null);
  
  const [activeType, setActiveType] = useState<ExplanationType | null>(null);

  if (!anchor) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full text-gray-400 p-6', className)}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">AI 阅读增强</h3>
          <p className="text-sm">选择文本、图表或公式获取智能解释</p>
          <div className="mt-4 space-y-2 text-xs text-left">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>术语解释 - 三层深度可选</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Image className="w-4 h-4 text-emerald-500" />
              <span>图表解读 - 关键发现与局限</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Calculator className="w-4 h-4 text-purple-500" />
              <span>公式解析 - 符号表与推导</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearResults = () => {
    setTermExplanation(null);
    setFigureExplanation(null);
    setEquationExplanation(null);
    setSectionSummary(null);
    setError(null);
  };

  const handleExplainTerm = async () => {
    if (!anchor.id || !selectedTerm.trim()) {
      setError('请先选择或输入要解释的术语');
      return;
    }
    
    setIsLoading(true);
    clearResults();
    setActiveType('term');
    
    try {
      const response = await enhanceApi.enhance({
        paper_id: paperId || '',
        anchor_id: anchor.id,
        enhance_type: 'term',
        selected_text: selectedTerm,
        level: explanationLevel, // 传递解释级别
      });
      
      if (response.term) {
        setTermExplanation(response.term);
      } else if (response.explanation) {
        setTermExplanation(response.explanation);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '解释失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplainFigure = async () => {
    if (!anchor.id) return;
    
    setIsLoading(true);
    clearResults();
    setActiveType('figure');
    
    try {
      const response = await enhanceApi.enhance({
        paper_id: paperId || '',
        anchor_id: anchor.id,
        enhance_type: 'figure',
      });
      
      if (response.figure) {
        setFigureExplanation(response.figure);
      } else if (response.explanation) {
        setFigureExplanation(response.explanation);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '解释失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplainEquation = async () => {
    if (!anchor.id) return;
    
    setIsLoading(true);
    clearResults();
    setActiveType('equation');
    
    try {
      const response = await enhanceApi.enhance({
        paper_id: paperId || '',
        anchor_id: anchor.id,
        enhance_type: 'equation',
      });
      
      if (response.equation) {
        setEquationExplanation(response.equation);
      } else if (response.explanation) {
        setEquationExplanation(response.explanation);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '解释失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeSection = async () => {
    if (!anchor.id) return;
    
    setIsLoading(true);
    clearResults();
    setActiveType('section');
    
    try {
      const response = await enhanceApi.enhance({
        paper_id: paperId || '',
        anchor_id: anchor.id,
        enhance_type: 'paragraph',
        level: explanationLevel,
      });
      
      setSectionSummary(response.summary || response.explanation || '');
    } catch (err: unknown) {
      setError((err as Error).message || '总结失败');
    } finally {
      setIsLoading(false);
    }
  };

  const getAnchorTypeIcon = () => {
    switch (anchor.type) {
      case 'figure':
        return <Image className="w-5 h-5 text-emerald-600" />;
      case 'equation':
        return <Calculator className="w-5 h-5 text-purple-600" />;
      case 'section':
        return <FileText className="w-5 h-5 text-blue-600" />;
      default:
        return <BookOpen className="w-5 h-5 text-indigo-600" />;
    }
  };

  const getAnchorTypeLabel = () => {
    switch (anchor.type) {
      case 'figure': return '图表';
      case 'equation': return '公式';
      case 'section': return '章节';
      case 'table': return '表格';
      default: return '段落';
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          {getAnchorTypeIcon()}
          <span className="font-medium text-gray-900">AI 增强</span>
          <Badge variant="secondary" size="sm">{getAnchorTypeLabel()}</Badge>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Original content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">原文内容</span>
              <div className="flex items-center gap-1">
                {anchor.page && (
                  <span className="text-xs text-gray-400">第 {anchor.page} 页</span>
                )}
                <button
                  onClick={() => handleCopy(anchor.text || '')}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="复制"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
              {anchor.text || anchor.caption || '无内容'}
            </div>
          </div>

          {/* Explanation level selector - for term and section */}
          {(anchor.type === 'paragraph' || anchor.type === 'section' || !anchor.type) && (
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-2">解释深度</span>
              <div className="flex gap-1">
                {Object.entries(levelConfig).map(([level, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={level}
                      onClick={() => setExplanationLevel(level as ExplanationLevel)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-all',
                        explanationLevel === level
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Term input for paragraph type */}
          {(anchor.type === 'paragraph' || !anchor.type) && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">
                输入要解释的术语
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  placeholder="例如: attention mechanism"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleExplainTerm()}
                />
                <Button
                  size="sm"
                  onClick={handleExplainTerm}
                  disabled={isLoading || !selectedTerm.trim()}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons based on anchor type */}
          <div className="flex flex-wrap gap-2">
            {(anchor.type === 'paragraph' || !anchor.type) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSummarizeSection}
                disabled={isLoading}
              >
                <FileText className="w-4 h-4 mr-1" />
                总结段落
              </Button>
            )}
            {anchor.type === 'figure' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExplainFigure}
                disabled={isLoading}
              >
                <Image className="w-4 h-4 mr-1" />
                解释图表
              </Button>
            )}
            {anchor.type === 'equation' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExplainEquation}
                disabled={isLoading}
              >
                <Calculator className="w-4 h-4 mr-1" />
                解释公式
              </Button>
            )}
            {anchor.type === 'section' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSummarizeSection}
                disabled={isLoading}
              >
                <FileText className="w-4 h-4 mr-1" />
                章节摘要
              </Button>
            )}
            {anchor.type === 'table' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExplainFigure}
                disabled={isLoading}
              >
                <Layers className="w-4 h-4 mr-1" />
                解析表格
              </Button>
            )}
          </div>

          {/* Equation specific: LaTeX */}
          {anchor.type === 'equation' && anchor.latex && (
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-2">LaTeX</span>
              <div className="p-3 bg-purple-50 rounded-lg font-mono text-sm text-purple-900 overflow-x-auto">
                {anchor.latex}
              </div>
            </div>
          )}

          {/* Figure specific: Image */}
          {anchor.type === 'figure' && anchor.image_path && (
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-2">图片预览</span>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={anchor.image_path}
                  alt={anchor.caption || 'Figure'}
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="ml-2 text-sm text-gray-600">AI 正在分析...</span>
            </div>
          )}

          {/* Term Explanation Result */}
          {!isLoading && termExplanation && activeType === 'term' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-900">术语解释</span>
                  <Badge variant="info" size="sm">{levelConfig[explanationLevel].label}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onCreateCard?.(JSON.stringify(termExplanation), 'method')}
                    className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    title="创建卡片"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 p-3 bg-indigo-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-gray-500">定义</span>
                  <p className="text-sm text-gray-700 mt-1">{termExplanation.definition}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">通俗解释</span>
                  <p className="text-sm text-gray-700 mt-1">{termExplanation.explanation}</p>
                </div>
                {termExplanation.examples?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">示例</span>
                    <ul className="text-sm text-gray-700 mt-1 list-disc list-inside">
                      {termExplanation.examples.map((ex, i) => (
                        <li key={i}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {termExplanation.related_terms?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">相关术语</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {termExplanation.related_terms.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedTerm(term)}
                          className="px-2 py-0.5 text-xs bg-white border border-indigo-200 text-indigo-700 rounded-full hover:bg-indigo-100"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Figure Explanation Result */}
          {!isLoading && figureExplanation && activeType === 'figure' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-900">图表解释</span>
                  <Badge variant="success" size="sm">AI</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onCreateCard?.(JSON.stringify(figureExplanation), 'evidence')}
                    className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                    title="创建卡片"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 p-3 bg-emerald-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-gray-500">图表内容</span>
                  <p className="text-sm text-gray-700 mt-1">{figureExplanation.description}</p>
                </div>
                {figureExplanation.key_findings?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">关键发现</span>
                    <ul className="text-sm text-gray-700 mt-1 space-y-1">
                      {figureExplanation.key_findings.map((finding, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-gray-500">解读</span>
                  <p className="text-sm text-gray-700 mt-1">{figureExplanation.interpretation}</p>
                </div>
                {figureExplanation.limitations?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">局限性 / 替代解释</span>
                    <ul className="text-sm text-gray-700 mt-1 space-y-1">
                      {figureExplanation.limitations.map((lim, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Equation Explanation Result */}
          {!isLoading && equationExplanation && activeType === 'equation' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">公式解释</span>
                  <Badge variant="warning" size="sm">AI</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onCreateCard?.(JSON.stringify(equationExplanation), 'method')}
                    className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                    title="创建卡片"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 p-3 bg-purple-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-gray-500">公式含义</span>
                  <p className="text-sm text-gray-700 mt-1">{equationExplanation.explanation}</p>
                </div>
                {equationExplanation.symbols?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">符号表</span>
                    <div className="mt-1 space-y-1">
                      {equationExplanation.symbols.map((sym, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <code className="px-1.5 py-0.5 bg-purple-100 rounded font-mono text-purple-800">{sym.symbol}</code>
                          <span className="text-gray-500">→</span>
                          <span className="text-gray-700">{sym.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {equationExplanation.derivation_hint && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">推导提示</span>
                    <p className="text-sm text-gray-700 mt-1">{equationExplanation.derivation_hint}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-gray-500">用途</span>
                  <p className="text-sm text-gray-700 mt-1">{equationExplanation.usage}</p>
                </div>
                {equationExplanation.related_equations && equationExplanation.related_equations.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">相关公式</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {equationExplanation.related_equations.map((eq, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-white border border-purple-200 text-purple-700 rounded-full">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section Summary Result */}
          {!isLoading && sectionSummary && activeType === 'section' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">段落摘要</span>
                  <Badge variant="info" size="sm">{levelConfig[explanationLevel].label}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onCreateCard?.(sectionSummary, 'note')}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="创建卡片"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onAddToChecklist?.(sectionSummary)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="加入清单"
                  >
                    <ListChecks className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                {sectionSummary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uncertainty notice */}
      {expanded && (termExplanation || figureExplanation || equationExplanation || sectionSummary) && (
        <div className="px-4 py-2 border-t border-gray-100 bg-amber-50 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>AI 生成内容可能包含推测，请结合原文验证</span>
          </div>
        </div>
      )}
    </div>
  );
}
