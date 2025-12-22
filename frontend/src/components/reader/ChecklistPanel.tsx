'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/common';
import type { Anchor } from '@/types';
import {
  Plus,
  ListChecks,
  Database,
  Cpu,
  BarChart3,
  Settings,
  AlertCircle,
  Check,
  X,
  Edit3,
  Trash2,
  ExternalLink,
  Search,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  group: 'data' | 'preprocess' | 'training' | 'eval' | 'env';
  text: string;
  source_anchor?: string;
  missing: boolean;
  needs_verify: boolean;
  value?: string;
}

interface ChecklistPanelProps {
  items: ChecklistItem[];
  paperId: string;
  onAddItem?: (item: Omit<ChecklistItem, 'id'>) => void;
  onUpdateItem?: (itemId: string, item: Partial<ChecklistItem>) => void;
  onDeleteItem?: (itemId: string) => void;
  onJumpToAnchor?: (anchorId: string) => void;
  onFindMissing?: () => void;
  className?: string;
}

const groupConfig = {
  data: { 
    label: '数据', 
    icon: Database, 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  preprocess: { 
    label: '预处理', 
    icon: Settings, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  training: { 
    label: '训练', 
    icon: Cpu, 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  eval: { 
    label: '评估', 
    icon: BarChart3, 
    color: 'text-emerald-600', 
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  },
  env: { 
    label: '环境', 
    icon: Settings, 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
};

export function ChecklistPanel({
  items,
  paperId,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onJumpToAnchor,
  onFindMissing,
  className,
}: ChecklistPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Omit<ChecklistItem, 'id'>>({
    group: 'data',
    text: '',
    missing: false,
    needs_verify: false,
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(Object.keys(groupConfig))
  );

  // 按组分类
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const missingCount = items.filter(i => i.missing).length;
  const verifyCount = items.filter(i => i.needs_verify).length;

  const handleAddItem = () => {
    if (newItem.text.trim()) {
      onAddItem?.(newItem);
      setNewItem({
        group: 'data',
        text: '',
        missing: false,
        needs_verify: false,
      });
      setIsAdding(false);
    }
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-900">复现清单</span>
          <Badge variant="secondary" size="sm">{items.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-1" />
          添加
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-3 py-2 border-b border-gray-100">
        {missingCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{missingCount} 缺失</span>
          </div>
        )}
        {verifyCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{verifyCount} 待确认</span>
          </div>
        )}
        <button
          onClick={onFindMissing}
          className="flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-full text-xs ml-auto"
        >
          <Search className="w-3.5 h-3.5" />
          扫描缺失
        </button>
      </div>

      {/* Add item form */}
      {isAdding && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            {/* Group selector */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(groupConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setNewItem({ ...newItem, group: key as ChecklistItem['group'] })}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 text-xs rounded-lg border transition-colors',
                    newItem.group === key
                      ? `${config.bgColor} ${config.color} ${config.borderColor}`
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <config.icon className="w-3 h-3" />
                  {config.label}
                </button>
              ))}
            </div>

            {/* Text input */}
            <input
              type="text"
              value={newItem.text}
              onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
              placeholder="例如：学习率 = 1e-4"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            />

            {/* Flags */}
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItem.missing}
                  onChange={(e) => setNewItem({ ...newItem, missing: e.target.checked })}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                标记为缺失
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItem.needs_verify}
                  onChange={(e) => setNewItem({ ...newItem, needs_verify: e.target.checked })}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                需要确认
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setIsAdding(false)}>
                取消
              </Button>
              <Button size="sm" onClick={handleAddItem}>
                添加
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist items by group */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Object.entries(groupConfig).map(([groupKey, config]) => {
          const groupItems = groupedItems[groupKey] || [];
          const isExpanded = expandedGroups.has(groupKey);
          const Icon = config.icon;

          return (
            <div key={groupKey} className={cn(
              'border rounded-lg overflow-hidden',
              config.borderColor
            )}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(groupKey)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 transition-colors',
                  config.bgColor
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', config.color)} />
                  <span className={cn('text-sm font-medium', config.color)}>
                    {config.label}
                  </span>
                  <Badge variant="secondary" size="sm">{groupItems.length}</Badge>
                </div>
                <span className="text-xs text-gray-400">
                  {isExpanded ? '收起' : '展开'}
                </span>
              </button>

              {/* Group items */}
              {isExpanded && (
                <div className="bg-white divide-y divide-gray-100">
                  {groupItems.length > 0 ? (
                    groupItems.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-start gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        {/* Status indicators */}
                        <div className="flex flex-col items-center gap-1 mt-0.5">
                          {item.missing ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm',
                            item.missing ? 'text-red-700' : 'text-gray-700'
                          )}>
                            {item.text}
                          </p>
                          {item.value && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              值: <code className="px-1 bg-gray-100 rounded">{item.value}</code>
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {item.needs_verify && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                                <HelpCircle className="w-3 h-3" />
                                待确认
                              </span>
                            )}
                            {item.source_anchor && (
                              <button
                                onClick={() => onJumpToAnchor?.(item.source_anchor!)}
                                className="inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-700"
                              >
                                <ExternalLink className="w-3 h-3" />
                                来源
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={() => onUpdateItem?.(item.id, { missing: !item.missing })}
                            className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                            title={item.missing ? '标记为已有' : '标记为缺失'}
                          >
                            {item.missing ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => onDeleteItem?.(item.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                      暂无条目
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI assist */}
      <div className="p-3 border-t border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <button
          onClick={onFindMissing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 rounded-lg text-indigo-700 hover:bg-indigo-50 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">AI 扫描缺失项</span>
        </button>
      </div>
    </div>
  );
}

