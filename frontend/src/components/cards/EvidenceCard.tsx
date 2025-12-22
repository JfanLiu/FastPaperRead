'use client';

import { useState } from 'react';
import { Badge, Button } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';
import {
  Scale,
  Edit3,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  MoreVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface EvidenceCardProps {
  card: Card;
  onEdit?: (card: Card) => void;
  onDelete?: (cardId: string) => void;
  className?: string;
}

export function EvidenceCard({ card, onEdit, onDelete, className }: EvidenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const getStrengthConfig = (strength?: string) => {
    switch (strength) {
      case 'strong':
        return { label: '强', variant: 'success' as const };
      case 'weak':
        return { label: '弱', variant: 'danger' as const };
      default:
        return { label: '中', variant: 'warning' as const };
    }
  };

  const strengthConfig = getStrengthConfig(card.evidence_strength);

  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{card.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={strengthConfig.variant} size="sm">
                证据{strengthConfig.label}
              </Badge>
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
        {/* Claim */}
        {card.claim && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              主张
            </h4>
            <p className="text-sm text-gray-900 font-medium">{card.claim}</p>
          </div>
        )}

        {/* Evidence */}
        {card.evidence && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 mb-1">证据</h4>
            <p className="text-sm text-gray-700">{card.evidence}</p>
          </div>
        )}

        {/* Expandable sections */}
        {(card.alternative_explanations?.length || card.risks?.length) && (
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
            {/* Alternative explanations */}
            {card.alternative_explanations && card.alternative_explanations.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1">替代解释</h4>
                <ul className="space-y-1">
                  {card.alternative_explanations.map((alt, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-1">
                      <span className="text-gray-400">•</span>
                      {alt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {card.risks && card.risks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  风险
                </h4>
                <ul className="space-y-1">
                  {card.risks.map((risk, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-1">
                      <span className="text-amber-500">!</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Figure anchors */}
        {card.figure_anchor_ids && card.figure_anchor_ids.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
              <ExternalLink className="w-3 h-3" />
              查看相关图表 ({card.figure_anchor_ids.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


