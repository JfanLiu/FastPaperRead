'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Input, EmptyState } from '@/components/common';
import { PaperCard, EvidenceCard, MethodCard } from '@/components/cards';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'paper' | 'evidence' | 'method' | 'note';

export default function NotesPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock data
    setCards([
      {
        id: 'c1',
        paper_id: 'p1',
        type: 'paper',
        title: 'Transformer 论文总结',
        content: '提出了基于自注意力机制的Transformer架构...',
        one_line_summary: '革命性的序列建模架构',
        contributions: ['自注意力机制', '多头注意力', '位置编码'],
        limitations: ['计算复杂度高', '需要大量数据'],
        tags: ['NLP', 'Attention', 'Transformer'],
        source_anchor_ids: [],
        uncertainty: 'from_text',
        status: 'final',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'c2',
        paper_id: 'p1',
        type: 'evidence',
        title: 'BLEU分数提升证据',
        content: '在WMT 2014英德翻译任务上...',
        claim: 'Transformer在机器翻译上优于RNN',
        evidence: 'BLEU分数提高2.0',
        evidence_strength: 'strong',
        tags: ['实验结果', '翻译'],
        source_anchor_ids: [],
        uncertainty: 'from_text',
        status: 'draft',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'c3',
        paper_id: 'p1',
        type: 'method',
        title: 'Scaled Dot-Product Attention',
        content: '核心注意力计算公式',
        method_name: 'Scaled Dot-Product Attention',
        inputs: ['Query Q', 'Key K', 'Value V'],
        outputs: ['Attention输出'],
        complexity: 'O(n²d)',
        tags: ['注意力', '公式'],
        source_anchor_ids: [],
        uncertainty: 'from_text',
        status: 'final',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    
    setIsLoading(false);
  };

  const filteredCards = cards.filter(card => {
    // Type filter
    if (filterType !== 'all' && card.type !== filterType) {
      return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        card.title.toLowerCase().includes(query) ||
        card.content?.toLowerCase().includes(query) ||
        card.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    return true;
  });

  const typeConfig = {
    all: { icon: FileText, label: '全部' },
    paper: { icon: FileText, label: 'Paper Card' },
    evidence: { icon: Scale, label: 'Evidence Card' },
    method: { icon: Wrench, label: 'Method Card' },
    note: { icon: StickyNote, label: '笔记' },
  };

  const renderCard = (card: Card) => {
    switch (card.type) {
      case 'evidence':
        return <EvidenceCard key={card.id} card={card} />;
      case 'method':
        return <MethodCard key={card.id} card={card} />;
      default:
        return <PaperCard key={card.id} card={card} />;
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
                共 {cards.length} 张卡片
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary">
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
              <Button>
                <Plus className="w-4 h-4 mr-1" />
                新建卡片
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
        ) : filteredCards.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title="暂无卡片"
            description={searchQuery ? '没有找到匹配的卡片' : '开始阅读论文并创建笔记卡片'}
            action={
              searchQuery ? (
                <Button variant="secondary" onClick={() => setSearchQuery('')}>
                  清除搜索
                </Button>
              ) : undefined
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
            {filteredCards.map(renderCard)}
          </div>
        )}

        {/* Stats */}
        {!isLoading && cards.length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            {(Object.entries(typeConfig) as [FilterType, typeof typeConfig.all][])
              .filter(([type]) => type !== 'all')
              .map(([type, config]) => {
                const count = cards.filter(c => c.type === type).length;
                return (
                  <div
                    key={type}
                    className="bg-white rounded-xl border border-gray-200 p-4"
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


