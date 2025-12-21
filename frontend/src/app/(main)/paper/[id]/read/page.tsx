'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button, Badge } from '@/components/common';
import { usePaperStore } from '@/stores/paperStore';
import { useUIStore } from '@/stores/uiStore';
import { paperApi, anchorApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BookOpen,
  List,
  FileText,
  CheckSquare,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { SectionNode } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReadPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { currentPaper, setCurrentPaper, sectionTree, setSectionTree, currentAnchors, setCurrentAnchors } = usePaperStore();
  const { splitRatio, setSplitRatio, pdfScale, setPdfScale, showAnchors, toggleAnchors, setRightPanelTab } = useUIStore();
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'pdf' | 'structure'>('split');

  useEffect(() => {
    loadPaperData();
  }, [resolvedParams.id]);

  const loadPaperData = async () => {
    setIsLoading(true);
    try {
      const paper = await paperApi.get(resolvedParams.id);
      setCurrentPaper(paper);

      const anchorsResponse = await anchorApi.getByPaper(resolvedParams.id);
      setCurrentAnchors(anchorsResponse.items);

      const sections = await anchorApi.getSectionTree(resolvedParams.id);
      setSectionTree(sections);
    } catch (error) {
      console.error('Failed to load paper:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnchorClick = (anchorId: string) => {
    setSelectedAnchorId(anchorId);
    setRightPanelTab('enhance');
  };

  if (isLoading) {
    return (
      <MainLayout showSearch={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSearch={false} showRightPanel>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Toolbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href={`/paper/${resolvedParams.id}/overview`}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              返回概览
            </Link>
            <span className="text-sm font-medium text-gray-900 truncate max-w-md">
              {currentPaper?.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('pdf')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'pdf' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
                title="仅PDF"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'split' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
                title="分屏"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('structure')}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  viewMode === 'structure' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
                title="仅结构化"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPdfScale(Math.max(0.5, pdfScale - 0.1))}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 w-12 text-center">
                {Math.round(pdfScale * 100)}%
              </span>
              <button
                onClick={() => setPdfScale(Math.min(2, pdfScale + 0.1))}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Toggle Anchors */}
            <button
              onClick={toggleAnchors}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                showAnchors ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              )}
              title={showAnchors ? '隐藏锚点' : '显示锚点'}
            >
              {showAnchors ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF Viewer */}
          {(viewMode === 'pdf' || viewMode === 'split') && (
            <div
              className={cn(
                'bg-gray-100 overflow-auto',
                viewMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'flex-1'
              )}
            >
              <PDFViewer
                pdfPath={currentPaper?.pdf_path}
                scale={pdfScale}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                anchors={showAnchors ? currentAnchors : []}
                onAnchorClick={handleAnchorClick}
                selectedAnchorId={selectedAnchorId}
              />
            </div>
          )}

          {/* Structured View */}
          {(viewMode === 'structure' || viewMode === 'split') && (
            <div
              className={cn(
                'bg-white overflow-auto',
                viewMode === 'split' ? 'w-1/2' : 'flex-1'
              )}
            >
              <StructuredView
                sections={sectionTree?.sections || []}
                anchors={currentAnchors}
                onAnchorClick={handleAnchorClick}
                selectedAnchorId={selectedAnchorId}
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// PDF Viewer Component
function PDFViewer({
  pdfPath,
  scale,
  currentPage,
  onPageChange,
  anchors,
  onAnchorClick,
  selectedAnchorId,
}: {
  pdfPath?: string | null;
  scale: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  anchors: Array<{ id: string; page: number; type: string; bbox?: { x1: number; y1: number; x2: number; y2: number } | null }>;
  onAnchorClick: (id: string) => void;
  selectedAnchorId: string | null;
}) {
  // 这里是PDF渲染的占位符，实际需要集成PDF.js
  return (
    <div className="p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 min-h-[800px] relative">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg font-medium">PDF 阅读器</p>
            <p className="text-sm mt-2">需要集成 PDF.js</p>
            {pdfPath && (
              <p className="text-xs mt-4 text-gray-300">{pdfPath}</p>
            )}
          </div>
        </div>

        {/* Anchor Overlays */}
        {anchors
          .filter((a) => a.page === currentPage && a.bbox)
          .map((anchor) => (
            <div
              key={anchor.id}
              onClick={() => onAnchorClick(anchor.id)}
              className={cn(
                'absolute cursor-pointer transition-colors',
                anchor.type === 'figure'
                  ? 'pdf-highlight-figure'
                  : anchor.type === 'equation'
                  ? 'pdf-highlight-equation'
                  : 'pdf-highlight',
                selectedAnchorId === anchor.id && 'ring-2 ring-indigo-500'
              )}
              style={{
                left: `${(anchor.bbox?.x1 || 0) * 100}%`,
                top: `${(anchor.bbox?.y1 || 0) * 100}%`,
                width: `${((anchor.bbox?.x2 || 0) - (anchor.bbox?.x1 || 0)) * 100}%`,
                height: `${((anchor.bbox?.y2 || 0) - (anchor.bbox?.y1 || 0)) * 100}%`,
              }}
            />
          ))}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-gray-600">
          第 {currentPage} 页
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Structured View Component
function StructuredView({
  sections,
  anchors,
  onAnchorClick,
  selectedAnchorId,
}: {
  sections: SectionNode[];
  anchors: Array<{ id: string; section?: string | null; type: string; text: string }>;
  onAnchorClick: (id: string) => void;
  selectedAnchorId: string | null;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedSections(next);
  };

  return (
    <div className="p-4">
      {/* Section Navigation */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-3">章节导航</h3>
        <div className="space-y-1">
          {sections.map((section) => (
            <SectionItem
              key={section.id}
              section={section}
              expanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              level={0}
            />
          ))}
        </div>
      </div>

      {/* Content by Section */}
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.id} className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              {section.is_must_read && (
                <Badge variant="warning" size="sm">必读</Badge>
              )}
              {section.title}
            </h4>
            
            {/* Related anchors */}
            <div className="space-y-2">
              {anchors
                .filter((a) => a.section === section.title && a.type === 'paragraph')
                .slice(0, 3)
                .map((anchor) => (
                  <div
                    key={anchor.id}
                    onClick={() => onAnchorClick(anchor.id)}
                    className={cn(
                      'p-3 bg-white rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-indigo-50 transition-colors',
                      selectedAnchorId === anchor.id && 'ring-2 ring-indigo-500'
                    )}
                  >
                    {anchor.text.length > 200
                      ? anchor.text.slice(0, 200) + '...'
                      : anchor.text}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionItem({
  section,
  expanded,
  onToggle,
  level,
}: {
  section: SectionNode;
  expanded: boolean;
  onToggle: () => void;
  level: number;
}) {
  return (
    <div style={{ paddingLeft: level * 12 }}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left',
          section.is_read ? 'text-gray-400' : 'text-gray-700',
          section.is_must_read && 'font-medium',
          'hover:bg-gray-100'
        )}
      >
        {section.children.length > 0 && (
          <ChevronRight
            className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')}
          />
        )}
        {section.is_read && <CheckSquare className="w-4 h-4 text-green-500" />}
        <span>{section.title}</span>
        {section.is_must_read && !section.is_read && (
          <span className="text-xs text-amber-500">必读</span>
        )}
      </button>
      {expanded && section.children.length > 0 && (
        <div className="mt-1">
          {section.children.map((child) => (
            <SectionItem
              key={child.id}
              section={child}
              expanded={false}
              onToggle={() => {}}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

