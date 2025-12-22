import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type RightPanelTab = 'enhance' | 'notes' | 'checklist' | 'chat' | 'timer';
type ViewMode = 'list' | 'grid';

interface UIState {
  // 侧边栏
  sidebarOpen: boolean;
  sidebarWidth: number;
  
  // 右侧面板
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  rightPanelWidth: number;
  
  // 阅读器
  splitRatio: number; // PDF vs Structured view (0-100)
  pdfScale: number;
  showAnchors: boolean;
  
  // 视图模式
  libraryViewMode: ViewMode;
  
  // 主题
  theme: 'light' | 'dark' | 'system';
  
  // 导入状态
  importModalOpen: boolean;
  importProgress: {
    jobId: string | null;
    progress: number;
    status: string;
    currentStep: string;
  } | null;
  
  // Actions
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setRightPanelWidth: (width: number) => void;
  
  setSplitRatio: (ratio: number) => void;
  setPdfScale: (scale: number) => void;
  toggleAnchors: () => void;
  
  setLibraryViewMode: (mode: ViewMode) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  openImportModal: () => void;
  closeImportModal: () => void;
  setImportProgress: (progress: UIState['importProgress']) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // 初始状态
      sidebarOpen: true,
      sidebarWidth: 280,
      rightPanelOpen: false,
      rightPanelTab: 'enhance',
      rightPanelWidth: 400,
      splitRatio: 50,
      pdfScale: 1,
      showAnchors: true,
      libraryViewMode: 'list',
      theme: 'light',
      importModalOpen: false,
      importProgress: null,

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width }),
      
      setSplitRatio: (ratio) => set({ splitRatio: ratio }),
      setPdfScale: (scale) => set({ pdfScale: scale }),
      toggleAnchors: () => set((state) => ({ showAnchors: !state.showAnchors })),
      
      setLibraryViewMode: (mode) => set({ libraryViewMode: mode }),
      setTheme: (theme) => set({ theme }),
      
      openImportModal: () => set({ importModalOpen: true }),
      closeImportModal: () => set({ importModalOpen: false, importProgress: null }),
      setImportProgress: (progress) => set({ importProgress: progress }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        splitRatio: state.splitRatio,
        pdfScale: state.pdfScale,
        showAnchors: state.showAnchors,
        libraryViewMode: state.libraryViewMode,
        theme: state.theme,
      }),
    }
  )
);

