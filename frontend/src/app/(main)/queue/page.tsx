'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge, EmptyState } from '@/components/common';
import { cn } from '@/lib/utils';
import { skimApi, paperApi } from '@/lib/api';
import {
  BookOpen,
  Play,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Star,
  Loader2,
  ListTodo,
} from 'lucide-react';

interface QueueItem {
  queue_id: string;
  paper_id: string;
  title: string;
  authors?: string[];
  year?: number;
  status: string;
  quality_grade?: string;
  priority: number;
  note?: string;
  added_at?: string;
}

export default function QueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const data = await skimApi.getQueue();
      setItems(data.items || []);
    } catch (error) {
      console.error('加载队列失败:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (paperId: string) => {
    setRemovingId(paperId);
    try {
      await skimApi.removeFromQueue(paperId);
      setItems(items.filter(item => item.paper_id !== paperId));
    } catch (error) {
      console.error('移除失败:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleStartReading = (paperId: string) => {
    router.push(`/paper/${paperId}/read`);
  };

  const handleViewOverview = (paperId: string) => {
    router.push(`/paper/${paperId}/overview`);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
      unread: { label: '未读', variant: 'default' },
      skimmed: { label: '已略读', variant: 'warning' },
      deepread: { label: '已精读', variant: 'success' },
      archived: { label: '已归档', variant: 'danger' },
    };
    const c = config[status] || { label: status, variant: 'default' };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getPriorityStars = (priority: number) => {
    const stars = Math.min(Math.max(Math.ceil(priority / 2), 0), 5);
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'w-3.5 h-3.5',
              i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">待读队列</h1>
                <p className="text-sm text-gray-500">
                  {items.length} 篇论文待阅读
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={loadQueue}>
              刷新
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {items.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-8 h-8 text-gray-400" />}
            title="队列为空"
            description="暂无待读论文，在文献库或 Overview 页面将论文加入队列"
            action={
              <Button onClick={() => router.push('/library')}>
                前往文献库
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.queue_id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* 序号 */}
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold shrink-0">
                    {index + 1}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3
                          className="font-medium text-gray-900 hover:text-indigo-600 cursor-pointer line-clamp-2"
                          onClick={() => handleViewOverview(item.paper_id)}
                        >
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          {item.authors && item.authors.length > 0 && (
                            <span>
                              {item.authors.slice(0, 2).join(', ')}
                              {item.authors.length > 2 ? ' et al.' : ''}
                            </span>
                          )}
                          {item.year && (
                            <>
                              <span>•</span>
                              <span>{item.year}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusBadge(item.status)}
                        {item.quality_grade && (
                          <Badge variant="info">{item.quality_grade}</Badge>
                        )}
                      </div>
                    </div>

                    {/* 优先级和备注 */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">优先级:</span>
                        {getPriorityStars(item.priority)}
                      </div>
                      {item.note && (
                        <span className="text-sm text-gray-600 truncate">
                          📝 {item.note}
                        </span>
                      )}
                      {item.added_at && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {new Date(item.added_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => handleStartReading(item.paper_id)}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        开始阅读
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewOverview(item.paper_id)}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        查看概览
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(item.paper_id)}
                        disabled={removingId === item.paper_id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {removingId === item.paper_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 提示 */}
        {items.length > 0 && (
          <div className="mt-8 bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
            <p>
              💡 提示：论文按优先级和添加时间排序。您可以在 Overview 页面调整优先级或添加备注。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

