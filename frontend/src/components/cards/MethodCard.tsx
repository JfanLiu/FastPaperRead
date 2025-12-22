'use client';

import { useState } from 'react';
import { Badge } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';
import {
  Wrench,
  Edit3,
  Trash2,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Code,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface MethodCardProps {
  card: Card;
  onEdit?: (card: Card) => void;
  onDelete?: (cardId: string) => void;
  className?: string;
}

export function MethodCard({ card, onEdit, onDelete, className }: MethodCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">
              {card.method_name || card.title}
            </h3>
            {card.complexity && (
              <Badge variant="info" size="sm" className="mt-1">
                {card.complexity}
              </Badge>
            )}
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
        {/* Inputs and Outputs */}
        {(card.inputs?.length || card.outputs?.length) && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            {/* Inputs */}
            <div className="flex-1">
              <span className="text-xs font-medium text-gray-500 block mb-1">输入</span>
              <div className="flex flex-wrap gap-1">
                {card.inputs?.map((input, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                    {input}
                  </span>
                )) || <span className="text-xs text-gray-400">-</span>}
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />

            {/* Outputs */}
            <div className="flex-1">
              <span className="text-xs font-medium text-gray-500 block mb-1">输出</span>
              <div className="flex flex-wrap gap-1">
                {card.outputs?.map((output, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                    {output}
                  </span>
                )) || <span className="text-xs text-gray-400">-</span>}
              </div>
            </div>
          </div>
        )}

        {/* Process */}
        {card.process && (
          <div className="mb-3">
            <h4 className="text-xs font-medium text-gray-500 mb-1">流程</h4>
            <p className="text-sm text-gray-700">{card.process}</p>
          </div>
        )}

        {/* Expandable sections */}
        {(card.assumptions?.length || card.pseudocode) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? '收起详情' : '展开详情'}
          </button>
        )}

        {expanded && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            {/* Assumptions */}
            {card.assumptions && card.assumptions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                  假设
                </h4>
                <ul className="space-y-1">
                  {card.assumptions.map((assumption, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-1">
                      <span className="text-amber-500">!</span>
                      {assumption}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pseudocode */}
            {card.pseudocode && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  伪代码
                </h4>
                <pre className="p-3 bg-gray-900 text-gray-100 text-xs rounded-lg overflow-x-auto">
                  {card.pseudocode}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {card.content && (
          <p className="text-sm text-gray-600 mt-3">{card.content}</p>
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
      </div>
    </div>
  );
}


