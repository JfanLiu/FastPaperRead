/**
 * 共享类型定义
 */

// ============ 论文相关 ============

export type PaperStatus = 
  | 'importing'
  | 'parsing' 
  | 'unread'
  | 'skimmed'
  | 'deepread'
  | 'archived';

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  keywords: string[];
  source_type: string;
  source_value: string;
  pdf_path?: string;
  markdown_path?: string;
  status: PaperStatus;
  quality_grade?: string;
  repro_status?: string;
  current_section?: string;
  read_progress: number;
  created_at: string;
  updated_at: string;
  last_read_at?: string;
}

export interface PaperListResponse {
  papers: Paper[];
  total: number;
  skip: number;
  limit: number;
}

// ============ 锚点相关 ============

export type AnchorType = 
  | 'paragraph'
  | 'section'
  | 'figure'
  | 'table'
  | 'equation'
  | 'citation';

export interface Anchor {
  id: string;
  paper_id: string;
  type: AnchorType;
  page?: number;
  bbox?: number[];
  section?: string;
  section_level?: number;
  sequence?: number;
  text?: string;
  caption?: string;
  image_path?: string;
  figure_number?: string;
  latex?: string;
  equation_number?: string;
  symbols?: string[];
  table_data?: Record<string, unknown>;
  ref_id?: string;
  ref_text?: string;
  metadata?: Record<string, unknown>;
  explanation_cache?: Record<string, unknown>;
}

// ============ 卡片相关 ============

export type CardType = 'paper' | 'evidence' | 'method' | 'note';
export type CardStatus = 'draft' | 'final';
export type UncertaintyLevel = 'from_text' | 'inferred' | 'needs_confirm';

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
  
  // PaperCard specific
  one_line_summary?: string;
  contributions?: string[];
  limitations?: string[];
  applicable_scope?: string;
  
  // EvidenceCard specific
  claim?: string;
  evidence?: string;
  evidence_strength?: string;
  alternative_explanations?: string[];
  risks?: string[];
  figure_anchor_ids?: string[];
  
  // MethodCard specific
  method_name?: string;
  inputs?: string[];
  outputs?: string[];
  assumptions?: string[];
  process?: string;
  pseudocode?: string;
  complexity?: string;
  equation_anchor_ids?: string[];
}

// ============ SkimCard ============

export interface SkimCard {
  research_question: string;
  contributions: string[];
  evidence_strength: 'strong' | 'medium' | 'weak';
  evidence_strength_reason: string;
  red_flags: string[];
  recommended_route: 'full_read' | 'focused_read' | 'skim' | 'skip';
  recommended_sections: string[];
  key_figures: string[];
}

// ============ 增强引擎 ============

export interface TermExplanation {
  definition: string;
  explanation: string;
  examples: string[];
  related_terms: string[];
}

export interface FigureExplanation {
  description: string;
  key_findings: string[];
  interpretation: string;
  limitations: string[];
  related_content: string;
}

export interface EquationExplanation {
  explanation: string;
  symbols: { symbol: string; meaning: string }[];
  derivation_hint?: string;
  usage: string;
  related_equations: string[];
}

export interface MissingDetailItem {
  group: 'data' | 'model' | 'training' | 'evaluation' | 'code';
  text: string;
  importance: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface MissingDetails {
  items: MissingDetailItem[];
  completeness_score: number;
  overall_assessment: string;
}

// ============ 方法流程提取 ============

export interface MethodFlowStep {
  step: number;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
}

export interface MethodFlowResult {
  method_name: string;
  overview: string;
  steps: MethodFlowStep[];
  key_innovations: string[];
  dependencies: string[];
  pseudocode?: string;
}

// ============ 实验设置提取 ============

export interface DatasetInfo {
  name: string;
  description: string;
  size: string;
  split: string;
}

export interface MetricInfo {
  name: string;
  description: string;
}

export interface HyperparameterInfo {
  name: string;
  value: string;
  description: string;
}

export interface TrainingDetails {
  optimizer: string;
  learning_rate: string;
  batch_size: string;
  epochs: string;
  hardware: string;
}

export interface ExperimentSetupResult {
  datasets: DatasetInfo[];
  baselines: string[];
  metrics: MetricInfo[];
  hyperparameters: HyperparameterInfo[];
  training_details: TrainingDetails;
  reproducibility_notes: string;
}

// ============ 复现清单 ============

export interface ChecklistItem {
  group: string;
  text: string;
  source_anchor?: string;
  missing: boolean;
  needs_verify: boolean;
}

export interface ReproChecklist {
  paper_id: string;
  items: ChecklistItem[];
  total_items: number;
  found_items: number;
  missing_items: number;
  completeness_score: number;
  repro_verdict: 'good' | 'fair' | 'poor' | 'unknown';
}

// ============ 导入任务 ============

export interface ImportJob {
  id: string;
  paper_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  steps: Record<string, 'pending' | 'running' | 'completed' | 'failed'>;
  error_message?: string;
}

// ============ API 请求/响应 ============

export interface PaperImportRequest {
  pdf_url: string;
}

export interface PaperImportResponse {
  paper_id: string;
  job_id: string;
  message: string;
}

export interface ImportJobStatus {
  paper_id: string;
  job_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_step: string;
  error_message?: string;
}

export interface SectionTree {
  id: string;
  title: string;
  level: number;
  children: SectionTree[];
}

export interface SkimDecisionRequest {
  paper_id: string;
  decision: 'deep_read' | 'focused_read' | 'skip' | 'archive' | 'queue';
  quality_grade?: string;
}

export interface EnhanceRequest {
  anchor_id: string;
  enhance_type: 'term' | 'figure' | 'equation' | 'section_summary';
  selected_text?: string;
  use_cache?: boolean;
}

export interface EnhanceResponse {
  enhance_type: string;
  anchor_id: string;
  cached: boolean;
  term?: TermExplanation;
  figure?: FigureExplanation;
  equation?: EquationExplanation;
  summary?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  cached?: boolean;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}
