'use client';

import { useState } from 'react';
import { 
  FileText,
  Copy,
  Check,
  Loader2,
  Sparkles,
  AlertTriangle,
  Target,
  X,
  Edit2,
  Save,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { enhanceApiExtended, cardApi } from '@/lib/api';
import type { PaperCardFull, Card } from '@/types';

interface PaperCardGeneratorProps {
  paperId: string;
  onCardCreated?: (card: Card) => void;
  onClose?: () => void;
  className?: string;
}

export function PaperCardGenerator({
  paperId,
  onCardCreated,
  onClose,
  className
}: PaperCardGeneratorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<PaperCardFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResult, setEditedResult] = useState<PaperCardFull | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await enhanceApiExtended.generatePaperCardFull(paperId);
      setResult(response.paper_card);
      setEditedResult(response.paper_card);
    } catch (err) {
      console.error('生成 PaperCard 失败:', err);
      setError('生成失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedResult) return;
    
    setIsSaving(true);
    try {
      // 创建一个 paper 类型的卡片
      const cardData = {
        paper_id: paperId,
        type: 'paper' as const,
        title: editedResult.one_line_summary,
        content: JSON.stringify(editedResult),
        tags: ['paper-card', 'auto-generated'],
        status: 'final' as const,
      };
      
      const newCard = await cardApi.create(cardData);
      onCardCreated?.(newCard);
      setResult(editedResult);
      setIsEditing(false);
    } catch (err) {
      console.error('保存失败:', err);
      setError('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyAll = async () => {
    if (!result) return;
    
    const text = `# PaperCard

## 一句话总结
${result.one_line_summary}

## 主要贡献
${result.contributions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## 局限性
${result.limitations.map((l, i) => `${i + 1}. ${l}`).join('\n')}

## 适用范围
${result.applicable_scope}

## 复现风险
${result.repro_risk}

## 关键要点
${result.key_takeaways?.map((t, i) => `${i + 1}. ${t}`).join('\n') || ''}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayResult = isEditing ? editedResult : result;

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-900">生成 PaperCard</span>
        </div>
        <div className="flex items-center gap-1">
          {result && (
            <>
              <button
                onClick={handleCopyAll}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                title="复制全部"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  if (isEditing) {
                    setEditedResult(result);
                  }
                  setIsEditing(!isEditing);
                }}
                className={cn(
                  "p-1.5 rounded",
                  isEditing ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-gray-600"
                )}
                title={isEditing ? "取消编辑" : "编辑"}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {/* 初始状态 - 生成按钮 */}
        {!result && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <FileText className="w-12 h-12 text-indigo-200 mb-4" />
            <p className="text-gray-600 mb-4 text-center">
              基于论文内容和已有卡片生成完整的 PaperCard
            </p>
            <Button onClick={handleGenerate}>
              <Sparkles className="w-4 h-4 mr-2" />
              生成 PaperCard
            </Button>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="text-gray-600">正在分析论文内容...</p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {/* 结果展示 */}
        {displayResult && (
          <div className="space-y-4">
            {/* 一句话总结 */}
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="text-xs font-medium text-indigo-600 mb-1">一句话总结</div>
              {isEditing ? (
                <Textarea
                  value={editedResult?.one_line_summary || ''}
                  onChange={(e) => setEditedResult(prev => prev ? { ...prev, one_line_summary: e.target.value } : null)}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                  {displayResult.one_line_summary}
                </p>
              )}
            </div>

            {/* 主要贡献 */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <Target className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-medium text-gray-700">主要贡献</span>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {editedResult?.contributions.map((contribution, index) => (
                    <Textarea
                      key={index}
                      value={contribution}
                      onChange={(e) => {
                        const newContributions = [...(editedResult?.contributions || [])];
                        newContributions[index] = e.target.value;
                        setEditedResult(prev => prev ? { ...prev, contributions: newContributions } : null);
                      }}
                      className="text-sm"
                    />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {displayResult.contributions.map((contribution, index) => (
                    <li key={index} className="flex gap-2 p-2 bg-green-50 rounded-lg text-sm text-green-800">
                      <span className="font-bold text-green-600">{index + 1}.</span>
                      {contribution}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 局限性 */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-gray-700">局限性</span>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {editedResult?.limitations.map((limitation, index) => (
                    <Textarea
                      key={index}
                      value={limitation}
                      onChange={(e) => {
                        const newLimitations = [...(editedResult?.limitations || [])];
                        newLimitations[index] = e.target.value;
                        setEditedResult(prev => prev ? { ...prev, limitations: newLimitations } : null);
                      }}
                      className="text-sm"
                    />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {displayResult.limitations.map((limitation, index) => (
                    <li key={index} className="flex gap-2 p-2 bg-amber-50 rounded-lg text-sm text-amber-800">
                      <span className="font-bold text-amber-600">{index + 1}.</span>
                      {limitation}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 适用范围 */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs font-medium text-blue-600 mb-1">适用范围</div>
              {isEditing ? (
                <Textarea
                  value={editedResult?.applicable_scope || ''}
                  onChange={(e) => setEditedResult(prev => prev ? { ...prev, applicable_scope: e.target.value } : null)}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-blue-900 leading-relaxed">
                  {displayResult.applicable_scope}
                </p>
              )}
            </div>

            {/* 复现风险 */}
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-xs font-medium text-red-600 mb-1">复现风险</div>
              {isEditing ? (
                <Textarea
                  value={editedResult?.repro_risk || ''}
                  onChange={(e) => setEditedResult(prev => prev ? { ...prev, repro_risk: e.target.value } : null)}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-red-900 leading-relaxed">
                  {displayResult.repro_risk}
                </p>
              )}
            </div>

            {/* 关键要点 */}
            {displayResult.key_takeaways && displayResult.key_takeaways.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-700 mb-2">关键要点</div>
                <div className="flex flex-wrap gap-1">
                  {displayResult.key_takeaways.map((takeaway, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {takeaway}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    保存卡片
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditedResult(result);
                      setIsEditing(false);
                    }}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleGenerate} variant="outline" disabled={isLoading} className="flex-1">
                    重新生成
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    保存
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

