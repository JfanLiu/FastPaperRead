// ============================================
// 论文相关类型
// ============================================

export type PaperStatus = 'importing' | 'parsing' | 'unread' | 'skimmed' | 'deepread' | 'archived';
export type QualityGrade = 'A' | 'B' | 'C' | 'D' | null;

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  keywords: string[];
  source_type: 'pdf' | 'doi' | 'arxiv' | 'url';
  source_value: string;
  pdf_path: string | null;
  status: PaperStatus;
  quality_grade: QualityGrade;
  repro_status: 'complete' | 'partial' | 'missing' | null;
  read_progress: number;
  anchor_count: number;
  card_count: number;
  created_at: string;
  updated_at: string;
  last_read_at: string | null;
}

export interface PaperImportRequest {
  pdf_url?: string;
  doi?: string;
  arxiv_id?: string;
  title?: string;
  authors?: string[];
  year?: number;
}

export interface PaperImportResponse {
  paper_id: string;
  job_id: string;
  status: string;
  message: string;
}

export interface ImportJobStatus {
  paper_id: string;
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  steps: Record<string, string>;
  error_message?: string;
}

// ============================================
// 锚点相关类型
// ============================================

export type AnchorType = 'paragraph' | 'section' | 'figure' | 'table' | 'equation' | 'citation';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Anchor {
  id: string;
  paper_id: string;
  type: AnchorType;
  page: number;
  bbox: BoundingBox | null;
  section: string | null;
  section_level: number;
  sequence: number;
  text: string;
  caption: string | null;
  image_path: string | null;
  figure_number: string | null;
  latex: string | null;
  equation_number: string | null;
  symbols: string[];
  table_data: Record<string, unknown> | null;
  ref_id: string | null;
  card_ids: string[];
  cached_explanation: Record<string, string> | null;
}

export interface SectionNode {
  id: string;
  title: string;
  level: number;
  anchor_id: string;
  page: number;
  children: SectionNode[];
  is_read: boolean;
  is_must_read: boolean;
}

export interface SectionTree {
  paper_id: string;
  sections: SectionNode[];
}

// ============================================
// SkimCard相关类型
// ============================================

export interface SkimCard {
  paper_id: string;
  research_question: string;
  contributions: string[];
  evidence_strength: 'strong' | 'medium' | 'weak';
  evidence_strength_reason: string;
  red_flags: string[];
  recommended_route: string;
  recommended_sections: string[];
  key_figures: string[];
  generated_at: string;
  source_anchor_ids: string[];
}

export type SkimDecision = 'archive' | 'queue' | 'deepread';

export interface SkimDecisionRequest {
  paper_id: string;
  decision: SkimDecision;
  archive_reasons?: string[];
  archive_note?: string;
  queue_priority?: 'high' | 'medium' | 'low';
  estimated_time?: number;
  reading_goal?: string;
  reading_route?: string;
}

// ============================================
// 卡片相关类型
// ============================================

export type CardType = 'paper' | 'evidence' | 'method' | 'note';
export type CardStatus = 'draft' | 'final';
export type UncertaintyLevel = 'from_text' | 'inferred' | 'needs_verify';

export interface Card {
  id: string;
  paper_id: string;
  type: CardType;
  title: string;
  content: string;
  source_anchor_ids: string[];
  uncertainty: UncertaintyLevel;
  tags: string[];
  status: CardStatus;
  version: number;
  created_at: string;
  updated_at: string;
  // PaperCard fields
  one_line_summary?: string;
  contributions?: string[];
  limitations?: string[];
  applicable_scope?: string;
  keywords?: string[];
  // EvidenceCard fields
  claim?: string;
  evidence?: string;
  evidence_strength?: string;
  alternative_explanations?: string[];
  risks?: string[];
  figure_anchor_ids?: string[];
  // MethodCard fields
  method_name?: string;
  inputs?: string[];
  outputs?: string[];
  assumptions?: string[];
  process?: string;
  pseudocode?: string;
  complexity?: string;
  equation_anchor_ids?: string[];
}

// ============================================
// 增强引擎相关类型
// ============================================

export type EnhanceType = 'term' | 'equation' | 'figure' | 'paragraph' | 'missing_detail';
export type ExplanationLevel = 'one_liner' | 'plain' | 'strict';

export interface EnhanceRequest {
  paper_id: string;
  anchor_id: string;
  enhance_type: EnhanceType;
  level?: ExplanationLevel;
  selected_text?: string;
  use_cache?: boolean;
}

export interface TermExplanation {
  term: string;
  one_liner: string;
  plain: string;
  strict: string;
  source_anchor_id: string;
  uncertainty: UncertaintyLevel;
  related_terms: string[];
}

export interface EquationExplanation {
  latex: string;
  symbol_table: Record<string, string>;
  key_assumptions: string[];
  derivation_steps: string[];
  plain_explanation: string;
  source_anchor_id: string;
  uncertainty: UncertaintyLevel;
}

export interface FigureExplanation {
  figure_number: string;
  caption: string;
  what_it_shows: string;
  evidence_assessment: string;
  alternative_explanations: string[];
  key_observations: string[];
  source_anchor_id: string;
  uncertainty: UncertaintyLevel;
}

export interface EnhanceResponse {
  enhance_type: EnhanceType;
  anchor_id: string;
  term?: TermExplanation;
  equation?: EquationExplanation;
  figure?: FigureExplanation;
  cached: boolean;
  processing_time_ms: number;
}

// ============================================
// API响应类型
// ============================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

