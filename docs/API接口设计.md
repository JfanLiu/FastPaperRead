# API 接口设计文档

> ⚠️ **重要说明（2025-12-22 更新）**  
> 本文档已与当前代码实现对齐。**以代码为最终标准**。  
> 全量待办与排期请见：`docs/任务与时间_2025-12-22.md`

---

## 接口实现状态汇总

> ✅ = 已实现并可用 | 🔧 = 部分实现 | 📋 = 计划中

| 模块 | 接口路径 | 状态 | 备注 |
|------|----------|------|------|
| **Papers** | `POST /papers/upload` | ✅ | PDF 上传 |
| | `POST /papers/import` | ✅ | URL 导入（arXiv/DOI） |
| | `GET /papers` | ✅ | 支持 `skip/limit` 和 `page/limit` |
| | `GET /papers/{id}` | ✅ | 获取详情 |
| | `GET /papers/{id}/pdf` | ✅ | 获取 PDF 文件 |
| | `GET /papers/{id}/import-status` | ✅ | 获取导入状态 |
| | `GET /papers/stats` | ✅ | 统计信息 |
| | `GET /papers/stats/overview` | ✅ | 统计信息（兼容路径） |
| | `PATCH /papers/{id}` | ✅ | 更新论文 |
| | `DELETE /papers/{id}` | ✅ | 删除论文 |
| | `POST /papers/{id}/fetch-metadata` | ✅ | **新增** - 获取DOI/arXiv元数据 |
| | `POST /papers/lookup-metadata` | ✅ | **新增** - 预览元数据 |
| **Anchors** | `GET /anchors/paper/{id}` | ✅ | 获取锚点列表 |
| | `GET /anchors/paper/{id}/sections` | ✅ | 获取章节树 |
| | `GET /anchors/{id}` | ✅ | 获取单个锚点 |
| | `GET /anchors/{id}/cards` | ✅ | **新增** - 获取关联卡片 |
| | `PUT /anchors/{id}/read` | ✅ | 标记已读 |
| **Skim** | `POST /skim/{id}/generate` | ✅ | 生成 SkimCard（含质量评估） |
| | `GET /skim/{id}` | ✅ | 获取 SkimCard |
| | `GET /skim/{id}/quality` | ✅ | **新增** - 获取质量评估 |
| | `POST /skim/{id}/decision` | ✅ | 做出决策 |
| | `GET /skim/queue` | ✅ | 获取待读队列 |
| | `POST /skim/queue/{id}` | ✅ | 加入队列 |
| | `DELETE /skim/queue/{id}` | ✅ | 从队列移除 |
| | `GET /skim/{id}/key-figures` | ✅ | 获取关键图表 |
| **Cards** | `POST /cards` | ✅ | 创建卡片 |
| | `POST /cards/from-anchor` | ✅ | 从锚点创建 |
| | `GET /cards/paper/{id}` | ✅ | 获取论文卡片 |
| | `GET /cards/{id}` | ✅ | 获取卡片详情 |
| | `GET /cards/{id}/anchors` | ✅ | **新增** - 获取关联锚点 |
| | `POST /cards/{id}/link-anchor` | ✅ | **新增** - 关联锚点 |
| | `DELETE /cards/{id}/unlink-anchor/{anchor_id}` | ✅ | **新增** - 取消关联 |
| | `PUT /cards/{id}` | ✅ | 更新卡片 |
| | `DELETE /cards/{id}` | ✅ | 删除卡片 |
| | `POST /cards/search` | ✅ | 搜索卡片（关键词） |
| | `POST /cards/semantic-search` | ✅ | **新增** - 语义搜索 |
| | `GET /cards/vector-store/stats` | ✅ | **新增** - 向量存储统计 |
| | `POST /cards/vector-store/rebuild` | ✅ | **新增** - 重建索引 |
| | `PUT /cards/{id}/finalize` | ✅ | 定稿卡片 |
| **Checklist** | `GET /checklist/templates` | ✅ | 获取模板 |
| | `POST /checklist/{id}/generate` | ✅ | 生成清单 |
| | `GET /checklist/{id}` | ✅ | 获取清单 |
| | `PUT /checklist/{id}/item/{item_id}` | ✅ | 更新清单项 |
| | `POST /checklist/{id}/verdict` | ✅ | 设置判定 |
| **Enhance** | `POST /enhance` | ✅ | 增强内容 |
| | `POST /enhance/batch` | ✅ | 批量增强 |
| | `POST /enhance/missing-details/scan` | ✅ | 扫描缺失细节 |
| **Export** | `POST /export` | ✅ | 统一导出入口 |
| | `GET /export/{id}/markdown` | ✅ | 导出 Markdown |
| | `GET /export/{id}/json` | ✅ | 导出 JSON |
| | `GET /export/{id}/bibtex` | ✅ | 导出 BibTeX |
| | `GET /export/paper/{id}/bibtex` | ✅ | 兼容路径 |
| | `GET /export/paper/{id}/notes` | ✅ | 导出笔记 |
| | `POST /export/batch/markdown` | ✅ | 批量导出 |
| **Compare** | `POST /compare/sets` | ✅ | 创建集合（数据库存储） |
| | `GET /compare/sets` | ✅ | 获取集合列表 |
| | `GET /compare/sets/{id}` | ✅ | 获取集合详情 |
| | `PUT /compare/sets/{id}` | ✅ | 更新集合 |
| | `DELETE /compare/sets/{id}` | ✅ | 删除集合 |
| | `POST /compare/sets/{id}/papers/{paper_id}` | ✅ | 添加论文 |
| | `DELETE /compare/sets/{id}/papers/{paper_id}` | ✅ | 移除论文 |
| | `POST /compare/sets/{id}/matrix` | ✅ | 生成矩阵 |
| **Review** | `POST /review/{id}/draft` | ✅ | 生成草稿（数据库存储） |
| | `GET /review/{id}/draft` | ✅ | 获取草稿 |
| | `PUT /review/{id}/draft` | ✅ | 更新草稿 |
| | `POST /review/{id}/feedback` | ✅ | 提交反馈 |
| | `GET /review/{id}/export-review` | ✅ | 导出审稿 |
| **Analytics** | `POST /analytics/track` | ✅ | **新增** - 记录事件 |
| | `POST /analytics/track/batch` | ✅ | **新增** - 批量记录 |
| | `GET /analytics/stats` | ✅ | **新增** - 统计看板 |
| | `GET /analytics/stats/paper/{id}` | ✅ | **新增** - 论文分析 |
| | `GET /analytics/report` | ✅ | **新增** - 使用报告 |
| | `GET /analytics/events` | ✅ | **新增** - 事件列表 |
| | `GET /analytics/event-types` | ✅ | **新增** - 事件类型 |
| | `GET /analytics/dashboard` | ✅ | **新增** - 仪表盘 |
| **WebSocket** | `WS /ws/papers/{id}/progress` | ✅ | 解析进度推送 |
| | `WS /ws/enhance/{id}` | ✅ | 增强流式推送 |

---

## 概述

FastPaperRead API 采用 RESTful 设计，基于 FastAPI 框架实现。

- **基础URL**: `http://localhost:8000/api/v1`
- **认证方式**: Bearer Token (后续实现)
- **响应格式**: JSON

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "PAPER_NOT_FOUND",
    "message": "论文不存在",
    "details": { "paper_id": "xxx" }
  }
}
```

### 分页响应

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "has_more": true
}
```

---

## 1. 论文管理 (`/papers`)

### 1.1 导入论文

```
POST /papers/import
```

**请求体**:
```json
{
  "pdf_url": "https://arxiv.org/pdf/xxx.pdf",
  "doi": "10.1234/xxx",
  "arxiv_id": "2301.00001",
  "title": "Paper Title",
  "authors": ["Author One", "Author Two"],
  "year": 2024
}
```

**响应**:
```json
{
  "paper_id": "uuid",
  "job_id": "uuid",
  "status": "pending",
  "message": "论文导入任务已创建",
  "metadata": {
    "title": "Paper Title",
    "authors": ["Author One"],
    "year": 2024,
    "source": "arxiv"
  }
}
```

### 1.2 获取元数据（预览）

```
POST /papers/lookup-metadata?url=https://arxiv.org/abs/2301.00001
```

**响应**:
```json
{
  "metadata": {
    "title": "Paper Title",
    "authors": ["Author One", "Author Two"],
    "year": 2024,
    "abstract": "...",
    "venue": "arXiv"
  },
  "source_type": "arxiv"
}
```

### 1.3 刷新元数据

```
POST /papers/{paper_id}/fetch-metadata
```

**响应**:
```json
{
  "message": "Metadata updated successfully",
  "paper": {...}
}
```

### 1.4 上传PDF

```
POST /papers/upload
Content-Type: multipart/form-data
```

**请求体**: `file` (PDF文件)

**响应**: 同上

### 1.5 获取导入状态

```
GET /papers/{paper_id}/import-status
```

> 注：使用 `paper_id` 而非 `job_id`，简化前端调用

**响应**:
```json
{
  "paper_id": "uuid",
  "status": "running",        // running/completed/failed
  "paper_status": "parsing",  // 实际论文状态
  "progress": 0.5,
  "current_step": "解析PDF中..."
}
```

### 1.6 获取论文列表

```
GET /papers?page=1&limit=20&status=unread&quality=A
GET /papers?skip=0&limit=20&status=unread  # 兼容格式
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码（从1开始），与 skip 二选一 |
| skip | int | 跳过数量，与 page 二选一 |
| limit | int | 每页数量（默认20，最大100） |
| status | string | 状态筛选 (importing/parsing/unread/skimmed/deepread/archived) |
| quality | string | 质量筛选 (A/B/C/D) |
| search | string | 关键词搜索 |

**响应**:
```json
{
  "papers": [...],  // 兼容旧格式
  "items": [...],   // 新格式
  "total": 100,
  "skip": 0,
  "limit": 20,
  "page": 1
}
```

### 1.7 获取论文详情

```
GET /papers/{paper_id}
```

### 1.8 更新论文

```
PUT /papers/{paper_id}
```

**请求体**:
```json
{
  "title": "New Title",
  "status": "skimmed",
  "quality_grade": "B",
  "read_progress": 50
}
```

### 1.9 删除论文

```
DELETE /papers/{paper_id}
```

### 1.10 获取论文统计

```
GET /papers/stats/overview
```

**响应**:
```json
{
  "total": 100,
  "unread": 30,
  "skimmed": 40,
  "deepread": 20,
  "archived": 10,
  "by_quality": {"A": 20, "B": 50, "C": 25, "D": 5},
  "by_year": {"2024": 30, "2023": 50, "2022": 20}
}
```

---

## 2. 锚点管理 (`/anchors`)

### 2.1 获取论文锚点

```
GET /anchors/paper/{paper_id}?type=figure&page=1
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 类型筛选 (paragraph/section/figure/table/equation/citation) |
| page | int | 页码筛选 |

**响应**:
```json
{
  "items": [
    {
      "id": "uuid",
      "paper_id": "uuid",
      "type": "figure",
      "page": 3,
      "bbox": {"x1": 0.1, "y1": 0.2, "x2": 0.9, "y2": 0.6},
      "section": "Method",
      "sequence": 15,
      "text": "Figure 1: Architecture overview",
      "caption": "Our proposed architecture...",
      "image_path": "/files/xxx/fig_1.png",
      "figure_number": "Figure 1",
      "card_ids": ["uuid1", "uuid2"]
    }
  ],
  "total": 20,
  "by_type": {"paragraph": 30, "figure": 5, "equation": 10}
}
```

### 2.2 获取锚点关联卡片

```
GET /anchors/{anchor_id}/cards
```

**响应**:
```json
{
  "anchor_id": "uuid",
  "cards": [...],
  "total": 3
}
```

### 2.3 获取章节树

```
GET /anchors/paper/{paper_id}/sections
```

**响应**:
```json
{
  "paper_id": "uuid",
  "sections": [
    {
      "id": "uuid",
      "title": "Introduction",
      "level": 1,
      "anchor_id": "uuid",
      "page": 1,
      "is_read": false,
      "is_must_read": true,
      "children": [
        {
          "id": "uuid",
          "title": "Background",
          "level": 2,
          "children": []
        }
      ]
    }
  ]
}
```

### 2.4 获取阅读路线

```
GET /anchors/paper/{paper_id}/routes/{route_name}
```

**路线名称**: `quick_repro` | `review` | `full` | `skim`

**响应**:
```json
{
  "name": "快速复现路线",
  "description": "快速了解方法和实验设置",
  "sections": [...],
  "estimated_time": 20,
  "total_sections": 4
}
```

### 2.5 获取单个锚点

```
GET /anchors/{anchor_id}
```

### 2.6 搜索锚点

```
POST /anchors/search
```

**请求体**:
```json
{
  "query": "attention mechanism",
  "types": ["paragraph", "equation"],
  "page_range": [1, 10],
  "limit": 20
}
```

### 2.7 标记锚点已读

```
PUT /anchors/{anchor_id}/read?is_read=true
```

---

## 3. 增强引擎 (`/enhance`)

### 3.1 增强内容

```
POST /enhance
```

**请求体**:
```json
{
  "paper_id": "uuid",
  "anchor_id": "uuid",
  "enhance_type": "term",
  "level": "plain",
  "selected_text": "attention mechanism",
  "use_cache": true
}
```

**增强类型**:
- `term`: 术语解释
- `equation`: 公式解释
- `figure`: 图表解释
- `paragraph`: 段落总结
- `missing_detail`: 缺失细节

**响应** (术语解释):
```json
{
  "enhance_type": "term",
  "anchor_id": "uuid",
  "term": {
    "term": "attention mechanism",
    "one_liner": "选择性关注输入的机制",
    "plain": "注意力机制就像人眼看东西一样，会重点关注某些部分...",
    "strict": "形式上，给定查询Q和键值对(K,V)，注意力权重α=softmax(QK^T/√d)...",
    "source_anchor_id": "uuid",
    "uncertainty": "from_text",
    "related_terms": ["self-attention", "multi-head attention"]
  },
  "cached": false,
  "processing_time_ms": 1200
}
```

### 3.2 批量增强

```
POST /enhance/batch
```

**请求体**:
```json
{
  "paper_id": "uuid",
  "items": [
    {"anchor_id": "uuid1", "enhance_type": "term", "level": "plain"},
    {"anchor_id": "uuid2", "enhance_type": "equation", "level": "strict"}
  ]
}
```

### 3.3 扫描缺失细节

```
POST /enhance/missing-details/scan
```

**请求体**:
```json
{
  "paper_id": "uuid",
  "categories": ["training", "data", "eval"],
  "full_scan": true
}
```

**响应**:
```json
{
  "paper_id": "uuid",
  "total_checked": 30,
  "missing_count": 5,
  "completeness_score": 83.3,
  "by_category": {
    "training": [
      {
        "category": "training",
        "detail_name": "学习率调度",
        "inferred_value": null,
        "confidence": "low",
        "source_hint": "查看Experiments章节",
        "needs_verify": true
      }
    ],
    "data": [...]
  },
  "suggested_sections": ["Method", "Appendix"]
}
```

---

## 4. 卡片管理 (`/cards`)

### 4.1 创建卡片

```
POST /cards
```

**请求体** (PaperCard):
```json
{
  "paper_id": "uuid",
  "type": "paper",
  "title": "论文总结",
  "content": "...",
  "source_anchor_ids": ["uuid1", "uuid2"],
  "uncertainty": "from_text",
  "tags": ["attention", "NLP"],
  "one_line_summary": "提出了新的注意力机制...",
  "contributions": ["贡献1", "贡献2"],
  "limitations": ["局限1"],
  "applicable_scope": "适用于..."
}
```

### 4.2 从锚点创建卡片

```
POST /cards/from-anchor
```

**请求体**:
```json
{
  "anchor_id": "uuid",
  "card_type": "evidence",
  "auto_generate": true
}
```

### 4.3 获取卡片关联锚点

```
GET /cards/{card_id}/anchors
```

**响应**:
```json
{
  "card_id": "uuid",
  "anchors": [...],
  "total": 2
}
```

### 4.4 关联锚点

```
POST /cards/{card_id}/link-anchor?anchor_id=uuid&link_type=reference
```

### 4.5 取消关联

```
DELETE /cards/{card_id}/unlink-anchor/{anchor_id}
```

### 4.6 获取论文卡片

```
GET /cards/paper/{paper_id}?type=evidence
```

### 4.7 获取卡片详情

```
GET /cards/{card_id}
```

### 4.8 更新卡片

```
PUT /cards/{card_id}
```

### 4.9 删除卡片

```
DELETE /cards/{card_id}
```

### 4.10 搜索卡片（关键词）

```
POST /cards/search
```

**请求体**:
```json
{
  "query": "attention",
  "types": ["paper", "evidence"],
  "tags": ["NLP"],
  "paper_ids": ["uuid1", "uuid2"],
  "status": "final",
  "limit": 20,
  "offset": 0
}
```

### 4.11 语义搜索

```
POST /cards/semantic-search?query=自注意力机制&limit=10
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| query | string | 搜索查询（必需） |
| limit | int | 结果数量（默认10，最大100） |
| paper_id | string | 限制特定论文 |
| types | list | 限制卡片类型 |

**响应**:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Self-Attention机制",
      "content": "...",
      "similarity_score": 0.89
    }
  ],
  "total": 5,
  "query": "自注意力机制",
  "search_type": "semantic"
}
```

### 4.12 向量存储统计

```
GET /cards/vector-store/stats
```

**响应**:
```json
{
  "available": true,
  "total_documents": 150,
  "collection_name": "cards"
}
```

### 4.13 重建向量索引

```
POST /cards/vector-store/rebuild
```

**响应**:
```json
{
  "message": "索引重建完成",
  "total_cards": 150,
  "indexed": 150
}
```

### 4.14 定稿卡片

```
PUT /cards/{card_id}/finalize
```

---

## 5. 粗读模式 (`/skim`)

### 5.1 生成SkimCard

```
POST /skim/{paper_id}/generate?force=false
```

**响应**:
```json
{
  "skim_card": {
    "research_question": "如何提高Transformer的效率？",
    "contributions": ["提出了线性复杂度的注意力", "在多个任务上SOTA"],
    "evidence_strength": "medium",
    "evidence_strength_reason": "只在3个数据集上验证",
    "red_flags": ["缺少消融实验", "仅在单个数据集上评估"],
    "recommended_route": "review",
    "recommended_sections": ["Method", "Experiments"],
    "key_figures": ["uuid_fig1", "uuid_fig2"]
  },
  "quality": {
    "overall_score": 72.5,
    "grade": "B",
    "dimensions": {
      "methodology": 70,
      "evidence": 70,
      "completeness": 75,
      "clarity": 80
    },
    "red_flags": [
      {
        "type": "no_ablation",
        "message": "缺少消融实验",
        "severity": "medium"
      }
    ],
    "suggestions": ["关注论文是否与相关工作进行了公平比较"]
  },
  "cached": false
}
```

### 5.2 获取SkimCard

```
GET /skim/{paper_id}
```

### 5.3 获取质量评估

```
GET /skim/{paper_id}/quality
```

**响应**:
```json
{
  "paper_id": "uuid",
  "quality": {
    "overall_score": 72.5,
    "grade": "B",
    "dimensions": {...},
    "red_flags": [...],
    "suggestions": [...]
  },
  "current_grade": "B"
}
```

### 5.4 做出阅读决策

```
POST /skim/{paper_id}/decision
```

**请求体** (归档):
```json
{
  "decision": "archive",
  "archive_reasons": ["not_relevant", "weak_evidence"],
  "archive_note": "不是我的研究方向"
}
```

**请求体** (加入队列):
```json
{
  "decision": "queue",
  "queue_priority": "high",
  "estimated_time": 30,
  "reading_goal": "method"
}
```

**响应**:
```json
{
  "paper_id": "uuid",
  "decision": "queue",
  "status": "skimmed",
  "message": "论文已加入待读队列",
  "next_action": "查看待读队列"
}
```

### 5.5 获取关键图表

```
GET /skim/{paper_id}/key-figures?limit=5
```

**响应**:
```json
{
  "paper_id": "uuid",
  "figures": [
    {
      "anchor_id": "uuid",
      "type": "figure",
      "page": 3,
      "figure_number": "Figure 1",
      "caption": "Architecture overview...",
      "image_path": "/files/xxx/fig_1.png",
      "section": "Method"
    }
  ],
  "total": 8,
  "returned": 5
}
```

### 5.6 获取待读队列

```
GET /skim/queue?limit=50
```

**响应**:
```json
{
  "items": [
    {
      "queue_id": "uuid",
      "paper_id": "uuid",
      "title": "Paper Title",
      "authors": ["Author One"],
      "year": 2024,
      "status": "skimmed",
      "quality_grade": "A",
      "priority": 5,
      "note": "重点阅读方法部分",
      "added_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 10
}
```

### 5.7 加入待读队列

```
POST /skim/queue/{paper_id}?priority=5&note=重点阅读
```

### 5.8 从队列移除

```
DELETE /skim/queue/{paper_id}
```

---

## 6. 对比模式 (`/compare`)

### 6.1 创建对比集合

```
POST /compare/sets
```

**请求体**:
```json
{
  "name": "注意力机制对比",
  "description": "对比不同注意力机制的性能",
  "paper_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**响应**:
```json
{
  "id": "uuid",
  "name": "注意力机制对比",
  "paper_ids": ["uuid1", "uuid2", "uuid3"],
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 6.2 获取对比集合列表

```
GET /compare/sets
```

### 6.3 获取对比集合详情

```
GET /compare/sets/{set_id}
```

### 6.4 更新对比集合

```
PUT /compare/sets/{set_id}
```

### 6.5 删除对比集合

```
DELETE /compare/sets/{set_id}
```

### 6.6 添加论文到集合

```
POST /compare/sets/{set_id}/papers/{paper_id}
```

### 6.7 从集合移除论文

```
DELETE /compare/sets/{set_id}/papers/{paper_id}
```

### 6.8 生成对比矩阵

```
POST /compare/sets/{set_id}/matrix
```

**响应**:
```json
{
  "compare_set_id": "uuid",
  "headers": ["论文", "方法", "数据集", "主要指标", "复现性"],
  "rows": [
    {
      "paper_id": "uuid1",
      "title": "Paper A",
      "method": "Self-Attention",
      "dataset": "GLUE",
      "metric": "Acc: 89.2%",
      "reproducibility": "完整"
    }
  ],
  "conflicts": [
    {
      "type": "metric_conflict",
      "papers": ["uuid1", "uuid2"],
      "description": "同一数据集上报告的baseline结果不一致"
    }
  ]
}
```

---

## 7. 审稿模式 (`/review`)

### 7.1 生成审稿草稿

```
POST /review/{paper_id}/draft
```

**响应**:
```json
{
  "id": "uuid",
  "paper_id": "uuid",
  "summary": "本文提出了...",
  "strengths": ["创新性强", "实验充分"],
  "weaknesses": ["缺少消融实验"],
  "questions": ["请补充超参数说明"],
  "recommendation": "weak_accept",
  "scores": {
    "novelty": 3,
    "novelty_reason": "方法有一定新意...",
    "soundness": 3,
    "clarity": 4,
    "significance": 3,
    "reproducibility": 2,
    "total": 3.0
  },
  "generated_at": "2024-01-01T00:00:00Z"
}
```

### 7.2 获取审稿草稿

```
GET /review/{paper_id}/draft
```

### 7.3 更新审稿草稿

```
PUT /review/{paper_id}/draft
```

**请求体**:
```json
{
  "summary": "更新后的总结",
  "strengths": ["更新后的优点"],
  "recommendation": "accept"
}
```

### 7.4 提交反馈

```
POST /review/{paper_id}/feedback
```

**请求体**:
```json
{
  "feedback": "建议增加更多实验对比",
  "type": "suggestion"
}
```

### 7.5 导出审稿报告

```
GET /review/{paper_id}/export-review?format=markdown
```

---

## 8. 导出 (`/export`)

### 8.1 通用导出

```
POST /export
```

**请求体**:
```json
{
  "object_type": "cards",
  "object_ids": ["uuid1", "uuid2"],
  "format": "markdown",
  "include_sources": true
}
```

**对象类型**: `skim_card` | `cards` | `checklist` | `review` | `compare`

**格式**: `markdown` | `json` | `bibtex`

### 8.2 导出BibTeX

```
GET /export/paper/{paper_id}/bibtex
```

### 8.3 导出论文笔记

```
GET /export/paper/{paper_id}/notes?format=markdown
```

---

## 9. 统计分析 (`/analytics`)

### 9.1 记录事件

```
POST /analytics/track
```

**请求体**:
```json
{
  "event_type": "paper_action",
  "event_name": "paper_upload",
  "paper_id": "uuid",
  "properties": {"source": "arxiv"},
  "page": "home",
  "session_id": "uuid"
}
```

**事件类型**:
- `page_view`: 页面浏览
- `user_action`: 用户操作
- `paper_action`: 论文操作
- `card_action`: 卡片操作
- `system`: 系统事件
- `performance`: 性能指标

### 9.2 批量记录

```
POST /analytics/track/batch
```

**请求体**:
```json
{
  "events": [
    {"event_type": "page_view", "event_name": "view_home"},
    {"event_type": "paper_action", "event_name": "paper_upload", "paper_id": "uuid"}
  ]
}
```

### 9.3 获取统计看板

```
GET /analytics/stats?days=30
```

**响应**:
```json
{
  "summary": {
    "total_papers": 100,
    "total_cards": 500,
    "total_reviews": 20,
    "total_events": 5000,
    "active_papers": 30,
    "date_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T00:00:00Z"
    }
  },
  "paper_status_distribution": {
    "unread": 30,
    "skimmed": 40,
    "deepread": 20,
    "archived": 10
  },
  "card_type_distribution": {
    "paper": 100,
    "evidence": 200,
    "method": 150,
    "note": 50
  },
  "event_type_distribution": {
    "page_view": 2000,
    "paper_action": 1500,
    "card_action": 1000
  },
  "top_events": [
    {"event_name": "view_home", "count": 500},
    {"event_name": "paper_upload", "count": 100}
  ],
  "daily_trend": [
    {"date": "2024-01-01", "count": 150},
    {"date": "2024-01-02", "count": 200}
  ]
}
```

### 9.4 获取论文分析

```
GET /analytics/stats/paper/{paper_id}
```

**响应**:
```json
{
  "paper_id": "uuid",
  "event_count": 50,
  "event_breakdown": {
    "view_read": 20,
    "card_create": 10,
    "enhance_request": 20
  },
  "card_count": 5,
  "recent_events": [...]
}
```

### 9.5 获取使用报告

```
GET /analytics/report?days=7
```

**响应**:
```json
{
  "period": "last_7_days",
  "new_papers": 10,
  "completed_papers": 5,
  "event_summary": {
    "view_home": 100,
    "paper_upload": 10,
    "card_create": 25
  }
}
```

### 9.6 获取仪表盘

```
GET /analytics/dashboard
```

**响应**:
```json
{
  "today": {
    "events": 50,
    "papers": 2,
    "cards": 10
  },
  "totals": {
    "papers": 100,
    "cards": 500,
    "reviews": 20,
    "pending_papers": 30
  },
  "weekly_trend": [
    {"date": "2024-01-01", "count": 150}
  ]
}
```

### 9.7 获取事件列表

```
GET /analytics/events?event_type=paper_action&limit=50
```

### 9.8 获取事件类型定义

```
GET /analytics/event-types
```

---

## 10. WebSocket接口

### 10.1 解析进度推送

```
WS /ws/papers/{paper_id}/progress
```

**消息格式**:
```json
{
  "type": "progress",
  "paper_id": "uuid",
  "progress": 60,
  "step": "extract_figures",
  "message": "正在提取图表...",
  "status": "running",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 10.2 增强结果流式推送

```
WS /ws/enhance/{request_id}
```

**消息格式**:
```json
{
  "type": "chunk",
  "content": "这个术语的含义是..."
}
```

```json
{
  "type": "complete",
  "full_response": {...}
}
```

---

## 错误码参考

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| PAPER_NOT_FOUND | 404 | 论文不存在 |
| ANCHOR_NOT_FOUND | 404 | 锚点不存在 |
| CARD_NOT_FOUND | 404 | 卡片不存在 |
| JOB_NOT_FOUND | 404 | 任务不存在 |
| INVALID_FILE_TYPE | 400 | 文件类型不支持 |
| PARSE_FAILED | 500 | 解析失败 |
| LLM_ERROR | 503 | LLM服务异常 |
| RATE_LIMITED | 429 | 请求过于频繁 |
| VECTOR_STORE_UNAVAILABLE | 503 | 向量存储不可用 |

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 2.1.0 | 2025-12-22 | 新增语义搜索、质量评估、埋点统计、元数据获取、卡片-锚点关联API |
| 2.0.0 | 2025-12-22 | WebSocket实现、Compare/Review数据库持久化 |
| 1.0.0 | 2025-12-20 | 初始版本 |
