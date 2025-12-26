'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Badge, EmptyState, Input, Modal } from '@/components/common';
import { cn } from '@/lib/utils';
import { compareApi, paperApi } from '@/lib/api';
import type { Paper } from '@/types';
import {
  GitCompare,
  Plus,
  Trash2,
  Search,
  Loader2,
  ChevronRight,
  Calendar,
  FileText,
  RefreshCw,
} from 'lucide-react';

interface CompareSet {
  id: string;
  name: string;
  paper_ids: string[];
  paper_count: number;
  created_at?: string;
  updated_at?: string;
}

export default function CompareListPage() {
  const router = useRouter();
  const [sets, setSets] = useState<CompareSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<Paper[]>([]);
  const [setName, setSetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadSets();
  }, []);

  // 搜索论文
  useEffect(() => {
    const searchPapers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        const result = await paperApi.list({ search: searchQuery, limit: 10 });
        const resultItems = result.items || [];
        // 过滤掉已选择的论文
        const filtered = resultItems.filter(
          (p: Paper) => !selectedPapers.find(existing => existing.id === p.id)
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error('搜索论文失败:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchPapers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedPapers]);

  const loadSets = async () => {
    setIsLoading(true);
    try {
      const result = await compareApi.listSets?.() || { items: [] };
      setSets(result.items || []);
    } catch (error) {
      console.error('加载对比集合失败:', error);
      setSets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSet = async () => {
    if (selectedPapers.length < 2) return;
    
    setIsCreating(true);
    try {
      const name = setName.trim() || `对比: ${selectedPapers.map(p => p.title.slice(0, 15)).join(' vs ')}`;
      const result = await compareApi.createSet(name, selectedPapers.map(p => p.id));
      
      // 跳转到新创建的对比页面
      if (result.id && selectedPapers[0]) {
        router.push(`/paper/${selectedPapers[0].id}/compare?setId=${result.id}`);
      } else {
        // 刷新列表
        loadSets();
        setShowCreateModal(false);
        setSelectedPapers([]);
        setSetName('');
        setSearchQuery('');
      }
    } catch (error) {
      console.error('创建对比集合失败:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    setDeletingId(setId);
    try {
      await compareApi.deleteSet?.(setId);
      setSets(sets.filter(s => s.id !== setId));
    } catch (error) {
      console.error('删除对比集合失败:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddPaper = (paper: Paper) => {
    if (!selectedPapers.find(p => p.id === paper.id)) {
      setSelectedPapers([...selectedPapers, paper]);
    }
    setSearchQuery('');
  };

  const handleRemovePaper = (paperId: string) => {
    setSelectedPapers(selectedPapers.filter(p => p.id !== paperId));
  };

  const handleOpenSet = (set: CompareSet) => {
    if (set.paper_ids && set.paper_ids.length > 0) {
      router.push(`/paper/${set.paper_ids[0]}/compare?setId=${set.id}`);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={loadSets}>
        <RefreshCw className="w-4 h-4 mr-1" />
        刷新
      </Button>
      <Button onClick={() => setShowCreateModal(true)}>
        <Plus className="w-4 h-4 mr-1" />
        新建对比
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <MainLayout title="论文对比" showSearch={false} headerActions={headerActions}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="论文对比" showSearch={false} headerActions={headerActions}>
      <div className="p-6 max-w-5xl mx-auto">
        {sets.length === 0 ? (
          <EmptyState
            icon={<GitCompare className="w-8 h-8 text-gray-400" />}
            title="暂无对比集合"
            description="创建一个新的对比集合，选择多篇论文进行对比分析"
            action={
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                新建对比
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {sets.map((set) => (
              <div
                key={set.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="font-medium text-gray-900 hover:text-indigo-600 cursor-pointer line-clamp-1"
                      onClick={() => handleOpenSet(set)}
                    >
                      {set.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{set.paper_count} 篇论文</span>
                      </div>
                      {set.created_at && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(set.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleOpenSet(set)}
                    >
                      <ChevronRight className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteSet(set.id)}
                      disabled={deletingId === set.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {deletingId === set.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">新建对比集合</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                集合名称（可选）
              </label>
              <Input
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
                placeholder="例如：Transformer变体对比"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                添加论文（至少2篇）
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索论文标题..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                {isSearching ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="p-2 space-y-1">
                    {searchResults.map((paper) => (
                      <button
                        key={paper.id}
                        onClick={() => handleAddPaper(paper)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 line-clamp-1">{paper.title}</div>
                          <div className="text-xs text-gray-500">
                            {paper.authors?.slice(0, 2).join(', ')} • {paper.year || 'N/A'}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-500">
                    没有找到匹配的论文
                  </div>
                )}
              </div>
            )}

            {/* Selected Papers */}
            {selectedPapers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  已选择 ({selectedPapers.length})
                </label>
                <div className="space-y-2">
                  {selectedPapers.map((paper, index) => (
                    <div
                      key={paper.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 line-clamp-1">{paper.title}</div>
                      </div>
                      <button
                        onClick={() => handleRemovePaper(paper.id)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                取消
              </Button>
              <Button 
                onClick={handleCreateSet}
                disabled={selectedPapers.length < 2 || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建并开始对比'
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}

