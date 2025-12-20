flowchart TB
  A([Start]) --> B[导入论文\nPDF / DOI / arXiv / URL / BibTeX]
  B --> C[解析与分段\n元数据/章节/参考文献/图表/公式/表格]
  C --> D{入口意图}

  D -->|粗读/筛选| E[粗读 Skim 3-7min]
  D -->|精读/复现| F[精读 Deep Read 20-60min]
  D -->|审稿/评价| G[Reviewer Mode]
  D -->|对比/综述| H[Compare Mode]
  D -->|自由对话| I[Dialogue Loop]

  %% Skim
  E --> E1[输出：Skim Card\n问题/贡献/证据强度/风险/是否精读]
  E --> J{阅读决策}
  J -->|不读| K[归档/忽略\n原因记录]
  J -->|待读| L[加入待读队列\n估时/优先级]
  J -->|精读| F

  %% Deep Read
  F --> F1[Section Walkthrough\n按“必须段落+关键图表”路线]
  F1 --> F2[方法复原\n输入输出/假设/流程/复杂度]
  F2 --> F3[证据审计\n图表解读/统计/消融/公平性]
  F3 --> F4[可复现包\n数据/代码/超参/环境/评估]
  F4 --> F5[输出：结构化笔记\nPaperCard/MethodCard/EvidenceCard/ReproChecklist]
  F5 --> M[入库：知识图谱\n标签/术语映射/引用片段]
  M --> N[主动对比触发\n同任务/同数据/同方法]
  N --> H

  %% Reviewer
  G --> G1[输出：审稿报告\nNovelty/Soundness/Rigor/Repro/Qs/Recommendation]
  G1 --> M

  %% Compare
  H --> H1[检索相似论文\n同类/对立/替代路线/经典+最新]
  H1 --> H2[对齐与归一\n术语/指标/数据集/设定]
  H2 --> H3[输出：对比矩阵\n差异点表+结论冲突表+最佳实践]
  H3 --> M

  %% Dialogue
  I --> I1[问答/追问/方案设计\n组会模式/写作模式/复现实验模式]
  I1 --> D

  %% Enhancement engine hooks (Module 2)
  subgraph X[阅读增强引擎 Module 2（随处可触发）]
    X1[术语/背景补齐\n三层解释：一句话/通俗/严格]
    X2[公式与符号表\n关键推导步/假设标注]
    X3[图表读法\n图想证明什么？证据够吗？替代解释？]
    X4[缺失细节补全\n默认设置推测+需原文确认清单]
  end

  %% Hooks
  E -. 遇到不懂/卡点 .-> X
  F1 -. 术语/公式/图表 .-> X
  F2 -. 缺失超参/设定 .-> X
  F3 -. 统计/评估疑点 .-> X
  G -. 证据链/漏洞定位 .-> X
  H -. 术语对齐/指标统一 .-> X
