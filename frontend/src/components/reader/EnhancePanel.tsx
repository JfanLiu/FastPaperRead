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
} from 'lucide-react';

interface EnhancePanelProps {
  anchor: Anchor | null;
  paperId?: string;
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

export function EnhancePanel({
  anchor,
  paperId,
  className,
}: EnhancePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 解释结果
  const [termExplanation, setTermExplanation] = useState<TermExplanation | null>(null);
  const [figureExplanation, setFigureExplanation] = useState<FigureExplanation | null>(null);
  const [equationExplanation, setEquationExplanation] = useState<EquationExplanation | null>(null);
  const [sectionSummary, setSectionSummary] = useState<string | null>(null);
  
  const [activeType, setActiveType] = useState<ExplanationType | null>(null);

  if (!anchor) {
    return (
      <div className={cn('flex items-center justify-center h-full text-gray-400', className)}>
        <div className="text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">选择内容以获取AI解释</p>
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

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {getAnchorTypeIcon()}
          <span className="font-medium text-gray-900">AI 增强</span>
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
              <span className="text-xs font-medium text-gray-500">原文</span>
              <button
                onClick={() => handleCopy(anchor.text || '')}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
              {anchor.text || anchor.caption || '无内容'}
            </div>
          </div>

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
              <span className="text-xs font-medium text-gray-500 block mb-2">图片</span>
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
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">术语解释</span>
                <Badge variant="info" size="sm">AI</Badge>
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
                        <Badge key={i} variant="secondary" size="sm">{term}</Badge>
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
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-gray-900">图表解释</span>
                <Badge variant="success" size="sm">AI</Badge>
              </div>
              
              <div className="space-y-3 p-3 bg-emerald-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-gray-500">图表内容</span>
                  <p className="text-sm text-gray-700 mt-1">{figureExplanation.description}</p>
                </div>
                {figureExplanation.key_findings?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">关键发现</span>
                    <ul className="text-sm text-gray-700 mt-1 list-disc list-inside">
                      {figureExplanation.key_findings.map((finding, i) => (
                        <li key={i}>{finding}</li>
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
                    <span className="text-xs font-medium text-gray-500">局限性</span>
                    <ul className="text-sm text-gray-700 mt-1 list-disc list-inside">
                      {figureExplanation.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
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
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-900">公式解释</span>
                <Badge variant="warning" size="sm">AI</Badge>
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
                          <code className="px-1 bg-purple-100 rounded font-mono">{sym.symbol}</code>
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
              </div>
            </div>
          )}

          {/* Section Summary Result */}
          {!isLoading && sectionSummary && activeType === 'section' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">段落摘要</span>
                <Badge variant="info" size="sm">AI</Badge>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
                {sectionSummary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
