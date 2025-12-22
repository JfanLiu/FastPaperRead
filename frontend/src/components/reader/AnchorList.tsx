'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Anchor } from '@/types';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Calculator,
  Table,
  Quote,
  Hash,
} from 'lucide-react';

interface AnchorListProps {
  anchors: Anchor[];
  onAnchorClick?: (anchor: Anchor) => void;
  selectedAnchorId?: string;
  className?: string;
}

const anchorTypeConfig = {
  section: { icon: Hash, color: 'text-indigo-600', label: '章节' },
  paragraph: { icon: FileText, color: 'text-gray-600', label: '段落' },
  figure: { icon: Image, color: 'text-emerald-600', label: '图表' },
  table: { icon: Table, color: 'text-amber-600', label: '表格' },
  equation: { icon: Calculator, color: 'text-purple-600', label: '公式' },
  citation: { icon: Quote, color: 'text-blue-600', label: '引用' },
};

export function AnchorList({
  anchors,
  onAnchorClick,
  selectedAnchorId,
  className,
}: AnchorListProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string | null>(null);

  // 按类型分组
  const groupedAnchors = anchors.reduce((acc, anchor) => {
    const section = anchor.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(anchor);
    return acc;
  }, {} as Record<string, Anchor[]>);

  const filteredAnchors = filterType
    ? anchors.filter(a => a.type === filterType)
    : anchors;

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 p-3 border-b border-gray-200">
        <button
          onClick={() => setFilterType(null)}
          className={cn(
            'px-2 py-1 text-xs rounded-full transition-colors',
            filterType === null
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          全部
        </button>
        {Object.entries(anchorTypeConfig).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              'px-2 py-1 text-xs rounded-full transition-colors flex items-center gap-1',
              filterType === type
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <config.icon className="w-3 h-3" />
            {config.label}
          </button>
        ))}
      </div>

      {/* Anchor list */}
      <div className="flex-1 overflow-y-auto">
        {filterType ? (
          // Flat list when filtered
          <div className="p-2 space-y-1">
            {filteredAnchors.map((anchor) => (
              <AnchorItem
                key={anchor.id}
                anchor={anchor}
                isSelected={anchor.id === selectedAnchorId}
                onClick={() => onAnchorClick?.(anchor)}
              />
            ))}
          </div>
        ) : (
          // Grouped by section when not filtered
          <div className="p-2 space-y-1">
            {Object.entries(groupedAnchors).map(([section, sectionAnchors]) => (
              <div key={section}>
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded"
                >
                  {expandedSections.has(section) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="truncate">{section}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {sectionAnchors.length}
                  </span>
                </button>
                {expandedSections.has(section) && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {sectionAnchors.map((anchor) => (
                      <AnchorItem
                        key={anchor.id}
                        anchor={anchor}
                        isSelected={anchor.id === selectedAnchorId}
                        onClick={() => onAnchorClick?.(anchor)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnchorItem({
  anchor,
  isSelected,
  onClick,
}: {
  anchor: Anchor;
  isSelected: boolean;
  onClick: () => void;
}) {
  const config = anchorTypeConfig[anchor.type as keyof typeof anchorTypeConfig] || anchorTypeConfig.paragraph;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2 px-2 py-1.5 text-sm rounded transition-colors text-left',
        isSelected
          ? 'bg-indigo-50 text-indigo-900'
          : 'text-gray-700 hover:bg-gray-50'
      )}
    >
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="truncate">
          {anchor.caption || anchor.text?.slice(0, 50) || `${config.label} ${anchor.id.slice(-4)}`}
        </p>
        {anchor.page && (
          <span className="text-xs text-gray-400">第 {anchor.page} 页</span>
        )}
      </div>
    </button>
  );
}


