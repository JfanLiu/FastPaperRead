'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Badge } from '@/components/common';
import type { Card, Anchor, UncertaintyLevel } from '@/types';
import {
  Plus,
  FileText,
  Tag,
  Clock,
  Edit3,
  Trash2,
  Save,
  X,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface NotesPanelProps {
  cards: Card[];
  paperId: string;
  selectedAnchor?: Anchor | null;
  onCreateCard?: (card: Partial<Card>) => void;
  onUpdateCard?: (cardId: string, card: Partial<Card>) => void;
  onDeleteCard?: (cardId: string) => void;
  onJumpToAnchor?: (anchorId: string) => void;
  className?: string;
}

type CardType = 'evidence' | 'method' | 'paper' | 'note';

const cardTypeConfig: Record<CardType, { label: string; color: string; bgColor: string }> = {
  evidence: { label: '证据卡', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  method: { label: '方法卡', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  paper: { label: '论文卡', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  note: { label: '笔记', color: 'text-gray-700', bgColor: 'bg-gray-50' },
};

const uncertaintyConfig: Record<UncertaintyLevel, { label: string; icon: React.ElementType; color: string }> = {
  from_text: { label: '来自原文', icon: CheckCircle, color: 'text-emerald-600' },
  inferred: { label: '推测补全', icon: Sparkles, color: 'text-amber-600' },
  needs_confirm: { label: '需确认', icon: HelpCircle, color: 'text-red-600' },
};

export function NotesPanel({
  cards,
  paperId,
  selectedAnchor,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onJumpToAnchor,
  className,
}: NotesPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingCard, setEditingCard] = useState<Partial<Card> | null>(null);
  const [filterType, setFilterType] = useState<CardType | 'all'>('all');

  const filteredCards = filterType === 'all' 
    ? cards 
    : cards.filter(c => c.type === filterType);

  const handleStartCreate = () => {
    setEditingCard({
      paper_id: paperId,
      type: 'evidence',
      title: '',
      content: selectedAnchor?.text?.slice(0, 100) || '',
      source_anchor_ids: selectedAnchor ? [selectedAnchor.id] : [],
      uncertainty: 'from_text',
      status: 'draft',
      tags: [],
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editingCard) {
      if (editingCard.id) {
        onUpdateCard?.(editingCard.id, editingCard);
      } else {
        onCreateCard?.(editingCard);
      }
    }
    setIsEditing(false);
    setEditingCard(null);
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingCard(null);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-900">笔记卡片</span>
          <Badge variant="secondary" size="sm">{cards.length}</Badge>
        </div>
        <Button size="sm" onClick={handleStartCreate}>
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto">
        <button
          onClick={() => setFilterType('all')}
          className={cn(
            'px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap',
            filterType === 'all'
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          全部
        </button>
        {Object.entries(cardTypeConfig).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setFilterType(type as CardType)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap',
              filterType === type
                ? `${config.bgColor} ${config.color}`
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* Card editor */}
      {isEditing && editingCard && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {Object.entries(cardTypeConfig).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => setEditingCard({ ...editingCard, type: type as CardType })}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg border transition-colors',
                    editingCard.type === type
                      ? `${config.bgColor} ${config.color} border-current`
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {config.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <input
              type="text"
              value={editingCard.title || ''}
              onChange={(e) => setEditingCard({ ...editingCard, title: e.target.value })}
              placeholder="卡片标题"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {/* Content */}
            <textarea
              value={editingCard.content || ''}
              onChange={(e) => setEditingCard({ ...editingCard, content: e.target.value })}
              placeholder="卡片内容（支持 Markdown）"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />

            {/* Uncertainty level */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1.5">确定性</span>
              <div className="flex gap-2">
                {Object.entries(uncertaintyConfig).map(([level, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={level}
                      onClick={() => setEditingCard({ ...editingCard, uncertainty: level as UncertaintyLevel })}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
                        editingCard.uncertainty === level
                          ? 'bg-white border-indigo-500 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5', config.color)} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source anchor indicator */}
            {editingCard.source_anchor_ids && editingCard.source_anchor_ids.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>已关联 {editingCard.source_anchor_ids.length} 个来源锚点</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" />
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCards.length > 0 ? (
          filteredCards.map((card) => {
            const typeConfig = cardTypeConfig[card.type as CardType] || cardTypeConfig.note;
            const uncertConfig = uncertaintyConfig[card.uncertainty as UncertaintyLevel];
            const UncertIcon = uncertConfig?.icon || CheckCircle;

            return (
              <div
                key={card.id}
                className="group p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-1.5 py-0.5 text-xs font-medium rounded',
                      typeConfig.bgColor,
                      typeConfig.color
                    )}>
                      {typeConfig.label}
                    </span>
                    {uncertConfig && (
                      <UncertIcon className={cn('w-3.5 h-3.5', uncertConfig.color)} />
                    )}
                    {card.status === 'draft' && (
                      <Badge variant="warning" size="sm">草稿</Badge>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={() => handleEdit(card)}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteCard?.(card.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card title */}
                <h4 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">
                  {card.title || '无标题'}
                </h4>

                {/* Card content preview */}
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {card.content}
                </p>

                {/* Card footer */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    {card.tags && card.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {card.tags.slice(0, 2).map((tag, i) => (
                          <span key={i}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {card.source_anchor_ids && card.source_anchor_ids.length > 0 && (
                    <button
                      onClick={() => onJumpToAnchor?.(card.source_anchor_ids![0])}
                      className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      查看来源
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">暂无卡片</p>
            <p className="text-xs mt-1">选中文本后创建笔记卡片</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {selectedAnchor && !isEditing && (
        <div className="p-3 border-t border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <p className="text-xs text-gray-600 mb-2">
            已选中: <span className="font-medium">{selectedAnchor.text?.slice(0, 30)}...</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleStartCreate} className="flex-1">
              <Plus className="w-4 h-4 mr-1" />
              创建卡片
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

