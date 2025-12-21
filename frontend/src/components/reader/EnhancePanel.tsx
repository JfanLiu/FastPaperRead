'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/common';
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
} from 'lucide-react';

interface EnhancePanelProps {
  anchor: Anchor | null;
  onExplainTerm?: (term: string) => void;
  onExplainFigure?: () => void;
  onExplainEquation?: () => void;
  className?: string;
}

interface ExplanationCache {
  term?: Record<string, TermExplanation>;
  figure?: FigureExplanation;
  equation?: EquationExplanation;
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
}

interface EquationExplanation {
  explanation: string;
  symbols: { symbol: string; meaning: string }[];
  derivation_hint?: string;
  usage: string;
}

export function EnhancePanel({
  anchor,
  onExplainTerm,
  onExplainFigure,
  onExplainEquation,
  className,
}: EnhancePanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationCache | null>(null);
  const [expanded, setExpanded] = useState(true);

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

  const getAnchorTypeIcon = () => {
    switch (anchor.type) {
      case 'figure':
        return <Image className="w-5 h-5 text-emerald-600" />;
      case 'equation':
        return <Calculator className="w-5 h-5 text-purple-600" />;
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
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
              {anchor.text || anchor.caption || '无内容'}
            </div>
          </div>

          {/* Action buttons based on anchor type */}
          <div className="flex flex-wrap gap-2">
            {anchor.type === 'paragraph' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onExplainTerm?.('')}
                disabled={isLoading}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                解释术语
              </Button>
            )}
            {anchor.type === 'figure' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onExplainFigure}
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
                onClick={onExplainEquation}
                disabled={isLoading}
              >
                <Calculator className="w-4 h-4 mr-1" />
                解释公式
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

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="ml-2 text-sm text-gray-600">AI 正在分析...</span>
            </div>
          )}

          {/* Explanation result placeholder */}
          {!isLoading && explanation && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-gray-900">AI 解释</span>
                <Badge variant="info" size="sm">GPT-4</Badge>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg text-sm text-gray-700">
                {/* Placeholder for actual explanation */}
                解释内容将在这里显示...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

