'use client';

import { useState } from 'react';
import { Button, Badge, Input } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Paper } from '@/types';
import {
  X,
  Clock,
  Target,
  Flag,
  BookOpen,
  Wrench,
  FlaskConical,
  Zap,
} from 'lucide-react';

interface QueueConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  paper: Paper | null;
  onConfirm: (config: QueueConfig) => void;
}

interface QueueConfig {
  priority: 'high' | 'medium' | 'low';
  estimatedTime: number;
  purpose: 'method' | 'experiment' | 'full' | 'skim';
  notes?: string;
}

const PURPOSE_OPTIONS = [
  { value: 'method', label: '读方法', icon: Wrench, description: '专注于方法论和算法细节', time: 30 },
  { value: 'experiment', label: '读实验', icon: FlaskConical, description: '专注于实验设置和结果分析', time: 25 },
  { value: 'full', label: '全文精读', icon: BookOpen, description: '完整阅读全文', time: 60 },
  { value: 'skim', label: '快速略读', icon: Zap, description: '快速浏览重点内容', time: 15 },
];

const PRIORITY_OPTIONS = [
  { value: 'high', label: '高', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'medium', label: '中', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'low', label: '低', color: 'bg-gray-100 text-gray-700 border-gray-200' },
];

export function QueueConfigDrawer({
  isOpen,
  onClose,
  paper,
  onConfirm,
}: QueueConfigDrawerProps) {
  const [priority, setPriority] = useState<QueueConfig['priority']>('medium');
  const [purpose, setPurpose] = useState<QueueConfig['purpose']>('full');
  const [estimatedTime, setEstimatedTime] = useState(60);
  const [notes, setNotes] = useState('');

  const handlePurposeChange = (newPurpose: QueueConfig['purpose']) => {
    setPurpose(newPurpose);
    const option = PURPOSE_OPTIONS.find(o => o.value === newPurpose);
    if (option) {
      setEstimatedTime(option.time);
    }
  };

  const handleConfirm = () => {
    onConfirm({
      priority,
      purpose,
      estimatedTime,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">加入待读队列</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Paper Info */}
          {paper && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 line-clamp-2">{paper.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {paper.authors?.slice(0, 2).join(', ')} • {paper.year}
              </p>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Flag className="w-4 h-4" />
              优先级
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPriority(option.value as QueueConfig['priority'])}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                    priority === option.value
                      ? option.color
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Target className="w-4 h-4" />
              阅读目的
            </label>
            <div className="space-y-2">
              {PURPOSE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handlePurposeChange(option.value as QueueConfig['purpose'])}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors',
                    purpose === option.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <option.icon className={cn(
                    'w-5 h-5 mt-0.5',
                    purpose === option.value ? 'text-indigo-600' : 'text-gray-400'
                  )} />
                  <div>
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.description}</div>
                    <div className="text-xs text-gray-400 mt-1">约 {option.time} 分钟</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Time */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Clock className="w-4 h-4" />
              预计时间（分钟）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-gray-900 w-16 text-right">
                {estimatedTime} 分钟
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              备注（可选）
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如：重点关注第3节的实验设置..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleConfirm}>
              加入队列
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

