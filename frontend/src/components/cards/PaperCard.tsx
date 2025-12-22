'use client';

import { useState } from 'react';
import { Badge, Button } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';
import {
  FileText,
  Edit3,
  Trash2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';

interface PaperCardProps {
  card: Card;
  onEdit?: (card: Card) => void;
  onDelete?: (cardId: string) => void;
  onFinalize?: (cardId: string) => void;
  className?: string;
}

export function PaperCard({ card, onEdit, onDelete, onFinalize, className }: PaperCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getUncertaintyConfig = (uncertainty: string) => {
    switch (uncertainty) {
      case 'from_text':
        return { icon: CheckCircle, color: 'text-emerald-500', label: '来自原文' };
      case 'inferred':
        return { icon: AlertCircle, color: 'text-amber-500', label: '推测' };
      default:
        return { icon: AlertCircle, color: 'text-red-500', label: '需确认' };
    }
  };

  const uncertaintyConfig = getUncertaintyConfig(card.uncertainty);
  const UncertaintyIcon = uncertaintyConfig.icon;

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{card.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant={card.status === 'final' ? 'success' : 'default'}
                size="sm"
              >
                {card.status === 'final' ? '已定稿' : '草稿'}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <UncertaintyIcon className={cn('w-3 h-3', uncertaintyConfig.color)} />
                {uncertaintyConfig.label}
              </span>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              {onEdit && (
                <button
                  onClick={() => { onEdit(card); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit3 className="w-4 h-4" />
                  编辑
                </button>
              )}
              {onFinalize && card.status !== 'final' && (
                <button
                  onClick={() => { onFinalize(card.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  定稿
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onDelete(card.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* One-line summary */}
        {card.one_line_summary && (
          <p className="text-sm text-gray-700 mb-3 font-medium">
            {card.one_line_summary}
          </p>
        )}

        {/* Contributions */}
        {card.contributions && card.contributions.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-500 mb-1">贡献</h4>
            <ul className="space-y-1">
              {card.contributions.slice(0, 3).map((c, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-1">
                  <span className="text-indigo-500">•</span>
                  <span className="line-clamp-1">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Limitations */}
        {card.limitations && card.limitations.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-500 mb-1">局限</h4>
            <ul className="space-y-1">
              {card.limitations.slice(0, 2).map((l, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-1">
                  <span className="text-amber-500">•</span>
                  <span className="line-clamp-1">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Source anchors */}
        {card.source_anchor_ids && card.source_anchor_ids.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
              <ExternalLink className="w-3 h-3" />
              查看 {card.source_anchor_ids.length} 个来源
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


