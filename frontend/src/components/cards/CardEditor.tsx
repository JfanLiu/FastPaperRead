'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Input, Modal } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Card, CardType, UncertaintyLevel } from '@/types';
import {
  X,
  Save,
  FileText,
  Scale,
  Wrench,
  StickyNote,
  Plus,
  Trash2,
  Link,
  AlertCircle,
} from 'lucide-react';

interface CardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: Partial<Card>) => void;
  initialCard?: Partial<Card>;
  sourceText?: string;
  sourceAnchorIds?: string[];
  paperId: string;
}

const cardTypeConfig = {
  paper: { icon: FileText, label: 'Paper Card', color: 'bg-indigo-100 text-indigo-700' },
  evidence: { icon: Scale, label: 'Evidence Card', color: 'bg-amber-100 text-amber-700' },
  method: { icon: Wrench, label: 'Method Card', color: 'bg-purple-100 text-purple-700' },
  note: { icon: StickyNote, label: '笔记', color: 'bg-gray-100 text-gray-700' },
};

export function CardEditor({
  isOpen,
  onClose,
  onSave,
  initialCard,
  sourceText,
  sourceAnchorIds = [],
  paperId,
}: CardEditorProps) {
  const [cardType, setCardType] = useState<CardType>(initialCard?.type || 'note');
  const [title, setTitle] = useState(initialCard?.title || '');
  const [content, setContent] = useState(initialCard?.content || sourceText || '');
  const [tags, setTags] = useState<string[]>(initialCard?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [uncertainty, setUncertainty] = useState<UncertaintyLevel>(
    initialCard?.uncertainty || 'from_text'
  );
  
  // Type-specific fields
  const [claim, setClaim] = useState(initialCard?.claim || '');
  const [evidence, setEvidence] = useState(initialCard?.evidence || '');
  const [evidenceStrength, setEvidenceStrength] = useState(initialCard?.evidence_strength || 'medium');
  const [methodName, setMethodName] = useState(initialCard?.method_name || '');
  const [inputs, setInputs] = useState<string[]>(initialCard?.inputs || []);
  const [outputs, setOutputs] = useState<string[]>(initialCard?.outputs || []);
  const [contributions, setContributions] = useState<string[]>(initialCard?.contributions || []);
  const [limitations, setLimitations] = useState<string[]>(initialCard?.limitations || []);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && sourceText && !content) {
      setContent(sourceText);
    }
  }, [isOpen, sourceText, content]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddListItem = (
    list: string[],
    setList: (items: string[]) => void
  ) => {
    setList([...list, '']);
  };

  const handleUpdateListItem = (
    list: string[],
    setList: (items: string[]) => void,
    index: number,
    value: string
  ) => {
    const newList = [...list];
    newList[index] = value;
    setList(newList);
  };

  const handleRemoveListItem = (
    list: string[],
    setList: (items: string[]) => void,
    index: number
  ) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const card: Partial<Card> = {
        paper_id: paperId,
        type: cardType,
        title,
        content,
        tags,
        uncertainty,
        source_anchor_ids: sourceAnchorIds,
        status: 'draft',
      };

      // Add type-specific fields
      if (cardType === 'evidence') {
        card.claim = claim;
        card.evidence = evidence;
        card.evidence_strength = evidenceStrength;
      } else if (cardType === 'method') {
        card.method_name = methodName;
        card.inputs = inputs.filter(Boolean);
        card.outputs = outputs.filter(Boolean);
      } else if (cardType === 'paper') {
        card.contributions = contributions.filter(Boolean);
        card.limitations = limitations.filter(Boolean);
      }

      await onSave(card);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex flex-col h-[80vh] max-h-[700px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {initialCard?.id ? '编辑卡片' : '创建卡片'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              卡片类型
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(cardTypeConfig) as [CardType, typeof cardTypeConfig.paper][]).map(
                ([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setCardType(type)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-colors',
                      cardType === type
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <config.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标题 *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入卡片标题..."
              className="w-full"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入卡片内容..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Type-specific fields */}
          {cardType === 'evidence' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  主张 (Claim)
                </label>
                <Input
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  placeholder="论文的主张是什么..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  证据 (Evidence)
                </label>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="支持主张的证据..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  证据强度
                </label>
                <div className="flex gap-2">
                  {['strong', 'medium', 'weak'].map((strength) => (
                    <button
                      key={strength}
                      onClick={() => setEvidenceStrength(strength)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                        evidenceStrength === strength
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {strength === 'strong' ? '强' : strength === 'medium' ? '中' : '弱'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {cardType === 'method' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  方法名称
                </label>
                <Input
                  value={methodName}
                  onChange={(e) => setMethodName(e.target.value)}
                  placeholder="方法/算法名称..."
                />
              </div>
              <ListEditor
                label="输入"
                items={inputs}
                onAdd={() => handleAddListItem(inputs, setInputs)}
                onUpdate={(i, v) => handleUpdateListItem(inputs, setInputs, i, v)}
                onRemove={(i) => handleRemoveListItem(inputs, setInputs, i)}
                placeholder="添加输入..."
              />
              <ListEditor
                label="输出"
                items={outputs}
                onAdd={() => handleAddListItem(outputs, setOutputs)}
                onUpdate={(i, v) => handleUpdateListItem(outputs, setOutputs, i, v)}
                onRemove={(i) => handleRemoveListItem(outputs, setOutputs, i)}
                placeholder="添加输出..."
              />
            </>
          )}

          {cardType === 'paper' && (
            <>
              <ListEditor
                label="贡献"
                items={contributions}
                onAdd={() => handleAddListItem(contributions, setContributions)}
                onUpdate={(i, v) => handleUpdateListItem(contributions, setContributions, i, v)}
                onRemove={(i) => handleRemoveListItem(contributions, setContributions, i)}
                placeholder="添加贡献..."
              />
              <ListEditor
                label="局限"
                items={limitations}
                onAdd={() => handleAddListItem(limitations, setLimitations)}
                onUpdate={(i, v) => handleUpdateListItem(limitations, setLimitations, i, v)}
                onRemove={(i) => handleRemoveListItem(limitations, setLimitations, i)}
                placeholder="添加局限..."
              />
            </>
          )}

          {/* Uncertainty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              信息来源
            </label>
            <div className="flex gap-2">
              {[
                { value: 'from_text', label: '来自原文' },
                { value: 'inferred', label: '推测' },
                { value: 'needs_confirm', label: '需确认' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setUncertainty(value as UncertaintyLevel)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                    uncertainty === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标签
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="添加标签..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1"
              />
              <Button onClick={handleAddTag} variant="secondary" size="sm">
                添加
              </Button>
            </div>
          </div>

          {/* Source anchors */}
          {sourceAnchorIds.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
              <Link className="w-4 h-4 text-indigo-600" />
              <span className="text-sm text-indigo-700">
                关联 {sourceAnchorIds.length} 个来源锚点
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            卡片将保存为草稿
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ListEditor({
  label,
  items,
  onAdd,
  onUpdate,
  onRemove,
  placeholder,
}: {
  label: string;
  items: string[];
  onAdd: () => void;
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1"
            />
            <button
              onClick={() => onRemove(index)}
              className="p-2 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded"
        >
          <Plus className="w-4 h-4" />
          添加{label}
        </button>
      </div>
    </div>
  );
}


