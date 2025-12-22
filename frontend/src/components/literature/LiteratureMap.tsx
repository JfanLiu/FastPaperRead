'use client';

import { useState, useMemo } from 'react';
import { Button, Badge } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Paper } from '@/types';
import {
  Map,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface LiteraturePaper extends Paper {
  category?: 'similar' | 'opposite' | 'classic' | 'recent' | 'current';
  citationCount?: number;
  connections?: string[]; // paper ids this connects to
}

interface LiteratureMapProps {
  currentPaper: Paper;
  relatedPapers: LiteraturePaper[];
  onPaperClick?: (paper: Paper) => void;
  onAddToCompare?: (paper: Paper) => void;
  onAddToQueue?: (paper: Paper) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

const CATEGORY_CONFIG = {
  current: { label: '当前论文', color: 'bg-indigo-500', textColor: 'text-white' },
  similar: { label: '同类方法', color: 'bg-blue-100', textColor: 'text-blue-700' },
  opposite: { label: '对立观点', color: 'bg-red-100', textColor: 'text-red-700' },
  classic: { label: '经典论文', color: 'bg-amber-100', textColor: 'text-amber-700' },
  recent: { label: '最新进展', color: 'bg-green-100', textColor: 'text-green-700' },
};

export function LiteratureMap({
  currentPaper,
  relatedPapers,
  onPaperClick,
  onAddToCompare,
  onAddToQueue,
  onRefresh,
  isLoading,
  className,
}: LiteratureMapProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const filteredPapers = useMemo(() => {
    if (!selectedCategory) return relatedPapers;
    return relatedPapers.filter(p => p.category === selectedCategory);
  }, [relatedPapers, selectedCategory]);

  const groupedPapers = useMemo(() => {
    const groups: Record<string, LiteraturePaper[]> = {};
    for (const paper of relatedPapers) {
      const cat = paper.category || 'similar';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(paper);
    }
    return groups;
  }, [relatedPapers]);

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Map className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="font-semibold text-gray-900">文献地图</h2>
            <p className="text-sm text-gray-500">{relatedPapers.length} 篇相关论文</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 overflow-x-auto">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-3 py-1 text-sm rounded-full transition-colors whitespace-nowrap',
            !selectedCategory
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          全部
        </button>
        {Object.entries(CATEGORY_CONFIG)
          .filter(([key]) => key !== 'current')
          .map(([key, config]) => {
            const count = groupedPapers[key]?.length || 0;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={cn(
                  'px-3 py-1 text-sm rounded-full transition-colors whitespace-nowrap flex items-center gap-1',
                  selectedCategory === key
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {config.label}
                <span className="text-xs text-gray-400">({count})</span>
              </button>
            );
          })}
      </div>

      {/* Map View */}
      <div
        className="relative h-96 overflow-auto bg-gray-50"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        {/* Current Paper (Center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <PaperNode
            paper={{ ...currentPaper, category: 'current' } as LiteraturePaper}
            isCenter
            onClick={() => onPaperClick?.(currentPaper)}
          />
        </div>

        {/* Related Papers */}
        {Object.entries(CATEGORY_CONFIG)
          .filter(([key]) => key !== 'current')
          .map(([category, config], categoryIndex) => {
            const papers = groupedPapers[category] || [];
            const angle = (categoryIndex * 90) - 45; // Spread in 4 quadrants

            return papers.map((paper, paperIndex) => {
              const paperAngle = angle + (paperIndex - papers.length / 2) * 15;
              const distance = 120 + paperIndex * 30;
              const x = Math.cos((paperAngle * Math.PI) / 180) * distance;
              const y = Math.sin((paperAngle * Math.PI) / 180) * distance;

              if (selectedCategory && paper.category !== selectedCategory) {
                return null;
              }

              return (
                <div
                  key={paper.id}
                  className="absolute transition-all duration-300"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    transform: 'translate(-50%, -50%)',
                    opacity: hoveredPaper && hoveredPaper !== paper.id ? 0.3 : 1,
                  }}
                  onMouseEnter={() => setHoveredPaper(paper.id)}
                  onMouseLeave={() => setHoveredPaper(null)}
                >
                  {/* Connection line */}
                  <svg
                    className="absolute pointer-events-none"
                    style={{
                      left: '50%',
                      top: '50%',
                      width: distance,
                      height: 2,
                      transform: `rotate(${180 + paperAngle}deg)`,
                      transformOrigin: '0 0',
                    }}
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2={distance - 40}
                      y2="0"
                      stroke="#d1d5db"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                    />
                  </svg>

                  <PaperNode
                    paper={paper}
                    onClick={() => onPaperClick?.(paper)}
                    onAddToCompare={() => onAddToCompare?.(paper)}
                    onAddToQueue={() => onAddToQueue?.(paper)}
                    isHovered={hoveredPaper === paper.id}
                  />
                </div>
              );
            });
          })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-gray-200 bg-gray-50">
        {Object.entries(CATEGORY_CONFIG)
          .filter(([key]) => key !== 'current')
          .map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn('w-3 h-3 rounded-full', config.color)} />
              <span className="text-xs text-gray-600">{config.label}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function PaperNode({
  paper,
  isCenter,
  isHovered,
  onClick,
  onAddToCompare,
  onAddToQueue,
}: {
  paper: LiteraturePaper;
  isCenter?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onAddToCompare?: () => void;
  onAddToQueue?: () => void;
}) {
  const config = CATEGORY_CONFIG[paper.category || 'similar'];

  return (
    <div
      className={cn(
        'relative group cursor-pointer transition-all duration-200',
        isCenter ? 'z-10' : 'z-0',
        isHovered && 'z-20'
      )}
      onClick={onClick}
    >
      {/* Node */}
      <div
        className={cn(
          'px-3 py-2 rounded-lg shadow-sm border transition-all duration-200',
          isCenter
            ? 'bg-indigo-600 text-white border-indigo-700 min-w-[160px]'
            : cn(config.color, config.textColor, 'border-transparent min-w-[120px]'),
          isHovered && !isCenter && 'shadow-md scale-105'
        )}
      >
        <h4 className={cn(
          'font-medium text-sm line-clamp-2',
          isCenter ? 'text-white' : config.textColor
        )}>
          {paper.title}
        </h4>
        <div className={cn(
          'text-xs mt-1 flex items-center gap-2',
          isCenter ? 'text-indigo-200' : 'text-gray-500'
        )}>
          <span>{paper.year}</span>
          {paper.citationCount !== undefined && (
            <span>引用 {paper.citationCount}</span>
          )}
        </div>
      </div>

      {/* Actions (on hover) */}
      {!isCenter && isHovered && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCompare?.(); }}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            title="加入对比"
          >
            对比
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onAddToQueue?.(); }}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            title="加入队列"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            title="查看详情"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}


