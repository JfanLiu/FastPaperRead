'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { MainLayout } from '@/components/layout';
import { Button, Input, Progress } from '@/components/common';
import { useUIStore } from '@/stores/uiStore';
import { paperApi } from '@/lib/api';
import {
  Upload,
  FileText,
  Link as LinkIcon,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

type ImportMethod = 'file' | 'url';

export default function ImportPage() {
  const router = useRouter();
  const [method, setMethod] = useState<ImportMethod>('file');
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    jobId: string;
    progress: number;
    status: string;
    currentStep: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    await handleImport('file', file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isImporting,
  });

  const handleImport = async (type: 'file' | 'url', data: File | string) => {
    setIsImporting(true);
    setError(null);

    try {
      let response;
      if (type === 'file') {
        response = await paperApi.upload(data as File);
      } else {
        response = await paperApi.import({ pdf_url: data as string });
      }

      const paperId = response.paper_id;

      setImportStatus({
        jobId: response.job_id,
        progress: 0,
        status: 'running',
        currentStep: '初始化...',
      });

      // 轮询检查进度 (使用 paper_id)
      pollImportStatus(paperId);
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail 
        || (err as Error).message 
        || '导入失败';
      setError(errorMsg);
      setIsImporting(false);
    }
  };

  const pollImportStatus = async (paperId: string) => {
    const maxAttempts = 120; // 最多轮询120次（2分钟）
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await paperApi.getImportStatus(paperId);
        
        // 后端返回0-1，前端显示0-100
        const progressPercent = (status.progress || 0) * 100;
        
        setImportStatus({
          jobId: status.job_id || paperId,
          progress: progressPercent,
          status: status.status,
          currentStep: status.current_step || '处理中...',
        });

        console.log(`[IMPORT] 状态: ${status.status}, 进度: ${progressPercent}%`);

        if (status.status === 'completed') {
          // 导入完成，跳转到Overview页面
          console.log('[IMPORT] 导入完成，即将跳转...');
          setTimeout(() => {
            router.push(`/paper/${paperId}/overview`);
          }, 1500);
        } else if (status.status === 'failed') {
          setError(status.error_message || '导入失败');
          setIsImporting(false);
        } else if (status.status === 'running' && attempts < maxAttempts) {
          // 仍在处理中，继续轮询
          attempts++;
          setTimeout(poll, 1000);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        } else {
          setError('导入超时');
          setIsImporting(false);
        }
      } catch (err) {
        console.error('[IMPORT] 获取状态失败:', err);
        // 如果获取状态失败，可能还在处理中，继续轮询
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        } else {
          setError('获取进度失败');
          setIsImporting(false);
        }
      }
    };

    poll();
  };

  const handleUrlImport = () => {
    if (!url.trim()) return;
    handleImport('url', url.trim());
  };

  return (
    <MainLayout title="导入论文" showSearch={false}>
      <div className="max-w-2xl mx-auto p-6">
        {/* Method Tabs */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setMethod('file')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              method === 'file'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            上传文件
          </button>
          <button
            onClick={() => setMethod('url')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              method === 'url'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            输入链接
          </button>
        </div>

        {/* Import Form */}
        {!importStatus ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            {method === 'file' ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-indigo-600" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  {isDragActive ? '释放文件以上传' : '拖拽PDF文件到这里'}
                </p>
                <p className="text-sm text-gray-500 mb-4">或点击选择文件</p>
                <p className="text-xs text-gray-400">支持 PDF 格式，最大 50MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label="论文链接"
                  placeholder="输入 PDF URL / DOI / arXiv ID"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  icon={<LinkIcon className="w-4 h-4" />}
                />
                <div className="text-xs text-gray-500 space-y-1">
                  <p>支持以下格式：</p>
                  <ul className="list-disc list-inside pl-2">
                    <li>PDF直链: https://arxiv.org/pdf/2301.00001.pdf</li>
                    <li>DOI: 10.1234/example</li>
                    <li>arXiv ID: 2301.00001</li>
                  </ul>
                </div>
                <Button
                  onClick={handleUrlImport}
                  disabled={!url.trim()}
                  className="w-full"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  开始导入
                </Button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <XCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        ) : (
          /* Import Progress */
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="text-center mb-6">
              {importStatus.status === 'completed' ? (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              )}
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {importStatus.status === 'completed' ? '导入完成！' : '正在导入...'}
              </h3>
              <p className="text-sm text-gray-500">{importStatus.currentStep}</p>
            </div>

            <Progress
              value={importStatus.progress}
              size="lg"
              variant={importStatus.status === 'completed' ? 'success' : 'default'}
              showLabel
            />

            <div className="mt-6 space-y-2">
              {[
                { step: '下载PDF', key: 'download' },
                { step: '解析文档', key: 'parse_text' },
                { step: '提取章节', key: 'extract_sections' },
                { step: '提取图表', key: 'extract_figures' },
                { step: '生成锚点', key: 'generate_anchors' },
              ].map((item, index) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 text-sm"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      importStatus.progress > index * 20
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {importStatus.progress > index * 20 ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={
                      importStatus.progress > index * 20
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }
                  >
                    {item.step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

