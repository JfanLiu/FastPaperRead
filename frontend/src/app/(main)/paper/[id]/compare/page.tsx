'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Badge, Input, Modal } from '@/components/common';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

interface CompareItem {
  paper: Paper;
  values: Record<string, string>;
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
  const [dimensions, setDimensions] = useState<string[]>(DEFAULT_DIMENSIONS);
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>({});
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 加载当前论文
    loadCurrentPaper();
  }, [paperId]);

  const loadCurrentPaper = async () => {
    // Mock data
    const mockPaper: Paper = {
      id: paperId,
      title: 'Attention Is All You Need',
      authors: ['Vaswani et al.'],
      year: 2017,
      venue: 'NeurIPS',
      status: 'deepread',
      read_progress: 1,
      keywords: [],
      source_type: 'arxiv',
      source_value: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPapers([mockPaper]);
  };

  const handleAddPaper = (paper: Paper) => {
    if (!papers.find(p => p.id === paper.id)) {
      setPapers([...papers, paper]);
    }
    setShowAddPaper(false);
  };

  const handleRemovePaper = (paperId: string) => {
    setPapers(papers.filter(p => p.id !== paperId));
  };

  const handleGenerateMatrix = async () => {
    if (papers.length < 2) return;
    
    setIsLoading(true);
    
    // 模拟生成
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockMatrix: Record<string, Record<string, string>> = {};
    const mockConflicts: string[] = [];
    
    for (const dim of dimensions) {
      mockMatrix[dim] = {};
      const values: string[] = [];
      
      for (const paper of papers) {
        const value = `${paper.title.slice(0, 20)}的${dim}...`;
        mockMatrix[dim][paper.id] = value;
        values.push(value);
      }
      
      // 检测冲突
      if (new Set(values).size > 1 && Math.random() > 0.5) {
        mockConflicts.push(dim);
      }
    }
    
    setMatrix(mockMatrix);
    setConflicts(mockConflicts);
    setIsLoading(false);
  };

  const handleExport = () => {
    // TODO: 导出比较结果
    console.log('Export comparison');
  };

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
                disabled={papers.length < 2 || isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <GitCompare className="w-4 h-4 mr-1" />
                )}
                生成对比
              </Button>
              <Button variant="secondary" onClick={handleExport}>
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
        {Object.keys(matrix).length > 0 && (
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
                  {dimensions.map((dim) => (
                    <tr key={dim} className="border-b border-gray-100 last:border-0">
                      <td className="px-6 py-4 font-medium text-gray-900 bg-gray-50">
                        <div className="flex items-center gap-2">
                          {dim}
                          {conflicts.includes(dim) && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </td>
                      {papers.map((paper) => (
                        <td key={paper.id} className="px-6 py-4 text-gray-700">
                          {matrix[dim]?.[paper.id] || '-'}
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
        {papers.length >= 2 && Object.keys(matrix).length === 0 && !isLoading && (
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
            {/* Mock search results */}
            {[
              { id: 'p2', title: 'BERT: Pre-training of Deep Bidirectional Transformers', year: 2019 },
              { id: 'p3', title: 'GPT-3: Language Models are Few-Shot Learners', year: 2020 },
              { id: 'p4', title: 'Vision Transformer', year: 2021 },
            ].map((paper) => (
              <button
                key={paper.id}
                onClick={() => handleAddPaper(paper as Paper)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg text-left"
              >
                <div>
                  <div className="font-medium text-gray-900">{paper.title}</div>
                  <div className="text-sm text-gray-500">{paper.year}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}


