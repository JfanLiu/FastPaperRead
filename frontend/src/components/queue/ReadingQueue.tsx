'use client';

import { useState } from 'react';
import { Button, Badge, Progress } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Paper } from '@/types';
import {
  List,
  Clock,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Trash2,
  GripVertical,
  Target,
  Timer,
  CheckCircle,
} from 'lucide-react';

interface QueueItem {
  paper: Paper;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number; // minutes
  purpose: 'method' | 'experiment' | 'full' | 'skim';
  addedAt: string;
}

interface ReadingQueueProps {
  items: QueueItem[];
  currentItem?: QueueItem;
  onStartReading?: (paperId: string) => void;
  onPauseReading?: () => void;
  onRemoveItem?: (paperId: string) => void;
  onReorderItems?: (fromIndex: number, toIndex: number) => void;
  onChangePriority?: (paperId: string, priority: QueueItem['priority']) => void;
  className?: string;
}

const PRIORITY_CONFIG = {
  high: { label: '高', color: 'bg-red-100 text-red-700', order: 0 },
  medium: { label: '中', color: 'bg-amber-100 text-amber-700', order: 1 },
  low: { label: '低', color: 'bg-gray-100 text-gray-700', order: 2 },
};

const PURPOSE_CONFIG = {
  method: { label: '读方法', icon: '🔧' },
  experiment: { label: '读实验', icon: '🧪' },
  full: { label: '全读', icon: '📖' },
  skim: { label: '略读', icon: '👀' },
};

export function ReadingQueue({
  items,
  currentItem,
  onStartReading,
  onPauseReading,
  onRemoveItem,
  onReorderItems,
  onChangePriority,
  className,
}: ReadingQueueProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const sortedItems = [...items].sort((a, b) => {
    return PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order;
  });

  const totalEstimatedTime = items.reduce((sum, item) => sum + item.estimatedTime, 0);
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index && onReorderItems) {
      onReorderItems(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
        <div className="flex items-center gap-3">
          <List className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-semibold text-gray-900">待读队列</h2>
            <p className="text-sm text-gray-500">
              {items.length} 篇论文 · 预计 {formatTime(totalEstimatedTime)}
            </p>
          </div>
        </div>
      </div>

      {/* Current Reading */}
      {currentItem && (
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-sm font-medium text-indigo-900">正在阅读</span>
            </div>
            <Button size="sm" variant="secondary" onClick={onPauseReading}>
              <Pause className="w-4 h-4 mr-1" />
              暂停
            </Button>
          </div>
          <h3 className="font-medium text-gray-900 line-clamp-1">{currentItem.paper.title}</h3>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500">
              {PURPOSE_CONFIG[currentItem.purpose].icon} {PURPOSE_CONFIG[currentItem.purpose].label}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatTime(currentItem.estimatedTime)}
            </span>
          </div>
        </div>
      )}

      {/* Queue Items */}
      {items.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500">
          <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>队列为空</p>
          <p className="text-sm mt-1">从文献库添加论文到队列</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {sortedItems.map((item, index) => (
            <div
              key={item.paper.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors cursor-grab',
                draggedIndex === index && 'opacity-50',
                currentItem?.paper.id === item.paper.id && 'bg-indigo-50'
              )}
            >
              {/* Drag handle */}
              <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />

              {/* Priority indicator */}
              <div
                className={cn(
                  'w-2 h-8 rounded-full shrink-0',
                  item.priority === 'high' ? 'bg-red-500' :
                  item.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-300'
                )}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">{item.paper.title}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={PRIORITY_CONFIG[item.priority].color} size="sm">
                    {PRIORITY_CONFIG[item.priority].label}优先
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {PURPOSE_CONFIG[item.purpose].icon} {PURPOSE_CONFIG[item.purpose].label}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(item.estimatedTime)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {currentItem?.paper.id !== item.paper.id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onStartReading?.(item.paper.id)}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                <button
                  onClick={() => onRemoveItem?.(item.paper.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {items.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-red-600">
                {items.filter(i => i.priority === 'high').length}
              </div>
              <div className="text-xs text-gray-500">高优先</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-amber-600">
                {items.filter(i => i.priority === 'medium').length}
              </div>
              <div className="text-xs text-gray-500">中优先</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-600">
                {items.filter(i => i.priority === 'low').length}
              </div>
              <div className="text-xs text-gray-500">低优先</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


