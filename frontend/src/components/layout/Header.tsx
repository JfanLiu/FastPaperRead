'use client';

import Link from 'next/link';
import { useUIStore } from '@/stores/uiStore';
import { usePaperStore } from '@/stores/paperStore';
import { Search, Bell, Settings, User, Home } from 'lucide-react';
import { Input } from '@/components/common';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  actions?: React.ReactNode;
}

export function Header({ title, showSearch = true, actions }: HeaderProps) {
  const { sidebarOpen } = useUIStore();
  const { filters, setFilters } = usePaperStore();

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white/80 backdrop-blur-sm border-b border-gray-100 transition-all duration-300 ${
        sidebarOpen ? 'left-64' : 'left-16'
      }`}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: Home + Title or Search */}
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="返回主页"
          >
            <Home className="w-5 h-5" />
            <span className="text-sm font-medium">主页</span>
          </Link>
          {title && (
            <>
              <span className="text-gray-300">|</span>
              <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            </>
          )}
          {showSearch && (
            <div className="w-80">
              <Input
                placeholder="搜索论文..."
                icon={<Search className="w-4 h-4" />}
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {actions}
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <button className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

