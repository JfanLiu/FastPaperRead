'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/common';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Download,
  Maximize2,
  Search,
} from 'lucide-react';

interface PDFViewerProps {
  pdfUrl: string;
  className?: string;
  onAnchorClick?: (anchorId: string) => void;
  highlightAnchorId?: string;
}

export function PDFViewer({
  pdfUrl,
  className,
  onAnchorClick,
  highlightAnchorId,
}: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 模拟加载
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [pdfUrl]);

  const handleZoomIn = () => setZoom(Math.min(zoom + 25, 200));
  const handleZoomOut = () => setZoom(Math.max(zoom - 25, 50));
  const handlePrevPage = () => setCurrentPage(Math.max(currentPage - 1, 1));
  const handleNextPage = () => setCurrentPage(Math.min(currentPage + 1, totalPages));

  return (
    <div className={cn('flex flex-col h-full bg-gray-100', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          {/* Page navigation */}
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[80px] text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[50px] text-center">
            {zoom}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Other controls */}
          <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
            <Search className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
            <RotateCw className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4"
        style={{ backgroundColor: '#525659' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-300">加载PDF中...</span>
            </div>
          </div>
        ) : (
          <div
            className="mx-auto bg-white shadow-lg"
            style={{
              width: `${8.5 * zoom / 100}in`,
              minHeight: `${11 * zoom / 100}in`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          >
            {/* Placeholder for actual PDF content */}
            <div className="p-8">
              <div className="text-center text-gray-400 py-20">
                <p className="text-lg mb-2">PDF 预览区域</p>
                <p className="text-sm">
                  实际项目中需要集成 PDF.js 或 react-pdf
                </p>
                <p className="text-xs mt-4 text-gray-500">
                  当前文件: {pdfUrl}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

