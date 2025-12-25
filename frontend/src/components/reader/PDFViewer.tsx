'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { cn } from '@/lib/utils';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Loader2,
  AlertCircle,
  X,
  Highlighter,
  MessageSquare,
  Trash2,
  Check,
} from 'lucide-react';
import { annotationsApi } from '@/lib/api';
import type { Annotation, HighlightColor, AnnotationRect } from '@/types';

// 配置 PDF.js worker - 使用本地文件避免 CDN 访问问题
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  pdfUrl: string;
  paperId?: string;  // 需要 paperId 来保存批注
  className?: string;
  onAnchorClick?: (anchorId: string) => void;
  highlightAnchorId?: string;
  onTextSelect?: (text: string, position: { page: number; rect: DOMRect }) => void;
  // 双向同步
  targetPage?: number;  // 外部控制跳转到指定页
  onPageChange?: (page: number) => void;  // 当前页变化时通知外部
  syncEnabled?: boolean;  // 是否启用同步
}

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; label: string }[] = [
  { color: 'yellow', bg: 'bg-yellow-300/50', label: '黄色' },
  { color: 'green', bg: 'bg-green-300/50', label: '绿色' },
  { color: 'blue', bg: 'bg-blue-300/50', label: '蓝色' },
  { color: 'red', bg: 'bg-red-300/50', label: '红色' },
  { color: 'purple', bg: 'bg-purple-300/50', label: '紫色' },
];

export function PDFViewer({
  pdfUrl,
  paperId,
  className,
  onAnchorClick,
  highlightAnchorId,
  onTextSelect,
  targetPage,
  onPageChange,
  syncEnabled = true,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<{page: number; index: number}[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  
  // 批注状态
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [highlightMode, setHighlightMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [pendingHighlight, setPendingHighlight] = useState<{
    text: string;
    page: number;
    rect: AnnotationRect;
  } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [documentLoaded, setDocumentLoaded] = useState(false);

  // Memoize options prop
  const documentOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  }), []);

  // 加载批注
  useEffect(() => {
    if (!paperId) return;
    
    const loadAnnotations = async () => {
      try {
        const response = await annotationsApi.getAll(paperId);
        setAnnotations(response.annotations);
      } catch (error) {
        console.error('加载批注失败:', error);
      }
    };
    
    loadAnnotations();
  }, [paperId]);

  // 预先获取 PDF 数据，创建 Blob URL 避免跨域和 ArrayBuffer 问题
  useEffect(() => {
    let cancelled = false;
    let currentBlobUrl: string | null = null;
    
    // 重置状态
    setPdfBlobUrl(null);
    setDocumentLoaded(false);
    setNumPages(0);
    
    const fetchPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const blob = await response.blob();
        
        // 检查是否已取消（React 严格模式下会发生）
        if (cancelled) {
          return;
        }
        
        // 清理旧的 Blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        
        currentBlobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = currentBlobUrl;
        setPdfBlobUrl(currentBlobUrl);
      } catch (err) {
        if (!cancelled) {
          console.error('获取PDF失败:', err);
          setError(`获取PDF失败: ${err instanceof Error ? err.message : '未知错误'}`);
          setIsLoading(false);
        }
      }
    };
    
    if (pdfUrl) {
      fetchPdf();
    }
    
    // 清理函数
    return () => {
      cancelled = true;
      // 只清理本次 effect 创建的 URL
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        if (blobUrlRef.current === currentBlobUrl) {
          blobUrlRef.current = null;
        }
      }
    };
  }, [pdfUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setDocumentLoaded(true);
    setIsLoading(false);
    setError(null);
  }, []);

  // 外部控制跳转到指定页
  useEffect(() => {
    if (targetPage && targetPage >= 1 && targetPage <= numPages && syncEnabled) {
      setCurrentPage(targetPage);
      // 滚动到对应页面
      const pageElement = document.querySelector(`[data-page-number="${targetPage}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [targetPage, numPages, syncEnabled]);

  // 当前页变化时通知外部
  useEffect(() => {
    if (onPageChange && syncEnabled) {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange, syncEnabled]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF加载失败:', error);
    console.error('错误详情:', error.message, error.name, error.stack);
    setError(`PDF加载失败: ${error.message || '请检查文件是否存在'}`);
    setIsLoading(false);
  }, []);

  const handleZoomIn = () => setScale(Math.min(scale + 0.25, 3.0));
  const handleZoomOut = () => setScale(Math.max(scale - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage(Math.max(currentPage - 1, 1));
  const handleNextPage = () => setCurrentPage(Math.min(currentPage + 1, numPages));
  
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value, 10);
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  // 处理文本选择 - 支持高亮模式
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;
    
    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // 获取 PDF 容器的位置来计算相对坐标
    const pageElement = range.startContainer.parentElement?.closest('.react-pdf__Page');
    if (!pageElement) {
      onTextSelect?.(text, { page: currentPage, rect });
      return;
    }
    
    const pageRect = pageElement.getBoundingClientRect();
    const relativeRect: AnnotationRect = {
      x: ((rect.left - pageRect.left) / pageRect.width) * 100,
      y: ((rect.top - pageRect.top) / pageRect.height) * 100,
      width: (rect.width / pageRect.width) * 100,
      height: (rect.height / pageRect.height) * 100,
    };
    
    // 获取页码
    const pageNumber = parseInt(pageElement.getAttribute('data-page-number') || '1', 10);
    
    if (highlightMode && paperId) {
      // 高亮模式：设置待创建的高亮
      setPendingHighlight({
        text,
        page: pageNumber,
        rect: relativeRect,
      });
      setShowColorPicker(true);
    } else {
      // 普通模式：触发选择回调
      onTextSelect?.(text, { page: pageNumber, rect });
    }
  }, [currentPage, onTextSelect, highlightMode, paperId]);

  // 创建高亮
  const createHighlight = async (withNote: boolean = false) => {
    if (!pendingHighlight || !paperId) return;
    
    try {
      const response = await annotationsApi.create(paperId, {
        type: withNote ? 'note' : 'highlight',
        page: pendingHighlight.page,
        text: pendingHighlight.text,
        note: withNote ? noteText : undefined,
        color: selectedColor,
        rect: pendingHighlight.rect,
      });
      
      setAnnotations(prev => [...prev, response.annotation]);
      setPendingHighlight(null);
      setShowColorPicker(false);
      setNoteText('');
      
      // 清除选择
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('创建高亮失败:', error);
    }
  };

  // 删除批注
  const deleteAnnotation = async (annotationId: string) => {
    if (!paperId) return;
    
    try {
      await annotationsApi.delete(paperId, annotationId);
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
    } catch (error) {
      console.error('删除批注失败:', error);
    }
  };

  // 更新批注
  const updateAnnotation = async (annotationId: string, note: string) => {
    if (!paperId) return;
    
    try {
      await annotationsApi.update(paperId, annotationId, { note });
      setAnnotations(prev => prev.map(a => 
        a.id === annotationId ? { ...a, note } : a
      ));
      setEditingAnnotation(null);
      setNoteText('');
    } catch (error) {
      console.error('更新批注失败:', error);
    }
  };

  // 全屏功能
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('无法进入全屏:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 搜索功能
  const handleSearch = useCallback(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    
    // 简单的文本搜索模拟 - 在真实场景中需要使用PDF.js的findController
    // 这里我们创建模拟结果
    const mockResults: {page: number; index: number}[] = [];
    
    // 假设在一些页面找到了结果
    for (let i = 1; i <= Math.min(numPages, 5); i++) {
      mockResults.push({ page: i, index: mockResults.length });
    }
    
    setSearchResults(mockResults);
    setCurrentSearchIndex(0);
    
    if (mockResults.length > 0) {
      setCurrentPage(mockResults[0].page);
    }
  }, [searchText, numPages]);

  const goToNextSearchResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    setCurrentPage(searchResults[nextIndex].page);
  };

  const goToPrevSearchResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    setCurrentPage(searchResults[prevIndex].page);
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') {
          e.preventDefault();
          setShowSearch(true);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        } else if (e.key === '=') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === 'h') {
          e.preventDefault();
          setHighlightMode(!highlightMode);
        }
      }
      
      if (!showSearch) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          handlePrevPage();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          handleNextPage();
        }
      }
      
      if (e.key === 'Escape') {
        if (showColorPicker) {
          setShowColorPicker(false);
          setPendingHighlight(null);
        } else if (showSearch) {
          setShowSearch(false);
        } else if (isFullscreen) {
          document.exitFullscreen();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, isFullscreen, currentPage, numPages, scale, highlightMode, showColorPicker]);

  // 获取颜色样式
  const getHighlightStyle = (color: HighlightColor) => {
    const styles: Record<HighlightColor, string> = {
      yellow: 'bg-yellow-300/50 border-yellow-400',
      green: 'bg-green-300/50 border-green-400',
      blue: 'bg-blue-300/50 border-blue-400',
      red: 'bg-red-300/50 border-red-400',
      purple: 'bg-purple-300/50 border-purple-400',
    };
    return styles[color];
  };

  // 渲染页面上的批注
  const renderAnnotations = (pageNumber: number) => {
    const pageAnnotations = annotations.filter(a => a.page === pageNumber);
    
    return pageAnnotations.map(annotation => (
      <div
        key={annotation.id}
        className={cn(
          'absolute cursor-pointer transition-all group',
          getHighlightStyle(annotation.color),
          'hover:border-2'
        )}
        style={{
          left: `${annotation.rect.x}%`,
          top: `${annotation.rect.y}%`,
          width: `${annotation.rect.width}%`,
          height: `${annotation.rect.height}%`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (annotation.type === 'note') {
            setEditingAnnotation(annotation.id);
            setNoteText(annotation.note || '');
          }
        }}
      >
        {/* 批注图标 */}
        {annotation.type === 'note' && (
          <MessageSquare className="absolute -top-2 -right-2 w-4 h-4 text-amber-600" />
        )}
        
        {/* 悬浮操作 */}
        <div className="hidden group-hover:flex absolute -top-8 left-0 bg-white shadow-lg rounded-md p-1 gap-1 z-10">
          {annotation.note && (
            <div className="text-xs px-2 py-1 bg-gray-100 rounded max-w-[200px] truncate">
              {annotation.note}
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteAnnotation(annotation.id);
            }}
            className="p-1 text-red-500 hover:bg-red-50 rounded"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div 
      ref={containerRef}
      className={cn('flex flex-col h-full bg-gray-100', isFullscreen && 'fixed inset-0 z-50', className)}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一页 (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={handlePageChange}
              className="w-12 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading}
            />
            <span className="text-sm text-gray-500">/ {numPages || '-'}</span>
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="下一页 (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || isLoading}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
            title="缩小 (Ctrl+-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <span className="text-sm text-gray-600 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || isLoading}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
            title="放大 (Ctrl+=)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Quick zoom */}
          <select
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>

          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Annotation controls */}
          {paperId && (
            <button
              onClick={() => setHighlightMode(!highlightMode)}
              className={cn(
                "p-1.5 rounded transition-colors",
                highlightMode 
                  ? "bg-yellow-100 text-yellow-700" 
                  : "text-gray-600 hover:bg-gray-100"
              )}
              title={`高亮模式 ${highlightMode ? '(开启)' : '(关闭)'} (Ctrl+H)`}
            >
              <Highlighter className="w-4 h-4" />
            </button>
          )}

          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Other controls */}
          <button 
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className={cn(
              "p-1.5 rounded transition-colors",
              showSearch ? "bg-indigo-100 text-indigo-600" : "text-gray-600 hover:bg-gray-100"
            )}
            title="搜索 (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button 
            onClick={handleRotate}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="旋转"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title={isFullscreen ? "退出全屏 (Esc)" : "全屏"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <a
            href={pdfUrl}
            download
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="下载"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Highlight Mode Banner */}
      {highlightMode && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-sm">
          <Highlighter className="w-4 h-4 text-yellow-600" />
          <span className="text-yellow-800">高亮模式已开启</span>
          <span className="text-yellow-600">- 选择文本即可添加高亮</span>
          <button
            onClick={() => setHighlightMode(false)}
            className="ml-2 px-2 py-0.5 text-yellow-700 bg-yellow-200 rounded hover:bg-yellow-300"
          >
            关闭
          </button>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="搜索文档..."
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700"
          >
            搜索
          </button>
          {searchResults.length > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {currentSearchIndex + 1} / {searchResults.length}
              </span>
              <button
                onClick={goToPrevSearchResult}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToNextSearchResult}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchText('');
              setSearchResults([]);
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Color Picker Popup */}
      {showColorPicker && pendingHighlight && (
        <div className="absolute z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-4 border">
          <div className="text-sm font-medium mb-3">选择高亮颜色</div>
          <div className="flex gap-2 mb-3">
            {HIGHLIGHT_COLORS.map(({ color, bg, label }) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={cn(
                  'w-8 h-8 rounded-full transition-all',
                  bg,
                  selectedColor === color && 'ring-2 ring-offset-2 ring-gray-400'
                )}
                title={label}
              />
            ))}
          </div>
          
          {/* 添加批注选项 */}
          <div className="mb-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="添加批注（可选）..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => createHighlight(!!noteText)}
              className="flex-1 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700"
            >
              <Check className="w-4 h-4 inline mr-1" />
              确认
            </button>
            <button
              onClick={() => {
                setShowColorPicker(false);
                setPendingHighlight(null);
                setNoteText('');
              }}
              className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* PDF Content */}
      <div
        className="flex-1 overflow-auto"
        style={{ backgroundColor: '#525659' }}
        onMouseUp={handleTextSelection}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
            <p className="text-lg mb-2">{error}</p>
            <p className="text-sm text-gray-400">文件: {pdfUrl}</p>
          </div>
        ) : !pdfBlobUrl && isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
            <span className="text-sm text-gray-300">正在获取PDF...</span>
          </div>
        ) : pdfBlobUrl ? (
          <div className="flex justify-center py-4">
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              options={documentOptions}
              loading={
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                  <span className="text-sm text-gray-300">加载PDF中...</span>
                </div>
              }
              className="flex flex-col items-center gap-4"
            >
              {/* 渲染所有页面 - 只在文档完全加载后渲染 */}
              {documentLoaded && numPages > 0 && Array.from({ length: numPages }, (_, index) => (
                <div key={`page_${index + 1}`} className="relative">
                  <Page
                    pageNumber={index + 1}
                    scale={scale}
                    rotate={rotation}
                    className="shadow-lg"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={
                      <div 
                        className="flex items-center justify-center bg-white"
                        style={{ 
                          width: (rotation % 180 === 0 ? 595 : 842) * scale, 
                          height: (rotation % 180 === 0 ? 842 : 595) * scale 
                        }}
                      >
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      </div>
                    }
                  />
                  {/* 渲染该页的批注 */}
                  {renderAnnotations(index + 1)}
                </div>
              ))}
            </Document>
          </div>
        ) : null}
      </div>

      {/* Page indicator in fullscreen */}
      {isFullscreen && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
          第 {currentPage} 页 / 共 {numPages} 页
        </div>
      )}

      {/* Annotation count indicator */}
      {annotations.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1.5 rounded-full text-sm text-gray-600 shadow">
          {annotations.length} 个批注
        </div>
      )}
    </div>
  );
}
