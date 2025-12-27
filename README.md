# FastPaperRead 📚

> 科研论文智能阅读平台 —— 让每篇论文都值得深读

FastPaperRead 是一款面向科研人员的 AI 驱动论文阅读工具。通过结构化解析、智能增强和知识资产化，将论文阅读从"被动浏览"转变为"主动构建"，显著提升阅读效率和知识留存率。

## ✨ 核心特性

### 📖 智能阅读流程
- **快速筛选 (Skim)** - 3-7分钟生成 SkimCard，快速判断是否值得深读
- **深度阅读 (Deep Read)** - 结构化路线规划，AI 辅助理解难点
- **审稿模式 (Review)** - 自动生成结构化审稿意见
- **对比模式 (Compare)** - 多论文横向对比，发现异同

### 🎯 锚点系统
- 自动提取章节、段落、图表、公式、引用
- 选中文本即可获取 AI 解释
- 所有内容可追溯至原文位置

### 📝 知识资产化
- **SkimCard** - 研究问题、贡献、证据强度、风险提示
- **EvidenceCard** - 主张-证据对，带强度评估
- **MethodCard** - 方法复原，输入/输出/流程/复杂度
- **ReproChecklist** - 复现清单，缺失项自动标记

### 🔧 增强引擎
- 术语解释（三层深度：一句话/通俗/严格）
- 公式解读（符号表 + 推导思路）
- 图表分析（关键发现 + 局限性）
- 缺失细节查找

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Library │ │ Reader  │ │ Compare │ │ Review  │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────────────────┤
│                    Backend (FastAPI)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Parser  │ │ Enhancer│ │  CRUD   │ │ Export  │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────────────────┤
│           Storage: SQLite/PostgreSQL + Files           │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求
- Python 3.11+
- Node.js 18+
- LLM API Key (DeepSeek / OpenAI / Qwen)

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/FastPaperRead.git
cd FastPaperRead
```

### 2. 配置环境变量
```bash
cp env.example .env
```

编辑 `.env` 文件：
```env
# LLM配置 (任选一个)
LLM_API_KEY=sk-your-api-key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# 搜索 (可选)
TAVILY_API_KEY=tvly-your-key
```

### 3. 启动后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3.1 配置 MinerU（可选，推荐）

MinerU 提供高质量的 PDF 解析，能准确识别章节、公式、图表等结构：

```bash
# 运行安装脚本
chmod +x scripts/setup_mineru.sh
./scripts/setup_mineru.sh

# 或手动安装
pip install mineru
mineru-models-download
```

> 📖 详细配置指南：[docs/MinerU配置指南.md](docs/MinerU配置指南.md)

### 4. 启动前端
```bash
cd frontend
npm install
npm run dev
```

### 5. 访问应用
打开浏览器访问 `http://localhost:3000`

### Docker 一键启动 (可选)
```bash
docker-compose up -d
```

### Docker 单容器部署（前端 + 后端 + PostgreSQL）

使用项目根目录下的 `Dockerfile` 可以构建一个包含前端、后端与内置 PostgreSQL 的单镜像：

```bash
# 构建镜像（可按需覆盖 API 地址）
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 \
  -t fastpaperread:all-in-one .

# 运行容器（暴露前端3000、后端8000、数据库5432）
docker run -d \
  --name fastpaperread \
  -p 3000:3000 \
  -p 8000:8000 \
  -p 5432:5432 \
  --env-file .env \
  -v fastpaperread_pg:/data/postgres \
  fastpaperread:all-in-one
```

- 默认数据库：`postgres/postgres`，库名 `fastpaperread`，可用 `POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB` 覆盖；`DATABASE_URL` 会自动指向容器内数据库。  
- `NEXT_PUBLIC_API_URL` 会在构建时写入前端，如需指向其他域名/端口请重新 `docker build --build-arg ...`。  
- 上传/输出目录默认在容器内 `/app/backend/uploads`、`/app/backend/output`，需要持久化可额外挂载卷。

## 📁 项目结构

```
FastPaperRead/
├── backend/                 # FastAPI 后端
│   └── app/
│       ├── api/v1/         # API 端点
│       ├── core/           # LLM, 解析器
│       ├── crud/           # 数据库操作
│       ├── db/             # SQLAlchemy 模型
│       └── schemas/        # Pydantic schemas
├── frontend/               # Next.js 14 前端
│   └── src/
│       ├── app/           # 页面路由
│       ├── components/    # UI 组件
│       │   ├── cards/     # 卡片组件
│       │   ├── checklist/ # 复现清单
│       │   ├── common/    # 通用组件
│       │   ├── layout/    # 布局组件
│       │   ├── literature/# 文献地图
│       │   ├── queue/     # 待读队列
│       │   └── reader/    # 阅读器
│       ├── lib/           # 工具函数
│       ├── stores/        # Zustand 状态
│       └── types/         # TypeScript 类型
├── docs/                   # 设计文档
│   ├── prd.md             # 产品需求文档
│   ├── 技术架构.md         # 技术架构设计
│   ├── API接口设计.md      # API 接口文档
│   └── Milestone任务拆分.md # 开发计划
├── docker-compose.yml      # Docker 编排
└── env.example            # 环境变量模板
```

## 🔌 API 概览

| 模块 | 端点 | 功能 |
|------|------|------|
| Papers | `POST /api/v1/papers/upload` | 上传 PDF |
| Papers | `GET /api/v1/papers` | 论文列表 |
| Skim | `POST /api/v1/skim/{id}/generate` | 生成 SkimCard |
| Enhance | `POST /api/v1/enhance/term/{id}` | 术语解释 |
| Enhance | `POST /api/v1/enhance/figure/{id}` | 图表解释 |
| Compare | `POST /api/v1/compare/sets` | 创建对比集 |
| Review | `POST /api/v1/review/{id}/draft` | 生成审稿意见 |
| Export | `GET /api/v1/export/{id}/markdown` | 导出 Markdown |

## 🛠️ 技术栈

### 后端
- **FastAPI** - 高性能 Python Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **OpenAI SDK** - LLM 集成 (兼容 DeepSeek/Qwen)
- **MinerU** - 高质量 PDF 解析（推荐）/ PyMuPDF（备用）

### 前端
- **Next.js 14** - React 全栈框架
- **Tailwind CSS** - 原子化 CSS
- **Zustand** - 轻量状态管理
- **react-pdf** - PDF 渲染
- **Lucide Icons** - 图标库

### 支持的 LLM

| 服务 | 配置 | 推荐场景 |
|------|------|----------|
| DeepSeek | `api.deepseek.com` | 性价比最高 ⭐ |
| OpenAI | `api.openai.com` | 效果最好 |
| Qwen | `dashscope.aliyuncs.com` | 国内稳定 |

## 📖 使用流程

```
导入论文 → 快速阅读(Skim) → 决策 → 深度阅读(Deep Read) → 知识资产化
    │            │            │            │                 │
    │            ▼            │            ▼                 ▼
    │       SkimCard     ┌────┴────┐   创建卡片        导出/复用
    │                    │         │   复现清单
    │               归档/跳过   精读/对比/审稿
    └──────────────────────────────────────────────────────────
```

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🙏 致谢

- [MinerU](https://github.com/opendatalab/MinerU) - PDF 解析
- [Tavily](https://tavily.com/) - AI 搜索
- [DeepSeek](https://deepseek.com/) - LLM 服务

---

<p align="center">
  Made with ❤️ for Researchers
</p>
