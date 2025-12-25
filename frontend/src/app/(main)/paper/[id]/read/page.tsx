'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  AnchorList, 
  EnhancePanel, 
  SelectionToolbar,
  RoutePlanner,
  StructuredView,
  NotesPanel,
  ChecklistPanel,
  TimerWidget,
  ResumeBanner,
} from '@/components/reader';
import { Button, Badge, Progress } from '@/components/common';
import { cn } from '@/lib/utils';
import { getPdfUrl, paperApi, anchorApi, cardApi, checklistApi } from '@/lib/api';
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
  ListChecks,
  MessageSquare,
  Timer,
  Pause,
  Play,
  ArrowLeft,
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
type RightPanelTab = 'enhance' | 'notes' | 'checklist' | 'chat' | 'timer';

interface ReadingSession {
  startTime: Date;
  lastAnchor?: Anchor;
  lastTab?: RightPanelTab;
  completedSections: Set<string>;
  route?: string[];
}

interface ChecklistItem {
  id: string;
  group: 'data' | 'preprocess' | 'training' | 'eval' | 'env';
  text: string;
  source_anchor?: string;
  missing: boolean;
  needs_verify: boolean;
  value?: string;
}

export default function ReadPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  
  // 基础数据
  const [paper, setPaper] = useState<Paper | null>(null);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 视图状态
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('enhance');
  const [selectedAnchor, setSelectedAnchor] = useState<Anchor | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // 精读状态
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string[]>([]);
  const [session, setSession] = useState<ReadingSession | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  
  // 选择工具栏
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  
  // 复现清单
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const paperData = await paperApi.get(paperId);
        setPaper(paperData);

        try {
          const anchorsResponse = await anchorApi.getByPaper(paperId);
          setAnchors(anchorsResponse.items || []);
        } catch (e) {
          console.warn('加载锚点失败:', e);
          setAnchors([]);
        }

        try {
          const cardsResponse = await cardApi.getByPaper(paperId);
          setCards(cardsResponse.items || []);
        } catch (e) {
          console.warn('加载卡片失败:', e);
          setCards([]);
        }
        
        // 检查是否有上次阅读会话
        const savedSession = localStorage.getItem(`reading_session_${paperId}`);
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          setShowResumeBanner(true);
          setSession({
            ...parsed,
            startTime: new Date(parsed.startTime),
            completedSections: new Set(parsed.completedSections || []),
          });
        } else {
          // 第一次阅读，显示路线规划
          setShowRoutePlanner(true);
        }
      } catch (error) {
        console.error('加载论文失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [paperId]);

  // 保存会话状态
  const saveSession = useCallback(() => {
    if (session) {
      localStorage.setItem(`reading_session_${paperId}`, JSON.stringify({
        ...session,
        completedSections: Array.from(session.completedSections),
        lastAnchor: selectedAnchor,
        lastTab: rightPanelTab,
      }));
    }
  }, [session, paperId, selectedAnchor, rightPanelTab]);

  // 处理锚点点击
  const handleAnchorClick = (anchor: Anchor) => {
    setSelectedAnchor(anchor);
    setRightPanelTab('enhance');
    if (session) {
      setSession({
        ...session,
        lastAnchor: anchor,
      });
    }
  };

  // 处理章节完成标记
  const handleMarkSectionComplete = (sectionId: string) => {
    if (session) {
      const newCompleted = new Set(session.completedSections);
      if (newCompleted.has(sectionId)) {
        newCompleted.delete(sectionId);
      } else {
        newCompleted.add(sectionId);
      }
      setSession({
        ...session,
        completedSections: newCompleted,
      });
    }
  };

  // 处理路线选择
  const handleSelectRoute = (route: { sections: string[] }, customSections?: string[]) => {
    const sections = customSections || route.sections;
    setCurrentRoute(sections);
    setSession({
      startTime: new Date(),
      completedSections: new Set(),
      route: sections,
    });
    setShowRoutePlanner(false);
  };

  // 处理暂停/继续
  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
      saveSession();
    }
  };

  // 处理恢复阅读
  const handleResume = () => {
    setShowResumeBanner(false);
    if (session?.lastAnchor) {
      setSelectedAnchor(session.lastAnchor);
    }
    if (session?.lastTab) {
      setRightPanelTab(session.lastTab);
    }
  };

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    } else {
      setSelectionPosition(null);
      setSelectedText('');
    }
  }, []);

  // 处理创建卡片 - 调用后端API
  const handleCreateCard = async (card: Partial<Card>) => {
    try {
      const newCard = await cardApi.create({
        paper_id: paperId,
        type: card.type || 'note',
        title: card.title || '',
        content: card.content || '',
        source_anchor_ids: card.source_anchor_ids || [],
        uncertainty: card.uncertainty || 'from_text',
        tags: card.tags || [],
      });
      setCards([...cards, newCard]);
    } catch (error) {
      console.error('创建卡片失败:', error);
      // 失败时保存到本地
      const localCard: Card = {
        id: `local_card_${Date.now()}`,
        paper_id: paperId,
        type: card.type || 'note',
        title: card.title || '',
        content: card.content || '',
        source_anchor_ids: card.source_anchor_ids || [],
        uncertainty: card.uncertainty || 'from_text',
        status: 'draft',
        tags: card.tags || [],
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCards([...cards, localCard]);
    }
  };
  
  // 处理更新卡片 - 调用后端API
  const handleUpdateCard = async (cardId: string, updates: Partial<Card>) => {
    try {
      // 如果是本地卡片，只更新本地
      if (cardId.startsWith('local_')) {
        setCards(cards.map(c => 
          c.id === cardId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
        ));
        return;
      }
      
      const updatedCard = await cardApi.update(cardId, updates);
      setCards(cards.map(c => c.id === cardId ? updatedCard : c));
    } catch (error) {
      console.error('更新卡片失败:', error);
      // 失败时更新本地
      setCards(cards.map(c => 
        c.id === cardId ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
      ));
    }
  };
  
  // 处理删除卡片 - 调用后端API
  const handleDeleteCard = async (cardId: string) => {
    try {
      // 如果是本地卡片，只删除本地
      if (cardId.startsWith('local_')) {
        setCards(cards.filter(c => c.id !== cardId));
        return;
      }
      
      await cardApi.delete(cardId);
      setCards(cards.filter(c => c.id !== cardId));
    } catch (error) {
      console.error('删除卡片失败:', error);
      // 失败时也从本地删除
      setCards(cards.filter(c => c.id !== cardId));
    }
  };

  // 处理添加到复现清单
  const handleAddToChecklist = (item: Omit<ChecklistItem, 'id'>) => {
    const newItem: ChecklistItem = {
      id: `checklist_${Date.now()}`,
      ...item,
    };
    setChecklistItems([...checklistItems, newItem]);
  };

  // 处理更新清单项 - 调用后端API
  const handleUpdateChecklistItem = async (itemId: string, updates: Partial<ChecklistItem>) => {
    // 先更新本地状态
    setChecklistItems(checklistItems.map(i =>
      i.id === itemId ? { ...i, ...updates } : i
    ));
    
    // 如果不是本地创建的ID，尝试同步到后端
    if (!itemId.startsWith('checklist_')) {
      try {
        await checklistApi.updateItem(paperId, itemId, {
          found: updates.missing === false,
          note: updates.value,
          inferred_value: updates.value,
        });
      } catch (error) {
        console.error('同步清单项到后端失败:', error);
      }
    }
  };

  // 处理删除清单项
  const handleDeleteChecklistItem = (itemId: string) => {
    setChecklistItems(checklistItems.filter(i => i.id !== itemId));
  };

  // 处理扫描缺失项 - 调用后端API
  const handleScanMissing = async () => {
    try {
      // 先尝试生成清单
      const result = await checklistApi.generate(paperId);
      if (result.items) {
        // 将后端返回的项目转换为本地格式
        const newItems: ChecklistItem[] = result.items.map((item: { id: string; group: string; text: string; found: boolean; needs_verify: boolean; inferred_value?: string }) => ({
          id: item.id,
          group: item.group as 'data' | 'preprocess' | 'training' | 'eval' | 'env',
          text: item.text,
          missing: !item.found,
          needs_verify: item.needs_verify,
          source_anchor: undefined,
          value: item.inferred_value,
        }));
        setChecklistItems(newItems);
      }
    } catch (error) {
      console.error('扫描缺失项失败:', error);
    }
  };

  // 加载已有的清单数据
  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const result = await checklistApi.get(paperId);
        if (result.items) {
          const items: ChecklistItem[] = result.items.map((item: { id: string; group: string; text: string; found: boolean; needs_verify: boolean; inferred_value?: string; source_anchor_id?: string }) => ({
            id: item.id,
            group: item.group as 'data' | 'preprocess' | 'training' | 'eval' | 'env',
            text: item.text,
            missing: !item.found,
            needs_verify: item.needs_verify,
            source_anchor: item.source_anchor_id,
            value: item.inferred_value,
          }));
          setChecklistItems(items);
        }
      } catch {
        // 清单不存在是正常的
      }
    };
    
    if (paperId) {
      loadChecklist();
    }
  }, [paperId]);

  // 计算阅读进度
  const sectionAnchors = anchors.filter(a => a.type === 'section');
  const readingProgress = session 
    ? (session.completedSections.size / Math.max(sectionAnchors.length, 1)) * 100
    : 0;

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
      {/* Resume Banner */}
      {showResumeBanner && session?.lastAnchor && (
        <ResumeBanner
          lastAnchor={session.lastAnchor}
          lastTab={session.lastTab}
          onResume={handleResume}
          onDismiss={() => setShowResumeBanner(false)}
        />
      )}
      
      {/* Route Planner Modal */}
      <RoutePlanner
        isOpen={showRoutePlanner}
        onClose={() => setShowRoutePlanner(false)}
        onSelectRoute={handleSelectRoute}
        anchors={anchors}
        paperTitle={paper.title}
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-medium text-gray-900 line-clamp-1">{paper.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{paper.authors?.slice(0, 2).join(', ')}{paper.authors && paper.authors.length > 2 ? ' et al.' : ''}</span>
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
              结构化
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">进度</span>
            <Progress value={readingProgress} className="w-24" />
            <span className="text-sm text-gray-600">{Math.round(readingProgress)}%</span>
          </div>

          {/* Pause/Resume */}
          <button
            onClick={handlePauseResume}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isPaused 
                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' 
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>

          {/* Route */}
          <button 
            onClick={() => setShowRoutePlanner(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="修改阅读路线"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Actions */}
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Save className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Share className="w-5 h-5" />
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

        {/* Center - PDF/Structured Viewer */}
        <div className="flex-1 flex overflow-hidden" onMouseUp={handleTextSelection}>
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
            <div className="flex-1 bg-white overflow-hidden">
              <StructuredView
                anchors={anchors}
                paperId={paperId}
                currentRoute={currentRoute}
                completedSections={session?.completedSections || new Set()}
                onSectionClick={handleAnchorClick}
                onMarkComplete={handleMarkSectionComplete}
                onExtractToChecklist={(anchor) => {
                  handleAddToChecklist({
                    group: 'training',
                    text: anchor.text?.slice(0, 100) || '',
                    source_anchor: anchor.id,
                    missing: false,
                    needs_verify: true,
                  });
                  setRightPanelTab('checklist');
                }}
                className="h-full"
              />
            </div>
          )}
        </div>

        {/* Selection Toolbar */}
        {selectionPosition && selectedText && (
          <SelectionToolbar
            selectedText={selectedText}
            position={selectionPosition}
            onExplain={(text) => {
              // 创建临时锚点并触发解释
              const tempAnchor: Anchor = {
                id: `temp_${Date.now()}`,
                paper_id: paperId,
                type: 'paragraph',
                text,
                page: 1,
              };
              setSelectedAnchor(tempAnchor);
              setRightPanelTab('enhance');
              setSelectionPosition(null);
            }}
            onCreateCard={(text) => {
              handleCreateCard({
                type: 'evidence',
                title: text.slice(0, 50),
                content: text,
                source_anchor_ids: selectedAnchor ? [selectedAnchor.id] : [],
              });
              setRightPanelTab('notes');
              setSelectionPosition(null);
            }}
            onAddToChecklist={(text) => {
              handleAddToChecklist({
                group: 'training',
                text,
                source_anchor: selectedAnchor?.id,
                missing: false,
                needs_verify: true,
              });
              setRightPanelTab('checklist');
              setSelectionPosition(null);
            }}
            onClose={() => setSelectionPosition(null)}
          />
        )}

        {/* Right Panel */}
        <div
          className={cn(
            'bg-white border-l border-gray-200 transition-all duration-300 flex flex-col',
            rightPanelCollapsed ? 'w-0' : 'w-80'
          )}
        >
          {!rightPanelCollapsed && (
            <>
              {/* Panel tabs */}
              <div className="flex items-center border-b border-gray-200 shrink-0">
                <button
                  onClick={() => setRightPanelTab('enhance')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors',
                    rightPanelTab === 'enhance'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  AI
                </button>
                <button
                  onClick={() => setRightPanelTab('notes')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors',
                    rightPanelTab === 'notes'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  笔记
                </button>
                <button
                  onClick={() => setRightPanelTab('checklist')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors',
                    rightPanelTab === 'checklist'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <ListChecks className="w-4 h-4" />
                  清单
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
                {rightPanelTab === 'enhance' && (
                  <EnhancePanel
                    anchor={selectedAnchor}
                    paperId={paperId}
                    onCreateCard={(text, type) => {
                      handleCreateCard({
                        type: type as 'evidence' | 'method' | 'paper' | 'note',
                        title: text.slice(0, 50),
                        content: text,
                        source_anchor_ids: selectedAnchor ? [selectedAnchor.id] : [],
                      });
                      setRightPanelTab('notes');
                    }}
                    onAddToChecklist={(text) => {
                      handleAddToChecklist({
                        group: 'training',
                        text,
                        source_anchor: selectedAnchor?.id,
                        missing: false,
                        needs_verify: true,
                      });
                      setRightPanelTab('checklist');
                    }}
                  />
                )}
                {rightPanelTab === 'notes' && (
                  <NotesPanel
                    cards={cards}
                    paperId={paperId}
                    selectedAnchor={selectedAnchor}
                    onCreateCard={handleCreateCard}
                    onUpdateCard={handleUpdateCard}
                    onDeleteCard={handleDeleteCard}
                    onJumpToAnchor={(anchorId) => {
                      const anchor = anchors.find(a => a.id === anchorId);
                      if (anchor) handleAnchorClick(anchor);
                    }}
                  />
                )}
                {rightPanelTab === 'checklist' && (
                  <ChecklistPanel
                    items={checklistItems}
                    paperId={paperId}
                    onAddItem={handleAddToChecklist}
                    onUpdateItem={handleUpdateChecklistItem}
                    onDeleteItem={handleDeleteChecklistItem}
                    onJumpToAnchor={(anchorId) => {
                      const anchor = anchors.find(a => a.id === anchorId);
                      if (anchor) handleAnchorClick(anchor);
                    }}
                    onFindMissing={handleScanMissing}
                  />
                )}
              </div>

              {/* Timer widget */}
              <TimerWidget
                onSessionComplete={(duration, goals) => {
                  console.log('Session complete:', duration, goals);
                }}
                onPause={saveSession}
              />
            </>
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
