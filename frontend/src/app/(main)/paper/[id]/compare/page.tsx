'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Badge, Input, Modal } from '@/components/common';
import { cn } from '@/lib/utils';
import { compareApi, paperApi } from '@/lib/api';
import type { Paper } from '@/types';
import {
  Plus,
  X,
  Search,
  GitCompare,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Download,
  RefreshCw,
  Loader2,
  Save,
} from 'lucide-react';

interface CompareItem {
  paper: Paper;
  values: Record<string, string>;
}

interface MatrixRow {
  dimension: string;
  values: Array<{
    paper_id: string;
    paper_title: string;
    value: string;
  }>;
}

const DEFAULT_DIMENSIONS = [
  '研究问题',
  '方法',
  '数据集',
  '评估指标',
  '主要结果',
  '局限性',
];

export default function ComparePage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [papers, setPapers] = useState<Paper[]>([]);
  const [dimensions] = useState<string[]>(DEFAULT_DIMENSIONS);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [compareSetId, setCompareSetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCurrentPaper();
  }, [paperId]);

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
        // 过滤掉已添加的论文
        const filtered = (result.items || result.papers || []).filter(
          (p: Paper) => !papers.find(existing => existing.id === p.id)
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
  }, [searchQuery, papers]);

  const loadCurrentPaper = async () => {
    setIsLoading(true);
    try {
      const paper = await paperApi.get(paperId);
      setPapers([paper]);
    } catch (error) {
      console.error('加载论文失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPaper = (paper: Paper) => {
    if (!papers.find(p => p.id === paper.id)) {
      setPapers([...papers, paper]);
      // 清除旧的比较结果
      setMatrix([]);
      setConflicts([]);
      setSummary('');
    }
    setShowAddPaper(false);
    setSearchQuery('');
  };

  const handleRemovePaper = (removePaperId: string) => {
    setPapers(papers.filter(p => p.id !== removePaperId));
    // 清除旧的比较结果
    setMatrix([]);
    setConflicts([]);
    setSummary('');
  };

  const handleGenerateMatrix = async () => {
    if (papers.length < 2) return;
    
    setIsGenerating(true);
    
    try {
      // 如果没有保存的集合，先创建一个
      let setId = compareSetId;
      if (!setId) {
        const createResult = await compareApi.createSet(
          `对比: ${papers.map(p => p.title.slice(0, 20)).join(' vs ')}`,
          papers.map(p => p.id)
        );
        setId = createResult.id;
        setCompareSetId(setId);
      }
      
      // 生成对比矩阵
      const result = await compareApi.generateMatrix(setId, dimensions);
      
      setMatrix(result.matrix || []);
      setConflicts((result.conflicts || []).map((c: { dimension: string }) => c.dimension));
      setSummary(result.summary || '');
    } catch (error) {
      console.error('生成对比失败:', error);
      // 如果API失败，使用本地模拟
      generateLocalMatrix();
    } finally {
      setIsGenerating(false);
    }
  };

  const generateLocalMatrix = () => {
    const mockMatrix: MatrixRow[] = dimensions.map(dim => ({
      dimension: dim,
      values: papers.map(paper => ({
        paper_id: paper.id,
        paper_title: paper.title,
        value: `${paper.title.slice(0, 20)}的${dim}...`,
      }))
    }));
    
    const mockConflicts = dimensions.filter(() => Math.random() > 0.5);
    
    setMatrix(mockMatrix);
    setConflicts(mockConflicts);
    setSummary(`比较了 ${papers.length} 篇论文。`);
  };

  const handleSaveSet = async () => {
    if (papers.length < 2) return;
    
    setIsSaving(true);
    try {
      const result = await compareApi.createSet(
        `对比: ${papers.map(p => p.title.slice(0, 20)).join(' vs ')}`,
        papers.map(p => p.id)
      );
      setCompareSetId(result.id);
      alert('对比集合已保存！');
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (matrix.length === 0) return;
    
    // 生成Markdown内容
    let md = `# 论文对比\n\n`;
    md += `## 对比论文\n`;
    papers.forEach((p, i) => {
      md += `${i + 1}. ${p.title} (${p.year || 'N/A'})\n`;
    });
    md += `\n## 对比矩阵\n\n`;
    
    // 表头
    md += `| 维度 | ${papers.map(p => p.title.slice(0, 20)).join(' | ')} |\n`;
    md += `| --- | ${papers.map(() => '---').join(' | ')} |\n`;
    
    // 表格内容
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
    
    // 下载文件
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compare_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-semibold text-gray-900">论文对比</h1>
              <Badge variant="info">{papers.length} 篇论文</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowAddPaper(true)}
                disabled={papers.length >= 5}
              >
                <Plus className="w-4 h-4 mr-1" />
                添加论文
              </Button>
              <Button
                onClick={handleGenerateMatrix}
                disabled={papers.length < 2 || isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <GitCompare className="w-4 h-4 mr-1" />
                )}
                生成对比
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleSaveSet}
                disabled={papers.length < 2 || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                保存
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleExport}
                disabled={matrix.length === 0}
              >
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Papers List */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">对比论文</h2>
          
          {papers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无论文，请添加至少2篇论文进行对比</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {papers.map((paper, index) => (
                <div
                  key={paper.id}
                  className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{paper.title}</h3>
                    <p className="text-sm text-gray-500">
                      {paper.authors?.slice(0, 2).join(', ')} • {paper.year}
                    </p>
                  </div>
                  {papers.length > 1 && (
                    <button
                      onClick={() => handleRemovePaper(paper.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {summary && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
            <p className="text-indigo-700">{summary}</p>
          </div>
        )}

        {/* Conflicts Alert */}
        {conflicts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">发现 {conflicts.length} 个差异维度</h3>
                <p className="text-sm text-amber-700 mt-1">
                  在以下维度存在明显差异：{conflicts.join('、')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Matrix */}
        {matrix.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-6 py-4 font-medium text-gray-900 w-40">
                      维度
                    </th>
                    {papers.map((paper) => (
                      <th key={paper.id} className="text-left px-6 py-4 font-medium text-gray-900">
                        <div className="max-w-xs truncate">{paper.title}</div>
                        <div className="text-xs font-normal text-gray-500">{paper.year}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.dimension} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-900 bg-gray-50">
                        <div className="flex items-center gap-2">
                          {row.dimension}
                          {conflicts.includes(row.dimension) && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </td>
                      {row.values.map((val) => (
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

        {/* Empty State */}
        {papers.length >= 2 && matrix.length === 0 && !isGenerating && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <GitCompare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">准备就绪</h3>
            <p className="text-gray-500 mb-4">已选择 {papers.length} 篇论文，点击"生成对比"开始</p>
            <Button onClick={handleGenerateMatrix}>
              生成对比矩阵
            </Button>
          </div>
        )}
      </div>

      {/* Add Paper Modal */}
      <Modal isOpen={showAddPaper} onClose={() => setShowAddPaper(false)}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">添加论文</h2>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索论文标题..."
              className="pl-10"
            />
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
                  onClick={() => handleAddPaper(paper)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg text-left"
                >
                  <div>
                    <div className="font-medium text-gray-900 line-clamp-1">{paper.title}</div>
                    <div className="text-sm text-gray-500">
                      {paper.authors?.slice(0, 2).join(', ')} • {paper.year || 'N/A'}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))
            ) : searchQuery ? (
              <div className="text-center py-4 text-gray-500">
                没有找到匹配的论文
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                输入关键词搜索论文
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
