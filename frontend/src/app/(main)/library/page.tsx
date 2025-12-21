'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { Button, Badge, EmptyState } from '@/components/common';
import { usePaperStore } from '@/stores/paperStore';
import { useUIStore } from '@/stores/uiStore';
import { paperApi } from '@/lib/api';
import { formatRelativeTime, getStatusColor, getQualityColor, getStatusText, truncate } from '@/lib/utils';
import {
  Plus,
  Filter,
  Grid3X3,
  List,
  FileText,
  MoreVertical,
  Eye,
  Trash2,
  Archive,
  Clock,
  BookOpen,
} from 'lucide-react';
import type { Paper } from '@/types';

export default function LibraryPage() {
  const { papers, totalPapers, filters, setPapers, setFilters, setLoading, isLoading } = usePaperStore();
  const { libraryViewMode, setLibraryViewMode, openImportModal } = useUIStore();
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);

  useEffect(() => {
    loadPapers();
  }, [filters]);

  const loadPapers = async () => {
    try {
      setLoading(true);
      const response = await paperApi.list({
        page: 1,
        limit: 50,
        status: filters.status === 'all' ? undefined : filters.status,
        search: filters.search || undefined,
      });
      setPapers(response.items, response.total);
    } catch (error) {
      console.error('Failed to load papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Link href="/import">
        <Button icon={<Plus className="w-4 h-4" />}>
          导入论文
        </Button>
      </Link>
    </div>
  );

  return (
    <MainLayout title="文献库" headerActions={headerActions}>
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as typeof filters.status })}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">全部状态</option>
              <option value="unread">未读</option>
              <option value="skimmed">已粗读</option>
              <option value="deepread">已精读</option>
              <option value="archived">已归档</option>
            </select>
            <Button variant="outline" size="sm" icon={<Filter className="w-4 h-4" />}>
              更多筛选
            </Button>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setLibraryViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                libraryViewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLibraryViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                libraryViewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '全部', value: totalPapers, icon: FileText, color: 'bg-gray-50' },
            { label: '未读', value: papers.filter(p => p.status === 'unread').length, icon: Clock, color: 'bg-blue-50' },
            { label: '已粗读', value: papers.filter(p => p.status === 'skimmed').length, icon: Eye, color: 'bg-yellow-50' },
            { label: '已精读', value: papers.filter(p => p.status === 'deepread').length, icon: BookOpen, color: 'bg-green-50' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <stat.icon className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Paper List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : papers.length === 0 ? (
          <EmptyState
            title="暂无论文"
            description="导入你的第一篇论文开始阅读"
            action={
              <Link href="/import">
                <Button icon={<Plus className="w-4 h-4" />}>导入论文</Button>
              </Link>
            }
          />
        ) : libraryViewMode === 'list' ? (
          <PaperListView papers={papers} />
        ) : (
          <PaperGridView papers={papers} />
        )}
      </div>
    </MainLayout>
  );
}

function PaperListView({ papers }: { papers: Paper[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              论文
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
              状态
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
              质量
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
              添加时间
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {papers.map((paper) => (
            <tr key={paper.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-4">
                <Link href={`/paper/${paper.id}/overview`} className="block">
                  <h3 className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                    {truncate(paper.title, 80)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {paper.authors.slice(0, 3).join(', ')}
                    {paper.authors.length > 3 && ' et al.'}
                    {paper.year && ` · ${paper.year}`}
                  </p>
                </Link>
              </td>
              <td className="px-4 py-4">
                <Badge className={getStatusColor(paper.status)}>
                  {getStatusText(paper.status)}
                </Badge>
              </td>
              <td className="px-4 py-4">
                {paper.quality_grade && (
                  <Badge className={getQualityColor(paper.quality_grade)}>
                    {paper.quality_grade}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-gray-500">
                {formatRelativeTime(paper.created_at)}
              </td>
              <td className="px-4 py-4 text-right">
                <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaperGridView({ papers }: { papers: Paper[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {papers.map((paper) => (
        <Link
          key={paper.id}
          href={`/paper/${paper.id}/overview`}
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all card-hover"
        >
          <div className="flex items-start justify-between mb-3">
            <Badge className={getStatusColor(paper.status)}>
              {getStatusText(paper.status)}
            </Badge>
            {paper.quality_grade && (
              <Badge className={getQualityColor(paper.quality_grade)}>
                {paper.quality_grade}
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
            {paper.title}
          </h3>
          <p className="text-sm text-gray-500 mb-3 line-clamp-1">
            {paper.authors.slice(0, 2).join(', ')}
            {paper.authors.length > 2 && ' et al.'}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{paper.year}</span>
            <span>{formatRelativeTime(paper.created_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

