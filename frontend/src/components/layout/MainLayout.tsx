'use client';

import { useUIStore } from '@/stores/uiStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RightPanel } from './RightPanel';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
  showRightPanel?: boolean;
  headerActions?: React.ReactNode;
}

export function MainLayout({
  children,
  title,
  showSearch = true,
  showRightPanel = false,
  headerActions,
}: MainLayoutProps) {
  const { sidebarOpen, rightPanelOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Header title={title} showSearch={showSearch} actions={headerActions} />
      
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
          sidebarOpen ? 'pl-64' : 'pl-16',
          showRightPanel && rightPanelOpen ? 'pr-[400px]' : ''
        )}
      >
        {children}
      </main>

      {showRightPanel && <RightPanel />}
    </div>
  );
}


