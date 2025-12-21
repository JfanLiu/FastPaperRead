'use client';

import { useState } from 'react';
import { Button, Badge, Progress } from '@/components/common';
import { cn } from '@/lib/utils';
import type { ChecklistItem, ReproChecklist as ReproChecklistType } from '@/types';
import {
  ListChecks,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Search,
} from 'lucide-react';

interface ReproChecklistProps {
  checklist: ReproChecklistType;
  onItemToggle?: (index: number, field: 'missing' | 'needs_verify') => void;
  onAddItem?: (item: Omit<ChecklistItem, 'source_anchor'>) => void;
  onRemoveItem?: (index: number) => void;
  onFindMissing?: () => void;
  onAnchorClick?: (anchorId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const GROUP_CONFIG = {
  data: { label: '数据', color: 'bg-blue-100 text-blue-700' },
  model: { label: '模型', color: 'bg-purple-100 text-purple-700' },
  training: { label: '训练', color: 'bg-amber-100 text-amber-700' },
  evaluation: { label: '评估', color: 'bg-green-100 text-green-700' },
  code: { label: '代码/环境', color: 'bg-gray-100 text-gray-700' },
};

export function ReproChecklist({
  checklist,
  onItemToggle,
  onAddItem,
  onRemoveItem,
  onFindMissing,
  onAnchorClick,
  isLoading,
  className,
}: ReproChecklistProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(Object.keys(GROUP_CONFIG))
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemGroup, setNewItemGroup] = useState<string>('data');

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const handleAddItem = () => {
    if (newItemText.trim() && onAddItem) {
      onAddItem({
        group: newItemGroup,
        text: newItemText.trim(),
        missing: true,
        needs_verify: false,
      });
      setNewItemText('');
      setShowAddForm(false);
    }
  };

  // 按组分类
  const groupedItems: Record<string, { item: ChecklistItem; index: number }[]> = {};
  checklist.items.forEach((item, index) => {
    const group = item.group || 'other';
    if (!groupedItems[group]) {
      groupedItems[group] = [];
    }
    groupedItems[group].push({ item, index });
  });

  const getVerdictConfig = (verdict: string) => {
    switch (verdict) {
      case 'good':
        return { label: '良好', color: 'text-emerald-600', bgColor: 'bg-emerald-50' };
      case 'fair':
        return { label: '一般', color: 'text-amber-600', bgColor: 'bg-amber-50' };
      case 'poor':
        return { label: '困难', color: 'text-red-600', bgColor: 'bg-red-50' };
      default:
        return { label: '未知', color: 'text-gray-600', bgColor: 'bg-gray-50' };
    }
  };

  const verdictConfig = getVerdictConfig(checklist.repro_verdict);

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-amber-600" />
          <div>
            <h2 className="font-semibold text-gray-900">复现清单</h2>
            <p className="text-sm text-gray-500">
              {checklist.found_items}/{checklist.total_items} 项已找到
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn('px-3 py-1 rounded-full text-sm font-medium', verdictConfig.bgColor, verdictConfig.color)}>
            可复现性: {verdictConfig.label}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={onFindMissing}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-1" />
            )}
            查找缺失
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">完整度</span>
          <span className="text-sm font-medium text-gray-900">
            {Math.round(checklist.completeness_score * 100)}%
          </span>
        </div>
        <Progress value={checklist.completeness_score * 100} className="h-2" />
      </div>

      {/* Groups */}
      <div className="divide-y divide-gray-100">
        {Object.entries(GROUP_CONFIG).map(([group, config]) => {
          const items = groupedItems[group] || [];
          const missingCount = items.filter(i => i.item.missing).length;
          const isExpanded = expandedGroups.has(group);

          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge className={config.color}>{config.label}</Badge>
                  <span className="text-sm text-gray-500">
                    {items.length} 项
                    {missingCount > 0 && (
                      <span className="text-red-500 ml-1">({missingCount} 缺失)</span>
                    )}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="px-6 pb-4">
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">暂无条目</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map(({ item, index }) => (
                        <ChecklistItemRow
                          key={index}
                          item={item}
                          index={index}
                          onToggle={onItemToggle}
                          onRemove={onRemoveItem}
                          onAnchorClick={onAnchorClick}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Item */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        {showAddForm ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={newItemGroup}
                onChange={(e) => setNewItemGroup(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.entries(GROUP_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="输入检查项..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddItem}>
                添加
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <Plus className="w-4 h-4" />
            添加检查项
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistItemRow({
  item,
  index,
  onToggle,
  onRemove,
  onAnchorClick,
}: {
  item: ChecklistItem;
  index: number;
  onToggle?: (index: number, field: 'missing' | 'needs_verify') => void;
  onRemove?: (index: number) => void;
  onAnchorClick?: (anchorId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <li
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg transition-colors',
        item.missing ? 'bg-red-50' : 'bg-green-50',
        showActions && 'ring-1 ring-indigo-200'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={() => onToggle?.(index, 'missing')}
        className={cn(
          'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
          item.missing
            ? 'border-red-300 text-red-500 hover:bg-red-100'
            : 'border-green-500 bg-green-500 text-white'
        )}
      >
        {!item.missing && <CheckCircle className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', item.missing ? 'text-gray-700' : 'text-gray-600 line-through')}>
          {item.text}
        </p>
        
        <div className="flex items-center gap-2 mt-1">
          {item.needs_verify && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <HelpCircle className="w-3 h-3" />
              需确认
            </span>
          )}
          
          {item.source_anchor && (
            <button
              onClick={() => onAnchorClick?.(item.source_anchor!)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink className="w-3 h-3" />
              查看来源
            </button>
          )}
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggle?.(index, 'needs_verify')}
            className={cn(
              'p-1 rounded transition-colors',
              item.needs_verify
                ? 'text-amber-500 bg-amber-100'
                : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'
            )}
            title="标记为需确认"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemove?.(index)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </li>
  );
}

