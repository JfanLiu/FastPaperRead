'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Send,
  Trash2,
  RefreshCw,
  Plus,
  FileText,
  CheckSquare,
  HelpCircle,
  Loader2,
  MessageSquare,
  Users,
  PenTool,
  FlaskConical,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { chatApi } from '@/lib/api';
import type { ChatMessage, ChatMode, ChatHistory } from '@/types';

interface ChatPanelProps {
  paperId: string;
  selectedText?: string;
  selectedAnchorIds?: string[];
  onAddToChecklist?: (text: string) => void;
  onCreateCard?: (content: string) => void;
  className?: string;
}

const modeConfig: Record<ChatMode, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  seminar: {
    label: '组会',
    icon: <Users className="w-3.5 h-3.5" />,
    description: '准备讲解，追问关键细节',
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  writing: {
    label: '写作',
    icon: <PenTool className="w-3.5 h-3.5" />,
    description: '帮助引用和对比',
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  },
  reproduction: {
    label: '复现',
    icon: <FlaskConical className="w-3.5 h-3.5" />,
    description: '关注实验细节和超参数',
    color: 'bg-green-100 text-green-700 border-green-200'
  },
  design: {
    label: '设计',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    description: '讨论改进方向',
    color: 'bg-orange-100 text-orange-700 border-orange-200'
  },
};

export function ChatPanel({
  paperId,
  selectedText,
  selectedAnchorIds = [],
  onAddToChecklist,
  onCreateCard,
  className
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMode, setCurrentMode] = useState<ChatMode>('seminar');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [contextText, setContextText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await chatApi.getHistory(paperId);
        if (response.history) {
          setMessages(response.history.messages);
          setCurrentMode(response.history.current_mode);
        }
      } catch (error) {
        console.error('加载聊天历史失败:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, [paperId]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 监听选中文本
  useEffect(() => {
    if (selectedText) {
      setContextText(selectedText);
    }
  }, [selectedText]);

  // 切换模式
  const handleModeChange = async (mode: ChatMode) => {
    try {
      const response = await chatApi.switchMode(paperId, mode);
      setCurrentMode(mode);
      // 添加系统消息
      const systemMessage: ChatMessage = {
        role: 'assistant',
        content: response.description,
        timestamp: new Date().toISOString(),
        context_anchors: []
      };
      setMessages(prev => [...prev, systemMessage]);
    } catch (error) {
      console.error('切换模式失败:', error);
    }
  };

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText,
      timestamp: new Date().toISOString(),
      context_anchors: selectedAnchorIds
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage(
        paperId,
        inputText,
        currentMode,
        contextText || undefined,
        selectedAnchorIds
      );
      setMessages(prev => [...prev, response.message]);
      setContextText(null); // 清除上下文
    } catch (error) {
      console.error('发送消息失败:', error);
      // 添加错误消息
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '抱歉，消息发送失败，请重试。',
        timestamp: new Date().toISOString(),
        context_anchors: []
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 清空历史
  const handleClearHistory = async () => {
    if (!confirm('确定要清空聊天记录吗？')) return;
    try {
      await chatApi.clearHistory(paperId);
      setMessages([]);
    } catch (error) {
      console.error('清空历史失败:', error);
    }
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col h-full bg-white', className)}>
        {/* 模式选择器 */}
        <div className="flex items-center gap-1 p-2 border-b border-gray-200">
          {(Object.entries(modeConfig) as [ChatMode, typeof modeConfig[ChatMode]][]).map(([mode, config]) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleModeChange(mode)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                    currentMode === mode
                      ? config.color
                      : 'text-gray-500 hover:bg-gray-100'
                  )}
                >
                  {config.icon}
                  {config.label}
                </button>
              </TooltipTrigger>
              <TooltipContent>{config.description}</TooltipContent>
            </Tooltip>
          ))}
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearHistory}
                className="h-7 w-7 p-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>清空记录</TooltipContent>
          </Tooltip>
        </div>

        {/* 上下文提示 */}
        {contextText && (
          <div className="mx-2 mt-2 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-indigo-700">已选中上下文</span>
              <button
                onClick={() => setContextText(null)}
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                移除
              </button>
            </div>
            <p className="text-xs text-indigo-600 line-clamp-2">{contextText}</p>
          </div>
        )}

        {/* 消息列表 */}
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">开始与 AI 讨论这篇论文</p>
              <p className="text-xs mt-1">当前模式: {modeConfig[currentMode].label}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  onAddToChecklist={onAddToChecklist}
                  onCreateCard={onCreateCard}
                />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">思考中...</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* 输入区域 */}
        <div className="p-3 border-t border-gray-200">
          <div className="relative">
            <Textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`在${modeConfig[currentMode].label}模式下提问...`}
              className="pr-10 min-h-[60px] max-h-[120px] text-sm resize-none"
              disabled={isLoading}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="absolute right-2 bottom-2 h-7 w-7 p-0"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// 消息气泡组件
interface MessageBubbleProps {
  message: ChatMessage;
  onAddToChecklist?: (text: string) => void;
  onCreateCard?: (content: string) => void;
}

function MessageBubble({ message, onAddToChecklist, onCreateCard }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col',
        isUser ? 'items-end' : 'items-start'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-800'
        )}
      >
        {/* 上下文锚点标签 */}
        {message.context_anchors.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.context_anchors.map((anchor, i) => (
              <Badge key={i} variant="outline" className="text-xs opacity-70">
                锚点 #{i + 1}
              </Badge>
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>

      {/* 时间和操作 */}
      <div className="flex items-center gap-2 mt-1 px-1">
        {message.timestamp && (
          <span className="text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
        
        {/* AI 回复的操作按钮 */}
        {!isUser && showActions && (
          <div className="flex items-center gap-1">
            {onAddToChecklist && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onAddToChecklist(message.content)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <CheckSquare className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>加入清单</TooltipContent>
              </Tooltip>
            )}
            {onCreateCard && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onCreateCard(message.content)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>生成卡片</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

