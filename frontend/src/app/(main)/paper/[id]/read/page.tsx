'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AnchorList, EnhancePanel } from '@/components/reader';
import { Button, Badge, Progress } from '@/components/common';
import { cn } from '@/lib/utils';
import { getPdfUrl, paperApi, anchorApi, cardApi } from '@/lib/api';
import type { Paper, Anchor, Card } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers,
  Sparkles,
  FileText,
  Settings,
  Save,
  Share,
  Loader2,
} from 'lucide-react';

// 动态导入 PDFViewer，禁用服务端渲染以避免 DOMMatrix 错误
const PDFViewer = dynamic(
  () => import('@/components/reader/PDFViewer').then(mod => ({ default: mod.PDFViewer })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-gray-500">加载 PDF 阅读器...</span>
        </div>
      </div>
    )
  }
);

type ViewMode = 'pdf' | 'markdown' | 'split';
type RightPanelMode = 'anchors' | 'enhance' | 'cards' | 'notes';

export default function ReadPage() {
  const params = useParams();
  const paperId = params.id as string;
  
  const [paper, setPaper] = useState<Paper | null>(null);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('anchors');
  const [selectedAnchor, setSelectedAnchor] = useState<Anchor | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  useEffect(() => {
    // 从API加载真实数据
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 加载论文详情
        const paperData = await paperApi.get(paperId);
        setPaper(paperData);

        // 加载锚点
        try {
          const anchorsResponse = await anchorApi.getByPaper(paperId);
          setAnchors(anchorsResponse.items || []);
        } catch (e) {
          console.warn('加载锚点失败:', e);
          setAnchors([]);
        }

        // 加载卡片
        try {
          const cardsResponse = await cardApi.getByPaper(paperId);
          setCards(cardsResponse.items || []);
        } catch (e) {
          console.warn('加载卡片失败:', e);
          setCards([]);
        }
      } catch (error) {
        console.error('加载论文失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [paperId]);

  const handleAnchorClick = (anchor: Anchor) => {
    setSelectedAnchor(anchor);
    setRightPanelMode('enhance');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">论文不存在</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-medium text-gray-900 line-clamp-1">{paper.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{paper.authors?.slice(0, 2).join(', ')}{paper.authors?.length > 2 ? ' et al.' : ''}</span>
              <span>•</span>
              <span>{paper.venue} {paper.year}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('pdf')}
              className={cn(
                'px-3 py-1 text-sm rounded-md transition-colors',
                viewMode === 'pdf' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              )}
            >
              PDF
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={cn(
                'px-3 py-1 text-sm rounded-md transition-colors',
                viewMode === 'split' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              )}
            >
              分屏
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={cn(
                'px-3 py-1 text-sm rounded-md transition-colors',
                viewMode === 'markdown' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              )}
            >
              Markdown
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">进度</span>
            <Progress value={paper.read_progress * 100} className="w-24" />
            <span className="text-sm text-gray-600">{Math.round(paper.read_progress * 100)}%</span>
          </div>

          {/* Actions */}
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Save className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Share className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Outline */}
        <div
          className={cn(
            'bg-white border-r border-gray-200 transition-all duration-300',
            leftPanelCollapsed ? 'w-0' : 'w-64'
          )}
        >
          {!leftPanelCollapsed && (
            <div className="h-full overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900">大纲</span>
                </div>
                <button
                  onClick={() => setLeftPanelCollapsed(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <AnchorList
                anchors={anchors}
                onAnchorClick={handleAnchorClick}
                selectedAnchorId={selectedAnchor?.id}
                className="h-[calc(100%-53px)]"
              />
            </div>
          )}
        </div>

        {leftPanelCollapsed && (
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="flex items-center justify-center w-6 bg-white border-r border-gray-200 text-gray-400 hover:text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Center - PDF/Markdown Viewer */}
        <div className="flex-1 flex overflow-hidden">
          {(viewMode === 'pdf' || viewMode === 'split') && (
            <div className={cn('flex-1', viewMode === 'split' && 'border-r border-gray-300')}>
              <PDFViewer
                pdfUrl={getPdfUrl(paperId)}
                highlightAnchorId={selectedAnchor?.id}
                onAnchorClick={(id) => {
                  const anchor = anchors.find(a => a.id === id);
                  if (anchor) handleAnchorClick(anchor);
                }}
              />
            </div>
          )}
          
          {(viewMode === 'markdown' || viewMode === 'split') && (
            <div className="flex-1 bg-white overflow-auto p-8">
              <article className="prose prose-indigo max-w-none">
                <h1>{paper.title}</h1>
                <p className="text-gray-500">{paper.authors?.join(', ')}</p>
                
                <h2>Abstract</h2>
                <p>{paper.abstract || '暂无摘要'}</p>
                
                {/* Rendered sections would go here */}
                <div className="text-center text-gray-400 py-10">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Markdown内容将在这里显示</p>
                  <p className="text-sm mt-2">实际项目中从后端获取解析后的Markdown</p>
                </div>
              </article>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div
          className={cn(
            'bg-white border-l border-gray-200 transition-all duration-300',
            rightPanelCollapsed ? 'w-0' : 'w-80'
          )}
        >
          {!rightPanelCollapsed && (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Panel tabs */}
              <div className="flex items-center border-b border-gray-200">
                <button
                  onClick={() => setRightPanelMode('anchors')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors',
                    rightPanelMode === 'anchors'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Layers className="w-4 h-4" />
                  元素
                </button>
                <button
                  onClick={() => setRightPanelMode('enhance')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors',
                    rightPanelMode === 'enhance'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  AI
                </button>
                <button
                  onClick={() => setRightPanelMode('cards')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors',
                    rightPanelMode === 'cards'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  卡片
                </button>
                <button
                  onClick={() => setRightPanelCollapsed(true)}
                  className="p-3 text-gray-400 hover:text-gray-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {rightPanelMode === 'anchors' && (
                  <AnchorList
                    anchors={anchors}
                    onAnchorClick={handleAnchorClick}
                    selectedAnchorId={selectedAnchor?.id}
                  />
                )}
                {rightPanelMode === 'enhance' && (
                  <EnhancePanel
                    anchor={selectedAnchor}
                    onExplainTerm={() => {}}
                    onExplainFigure={() => {}}
                    onExplainEquation={() => {}}
                  />
                )}
                {rightPanelMode === 'cards' && (
                  <div className="p-4">
                    <div className="text-center text-gray-400 py-10">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无卡片</p>
                      <Button size="sm" variant="secondary" className="mt-3">
                        创建卡片
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {rightPanelCollapsed && (
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="flex items-center justify-center w-6 bg-white border-l border-gray-200 text-gray-400 hover:text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
