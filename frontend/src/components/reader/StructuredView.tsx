'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Anchor } from '@/types';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Image,
  Calculator,
  Table,
  ArrowRight,
  Sparkles,
  ListChecks,
} from 'lucide-react';

interface StructuredViewProps {
  anchors: Anchor[];
  currentRoute?: string[];
  completedSections?: Set<string>;
  onSectionClick?: (anchor: Anchor) => void;
  onMarkComplete?: (sectionId: string) => void;
  onExtractToChecklist?: (anchor: Anchor) => void;
  className?: string;
}

interface SectionNode {
  anchor: Anchor;
  children: SectionNode[];
  isCompleted: boolean;
  isInRoute: boolean;
}

export function StructuredView({
  anchors,
  currentRoute = [],
  completedSections = new Set(),
  onSectionClick,
  onMarkComplete,
  onExtractToChecklist,
  className,
}: StructuredViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['root']));
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  // 构建章节树
  const sectionAnchors = anchors.filter(a => a.type === 'section');
  const contentAnchors = anchors.filter(a => a.type !== 'section');

  // 简化：按章节分组内容
  const sectionContents = contentAnchors.reduce((acc, anchor) => {
    const section = anchor.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(anchor);
    return acc;
  }, {} as Record<string, Anchor[]>);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getAnchorIcon = (type: string) => {
    switch (type) {
      case 'figure':
        return <Image className="w-4 h-4 text-emerald-500" />;
      case 'equation':
        return <Calculator className="w-4 h-4 text-purple-500" />;
      case 'table':
        return <Table className="w-4 h-4 text-amber-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const routeSet = new Set(currentRoute.map(s => s.toLowerCase()));

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-900">结构化视图</span>
        </div>
        <div className="text-xs text-gray-500">
          {completedSections.size} / {sectionAnchors.length} 已完成
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{
              width: `${sectionAnchors.length > 0 
                ? (completedSections.size / sectionAnchors.length) * 100 
                : 0}%`
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {sectionAnchors.length > 0 ? (
          <div className="space-y-1">
            {sectionAnchors.map((section) => {
              const sectionName = section.text || section.section || '';
              const isExpanded = expandedSections.has(section.id);
              const isCompleted = completedSections.has(section.id);
              const isInRoute = routeSet.has(sectionName.toLowerCase());
              const contents = sectionContents[sectionName] || [];

              return (
                <div key={section.id}>
                  {/* Section header */}
                  <div
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                      isInRoute && 'bg-indigo-50',
                      hoveredSection === section.id && 'bg-gray-50',
                      isCompleted && 'opacity-60'
                    )}
                    onMouseEnter={() => setHoveredSection(section.id)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => toggleSection(section.id)}
                  >
                    {/* Expand/collapse icon */}
                    {contents.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}

                    {/* Completion status */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkComplete?.(section.id);
                      }}
                      className="shrink-0"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </button>

                    {/* Section name */}
                    <span
                      className={cn(
                        'flex-1 text-sm font-medium truncate',
                        isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSectionClick?.(section);
                      }}
                    >
                      {sectionName}
                    </span>

                    {/* Route indicator */}
                    {isInRoute && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                        必读
                      </span>
                    )}

                    {/* Page number */}
                    {section.page && (
                      <span className="text-xs text-gray-400">
                        p.{section.page}
                      </span>
                    )}
                  </div>

                  {/* Section contents */}
                  {isExpanded && contents.length > 0 && (
                    <div className="ml-9 mt-1 mb-2 pl-3 border-l-2 border-gray-100 space-y-1">
                      {contents.map((content) => (
                        <div
                          key={content.id}
                          className="group flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => onSectionClick?.(content)}
                        >
                          {getAnchorIcon(content.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-600 truncate">
                              {content.caption || content.text?.slice(0, 60) || `${content.type}`}
                            </p>
                          </div>
                          
                          {/* Quick actions on hover */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExtractToChecklist?.(content);
                              }}
                              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="加入复现清单"
                            >
                              <ListChecks className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                              title="AI解释"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">暂无结构化内容</p>
            <p className="text-xs mt-1">解析完成后将显示章节结构</p>
          </div>
        )}
      </div>

      {/* Method/Experiment blocks placeholder */}
      <div className="border-t border-gray-200 p-3">
        <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">快速提取</span>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 px-3 py-2 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
              <ArrowRight className="w-3.5 h-3.5 inline mr-1" />
              方法流程
            </button>
            <button className="flex-1 px-3 py-2 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
              <ArrowRight className="w-3.5 h-3.5 inline mr-1" />
              实验设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

