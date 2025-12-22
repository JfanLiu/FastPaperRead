'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  FileText,
  ListChecks,
  Quote,
  Highlighter,
  StickyNote,
  Copy,
  Check,
} from 'lucide-react';

interface SelectionToolbarProps {
  selectedText: string;
  position: { x: number; y: number } | null;
  onExplain?: (text: string) => void;
  onCreateCard?: (text: string) => void;
  onAddToChecklist?: (text: string) => void;
  onQuote?: (text: string) => void;
  onHighlight?: (text: string, color: string) => void;
  onAnnotate?: (text: string) => void;
  onClose?: () => void;
}

const highlightColors = [
  { name: '黄色', value: '#fef08a' },
  { name: '绿色', value: '#bbf7d0' },
  { name: '蓝色', value: '#bfdbfe' },
  { name: '粉色', value: '#fbcfe8' },
  { name: '紫色', value: '#ddd6fe' },
];

export function SelectionToolbar({
  selectedText,
  position,
  onExplain,
  onCreateCard,
  onAddToChecklist,
  onQuote,
  onHighlight,
  onAnnotate,
  onClose,
}: SelectionToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!position || !selectedText) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const actions = [
    {
      icon: MessageSquare,
      label: '解释',
      onClick: () => onExplain?.(selectedText),
    },
    {
      icon: FileText,
      label: '创建卡片',
      onClick: () => onCreateCard?.(selectedText),
    },
    {
      icon: ListChecks,
      label: '加入清单',
      onClick: () => onAddToChecklist?.(selectedText),
    },
    {
      icon: Quote,
      label: '引用',
      onClick: () => onQuote?.(selectedText),
    },
    {
      icon: Highlighter,
      label: '高亮',
      onClick: () => setShowColorPicker(!showColorPicker),
    },
    {
      icon: StickyNote,
      label: '批注',
      onClick: () => onAnnotate?.(selectedText),
    },
    {
      icon: copied ? Check : Copy,
      label: copied ? '已复制' : '复制',
      onClick: handleCopy,
    },
  ];

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{
        left: position.x,
        top: position.y - 50,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Main toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-900 rounded-lg shadow-xl">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 text-xs text-white rounded transition-colors',
              action.icon === Highlighter && showColorPicker
                ? 'bg-gray-700'
                : 'hover:bg-gray-700'
            )}
            title={action.label}
          >
            <action.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Color picker for highlight */}
      {showColorPicker && (
        <div className="flex items-center gap-1 mt-2 px-2 py-1.5 bg-white rounded-lg shadow-xl border border-gray-200">
          {highlightColors.map((color) => (
            <button
              key={color.value}
              onClick={() => {
                onHighlight?.(selectedText, color.value);
                setShowColorPicker(false);
              }}
              className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      )}

      {/* Arrow */}
      <div className="w-3 h-3 bg-gray-900 rotate-45 -mt-1.5" />
    </div>
  );
}


