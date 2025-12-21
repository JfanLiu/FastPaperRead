'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import {
  Library,
  FileText,
  Upload,
  BookOpen,
  StickyNote,
  GitCompare,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const navigation = [
  { name: '文献库', href: '/library', icon: Library },
  { name: '导入论文', href: '/import', icon: Upload },
  { name: '待读队列', href: '/queue', icon: BookOpen },
  { name: '笔记库', href: '/notes', icon: StickyNote },
  { name: '对比模式', href: '/compare', icon: GitCompare },
  { name: '审稿模式', href: '/review', icon: ClipboardCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
        <Link href="/library" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              FastPaper
            </span>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={!sidebarOpen ? item.name : undefined}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', isActive && 'text-indigo-600')} />
              {sidebarOpen && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {sidebarOpen && (
        <div className="p-4 border-t border-gray-100">
          <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50">
            <p className="text-xs font-medium text-indigo-700">FastPaperRead</p>
            <p className="text-xs text-gray-500">AI驱动论文阅读平台</p>
          </div>
        </div>
      )}
    </aside>
  );
}

