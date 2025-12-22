'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/common';
import type { Anchor } from '@/types';
import {
  Route,
  Clock,
  Target,
  BookOpen,
  FileSearch,
  CheckSquare,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface RouteTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  estimatedTime: string;
  sections: string[];
  keyFigures?: string[];
}

interface RoutePlannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoute: (route: RouteTemplate, customSections?: string[]) => void;
  anchors: Anchor[];
  paperTitle?: string;
}

const defaultRoutes: RouteTemplate[] = [
  {
    id: 'quick-repro',
    name: '快速复现路线',
    description: '聚焦方法实现和实验设置，适合需要复现论文的场景',
    icon: FileSearch,
    estimatedTime: '20-30 分钟',
    sections: ['Method', 'Experiments', 'Implementation Details', 'Appendix'],
    keyFigures: ['架构图', '算法流程', '实验设置表'],
  },
  {
    id: 'reviewer',
    name: '审稿路线',
    description: '关注主张与证据，评估论文质量和创新性',
    icon: CheckSquare,
    estimatedTime: '30-45 分钟',
    sections: ['Abstract', 'Introduction', 'Method', 'Experiments', 'Conclusion'],
    keyFigures: ['主要结果图', '消融实验'],
  },
  {
    id: 'full-read',
    name: '全文精读路线',
    description: '按章节完整阅读，适合深入理解论文',
    icon: BookOpen,
    estimatedTime: '45-60 分钟',
    sections: ['Abstract', 'Introduction', 'Related Work', 'Method', 'Experiments', 'Discussion', 'Conclusion'],
  },
];

export function RoutePlanner({
  isOpen,
  onClose,
  onSelectRoute,
  anchors,
  paperTitle,
}: RoutePlannerProps) {
  const [selectedRoute, setSelectedRoute] = useState<RouteTemplate | null>(null);
  const [customSections, setCustomSections] = useState<Set<string>>(new Set());
  const [showCustomize, setShowCustomize] = useState(false);

  // 从 anchors 中提取章节
  const availableSections = anchors
    .filter(a => a.type === 'section')
    .map(a => a.text || a.section || '')
    .filter(Boolean);

  const handleSelectRoute = (route: RouteTemplate) => {
    setSelectedRoute(route);
    setCustomSections(new Set(route.sections));
  };

  const handleConfirm = () => {
    if (selectedRoute) {
      onSelectRoute(selectedRoute, Array.from(customSections));
    }
    onClose();
  };

  const toggleSection = (section: string) => {
    const newSections = new Set(customSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setCustomSections(newSections);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Route className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">选择阅读路线</h2>
              {paperTitle && (
                <p className="text-sm text-gray-500 truncate max-w-md">{paperTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showCustomize ? (
            <>
              {/* Route templates */}
              <div className="space-y-3">
                {defaultRoutes.map((route) => {
                  const Icon = route.icon;
                  const isSelected = selectedRoute?.id === route.id;
                  
                  return (
                    <button
                      key={route.id}
                      onClick={() => handleSelectRoute(route)}
                      className={cn(
                        'w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <div className={cn(
                        'p-2.5 rounded-lg shrink-0',
                        isSelected ? 'bg-indigo-100' : 'bg-gray-100'
                      )}>
                        <Icon className={cn(
                          'w-5 h-5',
                          isSelected ? 'text-indigo-600' : 'text-gray-500'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            'font-medium',
                            isSelected ? 'text-indigo-900' : 'text-gray-900'
                          )}>
                            {route.name}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            {route.estimatedTime}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{route.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {route.sections.slice(0, 4).map((section) => (
                            <span
                              key={section}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                            >
                              {section}
                            </span>
                          ))}
                          {route.sections.length > 4 && (
                            <span className="px-2 py-0.5 text-xs text-gray-400">
                              +{route.sections.length - 4} 更多
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-5 h-5 text-indigo-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* AI recommendation hint */}
              <div className="flex items-center gap-2 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">
                  系统根据论文类型推荐使用 <strong>{defaultRoutes[1].name}</strong>
                </p>
              </div>
            </>
          ) : (
            /* Custom section selection */
            <div>
              <h3 className="font-medium text-gray-900 mb-3">自定义必读章节</h3>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {availableSections.length > 0 ? (
                  availableSections.map((section) => (
                    <button
                      key={section}
                      onClick={() => toggleSection(section)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left',
                        customSections.has(section)
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      <CheckSquare className={cn(
                        'w-4 h-4 shrink-0',
                        customSections.has(section) ? 'text-indigo-600' : 'text-gray-400'
                      )} />
                      <span className="truncate">{section}</span>
                    </button>
                  ))
                ) : (
                  <p className="col-span-2 text-sm text-gray-500 text-center py-4">
                    暂无可用章节，将使用默认路线
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {showCustomize ? '← 返回路线选择' : '自定义章节 →'}
          </button>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedRoute}
            >
              <Target className="w-4 h-4 mr-1.5" />
              开始精读
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

