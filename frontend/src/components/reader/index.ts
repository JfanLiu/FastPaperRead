// 注意：PDFViewer 必须使用 dynamic import 以避免 SSR 问题
// 不要从这里直接导出 PDFViewer，请在使用时使用 next/dynamic 导入
// 例如：
// import dynamic from 'next/dynamic';
// const PDFViewer = dynamic(() => import('@/components/reader/PDFViewer').then(mod => ({ default: mod.PDFViewer })), { ssr: false });

// AnchorList 已合并到 StructuredView，如需单独使用可直接 import
// export { AnchorList } from './AnchorList';
export { EnhancePanel } from './EnhancePanel';
export { SelectionToolbar } from './SelectionToolbar';
export { RoutePlanner } from './RoutePlanner';
export { NotesPanel } from './NotesPanel';
export { ChecklistPanel } from './ChecklistPanel';
export { TimerWidget } from './TimerWidget';
export { StructuredView } from './StructuredView';
export { ResumeBanner } from './ResumeBanner';
export { EvidenceLedger } from './EvidenceLedger';
export { ChatPanel } from './ChatPanel';
export { QuoteSnippetPanel } from './QuoteSnippetPanel';
export { PaperCardGenerator } from './PaperCardGenerator';
export { MaterialsWorkspace } from './MaterialsWorkspace';
