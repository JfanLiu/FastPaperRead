'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Anchor, MethodFlowResult, ExperimentSetupResult } from '@/types';
import { enhanceApi } from '@/lib/api';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Image,
  Calculator,
  Table,
  ArrowRight,
  Sparkles,
  ListChecks,
  Loader2,
  X,
  GitBranch,
  FlaskConical,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { Button, Badge } from '@/components/common';

interface StructuredViewProps {
  anchors: Anchor[];
  paperId?: string;
  currentRoute?: string[];
  completedSections?: Set<string>;
  onSectionClick?: (anchor: Anchor) => void;
  onMarkComplete?: (sectionId: string) => void;
  onExtractToChecklist?: (anchor: Anchor) => void;
  onAddToChecklist?: (items: { group: string; text: string }[]) => void;
  className?: string;
  // 双向同步
  currentPage?: number;  // 当前 PDF 页码
  highlightedSectionId?: string;  // 高亮的章节 ID
}

interface SectionNode {
  anchor: Anchor;
  children: SectionNode[];
  isCompleted: boolean;
  isInRoute: boolean;
}

export function StructuredView({
  anchors,
  paperId,
  currentRoute = [],
  completedSections = new Set(),
  onSectionClick,
  onMarkComplete,
  currentPage,
  highlightedSectionId,
  onExtractToChecklist,
  onAddToChecklist,
  className,
}: StructuredViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['root']));
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  
  // 快速提取状态
  const [methodFlowLoading, setMethodFlowLoading] = useState(false);
  const [experimentSetupLoading, setExperimentSetupLoading] = useState(false);
  const [methodFlowResult, setMethodFlowResult] = useState<MethodFlowResult | null>(null);
  const [experimentSetupResult, setExperimentSetupResult] = useState<ExperimentSetupResult | null>(null);
  const [methodFlowExpanded, setMethodFlowExpanded] = useState(false);
  const [experimentSetupExpanded, setExperimentSetupExpanded] = useState(false);
  
  // 提取方法流程
  const handleExtractMethodFlow = async () => {
    if (!paperId) return;
    
    if (methodFlowResult) {
      // 如果已有结果，切换展开状态
      setMethodFlowExpanded(!methodFlowExpanded);
      return;
    }
    
    setMethodFlowLoading(true);
    try {
      const response = await enhanceApi.extractMethodFlow(paperId);
      setMethodFlowResult(response.method_flow);
      setMethodFlowExpanded(true);
    } catch (error) {
      console.error('提取方法流程失败:', error);
    } finally {
      setMethodFlowLoading(false);
    }
  };
  
  // 提取实验设置
  const handleExtractExperimentSetup = async () => {
    if (!paperId) return;
    
    if (experimentSetupResult) {
      // 如果已有结果，切换展开状态
      setExperimentSetupExpanded(!experimentSetupExpanded);
      return;
    }
    
    setExperimentSetupLoading(true);
    try {
      const response = await enhanceApi.extractExperimentSetup(paperId);
      setExperimentSetupResult(response.experiment_setup);
      setExperimentSetupExpanded(true);
    } catch (error) {
      console.error('提取实验设置失败:', error);
    } finally {
      setExperimentSetupLoading(false);
    }
  };

  // 提取到清单
  const handleExtractMethodToChecklist = () => {
    if (!methodFlowResult || !onAddToChecklist) return;
    
    const items: { group: string; text: string }[] = [];
    
    // 方法步骤
    methodFlowResult.steps?.forEach((step) => {
      items.push({
        group: 'model',
        text: `步骤 ${step.step}: ${step.name} - ${step.description}`
      });
    });
    
    // 依赖项
    methodFlowResult.dependencies?.forEach((dep) => {
      items.push({
        group: 'code',
        text: `依赖: ${dep}`
      });
    });
    
    onAddToChecklist(items);
  };

  const handleExtractExperimentToChecklist = () => {
    if (!experimentSetupResult || !onAddToChecklist) return;
    
    const items: { group: string; text: string }[] = [];
    
    // 数据集
    experimentSetupResult.datasets?.forEach((ds) => {
      items.push({
        group: 'data',
        text: `数据集: ${ds.name} - ${ds.description}`
      });
    });
    
    // 超参数
    experimentSetupResult.hyperparameters?.forEach((hp) => {
      items.push({
        group: 'training',
        text: `${hp.name}: ${hp.value}`
      });
    });
    
    // 训练细节
    if (experimentSetupResult.training_details) {
      const td = experimentSetupResult.training_details;
      if (td.optimizer) items.push({ group: 'training', text: `优化器: ${td.optimizer}` });
      if (td.learning_rate) items.push({ group: 'training', text: `学习率: ${td.learning_rate}` });
      if (td.batch_size) items.push({ group: 'training', text: `批次大小: ${td.batch_size}` });
      if (td.epochs) items.push({ group: 'training', text: `训练轮数: ${td.epochs}` });
      if (td.hardware) items.push({ group: 'code', text: `硬件: ${td.hardware}` });
    }
    
    onAddToChecklist(items);
  };

  // 构建章节树
  const sectionAnchors = anchors.filter(a => a.type === 'section');
  const contentAnchors = anchors.filter(a => a.type !== 'section');

  // 简化：按章节分组内容
  const sectionContents = contentAnchors.reduce((acc, anchor) => {
    const section = anchor.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(anchor);
    return acc;
  }, {} as Record<string, Anchor[]>);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getAnchorIcon = (type: string) => {
    switch (type) {
      case 'figure':
        return <Image className="w-4 h-4 text-emerald-500" />;
      case 'equation':
        return <Calculator className="w-4 h-4 text-purple-500" />;
      case 'table':
        return <Table className="w-4 h-4 text-amber-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const routeSet = new Set(currentRoute.map(s => s.toLowerCase()));

  return (
    <div className={cn('flex flex-col h-full bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-gray-900">结构化视图</span>
        </div>
        <div className="text-xs text-gray-500">
          {completedSections.size} / {sectionAnchors.length} 已完成
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{
              width: `${sectionAnchors.length > 0 
                ? (completedSections.size / sectionAnchors.length) * 100 
                : 0}%`
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {sectionAnchors.length > 0 ? (
          <div className="space-y-1">
            {sectionAnchors.map((section) => {
              const sectionName = section.text || section.section || '';
              const isExpanded = expandedSections.has(section.id);
              const isCompleted = completedSections.has(section.id);
              const isInRoute = routeSet.has(sectionName.toLowerCase());
              const contents = sectionContents[sectionName] || [];

              return (
                <div key={section.id}>
                  {/* Section header */}
                  <div
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                      isInRoute && 'bg-indigo-50',
                      highlightedSectionId === section.id && 'bg-amber-50 ring-1 ring-amber-200',
                      hoveredSection === section.id && 'bg-gray-50',
                      isCompleted && 'opacity-60'
                    )}
                    onMouseEnter={() => setHoveredSection(section.id)}
                    onMouseLeave={() => setHoveredSection(null)}
                    onClick={() => toggleSection(section.id)}
                  >
                    {/* Expand/collapse icon */}
                    {contents.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}

                    {/* Completion status */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkComplete?.(section.id);
                      }}
                      className="shrink-0"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </button>

                    {/* Section name */}
                    <span
                      className={cn(
                        'flex-1 text-sm font-medium truncate',
                        isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSectionClick?.(section);
                      }}
                    >
                      {sectionName}
                    </span>

                    {/* Route indicator */}
                    {isInRoute && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                        必读
                      </span>
                    )}

                    {/* Page number */}
                    {section.page && (
                      <span className="text-xs text-gray-400">
                        p.{section.page}
                      </span>
                    )}
                  </div>

                  {/* Section contents */}
                  {isExpanded && contents.length > 0 && (
                    <div className="ml-9 mt-1 mb-2 pl-3 border-l-2 border-gray-100 space-y-1">
                      {contents.map((content) => (
                        <div
                          key={content.id}
                          className="group flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => onSectionClick?.(content)}
                        >
                          {getAnchorIcon(content.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-600 truncate">
                              {content.caption || content.text?.slice(0, 60) || `${content.type}`}
                            </p>
                          </div>
                          
                          {/* Quick actions on hover */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExtractToChecklist?.(content);
                              }}
                              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                              title="加入复现清单"
                            >
                              <ListChecks className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                              title="AI解释"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">暂无结构化内容</p>
            <p className="text-xs mt-1">解析完成后将显示章节结构</p>
          </div>
        )}
      </div>

      {/* Method/Experiment blocks */}
      <div className="border-t border-gray-200 p-3 space-y-2">
        <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">快速提取</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExtractMethodFlow}
              disabled={methodFlowLoading || !paperId}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                methodFlowResult
                  ? "text-white bg-indigo-600 hover:bg-indigo-700"
                  : "text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
              )}
            >
              {methodFlowLoading ? (
                <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />
              ) : (
                <GitBranch className="w-3.5 h-3.5 inline mr-1" />
              )}
              方法流程
              {methodFlowResult && (
                methodFlowExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
                )
              )}
            </button>
            <button 
              onClick={handleExtractExperimentSetup}
              disabled={experimentSetupLoading || !paperId}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                experimentSetupResult
                  ? "text-white bg-emerald-600 hover:bg-emerald-700"
                  : "text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50"
              )}
            >
              {experimentSetupLoading ? (
                <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5 inline mr-1" />
              )}
              实验设置
              {experimentSetupResult && (
                experimentSetupExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 inline ml-1" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
                )
              )}
            </button>
          </div>
        </div>
        
        {/* 内嵌方法流程块 */}
        {methodFlowExpanded && methodFlowResult && (
          <MethodFlowBlock 
            result={methodFlowResult} 
            onExtractToChecklist={handleExtractMethodToChecklist}
            onClose={() => setMethodFlowExpanded(false)}
          />
        )}
        
        {/* 内嵌实验设置块 */}
        {experimentSetupExpanded && experimentSetupResult && (
          <ExperimentSetupBlock 
            result={experimentSetupResult}
            onExtractToChecklist={handleExtractExperimentToChecklist}
            onClose={() => setExperimentSetupExpanded(false)}
          />
        )}
      </div>
    </div>
  );
}

// 方法流程内嵌块组件
interface MethodFlowBlockProps {
  result: MethodFlowResult;
  onExtractToChecklist?: () => void;
  onClose: () => void;
}

function MethodFlowBlock({ result, onExtractToChecklist, onClose }: MethodFlowBlockProps) {
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    const text = `方法: ${result.method_name}\n${result.overview}\n\n步骤:\n${
      result.steps?.map(s => `${s.step}. ${s.name}: ${s.description}`).join('\n') || ''
    }`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-indigo-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-900">{result.method_name || '方法流程'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded"
            title="复制"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
        {/* Overview */}
        {result.overview && (
          <p className="text-xs text-gray-600 leading-relaxed">{result.overview}</p>
        )}
        
        {/* Steps */}
        {result.steps && result.steps.length > 0 && (
          <div>
            <button
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-indigo-600"
            >
              {stepsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              方法步骤 ({result.steps.length})
            </button>
            {stepsExpanded && (
              <div className="mt-2 space-y-2">
                {result.steps.map((step, index) => (
                  <div key={index} className="flex gap-2 p-2 bg-gray-50 rounded text-xs">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                      {step.step}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800">{step.name}</div>
                      <div className="text-gray-500 mt-0.5">{step.description}</div>
                      {step.inputs && step.inputs.length > 0 && (
                        <div className="text-gray-400 mt-1">
                          <span className="font-medium">输入:</span> {step.inputs.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Innovations */}
        {result.key_innovations && result.key_innovations.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">关键创新</div>
            <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
              {result.key_innovations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Dependencies */}
        {result.dependencies && result.dependencies.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">依赖项</div>
            <div className="flex flex-wrap gap-1">
              {result.dependencies.map((dep, index) => (
                <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0">
                  {dep}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Extract to checklist button */}
        {onExtractToChecklist && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExtractToChecklist}
            className="w-full text-xs h-7"
          >
            <ListChecks className="w-3 h-3 mr-1" />
            提取到复现清单
          </Button>
        )}
      </div>
    </div>
  );
}

// 实验设置内嵌块组件
interface ExperimentSetupBlockProps {
  result: ExperimentSetupResult;
  onExtractToChecklist?: () => void;
  onClose: () => void;
}

function ExperimentSetupBlock({ result, onExtractToChecklist, onClose }: ExperimentSetupBlockProps) {
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [paramsExpanded, setParamsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    const text = `数据集: ${result.datasets?.map(d => d.name).join(', ') || ''}\n` +
      `对比方法: ${result.baselines?.join(', ') || ''}\n` +
      `评估指标: ${result.metrics?.map(m => m.name).join(', ') || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-emerald-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-900">实验设置</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded"
            title="复制"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
        {/* Datasets */}
        {result.datasets && result.datasets.length > 0 && (
          <div>
            <button
              onClick={() => setDatasetsExpanded(!datasetsExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-emerald-600"
            >
              {datasetsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              数据集 ({result.datasets.length})
            </button>
            {datasetsExpanded && (
              <div className="mt-2 space-y-2">
                {result.datasets.map((ds, index) => (
                  <div key={index} className="p-2 bg-emerald-50 rounded text-xs">
                    <div className="font-medium text-emerald-800">{ds.name}</div>
                    <div className="text-gray-600 mt-0.5">{ds.description}</div>
                    <div className="flex gap-3 mt-1 text-gray-500">
                      {ds.size && <span>规模: {ds.size}</span>}
                      {ds.split && <span>划分: {ds.split}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Baselines */}
        {result.baselines && result.baselines.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">对比方法</div>
            <div className="flex flex-wrap gap-1">
              {result.baselines.map((baseline, index) => (
                <Badge key={index} className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 hover:bg-amber-200">
                  {baseline}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Metrics */}
        {result.metrics && result.metrics.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">评估指标</div>
            <div className="flex flex-wrap gap-1">
              {result.metrics.map((metric, index) => (
                <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0 border-purple-200 text-purple-700">
                  {metric.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Hyperparameters */}
        {result.hyperparameters && result.hyperparameters.length > 0 && (
          <div>
            <button
              onClick={() => setParamsExpanded(!paramsExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-emerald-600"
            >
              {paramsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              超参数 ({result.hyperparameters.length})
            </button>
            {paramsExpanded && (
              <div className="mt-2">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {result.hyperparameters.map((param, index) => (
                    <div key={index} className="flex justify-between p-1.5 bg-gray-50 rounded">
                      <span className="font-mono text-gray-600">{param.name}</span>
                      <span className="font-mono text-indigo-600">{param.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Training Details */}
        {result.training_details && (
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">训练细节</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {result.training_details.optimizer && (
                <div className="p-1.5 bg-gray-50 rounded">
                  <span className="text-gray-500">优化器:</span>{' '}
                  <span className="font-medium">{result.training_details.optimizer}</span>
                </div>
              )}
              {result.training_details.learning_rate && (
                <div className="p-1.5 bg-gray-50 rounded">
                  <span className="text-gray-500">学习率:</span>{' '}
                  <span className="font-medium">{result.training_details.learning_rate}</span>
                </div>
              )}
              {result.training_details.batch_size && (
                <div className="p-1.5 bg-gray-50 rounded">
                  <span className="text-gray-500">批次:</span>{' '}
                  <span className="font-medium">{result.training_details.batch_size}</span>
                </div>
              )}
              {result.training_details.epochs && (
                <div className="p-1.5 bg-gray-50 rounded">
                  <span className="text-gray-500">轮数:</span>{' '}
                  <span className="font-medium">{result.training_details.epochs}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Extract to checklist button */}
        {onExtractToChecklist && (
          <Button
            size="sm"
            variant="outline"
            onClick={onExtractToChecklist}
            className="w-full text-xs h-7"
          >
            <ListChecks className="w-3 h-3 mr-1" />
            提取到复现清单
          </Button>
        )}
      </div>
    </div>
  );
}
