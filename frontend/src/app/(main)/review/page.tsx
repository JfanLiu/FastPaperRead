'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Badge, EmptyState } from '@/components/common';
import { cn } from '@/lib/utils';
import { reviewApi, paperApi } from '@/lib/api';
import {
  ClipboardCheck,
  RefreshCw,
  Loader2,
  Star,
  ChevronRight,
  Calendar,
  FileText,
  AlertCircle,
  GitCompare,
} from 'lucide-react';

interface ReviewItem {
  paper_id: string;
  paper_title?: string;
  recommendation?: string;
  total_score?: number;
  generated_at?: string;
  submitted_at?: string;
}

export default function ReviewListPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const result = await reviewApi.list?.() || { items: [] };
      setReviews(result.items || []);
    } catch (error) {
      console.error('加载审稿记录失败:', error);
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getRecommendationBadge = (recommendation?: string) => {
    const config: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
      accept: { label: 'Accept', variant: 'success' },
      weak_accept: { label: 'Weak Accept', variant: 'success' },
      weak_reject: { label: 'Weak Reject', variant: 'warning' },
      reject: { label: 'Reject', variant: 'danger' },
    };
    const c = config[recommendation || ''] || { label: recommendation || '未评估', variant: 'default' };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getScoreStars = (score?: number) => {
    if (!score) return null;
    const stars = Math.round(score);
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
        <span className="ml-1 text-sm text-gray-600">{score.toFixed(1)}</span>
      </div>
    );
  };

  const handleOpenReview = (paperId: string) => {
    router.push(`/paper/${paperId}/review`);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => router.push('/compare')}>
        <GitCompare className="w-4 h-4 mr-1" />
        去论文对比
      </Button>
      <Button variant="secondary" onClick={loadReviews}>
        <RefreshCw className="w-4 h-4 mr-1" />
        刷新
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <MainLayout title="审稿记录" showSearch={false} headerActions={headerActions}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="审稿记录" showSearch={false} headerActions={headerActions}>
      <div className="p-6 max-w-5xl mx-auto">
        {/* 提示卡片 */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-purple-900">如何使用审稿模式？</h3>
              <p className="text-sm text-purple-700 mt-1">
                在论文详情页点击"开始精读"，阅读完成后可通过论文页面进入审稿模式，生成结构化的审稿意见。
              </p>
            </div>
          </div>
        </div>

        {reviews.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="w-8 h-8 text-gray-400" />}
            title="暂无审稿记录"
            description="阅读论文后在论文页面进入审稿模式，生成审稿意见"
            action={
              <Button onClick={() => router.push('/library')}>
                前往文献库
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.paper_id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="font-medium text-gray-900 hover:text-indigo-600 cursor-pointer line-clamp-1"
                      onClick={() => handleOpenReview(review.paper_id)}
                    >
                      {review.paper_title || '未知论文'}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {getRecommendationBadge(review.recommendation)}
                      {getScoreStars(review.total_score)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      {review.generated_at && (
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>生成于 {new Date(review.generated_at).toLocaleDateString()}</span>
                        </div>
                      )}
                      {review.submitted_at && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>提交于 {new Date(review.submitted_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleOpenReview(review.paper_id)}
                    >
                      <ChevronRight className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 统计信息 */}
        {reviews.length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-semibold text-gray-900">{reviews.length}</div>
              <div className="text-sm text-gray-500">审稿总数</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-semibold text-green-600">
                {reviews.filter(r => r.recommendation === 'accept' || r.recommendation === 'weak_accept').length}
              </div>
              <div className="text-sm text-gray-500">Accept</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-semibold text-amber-600">
                {reviews.filter(r => r.recommendation === 'weak_reject').length}
              </div>
              <div className="text-sm text-gray-500">Weak Reject</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-semibold text-red-600">
                {reviews.filter(r => r.recommendation === 'reject').length}
              </div>
              <div className="text-sm text-gray-500">Reject</div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

