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
} from 'lucide-react';

interface StructuredViewProps {
  anchors: Anchor[];
  paperId?: string;
  currentRoute?: string[];
  completedSections?: Set<string>;
  onSectionClick?: (anchor: Anchor) => void;
  onMarkComplete?: (sectionId: string) => void;
  onExtractToChecklist?: (anchor: Anchor) => void;
  className?: string;
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
  onExtractToChecklist,
  className,
}: StructuredViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['root']));
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  
  // 快速提取状态
  const [methodFlowLoading, setMethodFlowLoading] = useState(false);
  const [experimentSetupLoading, setExperimentSetupLoading] = useState(false);
  const [methodFlowResult, setMethodFlowResult] = useState<MethodFlowResult | null>(null);
  const [experimentSetupResult, setExperimentSetupResult] = useState<ExperimentSetupResult | null>(null);
  const [showMethodFlowModal, setShowMethodFlowModal] = useState(false);
  const [showExperimentSetupModal, setShowExperimentSetupModal] = useState(false);
  
  // 提取方法流程
  const handleExtractMethodFlow = async () => {
    if (!paperId) return;
    setMethodFlowLoading(true);
    try {
      const response = await enhanceApi.extractMethodFlow(paperId);
      setMethodFlowResult(response.method_flow);
      setShowMethodFlowModal(true);
    } catch (error) {
      console.error('提取方法流程失败:', error);
    } finally {
      setMethodFlowLoading(false);
    }
  };
  
  // 提取实验设置
  const handleExtractExperimentSetup = async () => {
    if (!paperId) return;
    setExperimentSetupLoading(true);
    try {
      const response = await enhanceApi.extractExperimentSetup(paperId);
      setExperimentSetupResult(response.experiment_setup);
      setShowExperimentSetupModal(true);
    } catch (error) {
      console.error('提取实验设置失败:', error);
    } finally {
      setExperimentSetupLoading(false);
    }
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
      <div className="border-t border-gray-200 p-3">
        <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">快速提取</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExtractMethodFlow}
              disabled={methodFlowLoading || !paperId}
              className="flex-1 px-3 py-2 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {methodFlowLoading ? (
                <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />
              ) : (
                <GitBranch className="w-3.5 h-3.5 inline mr-1" />
              )}
              方法流程
            </button>
            <button 
              onClick={handleExtractExperimentSetup}
              disabled={experimentSetupLoading || !paperId}
              className="flex-1 px-3 py-2 text-xs font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {experimentSetupLoading ? (
                <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5 inline mr-1" />
              )}
              实验设置
            </button>
          </div>
        </div>
      </div>
      
      {/* Method Flow Modal */}
      {showMethodFlowModal && methodFlowResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">方法流程</h3>
              </div>
              <button
                onClick={() => setShowMethodFlowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-6">
                {/* Method name & overview */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{methodFlowResult.method_name}</h4>
                  <p className="text-gray-600">{methodFlowResult.overview}</p>
                </div>
                
                {/* Steps */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">方法步骤</h5>
                  <div className="space-y-3">
                    {methodFlowResult.steps?.map((step, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                            {step.step}
                          </span>
                          <span className="font-medium text-gray-900">{step.name}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                        {step.inputs?.length > 0 && (
                          <div className="text-xs text-gray-500">
                            <span className="font-medium">输入: </span>{step.inputs.join(', ')}
                          </div>
                        )}
                        {step.outputs?.length > 0 && (
                          <div className="text-xs text-gray-500">
                            <span className="font-medium">输出: </span>{step.outputs.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Innovations */}
                {methodFlowResult.key_innovations?.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">关键创新</h5>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {methodFlowResult.key_innovations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Dependencies */}
                {methodFlowResult.dependencies?.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">依赖项</h5>
                    <div className="flex flex-wrap gap-2">
                      {methodFlowResult.dependencies.map((dep, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Pseudocode */}
                {methodFlowResult.pseudocode && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">伪代码</h5>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {methodFlowResult.pseudocode}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Experiment Setup Modal */}
      {showExperimentSetupModal && experimentSetupResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-gray-900">实验设置</h3>
              </div>
              <button
                onClick={() => setShowExperimentSetupModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-6">
                {/* Datasets */}
                {experimentSetupResult.datasets?.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">数据集</h5>
                    <div className="space-y-3">
                      {experimentSetupResult.datasets.map((dataset, index) => (
                        <div key={index} className="bg-emerald-50 rounded-lg p-4">
                          <div className="font-medium text-gray-900 mb-1">{dataset.name}</div>
                          <p className="text-sm text-gray-600 mb-2">{dataset.description}</p>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span><strong>规模:</strong> {dataset.size}</span>
                            <span><strong>划分:</strong> {dataset.split}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Baselines */}
                {experimentSetupResult.baselines?.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">对比方法</h5>
                    <div className="flex flex-wrap gap-2">
                      {experimentSetupResult.baselines.map((baseline, index) => (
                        <span key={index} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded">
                          {baseline}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Metrics */}
                {experimentSetupResult.metrics?.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">评估指标</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {experimentSetupResult.metrics.map((metric, index) => (
                        <div key={index} className="bg-purple-50 rounded-lg p-3">
                          <div className="font-medium text-purple-900 text-sm">{metric.name}</div>
                          <div className="text-xs text-purple-700">{metric.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Hyperparameters */}
                {experimentSetupResult.hyperparameters?.length > 0 && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">超参数</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left bg-gray-50">
                            <th className="px-3 py-2 font-medium text-gray-700">参数名</th>
                            <th className="px-3 py-2 font-medium text-gray-700">值</th>
                            <th className="px-3 py-2 font-medium text-gray-700">说明</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {experimentSetupResult.hyperparameters.map((param, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 font-mono text-indigo-600">{param.name}</td>
                              <td className="px-3 py-2 font-mono">{param.value}</td>
                              <td className="px-3 py-2 text-gray-600">{param.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Training Details */}
                {experimentSetupResult.training_details && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">训练细节</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">优化器</div>
                        <div className="font-medium">{experimentSetupResult.training_details.optimizer}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">学习率</div>
                        <div className="font-medium">{experimentSetupResult.training_details.learning_rate}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">批次大小</div>
                        <div className="font-medium">{experimentSetupResult.training_details.batch_size}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-500">训练轮数</div>
                        <div className="font-medium">{experimentSetupResult.training_details.epochs}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                        <div className="text-xs text-gray-500">硬件配置</div>
                        <div className="font-medium">{experimentSetupResult.training_details.hardware}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Reproducibility Notes */}
                {experimentSetupResult.reproducibility_notes && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">复现注意事项</h5>
                    <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      {experimentSetupResult.reproducibility_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

