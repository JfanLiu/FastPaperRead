# PRD：面向科研人的 AI 论文阅读与知识资产化平台

## 1. 背景与问题

### 1.1 背景

科研人员阅读论文的目标不是“看完”，而是做研究决策并产出：选题、方案设计、复现、写 related work、审稿与组会分享。现有工具普遍停留在“摘要/翻译/问答”，缺乏 **可追溯证据链**、**结构化产物**与 **跨论文对比**。

### 1.2 核心痛点

* **信息过载**：检索到很多但难以判断“值不值得读”
* **读不懂/缺背景**：术语、公式、方法细节、图表含义难理解
* **读了记不住**：缺少可检索、可复用的笔记资产
* **读了用不上**：难转化为实验复现清单、写作素材、对比观点
* **缺少批判性评估**：不像审稿人那样评价证据强度与漏洞

---

## 2. 产品目标与成功定义

### 2.1 产品目标（北极星）

将论文阅读从“线性阅读”升级为 **工作流 + 证据链 + 可复用资产**：

1. 更快筛到值得读的论文
2. 更快读懂（补背景、读图、读公式、补缺失细节）
3. 更快沉淀结构化产物（卡片、复现清单、审稿报告、对比矩阵）
4. 更快复用到写作/实验/组会/审稿

### 2.2 MVP 成功指标（量化）

* Skim 决策效率：从导入到“读/不读”决策的中位时间下降（目标：< 7 分钟/篇）
* 资产产出率：精读完成后至少生成 2 张卡片 + 1 份 ReproChecklist（目标：>60% 精读会话）
* 复用率：写作/导出行为（Markdown/Docx）发生率（目标：>30% 周活跃用户）
* 留存：7 日留存 / 28 日留存（MVP 目标：以可用性为先，后续再优化）

---

## 3. 目标用户与场景

### 3.1 用户画像

* A：博士新手/转方向者（读不懂、缺背景）
* B：论文产出期博士/博后（要复现、要写作、要对比）
* C：PI/审稿人（要快速评价、找漏洞、提问题）

### 3.2 典型使用场景

* 组会前快速吃透一篇 paper 并输出讲稿要点/问题清单
* 开题/综述：构建文献地图，比较不同路线优缺点
* 复现实验：快速抽取数据切分、指标、超参、环境信息
* 投稿前：用审稿人视角对自己的方向/对标论文做严格评估

---

## 4. 产品范围与版本规划

### 4.1 MVP（第一阶段必须上线）

* 导入解析：PDF/DOI/arXiv/URL
* Paper Overview（粗读）：SkimCard + 决策（归档/队列/精读）
* Deep Read（精读）：PDF+结构化视图 + 右侧增强引擎（术语/公式/图表/缺失细节）
* 结构化产物：PaperCard / EvidenceCard / ReproChecklist（最少三类）
* 导出：Markdown（MVP）+（可选）Docx

### 4.2 V1（第二阶段增强差异化）

* Compare：对比集合 + 归一化 + 对比矩阵（基础）
* Reviewer：审稿报告模板（基于 Evidence/Checklist）
* Notes：笔记库检索与聚合（按方法/数据集/主题）

### 4.3 V2（第三阶段）

* 文献检索+质量过滤（更完整）
* ConflictMap（结论冲突图谱）
* 工作流自动化：间隔复习、写作骨架生成、项目空间协作

### 4.4 Out of Scope（明确不做/后做）

* 代替用户完成论文写作（仅提供“可改写骨架”，不输出可直接抄的段落）
* 自动保证复现成功（只提供复现信息抽取与缺失提醒）
* 复杂的 OCR/图片型PDF 支持（如需，放到后续）

---

## 5. 核心体验：模块2与模块3的关系（产品原则）

* **模块3（结构化阅读）**：主流程（粗读→精读→笔记/清单）
* **模块2（阅读增强引擎）**：随处可调用的“子流程”，对选中锚点即时解释与补全

> 用户只感知“我在粗读/精读/做笔记”，增强引擎在右侧 Panel 随叫随到。

---

## 6. 用户旅程与关键流程（E2E）

### 6.1 论文阅读闭环（MVP）

1. Import → 解析章节/图表/公式锚点
2. Overview：生成 SkimCard → 做阅读决策
3. Deep Read：按路线读 → 随时调用 Enhance → 生成卡片/复现清单
4. Notes/Export：导出资产用于写作/复现/组会

### 6.2 中断恢复

* Pause 会记录 `last_anchor + right_panel_tab + route_progress`
* 下次进入展示 ResumeBanner：一键回到上次位置继续

---

## 7. 功能需求（Functional Requirements）

### 7.1 导入与解析（FR-IMPORT）

**输入**：PDF / DOI / arXiv / URL
**输出**：Paper 对象 + anchors（段落/图/表/公式）

* FR-IMPORT-1：支持上传 PDF；支持粘贴 DOI/arXiv/URL
* FR-IMPORT-2：自动抽取元数据（标题、作者、年份、venue）；允许手动修改
* FR-IMPORT-3：解析结构：

  * 章节树（sections）
  * 参考文献（refs）
  * 图表列表（figures）含 caption 与页码定位
  * 公式列表（equations）含符号抽取（最低限：文本+位置）
* FR-IMPORT-4：失败处理（加密/无文本层/解析异常）：展示错误码+重试方案

**验收标准**

* 90% 机器可读 PDF 能在 60 秒内完成基础解析并可定位图表锚点（可先用经验值）

---

### 7.2 Paper Overview（粗读）（FR-SKIM）

**目标**：3–7 分钟内完成“值不值得精读”的决策。

* FR-SKIM-1：一键生成 SkimCard，包含：

  * Research Question（研究问题）
  * Contributions（3–5条）
  * Evidence Strength（强/中/弱 + 理由）
  * Red Flags（统计/评估/复现风险）
  * Recommended Route（建议先读章节/关键图）
* FR-SKIM-2：决策按钮：

  * Archive（需选择原因标签）
  * Add to Queue（优先级+估时）
  * Start Deep Read（可弹路线选择）
* FR-SKIM-3：Key Figures Strip：显示关键图缩略；点击打开图查看并可 Explain/生成卡片

**验收标准**

* 用户能在 Overview 页面完成：归档/加入队列/进入精读 三选一
* 每个 SkimCard 条目可点回原文锚点（至少支持图表/摘要锚点）

---

### 7.3 Deep Read（精读阅读器）（FR-DEEPREAD）

**目标**：按“路线”读论文，边读边产出结构化资产。

* FR-DEEPREAD-1：SplitView：

  * PDF Viewer（高亮/批注/跳转）
  * Structured View（章节摘要、方法块、实验块）
* FR-DEEPREAD-2：RoutePlanner：

  * 默认给 2–3 条路线模板（快速复现/审稿/全文）
  * 用户可自定义必读章节与关键图
* FR-DEEPREAD-3：Selection Toolbar（选中文本/图/公式浮条）支持：

  * Explain（触发增强）
  * Create EvidenceCard
  * Add to ReproChecklist
  * Quote snippet（生成“可改写引用骨架”，不直接复制原句）
* FR-DEEPREAD-4：Evidence Ledger（主张-证据台账）：

  * 自动从总结/结论段生成初稿（可编辑）
  * 每条 claim 绑定证据锚点与强度评级
* FR-DEEPREAD-5：Pause/Resume：中断恢复回到 anchor

**验收标准**

* 用户能从选中段落一键生成 EvidenceCard，并自动带来源锚点
* ReproChecklist 至少支持 Data/Training/Eval/Env 四类条目

---

### 7.4 阅读增强引擎（模块2）（FR-ENHANCE）

**目标**：降低理解成本，但保持科研严谨与可追溯。

* FR-ENHANCE-1：TermExplainer（三层解释）

  * 一句话 / 通俗 / 严格
* FR-ENHANCE-2：FigureExplainer

  * 图想证明什么？
  * 是否充分支持结论？
  * 替代解释/潜在混杂因素
* FR-ENHANCE-3：EquationExplainer

  * 符号表、关键假设、推导要点（可简化）
* FR-ENHANCE-4：MissingDetailFinder

  * 自动提示复现关键字段缺失（如 split/超参/统计检验）
  * 对推测补全必须标注“推测/需确认”，并给“需要回原文确认的清单”

**验收标准**

* Enhance 输出必须可回溯到 anchor（来源、或标注“推测”）
* 三层解释可随时切换，默认通俗版

---

### 7.5 结构化资产与笔记（FR-ASSETS）

**目标**：把阅读产物变成可检索知识库。

* FR-ASSETS-1：卡片类型（MVP）

  * PaperCard：一句话贡献、3要点、2局限、适用边界
  * EvidenceCard：Claim→Evidence→Uncertainty→Risks
  * ReproChecklist：复现要点+缺失项
* FR-ASSETS-2：Notes 库

  * 搜索：关键词/方法/数据集/标签/论文
  * 导出：Markdown（MVP）
* FR-ASSETS-3：每张卡都保存：

  * 来源 paper_id + anchor_id
  * 不确定性标签（原文/推测/需确认）
  * 最近编辑时间

---

### 7.6 导出（FR-EXPORT）

* FR-EXPORT-1：导出对象：SkimCard / Cards / Checklist
* FR-EXPORT-2：格式：Markdown（MVP）
* FR-EXPORT-3：导出内容带引用信息（标题、作者、年份、venue、锚点链接/页码）

---

## 8. 非功能性需求（NFR）

### 8.1 可信与可追溯（最高优先级）

* 任何生成内容必须标注来源或明确标注“推测”
* 允许用户纠错：对某条解释/卡片标记“不准确”并编辑

### 8.2 性能

* 打开已解析论文：首屏 < 2s（目标）
* Skim 生成：可后台跑；UI 有进度与可离开提示
* DeepRead 操作（选中文本→打开增强）：< 500ms 级响应（可用缓存/渐进加载）

### 8.3 隐私与合规（原则）

* 用户上传论文与笔记默认私有
* 导出不包含未经用户确认的敏感注释（可配置）

---

## 9. 数据模型（Schema，工程落地用）

（示例为概念结构，字段可裁剪）

```json
{
  "Paper": {
    "paper_id": "string",
    "title": "string",
    "authors": ["string"],
    "year": 2025,
    "venue": "string",
    "source": {"type": "pdf|doi|arxiv|url", "value": "string"},
    "status": "unread|skimmed|deepread|archived",
    "anchors": ["anchor_id"],
    "created_at": "iso",
    "updated_at": "iso"
  },
  "Anchor": {
    "anchor_id": "string",
    "paper_id": "string",
    "type": "paragraph|figure|table|equation",
    "section": "string",
    "page": 12,
    "bbox": [0,0,1,1],
    "text": "string",
    "caption": "string"
  },
  "Card": {
    "card_id": "string",
    "paper_id": "string",
    "type": "PaperCard|EvidenceCard|MethodCard",
    "title": "string",
    "content": "markdown",
    "source_anchors": ["anchor_id"],
    "uncertainty": "from_text|inferred|needs_verify",
    "tags": ["string"],
    "status": "draft|final",
    "updated_at": "iso"
  },
  "ReproChecklist": {
    "paper_id": "string",
    "items": [
      {"group": "Data|Training|Eval|Env", "text": "string", "source_anchor": "anchor_id", "missing": false, "needs_verify": false}
    ]
  }
}
```

---

## 10. 埋点与分析（Analytics）

### 10.1 核心事件（MVP）

* `paper_import_started/succeeded/failed`
* `skim_generated`
* `skim_decision_made`（archive|queue|deepread + reason_tags）
* `deepread_started/paused/resumed/completed`
* `enhance_panel_opened`（term|figure|equation|missing_detail）
* `card_created`（card_type）
* `checklist_item_added`
* `export_triggered`（object_type, format）

### 10.2 指标看板（建议）

* 阅读漏斗：Import→Skim→Decision→DeepRead→Assets→Export
* 资产产出：人均卡片数/篇、Checklist 完整度分布
* Enhance 使用：触发类型占比（术语/图/公式/缺失）
* 留存：按“产生资产的用户 vs 不产生资产的用户”分层

---

## 11. 风险与对策

1. **幻觉/不可信**：增强或总结出现错误

* 对策：强制锚点/证据链；推测标注；用户纠错入口；不确定性标签

2. **用户只想“快摘要”**导致产品被当成普通总结器

* 对策：默认导向“决策+资产”；摘要只是入口，核心是卡片/清单/对比

3. **解析质量不稳（PDF复杂）**

* 对策：降级策略：章节树不全也能用；图表锚点优先；错误码+重试

4. **过重工作流导致上手门槛高**

* 对策：MVP 只保留三步：导入→粗读决策→精读产出；其余隐藏为高级功能

---

## 12. MVP 验收清单（Go/No-Go）

* [ ] 论文导入后可打开 Overview，并能生成 SkimCard
* [ ] Overview 能完成 Archive/Queue/DeepRead 决策
* [ ] DeepRead 支持：PDF查看、选中内容浮条、右侧 Enhance
* [ ] 能一键生成 EvidenceCard，并含来源锚点
* [ ] 能生成并编辑 ReproChecklist（至少四组）
* [ ] 能导出 Markdown（卡片+清单+引用信息）
* [ ] Pause/Resume 可恢复到上次锚点
* [ ] 基础埋点可在看板看到漏斗（至少本地/日志级）

---

## 13. 里程碑建议（不含时间承诺，仅分阶段交付）

* Milestone 1：Import+Parse（anchors）+ Overview（SkimCard）
* Milestone 2：DeepRead（SplitView+Enhance+Cards+Checklist+Resume）
* Milestone 3：Notes库 + Export Markdown + Analytics看板
* Milestone 4（V1）：Compare/Reviewer 基础版