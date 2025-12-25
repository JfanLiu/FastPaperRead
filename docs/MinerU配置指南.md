# MinerU PDF 解析器配置指南

> MinerU 是一个高质量的 PDF 文档结构化解析工具，能够准确提取论文的章节、公式、图表等结构化信息。

## 📋 目录

- [为什么使用 MinerU](#为什么使用-mineru)
- [安装方式](#安装方式)
- [模型下载](#模型下载)
- [配置文件](#配置文件)
- [验证安装](#验证安装)
- [常见问题](#常见问题)
- [回退方案](#回退方案)

---

## 为什么使用 MinerU

| 功能 | PyMuPDF (备用) | MinerU |
|------|----------------|--------|
| 章节识别 | ❌ 仅基础文本 | ✅ 完整层级结构 |
| 公式提取 | ❌ | ✅ LaTeX 格式 |
| 图表关联 | ❌ | ✅ 自动匹配 caption |
| 表格解析 | ❌ | ✅ 结构化数据 |
| 算法块 | ❌ | ✅ 独立识别 |

**实测效果对比**（Position Based Fluids 论文）：
- PyMuPDF: 识别 1 个章节
- MinerU: 识别 **14 个章节**（完整结构）

---

## 安装方式

### 方式一：pip 安装（推荐）

```bash
# 激活你的 conda 环境
conda activate fastpaperread

# 安装 MinerU（CPU 版本）
pip install mineru

# 或安装 GPU 版本（需要 CUDA）
pip install mineru[cuda]
```

### 方式二：conda 安装

```bash
conda install -c conda-forge mineru
```

### 依赖说明

MinerU 会自动安装以下核心依赖：
- `torch` / `torchvision` - 深度学习框架
- `transformers` - Hugging Face 模型
- `paddleocr` - OCR 识别（可选）

---

## 模型下载

MinerU 首次运行需要下载模型文件（约 2-5GB）。

### 自动下载（推荐）

```bash
# 使用官方命令下载模型
mineru-models-download

# 如果网络不好，使用国内镜像
export HF_ENDPOINT=https://hf-mirror.com
mineru-models-download
```

### 手动下载

如果自动下载失败，可以手动下载：

1. 访问 [Hugging Face - opendatalab/PDF-Extract-Kit-1.0](https://huggingface.co/opendatalab/PDF-Extract-Kit-1.0)
2. 下载整个仓库到本地
3. 配置模型路径（见下节）

### 模型存储位置

默认位置：`~/.cache/huggingface/hub/`

自定义位置需要配置 `magic-pdf.json`（见配置文件章节）。

---

## 配置文件

MinerU 使用 `~/magic-pdf.json` 作为配置文件。

### 创建配置文件

```bash
cat > ~/magic-pdf.json << 'EOF'
{
    "models-dir": "",
    "device-mode": "cuda",
    "layout-config": {
        "model": "doclayout_yolo"
    },
    "formula-config": {
        "mfd_model": "yolo_v8_mfd",
        "mfr_model": "unimernet_small",
        "enable": true
    },
    "table-config": {
        "model": "tablemaster",
        "enable": true,
        "max_time": 400
    },
    "ocr-config": {
        "enable": true,
        "lang": ["ch", "en"]
    }
}
EOF
```

### 配置项说明

| 配置项 | 说明 | 可选值 |
|--------|------|--------|
| `models-dir` | 模型存储路径 | 留空使用默认路径，或填写绝对路径 |
| `device-mode` | 计算设备 | `cuda`（GPU）/ `cpu` |
| `layout-config.model` | 布局模型 | `doclayout_yolo`（推荐）/ `layoutlmv3` |
| `formula-config.enable` | 启用公式识别 | `true` / `false` |
| `table-config.enable` | 启用表格识别 | `true` / `false` |
| `ocr-config.enable` | 启用 OCR | `true` / `false` |

### CPU 版本配置

如果没有 GPU，修改配置：

```json
{
    "device-mode": "cpu",
    ...
}
```

---

## 验证安装

### 1. 检查命令是否可用

```bash
which mineru
# 应输出: /path/to/conda/envs/fastpaperread/bin/mineru
```

### 2. 查看版本

```bash
mineru --version
# 应输出: mineru 2.6.x
```

### 3. 测试解析

```bash
# 创建测试目录
mkdir -p ~/test_mineru

# 解析测试 PDF
mineru -p /path/to/your/paper.pdf -o ~/test_mineru

# 检查输出
ls ~/test_mineru/paper_name/auto/
# 应该看到: paper_name.md  paper_name_content_list.json  images/
```

### 4. 检查 FastPaperRead 是否识别

启动后端后，查看日志：

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

日志中应显示：
```
INFO: MinerU (mineru) 已安装
```

---

## 常见问题

### Q1: 网络问题导致模型下载失败

**解决方案**：设置 HuggingFace 镜像

```bash
export HF_ENDPOINT=https://hf-mirror.com
mineru-models-download
```

或在 `~/.bashrc` 中永久设置：
```bash
echo 'export HF_ENDPOINT=https://hf-mirror.com' >> ~/.bashrc
source ~/.bashrc
```

### Q2: CUDA 内存不足

**解决方案**：使用 CPU 模式或减小批处理大小

```json
{
    "device-mode": "cpu"
}
```

### Q3: 找不到配置文件

**错误信息**：`FileNotFoundError: ~/magic-pdf.json not found`

**解决方案**：按照「配置文件」章节创建配置文件

### Q4: 缺少依赖包

**常见缺失包**：
```bash
pip install pycocotools
pip install detectron2  # 或 conda install -c conda-forge detectron2
```

### Q5: transformers 版本冲突

**错误信息**：`ImportError: cannot import name 'xxx' from 'transformers'`

**解决方案**：
```bash
pip install transformers>=4.40.0
```

### Q6: 模型文件版本不匹配

**错误信息**：`FileNotFoundError: ...ch_PP-OCRv3_det_infer.pth`

**解决方案**：重新下载最新版本的模型
```bash
rm -rf ~/.cache/huggingface/hub/models--opendatalab--PDF-Extract-Kit*
mineru-models-download
```

---

## 回退方案

如果 MinerU 配置失败，FastPaperRead 会自动回退到 PyMuPDF 解析器：

```python
# backend/app/core/parser/pdf_parser.py 中的逻辑
if check_mineru_installed():
    result = await self._run_mineru(pdf_path, output_path)
else:
    # 自动回退到 PyMuPDF
    result = await self._fallback_parse(pdf_path, output_path)
```

PyMuPDF 能提供基础的文本和图片提取，但无法识别复杂的文档结构。

---

## 环境变量

在部署时可以设置以下环境变量：

```bash
# HuggingFace 镜像（推荐国内用户设置）
export HF_ENDPOINT=https://hf-mirror.com

# 自定义模型目录
export MINERU_MODELS_DIR=/path/to/models

# CUDA 设备选择（多 GPU 时使用）
export CUDA_VISIBLE_DEVICES=0
```

---

## 参考链接

- [MinerU 官方文档](https://github.com/opendatalab/MinerU)
- [MinerU PyPI](https://pypi.org/project/mineru/)
- [PDF-Extract-Kit 模型](https://huggingface.co/opendatalab/PDF-Extract-Kit-1.0)
- [HuggingFace 镜像站](https://hf-mirror.com/)

---

## 快速检查清单

安装完成后，确认以下项目：

- [ ] `mineru --version` 能正常输出版本号
- [ ] `~/magic-pdf.json` 配置文件存在
- [ ] 模型文件已下载（`~/.cache/huggingface/hub/` 或自定义路径）
- [ ] FastPaperRead 后端日志显示 "MinerU (mineru) 已安装"
- [ ] 上传 PDF 后能看到完整的章节结构

