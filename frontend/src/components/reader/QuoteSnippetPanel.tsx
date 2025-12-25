'use client';

import { useState } from 'react';
import { 
  Quote,
  Copy,
  Check,
  Loader2,
  FileText,
  Lightbulb,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/common';
import { enhanceApiExtended } from '@/lib/api';
import type { QuoteSnippet } from '@/types';

interface QuoteSnippetPanelProps {
  paperId: string;
  selectedText: string;
  anchorId?: string;
  onClose?: () => void;
  className?: string;
}

export function QuoteSnippetPanel({
  paperId,
  selectedText,
  anchorId,
  onClose,
  className
}: QuoteSnippetPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuoteSnippet | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await enhanceApiExtended.generateQuoteSnippet(paperId, selectedText, anchorId);
      setResult(response.quote_snippet);
    } catch (err) {
      console.error('生成引用骨架失败:', err);
      setError('生成失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Quote className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-900">引用骨架生成</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {/* 原文展示 */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 mb-1">选中文本</div>
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed">
            "{selectedText}"
          </div>
        </div>

        {/* 生成按钮 */}
        {!result && (
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !selectedText.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Quote className="w-4 h-4 mr-2" />
                生成引用骨架
              </>
            )}
          </Button>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 结果展示 */}
        {result && (
          <div className="space-y-4">
            {/* 引用骨架 */}
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">引用骨架</span>
                </div>
                <button
                  onClick={() => handleCopy(result.skeleton, 'skeleton')}
                  className="p-1 text-indigo-500 hover:text-indigo-700"
                  title="复制"
                >
                  {copiedField === 'skeleton' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-sm text-indigo-900 leading-relaxed">{result.skeleton}</p>
            </div>

            {/* 改写版本 */}
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">改写版本</span>
                </div>
                <button
                  onClick={() => handleCopy(result.paraphrase, 'paraphrase')}
                  className="p-1 text-purple-500 hover:text-purple-700"
                  title="复制"
                >
                  {copiedField === 'paraphrase' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-sm text-purple-900 leading-relaxed">{result.paraphrase}</p>
            </div>

            {/* 关键要点 */}
            {result.key_points && result.key_points.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">可引用的关键点</div>
                <ul className="space-y-1">
                  {result.key_points.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-indigo-500 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 引用场景 */}
            {result.citation_context && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">适用场景</div>
                <p className="text-sm text-gray-600">{result.citation_context}</p>
              </div>
            )}

            {/* 写作建议 */}
            {result.writing_suggestions && result.writing_suggestions.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-xs font-medium text-amber-700 mb-2">写作建议</div>
                <ul className="space-y-1">
                  {result.writing_suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-amber-800">
                      {index + 1}. {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 重新生成按钮 */}
            <Button
              onClick={handleGenerate}
              variant="secondary"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                '重新生成'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
