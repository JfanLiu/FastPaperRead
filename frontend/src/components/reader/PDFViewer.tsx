'use client';

import { useState, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { cn } from '@/lib/utils';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
  Maximize2,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// 配置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF加载失败:', error);
    setError('PDF加载失败，请检查文件是否存在');
    setIsLoading(false);
  }, []);

  const handleZoomIn = () => setScale(Math.min(scale + 0.25, 3.0));
  const handleZoomOut = () => setScale(Math.max(scale - 0.25, 0.5));
  const handlePrevPage = () => setCurrentPage(Math.max(currentPage - 1, 1));
  const handleNextPage = () => setCurrentPage(Math.min(currentPage + 1, numPages));

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

  return (
    <div className={cn('flex flex-col h-full bg-gray-100', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="上一页"
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
            title="下一页"
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
            title="缩小"
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
            title="放大"
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
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="搜索"
          >
            <Search className="w-4 h-4" />
          </button>
          <button 
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="旋转"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button 
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="全屏"
          >
            <Maximize2 className="w-4 h-4" />
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

      {/* PDF Content */}
      <div
        ref={containerRef}
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
        ) : (
          <div className="flex justify-center py-4">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                  <span className="text-sm text-gray-300">加载PDF中...</span>
                </div>
              }
              className="flex flex-col items-center gap-4"
            >
              {/* 渲染当前页和前后各一页以支持滚动 */}
              {Array.from({ length: numPages }, (_, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  scale={scale}
                  className="shadow-lg"
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div 
                      className="flex items-center justify-center bg-white"
                      style={{ width: 595 * scale, height: 842 * scale }}
                    >
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  }
                />
              ))}
            </Document>
          </div>
        )}
      </div>

      {/* Selection Toolbar - 会在文本选中时显示 */}
      {/* 这里可以添加浮动工具栏 */}
    </div>
  );
}
