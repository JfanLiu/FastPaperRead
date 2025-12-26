'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge, Input, EmptyState } from '@/components/common';
import { PaperCard, EvidenceCard, MethodCard } from '@/components/cards';
import { cn } from '@/lib/utils';
import { cardApi, exportApi } from '@/lib/api';
import type { Card } from '@/types';
import {
  Search,
  Filter,
  Grid,
  List,
  Plus,
  FileText,
  Scale,
  Wrench,
  StickyNote,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'paper' | 'evidence' | 'method' | 'note';

export default function NotesPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [byType, setByType] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // 防抖搜索
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const types = filterType === 'all' ? undefined : [filterType];
      const result = await cardApi.search({
        query: debouncedQuery,
        types,
        limit: 100,
        offset: 0,
      });
      
      setCards(result.items || []);
      setTotal(result.total || 0);
      setByType(result.by_type || {});
    } catch (error) {
      console.error('加载卡片失败:', error);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, filterType]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleExport = async () => {
    if (cards.length === 0) return;
    
    setIsExporting(true);
    try {
      const cardIds = cards.map(c => c.id);
      const result = await exportApi.export('card', cardIds, 'markdown');
      
      // 下载文件
      const blob = new Blob([result], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notes_export_${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const typeConfig = {
    all: { icon: FileText, label: '全部', count: total },
    paper: { icon: FileText, label: 'Paper Card', count: byType['paper'] || 0 },
    evidence: { icon: Scale, label: 'Evidence Card', count: byType['evidence'] || 0 },
    method: { icon: Wrench, label: 'Method Card', count: byType['method'] || 0 },
    note: { icon: StickyNote, label: '笔记', count: byType['note'] || 0 },
  };

  const renderCard = (card: Card) => {
    const handleClick = () => {
      if (card.paper_id) {
        router.push(`/paper/${card.paper_id}/read`);
      }
    };

    switch (card.type) {
      case 'evidence':
        return (
          <div key={card.id} onClick={handleClick} className="cursor-pointer">
            <EvidenceCard card={card} />
          </div>
        );
      case 'method':
        return (
          <div key={card.id} onClick={handleClick} className="cursor-pointer">
            <MethodCard card={card} />
          </div>
        );
      default:
        return (
          <div key={card.id} onClick={handleClick} className="cursor-pointer">
            <PaperCard card={card} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">笔记库</h1>
              <p className="text-sm text-gray-500 mt-1">
                共 {total} 张卡片
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="secondary" 
                onClick={handleExport}
                disabled={isExporting || cards.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                导出
              </Button>
              <Button variant="secondary" onClick={loadCards}>
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索卡片..."
                className="pl-10"
              />
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(Object.entries(typeConfig) as [FilterType, typeof typeConfig.all][]).map(
                ([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                      filterType === type
                        ? 'bg-white shadow text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    <config.icon className="w-4 h-4" />
                    {config.label}
                    {type !== 'all' && config.count > 0 && (
                      <span className="text-xs text-gray-400">({config.count})</span>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          {/* View mode */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon={<StickyNote className="w-8 h-8 text-gray-400" />}
            title="暂无卡片"
            description={searchQuery ? '没有找到匹配的卡片' : '开始阅读论文并创建笔记卡片'}
            action={
              searchQuery ? (
                <Button variant="secondary" onClick={() => setSearchQuery('')}>
                  清除搜索
                </Button>
              ) : (
                <Button onClick={() => router.push('/library')}>
                  前往文献库
                </Button>
              )
            }
          />
        ) : (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            )}
          >
            {cards.map(renderCard)}
          </div>
        )}

        {/* Stats */}
        {!isLoading && Object.keys(byType).length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            {(Object.entries(typeConfig) as [FilterType, typeof typeConfig.all][])
              .filter(([type]) => type !== 'all')
              .map(([type, config]) => {
                const count = byType[type] || 0;
                return (
                  <div
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      'bg-white rounded-xl border border-gray-200 p-4 cursor-pointer transition-all hover:shadow-md',
                      filterType === type && 'ring-2 ring-indigo-500'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <config.icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-2xl font-semibold text-gray-900">{count}</div>
                        <div className="text-sm text-gray-500">{config.label}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
