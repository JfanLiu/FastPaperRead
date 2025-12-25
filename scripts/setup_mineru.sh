#!/bin/bash
# =============================================================================
# MinerU 安装配置脚本
# 
# 用法:
#   chmod +x scripts/setup_mineru.sh
#   ./scripts/setup_mineru.sh
#
# 选项:
#   --cpu     仅安装 CPU 版本
#   --skip-models  跳过模型下载
# =============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
USE_CPU=false
SKIP_MODELS=false
CONFIG_FILE="$HOME/magic-pdf.json"

# 解析参数
for arg in "$@"; do
    case $arg in
        --cpu)
            USE_CPU=true
            shift
            ;;
        --skip-models)
            SKIP_MODELS=true
            shift
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --cpu          仅安装 CPU 版本"
            echo "  --skip-models  跳过模型下载"
            echo "  --help         显示帮助"
            exit 0
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MinerU 安装配置脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Python 环境
echo -e "${YELLOW}[1/5] 检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 Python3${NC}"
    exit 1
fi
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
echo -e "${GREEN}✓ Python $PYTHON_VERSION${NC}"

# 检查 CUDA
echo ""
echo -e "${YELLOW}[2/5] 检查 CUDA 环境...${NC}"
if command -v nvidia-smi &> /dev/null && [ "$USE_CPU" = false ]; then
    nvidia-smi --query-gpu=name --format=csv,noheader | head -1
    echo -e "${GREEN}✓ 检测到 NVIDIA GPU，将安装 CUDA 版本${NC}"
    DEVICE_MODE="cuda"
else
    echo -e "${YELLOW}⚠ 未检测到 GPU 或指定 --cpu，将使用 CPU 模式${NC}"
    DEVICE_MODE="cpu"
fi

# 设置 HuggingFace 镜像
echo ""
echo -e "${YELLOW}[3/5] 配置 HuggingFace 镜像...${NC}"
export HF_ENDPOINT=https://hf-mirror.com
echo -e "${GREEN}✓ 已设置 HF_ENDPOINT=$HF_ENDPOINT${NC}"

# 安装 MinerU
echo ""
echo -e "${YELLOW}[4/5] 安装 MinerU...${NC}"
if [ "$USE_CPU" = true ]; then
    pip install mineru --quiet
else
    pip install "mineru[cuda]" --quiet 2>/dev/null || pip install mineru --quiet
fi

# 验证安装
if command -v mineru &> /dev/null; then
    MINERU_VERSION=$(mineru --version 2>&1 || echo "unknown")
    echo -e "${GREEN}✓ MinerU 安装成功: $MINERU_VERSION${NC}"
else
    echo -e "${RED}✗ MinerU 安装失败${NC}"
    exit 1
fi

# 创建配置文件
echo ""
echo -e "${YELLOW}[5/5] 创建配置文件...${NC}"

if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠ 配置文件已存在: $CONFIG_FILE${NC}"
    read -p "是否覆盖? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}跳过配置文件创建${NC}"
    fi
fi

cat > "$CONFIG_FILE" << EOF
{
    "models-dir": "",
    "device-mode": "$DEVICE_MODE",
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
echo -e "${GREEN}✓ 配置文件已创建: $CONFIG_FILE${NC}"

# 下载模型
if [ "$SKIP_MODELS" = false ]; then
    echo ""
    echo -e "${YELLOW}[额外] 下载 MinerU 模型 (这可能需要几分钟)...${NC}"
    echo -e "${BLUE}如果下载失败，可以稍后手动运行: mineru-models-download${NC}"
    
    if command -v mineru-models-download &> /dev/null; then
        mineru-models-download || {
            echo -e "${YELLOW}⚠ 模型下载失败，请稍后手动运行: mineru-models-download${NC}"
        }
    else
        echo -e "${YELLOW}⚠ mineru-models-download 命令不可用，跳过模型下载${NC}"
    fi
fi

# 完成
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   安装完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "配置信息:"
echo "  - 设备模式: $DEVICE_MODE"
echo "  - 配置文件: $CONFIG_FILE"
echo "  - HF 镜像: $HF_ENDPOINT"
echo ""
echo "下一步:"
echo "  1. 如果模型未下载，运行: mineru-models-download"
echo "  2. 测试解析: mineru -p your_paper.pdf -o output/"
echo "  3. 启动 FastPaperRead 后端查看日志确认 MinerU 已识别"
echo ""
echo "详细文档: docs/MinerU配置指南.md"

