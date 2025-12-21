import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Paper, PaperStatus, Anchor, SectionTree, SkimCard, Card } from '@/types';

interface PaperState {
  // 论文列表
  papers: Paper[];
  totalPapers: number;
  
  // 当前论文
  currentPaper: Paper | null;
  currentAnchors: Anchor[];
  sectionTree: SectionTree | null;
  skimCard: SkimCard | null;
  cards: Card[];
  
  // 筛选状态
  filters: {
    status: PaperStatus | 'all';
    quality: string | 'all';
    search: string;
  };
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPapers: (papers: Paper[], total: number) => void;
  addPaper: (paper: Paper) => void;
  updatePaper: (paperId: string, data: Partial<Paper>) => void;
  removePaper: (paperId: string) => void;
  
  setCurrentPaper: (paper: Paper | null) => void;
  setCurrentAnchors: (anchors: Anchor[]) => void;
  setSectionTree: (tree: SectionTree | null) => void;
  setSkimCard: (card: SkimCard | null) => void;
  setCards: (cards: Card[]) => void;
  addCard: (card: Card) => void;
  updateCard: (cardId: string, data: Partial<Card>) => void;
  removeCard: (cardId: string) => void;
  
  setFilters: (filters: Partial<PaperState['filters']>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  reset: () => void;
}

const initialState = {
  papers: [],
  totalPapers: 0,
  currentPaper: null,
  currentAnchors: [],
  sectionTree: null,
  skimCard: null,
  cards: [],
  filters: {
    status: 'all' as const,
    quality: 'all',
    search: '',
  },
  isLoading: false,
  error: null,
};

export const usePaperStore = create<PaperState>()(
  persist(
    (set) => ({
      ...initialState,

      setPapers: (papers, total) => set({ papers, totalPapers: total }),
      
      addPaper: (paper) => set((state) => ({
        papers: [paper, ...state.papers],
        totalPapers: state.totalPapers + 1,
      })),
      
      updatePaper: (paperId, data) => set((state) => ({
        papers: state.papers.map((p) =>
          p.id === paperId ? { ...p, ...data } : p
        ),
        currentPaper: state.currentPaper?.id === paperId
          ? { ...state.currentPaper, ...data }
          : state.currentPaper,
      })),
      
      removePaper: (paperId) => set((state) => ({
        papers: state.papers.filter((p) => p.id !== paperId),
        totalPapers: state.totalPapers - 1,
        currentPaper: state.currentPaper?.id === paperId ? null : state.currentPaper,
      })),

      setCurrentPaper: (paper) => set({ currentPaper: paper }),
      setCurrentAnchors: (anchors) => set({ currentAnchors: anchors }),
      setSectionTree: (tree) => set({ sectionTree: tree }),
      setSkimCard: (card) => set({ skimCard: card }),
      setCards: (cards) => set({ cards }),
      
      addCard: (card) => set((state) => ({ cards: [...state.cards, card] })),
      
      updateCard: (cardId, data) => set((state) => ({
        cards: state.cards.map((c) =>
          c.id === cardId ? { ...c, ...data } : c
        ),
      })),
      
      removeCard: (cardId) => set((state) => ({
        cards: state.cards.filter((c) => c.id !== cardId),
      })),

      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'paper-storage',
      partialize: (state) => ({
        filters: state.filters,
      }),
    }
  )
);

