'use client';

import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import {
  X,
  Sparkles,
  StickyNote,
  CheckSquare,
  MessageSquare,
  Timer,
} from 'lucide-react';

const tabs = [
  { id: 'enhance', label: '增强', icon: Sparkles },
  { id: 'notes', label: '笔记', icon: StickyNote },
  { id: 'checklist', label: '清单', icon: CheckSquare },
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'timer', label: '计时', icon: Timer },
] as const;

interface RightPanelProps {
  children?: React.ReactNode;
}

export function RightPanel({ children }: RightPanelProps) {
  const { rightPanelOpen, rightPanelTab, setRightPanelTab, toggleRightPanel } = useUIStore();

  if (!rightPanelOpen) return null;

  return (
    <aside className="fixed right-0 top-16 bottom-0 w-[400px] bg-white border-l border-gray-200 flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightPanelTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                rightPanelTab === tab.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={toggleRightPanel}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {children || <RightPanelContent tab={rightPanelTab} />}
      </div>
    </aside>
  );
}

function RightPanelContent({ tab }: { tab: string }) {
  switch (tab) {
    case 'enhance':
      return <EnhancePanel />;
    case 'notes':
      return <NotesPanel />;
    case 'checklist':
      return <ChecklistPanel />;
    case 'chat':
      return <ChatPanel />;
    case 'timer':
      return <TimerPanel />;
    default:
      return null;
  }
}

function EnhancePanel() {
  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">选中文本或图表以获取AI解释</p>
      </div>
    </div>
  );
}

function NotesPanel() {
  return (
    <div className="space-y-4">
      <div className="text-center py-8">
        <StickyNote className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">暂无笔记</p>
      </div>
    </div>
  );
}

function ChecklistPanel() {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">复现清单</h3>
      <div className="space-y-2">
        {['数据集', '超参数', '训练配置', '评估指标'].map((group) => (
          <div key={group} className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{group}</h4>
            <p className="text-xs text-gray-500">暂无条目</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">开始与论文对话</p>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <input
          type="text"
          placeholder="输入问题..."
          className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}

function TimerPanel() {
  return (
    <div className="text-center py-8">
      <div className="w-32 h-32 mx-auto rounded-full border-4 border-indigo-100 flex items-center justify-center mb-4">
        <span className="text-3xl font-bold text-gray-900">25:00</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">番茄钟计时</p>
      <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        开始
      </button>
    </div>
  );
}


