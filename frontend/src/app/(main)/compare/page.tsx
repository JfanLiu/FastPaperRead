'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { Button, Badge, EmptyState, Input, Modal } from '@/components/common';
import { paperApi, compareApi } from '@/lib/api';
import type { Paper } from '@/types';
import { GitCompare, Plus, Search, Loader2, AlertTriangle, Download } from 'lucide-react';

type MatrixRow = {
  dimension: string;
  values: Array<{
    paper_id: string;
    paper_title: string;
    value: string;
  }>;
};

const DEFAULT_DIMENSIONS = ['研究问题', '方法', '数据集', '评估指标', '主要结果', '局限性'];

export default function ComparePage() {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<Paper[]>([]);

  const [isComparing, setIsComparing] = useState(false);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const result = await paperApi.list({ search: searchQuery, limit: 10 });
        const items = result.items || [];
        const filtered = items.filter((p: Paper) => !selectedPapers.some(sp => sp.id === p.id));
        setSearchResults(filtered);
      } catch (e) {
        console.error('搜索论文失败:', e);
      } finally {
        setIsSearching(false);
      }
    };

    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [searchQuery, selectedPapers]);

  const startCompare = async () => {
    if (selectedPapers.length < 2) return;
    setIsComparing(true);
    setErrorMessage(null);
    try {
      const res = await compareApi.quickMatrix(selectedPapers.map(p => p.id), DEFAULT_DIMENSIONS, { use_llm: true, persist: true });
      setMatrix(res.matrix || []);
      setConflicts((res.conflicts || []).map((c: { dimension: string }) => c.dimension));
      setSummary(res.summary || '');
      setShowModal(false);
    } catch (e) {
      console.error('对比失败:', e);
      setErrorMessage('对比失败，请稍后重试');
    } finally {
      setIsComparing(false);
    }
  };

  const exportMarkdown = () => {
    if (matrix.length === 0) return;
    let md = `# 论文对比\n\n`;
    md += `## 对比论文\n`;
    selectedPapers.forEach((p, i) => {
      md += `${i + 1}. ${p.title} (${p.year || 'N/A'})\n`;
    });
    md += `\n## 对比矩阵\n\n`;
    md += `| 维度 | ${selectedPapers.map(p => p.title.slice(0, 20)).join(' | ')} |\n`;
    md += `| --- | ${selectedPapers.map(() => '---').join(' | ')} |\n`;
    matrix.forEach(row => {
      md += `| ${row.dimension} | ${row.values.map(v => v.value || '-').join(' | ')} |\n`;
    });
    if (conflicts.length > 0) {
      md += `\n## 差异维度\n`;
      conflicts.forEach(c => {
        md += `- ${c}\n`;
      });
    }
    if (summary) {
      md += `\n## 总结\n${summary}\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compare_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={() => setShowModal(true)}>
        <Plus className="w-4 h-4 mr-1" />
        选择论文
      </Button>
      <Button variant="secondary" onClick={exportMarkdown} disabled={matrix.length === 0}>
        <Download className="w-4 h-4 mr-1" />
        导出
      </Button>
    </div>
  );

  return (
    <MainLayout title="论文对比" showSearch={false} headerActions={headerActions}>
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <EmptyState
          icon={<GitCompare className="w-8 h-8 text-gray-400" />}
          title="快速对比"
          description="直接选择多篇论文生成对比矩阵（当前不使用集合）"
          action={
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              开始
            </Button>
          }
        />

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{errorMessage}</div>
        )}
        {summary && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">{summary}</div>
        )}
        {matrix.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 font-medium text-gray-900 w-40">维度</th>
                    {selectedPapers.map(p => (
                      <th key={p.id} className="text-left px-6 py-4 font-medium text-gray-900">
                        <div className="max-w-xs truncate">{p.title}</div>
                        <div className="text-xs font-normal text-gray-500">{p.year}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(row => (
                    <tr key={row.dimension} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-900 bg-gray-50">
                        <div className="flex items-center gap-2">
                          {row.dimension}
                          {conflicts.includes(row.dimension) && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        </div>
                      </td>
                      {row.values.map(val => (
                        <td key={val.paper_id} className="px-6 py-4 text-gray-700">
                          {val.value || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">选择论文并对比</h2>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索论文标题..." className="pl-10" />
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((paper) => (
                <button
                  key={paper.id}
                  onClick={() => {
                    setSelectedPapers(prev => [...prev, paper]);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg text-left"
                >
                  <div>
                    <div className="font-medium text-gray-900 line-clamp-1">{paper.title}</div>
                    <div className="text-sm text-gray-500">{paper.authors?.slice(0, 2).join(', ')} • {paper.year || 'N/A'}</div>
                  </div>
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              ))
            ) : searchQuery ? (
              <div className="text-center py-4 text-gray-500">没有找到匹配的论文</div>
            ) : (
              <div className="text-center py-4 text-gray-500">输入关键词搜索论文</div>
            )}
          </div>

          {selectedPapers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPapers.map(p => (
                <Badge key={p.id} variant="default" className="flex items-center gap-1">
                  {p.title.slice(0, 20)}
                  <button
                    onClick={() => setSelectedPapers(prev => prev.filter(x => x.id !== p.id))}
                    className="ml-1 hover:text-red-500"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="pt-4 mt-4 border-t border-gray-200 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>取消</Button>
            <Button onClick={startCompare} disabled={selectedPapers.length < 2 || isComparing}>
              {isComparing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitCompare className="w-4 h-4 mr-2" />}
              开始对比
            </Button>
          </div>
        </div>
      </Modal>
    </MainLayout>
  );
}
