'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp,
  Plus, 
  Trash2, 
  Edit2, 
  Check,
  X,
  Sparkles,
  AlertTriangle,
  Target,
  Loader2,
  FileText,
  Shield,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { evidenceLedgerApi, cardApi } from '@/lib/api';
import type { EvidenceLedger as EvidenceLedgerType, Claim } from '@/types';

interface EvidenceLedgerProps {
  paperId: string;
  onAnchorClick?: (anchorId: string) => void;
  className?: string;
}

const strengthColors = {
  strong: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  weak: 'bg-red-100 text-red-700 border-red-200',
};

const strengthLabels = {
  strong: '强',
  medium: '中',
  weak: '弱',
};

const uncertaintyLabels = {
  from_text: '原文明确',
  inferred: '推断',
  needs_verify: '需验证',
};

const uncertaintyColors = {
  from_text: 'bg-blue-50 text-blue-600',
  inferred: 'bg-purple-50 text-purple-600',
  needs_verify: 'bg-orange-50 text-orange-600',
};

export function EvidenceLedger({ paperId, onAnchorClick, className }: EvidenceLedgerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ledger, setLedger] = useState<EvidenceLedgerType | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isAddingClaim, setIsAddingClaim] = useState(false);
  const [newClaimText, setNewClaimText] = useState('');

  // 加载台账
  const loadLedger = async () => {
    try {
      const response = await evidenceLedgerApi.get(paperId);
      if (response.evidence_ledger) {
        setLedger(response.evidence_ledger);
      }
    } catch (error) {
      console.error('加载证据台账失败:', error);
    }
  };

  // 生成台账
  const generateLedger = async (force: boolean = false) => {
    setIsLoading(true);
    try {
      const response = await evidenceLedgerApi.generate(paperId, force);
      setLedger(response.evidence_ledger);
      // 自动展开第一个
      if (response.evidence_ledger.claims.length > 0) {
        setExpandedClaims(new Set([response.evidence_ledger.claims[0].id]));
      }
    } catch (error) {
      console.error('生成证据台账失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 切换展开状态
  const toggleClaimExpand = (claimId: string) => {
    setExpandedClaims(prev => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  // 开始编辑
  const startEdit = (claim: Claim) => {
    setEditingClaimId(claim.id);
    setEditText(claim.text);
  };

  // 保存编辑
  const saveEdit = async (claimId: string) => {
    if (!editText.trim()) return;
    try {
      await evidenceLedgerApi.updateClaim(paperId, claimId, { text: editText });
      setLedger(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          claims: prev.claims.map(c => 
            c.id === claimId ? { ...c, text: editText } : c
          )
        };
      });
      setEditingClaimId(null);
      setEditText('');
    } catch (error) {
      console.error('更新主张失败:', error);
    }
  };

  // 更新强度
  const updateStrength = async (claimId: string, strength: 'strong' | 'medium' | 'weak') => {
    try {
      await evidenceLedgerApi.updateClaim(paperId, claimId, { strength });
      setLedger(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          claims: prev.claims.map(c => 
            c.id === claimId ? { ...c, strength } : c
          )
        };
      });
    } catch (error) {
      console.error('更新强度失败:', error);
    }
  };

  // 删除主张
  const deleteClaim = async (claimId: string) => {
    try {
      await evidenceLedgerApi.deleteClaim(paperId, claimId);
      setLedger(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          claims: prev.claims.filter(c => c.id !== claimId)
        };
      });
    } catch (error) {
      console.error('删除主张失败:', error);
    }
  };

  // 添加主张
  const addClaim = async () => {
    if (!newClaimText.trim()) return;
    try {
      const response = await evidenceLedgerApi.addClaim(paperId, newClaimText);
      setLedger(prev => {
        if (!prev) return { claims: [response.claim], overall_evidence_quality: 'medium', key_assumptions: [], methodology_concerns: [] };
        return {
          ...prev,
          claims: [...prev.claims, response.claim]
        };
      });
      setNewClaimText('');
      setIsAddingClaim(false);
    } catch (error) {
      console.error('添加主张失败:', error);
    }
  };

  // 转为卡片
  const convertToCard = async (claim: Claim) => {
    try {
      const response = await evidenceLedgerApi.claimToCard(paperId, claim.id);
      // 使用卡片数据创建卡片
      await cardApi.create(response.card_data);
      alert('已创建 EvidenceCard');
    } catch (error) {
      console.error('转换为卡片失败:', error);
    }
  };

  useEffect(() => {
    if (isOpen && !ledger) {
      loadLedger();
    }
  }, [isOpen, paperId]);

  return (
    <TooltipProvider>
      <div className={cn('border-t border-gray-200', className)}>
        {/* Header - 可折叠 */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-sm text-gray-800">主张-证据台账</span>
                {ledger && (
                  <Badge variant="outline" className="text-xs">
                    {ledger.claims.length} 条主张
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3">
              {/* 工具栏 */}
              <div className="flex items-center gap-2 mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateLedger(false)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {isLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  {ledger ? '重新生成' : '生成台账'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingClaim(true)}
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  添加主张
                </Button>
              </div>

              {/* 总体评估 */}
              {ledger && (
                <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>整体证据质量:</span>
                    <Badge className={cn('text-xs', strengthColors[ledger.overall_evidence_quality])}>
                      {strengthLabels[ledger.overall_evidence_quality]}
                    </Badge>
                  </div>
                  {ledger.key_assumptions.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="font-medium">关键假设:</span>
                      <ul className="list-disc list-inside mt-1">
                        {ledger.key_assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 主张列表 */}
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {/* 添加新主张 */}
                  {isAddingClaim && (
                    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <Textarea
                        value={newClaimText}
                        onChange={(e) => setNewClaimText(e.target.value)}
                        placeholder="输入新主张..."
                        className="text-sm min-h-[60px] mb-2"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addClaim} className="text-xs">
                          <Check className="w-3 h-3 mr-1" />
                          添加
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsAddingClaim(false)} className="text-xs">
                          <X className="w-3 h-3 mr-1" />
                          取消
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 加载状态 */}
                  {isLoading && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <p className="mt-2 text-sm text-gray-500">正在分析论文主张...</p>
                    </div>
                  )}

                  {/* 空状态 */}
                  {!isLoading && !ledger && (
                    <div className="text-center py-6 text-gray-500">
                      <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">点击"生成台账"自动提取论文主张</p>
                    </div>
                  )}

                  {/* 主张卡片 */}
                  {ledger?.claims.map((claim) => (
                    <ClaimItem
                      key={claim.id}
                      claim={claim}
                      isExpanded={expandedClaims.has(claim.id)}
                      isEditing={editingClaimId === claim.id}
                      editText={editText}
                      onToggleExpand={() => toggleClaimExpand(claim.id)}
                      onStartEdit={() => startEdit(claim)}
                      onSaveEdit={() => saveEdit(claim.id)}
                      onCancelEdit={() => setEditingClaimId(null)}
                      onEditTextChange={setEditText}
                      onUpdateStrength={(s) => updateStrength(claim.id, s)}
                      onDelete={() => deleteClaim(claim.id)}
                      onConvertToCard={() => convertToCard(claim)}
                      onAnchorClick={onAnchorClick}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}

// 单条主张组件
interface ClaimItemProps {
  claim: Claim;
  isExpanded: boolean;
  isEditing: boolean;
  editText: string;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onUpdateStrength: (strength: 'strong' | 'medium' | 'weak') => void;
  onDelete: () => void;
  onConvertToCard: () => void;
  onAnchorClick?: (anchorId: string) => void;
}

function ClaimItem({
  claim,
  isExpanded,
  isEditing,
  editText,
  onToggleExpand,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  onUpdateStrength,
  onDelete,
  onConvertToCard,
  onAnchorClick,
}: ClaimItemProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* 主张头部 */}
      <div
        className="flex items-start gap-2 p-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Textarea
                value={editText}
                onChange={(e) => onEditTextChange(e.target.value)}
                className="text-sm min-h-[60px]"
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={onSaveEdit} className="text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  保存
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit} className="text-xs">
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed">{claim.text}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge className={cn('text-xs', strengthColors[claim.strength])}>
            {strengthLabels[claim.strength]}
          </Badge>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && !isEditing && (
        <div className="px-3 pb-3 border-t border-gray-100 bg-gray-50">
          {/* 不确定性标签 */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">不确定性:</span>
            <Badge className={cn('text-xs', uncertaintyColors[claim.uncertainty])}>
              {uncertaintyLabels[claim.uncertainty]}
            </Badge>
          </div>

          {/* 证据摘要 */}
          {claim.evidence_summary && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-600">证据摘要:</span>
              <p className="text-xs text-gray-600 mt-1">{claim.evidence_summary}</p>
            </div>
          )}

          {/* 证据锚点 */}
          {claim.evidence_anchors.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-600">证据来源:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {claim.evidence_anchors.map((anchorId, i) => (
                  <button
                    key={i}
                    onClick={() => onAnchorClick?.(anchorId)}
                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    锚点 #{i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 替代解释 */}
          {claim.alternative_explanations.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                替代解释:
              </span>
              <ul className="list-disc list-inside mt-1">
                {claim.alternative_explanations.map((exp, i) => (
                  <li key={i} className="text-xs text-gray-600">{exp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 风险 */}
          {claim.risks.length > 0 && (
            <div className="mt-2">
              <span className="text-xs font-medium text-orange-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                潜在风险:
              </span>
              <ul className="list-disc list-inside mt-1">
                {claim.risks.map((risk, i) => (
                  <li key={i} className="text-xs text-orange-600">{risk}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200">
            <Select
              value={claim.strength}
              onValueChange={(v) => onUpdateStrength(v as 'strong' | 'medium' | 'weak')}
            >
              <SelectTrigger className="w-24 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong">强</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="weak">弱</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={onStartEdit} className="h-7 w-7 p-0">
                  <Edit2 className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={onConvertToCard} className="h-7 w-7 p-0">
                  <FileText className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>转为卡片</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}

