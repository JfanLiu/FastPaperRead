import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并Tailwind类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  
  return formatDate(date);
}

/**
 * 截断文本
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * 获取状态标签颜色
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    unread: 'bg-gray-100 text-gray-700',
    skimmed: 'bg-blue-100 text-blue-700',
    deepread: 'bg-green-100 text-green-700',
    archived: 'bg-gray-100 text-gray-500',
    importing: 'bg-yellow-100 text-yellow-700',
    parsing: 'bg-yellow-100 text-yellow-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

/**
 * 获取质量等级颜色
 */
export function getQualityColor(grade: string | null): string {
  if (!grade) return 'bg-gray-100 text-gray-500';
  const colors: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-700',
    B: 'bg-blue-100 text-blue-700',
    C: 'bg-yellow-100 text-yellow-700',
    D: 'bg-red-100 text-red-700',
  };
  return colors[grade] || 'bg-gray-100 text-gray-500';
}

/**
 * 获取证据强度颜色
 */
export function getEvidenceStrengthColor(strength: string): string {
  const colors: Record<string, string> = {
    strong: 'text-green-600',
    medium: 'text-yellow-600',
    weak: 'text-red-600',
  };
  return colors[strength] || 'text-gray-600';
}

/**
 * 状态文本映射
 */
export function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    unread: '未读',
    skimmed: '已粗读',
    deepread: '已精读',
    archived: '已归档',
    importing: '导入中',
    parsing: '解析中',
  };
  return texts[status] || status;
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}


