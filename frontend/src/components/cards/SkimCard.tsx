'use client';

import { Badge } from '@/components/common';
import { cn } from '@/lib/utils';
import type { SkimCard as SkimCardType } from '@/types';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  RefreshCw,
} from 'lucide-react';

interface SkimCardProps {
  skimCard: SkimCardType;
  onRegenerate?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function SkimCard({ skimCard, onRegenerate, isLoading, className }: SkimCardProps) {
  const getStrengthConfig = (strength: string) => {
    switch (strength) {
      case 'strong':
        return { label: '强', variant: 'success' as const, color: 'text-emerald-600' };
      case 'weak':
        return { label: '弱', variant: 'danger' as const, color: 'text-red-600' };
      default:
        return { label: '中', variant: 'warning' as const, color: 'text-amber-600' };
    }
  };

  const strengthConfig = getStrengthConfig(skimCard.evidence_strength);

  return (
    <div className={cn('bg-white rounded-2xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">SkimCard</h2>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            重新生成
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Research Question */}
        <Section title="研究问题">
          <p className="text-gray-900 leading-relaxed">{skimCard.research_question}</p>
        </Section>

        {/* Contributions */}
        <Section title="主要贡献">
          <ul className="space-y-2">
            {skimCard.contributions.map((contribution, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-gray-700">{contribution}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Evidence Strength */}
        <Section title="证据强度">
          <div className="flex items-start gap-3">
            <Badge variant={strengthConfig.variant} size="md">
              {strengthConfig.label}
            </Badge>
            <p className="text-sm text-gray-600 flex-1">
              {skimCard.evidence_strength_reason}
            </p>
          </div>
        </Section>

        {/* Red Flags */}
        {skimCard.red_flags.length > 0 && (
          <Section title="风险提示">
            <ul className="space-y-2">
              {skimCard.red_flags.map((flag, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <span className="text-gray-700">{flag}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Recommended Route */}
        <Section title="推荐阅读">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            <div className="flex flex-wrap gap-2">
              {skimCard.recommended_sections.map((section) => (
                <Badge key={section} variant="info">
                  {section}
                </Badge>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

