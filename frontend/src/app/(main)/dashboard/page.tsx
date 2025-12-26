'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { Button, Badge, EmptyState } from '@/components/common';
import { cn, formatRelativeTime, getStatusColor, getStatusText } from '@/lib/utils';
import { paperApi, cardApi, skimApi } from '@/lib/api';
import type { Paper } from '@/types';
import {
  Library,
  Upload,
  BookOpen,
  StickyNote,
  GitCompare,
  ClipboardCheck,
  FileText,
  Clock,
  TrendingUp,
  Star,
  Loader2,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Eye,
} from 'lucide-react';

interface DashboardStats {
  totalPapers: number;
  unreadPapers: number;
  skimmedPapers: number;
  deepreadPapers: number;
  totalCards: number;
  queuedPapers: number;
}

interface RecentPaper extends Paper {
  isRecent?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalPapers: 0,
    unreadPapers: 0,
    skimmedPapers: 0,
    deepreadPapers: 0,
    totalCards: 0,
    queuedPapers: 0,
  });
  const [recentPapers, setRecentPapers] = useState<RecentPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // 加载论文列表
      const papersResult = await paperApi.list({ limit: 100 });
      const papers = papersResult.items || [];
      
      // 计算统计数据
      const unread = papers.filter((p: Paper) => p.status === 'unread').length;
      const skimmed = papers.filter((p: Paper) => p.status === 'skimmed').length;
      const deepread = papers.filter((p: Paper) => p.status === 'deepread').length;
      
      // 加载卡片数量
      let totalCards = 0;
      try {
        const cardsResult = await cardApi.search({ query: '', limit: 1 });
        totalCards = cardsResult.total || 0;
      } catch {
        // 忽略错误
      }

      // 加载待读队列
      let queuedPapers = 0;
      try {
        const queueResult = await skimApi.getQueue();
        queuedPapers = (queueResult.items || []).length;
      } catch {
        // 忽略错误
      }
      
      setStats({
        totalPapers: papers.length,
        unreadPapers: unread,
        skimmedPapers: skimmed,
        deepreadPapers: deepread,
        totalCards,
        queuedPapers,
      });
      
      // 最近5篇论文
      const sorted = [...papers].sort((a, b) => 
        new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      );
      setRecentPapers(sorted.slice(0, 5));
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { 
      name: '导入论文', 
      href: '/import', 
      icon: Upload, 
      color: 'bg-indigo-500', 
      description: '上传PDF或输入链接' 
    },
    { 
      name: '文献库', 
      href: '/library', 
      icon: Library, 
      color: 'bg-purple-500', 
      description: '浏览所有论文' 
    },
    { 
      name: '待读队列', 
      href: '/queue', 
      icon: BookOpen, 
      color: 'bg-amber-500', 
      description: `${stats.queuedPapers} 篇待读` 
    },
    { 
      name: '笔记库', 
      href: '/notes', 
      icon: StickyNote, 
      color: 'bg-emerald-500', 
      description: `${stats.totalCards} 张卡片` 
    },
  ];

  const statCards = [
    { label: '论文总数', value: stats.totalPapers, icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
    { label: '未读', value: stats.unreadPapers, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: '已粗读', value: stats.skimmedPapers, icon: Eye, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: '已精读', value: stats.deepreadPapers, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ];

  if (isLoading) {
    return (
      <MainLayout title="仪表盘" showSearch={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-gray-500">加载中...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="仪表盘" showSearch={false}>
      <div className="p-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl mb-6">
          <div className="px-6 py-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">欢迎使用 FastPaperRead</h1>
                <p className="text-indigo-200">AI驱动的高效论文阅读平台</p>
              </div>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              {statCards.map((stat) => (
                <div key={stat.label} className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                      <stat.icon className={cn('w-5 h-5', stat.color)} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-indigo-200">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">快捷操作</h2>
          <div className="grid grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all group"
              >
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white', action.color)}>
                  <action.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {action.name}
                  </div>
                  <div className="text-sm text-gray-500">{action.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Recent Papers */}
          <div className="col-span-2">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">最近论文</h2>
                <Link 
                  href="/library" 
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  查看全部 <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              
              {recentPapers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>暂无论文，开始导入你的第一篇论文吧</p>
                  <Link href="/import">
                    <Button className="mt-4">
                      <Upload className="w-4 h-4 mr-1" />
                      导入论文
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentPapers.map((paper) => (
                    <Link
                      key={paper.id}
                      href={`/paper/${paper.id}/overview`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 line-clamp-1 hover:text-indigo-600">
                          {paper.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <span className="line-clamp-1">
                            {paper.authors?.slice(0, 2).join(', ')}
                            {paper.authors && paper.authors.length > 2 ? ' et al.' : ''}
                          </span>
                          {paper.year && <span>· {paper.year}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge className={getStatusColor(paper.status)}>
                          {getStatusText(paper.status)}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {formatRelativeTime(paper.updated_at || paper.created_at)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* More Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">更多功能</h3>
              <div className="space-y-3">
                <Link
                  href="/compare"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <GitCompare className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="font-medium text-gray-900">论文对比</div>
                    <div className="text-xs text-gray-500">多篇论文对比分析</div>
                  </div>
                </Link>
                <Link
                  href="/review"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ClipboardCheck className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-medium text-gray-900">审稿模式</div>
                    <div className="text-xs text-gray-500">生成结构化审稿意见</div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-indigo-900">使用提示</h3>
              </div>
              <ul className="space-y-2 text-sm text-indigo-800">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>导入论文后，先生成 SkimCard 快速了解核心内容</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>精读时可使用"材料"视图一键生成精读包</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>选中文本可快速创建卡片或添加到复现清单</span>
                </li>
              </ul>
            </div>

            {/* Reading Progress */}
            {stats.totalPapers > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">阅读进度</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">精读完成率</span>
                      <span className="font-medium text-gray-900">
                        {Math.round((stats.deepreadPapers / stats.totalPapers) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${(stats.deepreadPapers / stats.totalPapers) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">粗读完成率</span>
                      <span className="font-medium text-gray-900">
                        {Math.round(((stats.skimmedPapers + stats.deepreadPapers) / stats.totalPapers) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                        style={{ width: `${((stats.skimmedPapers + stats.deepreadPapers) / stats.totalPapers) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

