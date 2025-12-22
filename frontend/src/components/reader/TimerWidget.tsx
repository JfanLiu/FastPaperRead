'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/common';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Target,
  Coffee,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TimerWidgetProps {
  onSessionComplete?: (duration: number, goals: string[]) => void;
  onPause?: () => void;
  className?: string;
}

type TimerMode = 'focus' | 'break';

const POMODORO_PRESETS = [
  { focus: 25, break: 5, label: '25/5' },
  { focus: 45, break: 10, label: '45/10' },
  { focus: 60, break: 15, label: '60/15' },
];

export function TimerWidget({
  onSessionComplete,
  onPause,
  className,
}: TimerWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [totalFocusTime, setTotalFocusTime] = useState(0);
  const [preset, setPreset] = useState(POMODORO_PRESETS[0]);
  const [goals, setGoals] = useState<string[]>([]);
  const [currentGoal, setCurrentGoal] = useState('');
  const [completedGoals, setCompletedGoals] = useState<Set<number>>(new Set());

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer complete
            if (mode === 'focus') {
              setTotalFocusTime((t) => t + preset.focus * 60);
              onSessionComplete?.(preset.focus * 60, goals);
              setMode('break');
              return preset.break * 60;
            } else {
              setMode('focus');
              return preset.focus * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, mode, preset, goals, onSessionComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    onPause?.();
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? preset.focus * 60 : preset.break * 60);
  };

  const handlePresetChange = (newPreset: typeof POMODORO_PRESETS[0]) => {
    setPreset(newPreset);
    setTimeLeft(mode === 'focus' ? newPreset.focus * 60 : newPreset.break * 60);
    setIsRunning(false);
  };

  const handleAddGoal = () => {
    if (currentGoal.trim()) {
      setGoals([...goals, currentGoal.trim()]);
      setCurrentGoal('');
    }
  };

  const toggleGoalComplete = (index: number) => {
    const newCompleted = new Set(completedGoals);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
    }
    setCompletedGoals(newCompleted);
  };

  const progress = mode === 'focus' 
    ? ((preset.focus * 60 - timeLeft) / (preset.focus * 60)) * 100
    : ((preset.break * 60 - timeLeft) / (preset.break * 60)) * 100;

  return (
    <div className={cn('border-t border-gray-200', className)}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer className={cn(
            'w-4 h-4',
            isRunning ? 'text-indigo-600 animate-pulse' : 'text-gray-500'
          )} />
          <span className="font-medium text-gray-900">计时器</span>
          {isRunning && (
            <span className={cn(
              'px-1.5 py-0.5 text-xs font-medium rounded',
              mode === 'focus' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-emerald-100 text-emerald-700'
            )}>
              {mode === 'focus' ? '专注中' : '休息中'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-mono text-sm',
            isRunning ? 'text-indigo-600' : 'text-gray-500'
          )}>
            {formatTime(timeLeft)}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Progress ring */}
          <div className="flex justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  className="stroke-gray-200"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  className={mode === 'focus' ? 'stroke-indigo-500' : 'stroke-emerald-500'}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {mode === 'focus' ? (
                  <Target className="w-6 h-6 text-indigo-500 mb-1" />
                ) : (
                  <Coffee className="w-6 h-6 text-emerald-500 mb-1" />
                )}
                <span className="text-2xl font-mono font-bold text-gray-900">
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-2">
            {isRunning ? (
              <Button onClick={handlePause} variant="secondary">
                <Pause className="w-4 h-4 mr-1" />
                暂停
              </Button>
            ) : (
              <Button onClick={handleStart}>
                <Play className="w-4 h-4 mr-1" />
                {timeLeft === preset.focus * 60 || timeLeft === preset.break * 60 ? '开始' : '继续'}
              </Button>
            )}
            <Button variant="secondary" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Presets */}
          <div className="flex justify-center gap-2">
            {POMODORO_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePresetChange(p)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                  preset.label === p.label
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Session goals */}
          <div>
            <span className="text-xs font-medium text-gray-500 block mb-2">本次目标</span>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={currentGoal}
                onChange={(e) => setCurrentGoal(e.target.value)}
                placeholder="例如：读完方法章节"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
              />
              <Button size="sm" variant="secondary" onClick={handleAddGoal}>
                添加
              </Button>
            </div>
            {goals.length > 0 && (
              <div className="space-y-1.5">
                {goals.map((goal, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm',
                      completedGoals.has(index) ? 'bg-emerald-50' : 'bg-gray-50'
                    )}
                  >
                    <button onClick={() => toggleGoalComplete(index)}>
                      {completedGoals.has(index) ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                      )}
                    </button>
                    <span className={cn(
                      completedGoals.has(index) && 'line-through text-gray-400'
                    )}>
                      {goal}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          {totalFocusTime > 0 && (
            <div className="text-center text-xs text-gray-500">
              今日累计专注: {Math.floor(totalFocusTime / 60)} 分钟
            </div>
          )}
        </div>
      )}
    </div>
  );
}

