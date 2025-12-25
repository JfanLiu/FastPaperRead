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
} from 'lucide-react';

// 配置 PDF.js worker - 使用本地文件避免 CDN 访问问题
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  pdfUrl: string;
  className?: string;
  onAnchorClick?: (anchorId: string) => void;
  highlightAnchorId?: string;
  onTextSelect?: (text: string, position: { page: number; rect: DOMRect }) => void;
}

export function PDFViewer({
  pdfUrl,
  className,
  onAnchorClick,
  highlightAnchorId,
  onTextSelect,
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

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      onTextSelect?.(text, { page: currentPage, rect });
    }
  }, [currentPage, onTextSelect]);

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
        if (showSearch) {
          setShowSearch(false);
        } else if (isFullscreen) {
          document.exitFullscreen();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, isFullscreen, currentPage, numPages, scale]);

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
                <Page
                  key={`page_${index + 1}`}
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
    </div>
  );
}
