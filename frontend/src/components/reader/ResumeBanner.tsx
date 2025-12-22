'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/common';
import {
  ArrowRight,
  Clock,
  FileText,
  X,
} from 'lucide-react';

interface ResumeBannerProps {
  lastAnchor?: {
    id: string;
    section?: string;
    page?: number;
    text?: string;
  };
  lastTab?: string;
  lastTime?: string;
  onResume: () => void;
  onDismiss: () => void;
  className?: string;
}

export function ResumeBanner({
  lastAnchor,
  lastTab,
  lastTime,
  onResume,
  onDismiss,
  className,
}: ResumeBannerProps) {
  if (!lastAnchor) return null;

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white animate-in slide-in-from-top duration-300',
      className
    )}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium">继续上次阅读</p>
          <p className="text-xs text-white/80">
            {lastAnchor.section && `${lastAnchor.section}`}
            {lastAnchor.page && ` • 第 ${lastAnchor.page} 页`}
            {lastTime && ` • ${lastTime}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onResume}
          className="bg-white text-indigo-700 hover:bg-white/90"
        >
          <ArrowRight className="w-4 h-4 mr-1" />
          回到上次位置
        </Button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

