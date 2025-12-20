"""
LLM处理器 - 统一的OpenAI兼容接口
支持 DeepSeek, Qwen, OpenAI, Claude 等
"""
import os
from typing import Optional, List, Dict, Generator
from config import config


class LLMProcessor:
    """统一的LLM处理器，使用OpenAI兼容接口"""
    
    def __init__(self, use_backup: bool = False):
        """
        Args:
            use_backup: 是否使用备用LLM配置
        """
        self.llm_config = config.get_llm_config(use_backup)
        self._client = None
        
        if not self.llm_config.get("api_key"):
            print("⚠️ LLM_API_KEY 未配置")
    
    def _get_client(self):
        """懒加载OpenAI客户端"""
        if self._client is None:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=self.llm_config["api_key"],
                    base_url=self.llm_config["base_url"]
                )
            except ImportError:
                raise ImportError("请安装 openai: pip install openai")
        return self._client
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False
    ) -> str | Generator:
        """发送聊天请求
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            model: 模型名称，默认使用配置中的模型
            temperature: 温度参数
            max_tokens: 最大token数
            stream: 是否流式输出
            
        Returns:
            str 或 Generator: 响应内容
        """
        client = self._get_client()
        model = model or self.llm_config["model"]
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        )
        
        if stream:
            return self._stream_response(response)
        else:
            return response.choices[0].message.content
    
    def _stream_response(self, response) -> Generator:
        """处理流式响应"""
        for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    
    def complete(
        self,
        prompt: str,
        system_prompt: str = None,
        **kwargs
    ) -> str:
        """简化的完成接口
        
        Args:
            prompt: 用户提示
            system_prompt: 系统提示（可选）
            **kwargs: 其他参数传递给chat方法
            
        Returns:
            str: 响应内容
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        return self.chat(messages, **kwargs)
    
    # ==================== 论文处理专用方法 ====================
    
    def extract_keywords(self, paper_content: str) -> str:
        """从论文中提取关键词
        
        Args:
            paper_content: 论文内容
            
        Returns:
            str: 关键词（空格分隔）
        """
        system_prompt = """你是一个学术论文分析专家。请从给定的论文内容中提取5-10个最重要的关键词。
关键词应该包括：
1. 论文的核心方法/模型名称
2. 所属研究领域
3. 关键技术术语
4. 应用场景

请直接输出关键词，用空格分隔，不要有编号或其他格式。"""

        # 截取论文的摘要和引言部分（通常在前面）
        content_preview = paper_content[:8000] if len(paper_content) > 8000 else paper_content
        
        response = self.complete(
            prompt=f"请提取以下论文的关键词：\n\n{content_preview}",
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=200
        )
        
        # 清理输出
        keywords = response.strip().replace('\n', ' ').replace(',', ' ')
        return keywords
    
    def generate_summary(self, paper_content: str) -> str:
        """生成论文摘要
        
        Args:
            paper_content: 论文内容
            
        Returns:
            str: 论文摘要
        """
        system_prompt = """你是一个学术论文分析专家。请为给定的论文生成一个结构化摘要，包括：
1. 研究问题：论文要解决什么问题
2. 方法概述：使用了什么方法
3. 主要贡献：论文的主要创新点
4. 实验结果：关键实验结果

请用中文回答，每个部分用2-3句话概括。"""

        return self.complete(
            prompt=f"请分析以下论文并生成摘要：\n\n{paper_content[:15000]}",
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=1000
        )
    
    def analyze_with_knowledge(
        self, 
        paper_content: str, 
        knowledge_contents: List[str]
    ) -> str:
        """结合知识库分析论文
        
        Args:
            paper_content: 论文内容
            knowledge_contents: 知识库内容列表
            
        Returns:
            str: 分析结果
        """
        system_prompt = """你是一个学术论文分析专家。请结合提供的背景知识，深入分析这篇论文。

分析应包括：
1. 论文的研究背景和动机
2. 与现有工作的关系和区别
3. 方法的技术细节和创新点
4. 潜在的局限性和改进方向

请用中文回答，结构清晰。"""

        knowledge_text = "\n\n---\n\n".join(knowledge_contents[:5]) if knowledge_contents else "无额外背景知识"
        
        prompt = f"""## 论文内容
{paper_content[:12000]}

## 背景知识
{knowledge_text[:5000]}

请基于以上内容进行深入分析。"""

        return self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.6,
            max_tokens=3000
        )
    
    def generate_blog(
        self,
        paper_content: str,
        code_analysis: str = None,
        knowledge_contents: List[str] = None
    ) -> str:
        """生成结构化Blog
        
        Args:
            paper_content: 论文内容
            code_analysis: 代码分析结果（可选）
            knowledge_contents: 知识库内容（可选）
            
        Returns:
            str: Markdown格式的Blog
        """
        system_prompt = """你是一个专业的技术博客作者，擅长将复杂的学术论文转化为通俗易懂的技术博客。

请根据提供的论文内容，生成一篇结构化的技术博客，包含以下7个模块：

1. **动机 (Motivation)** - 为什么要做这个研究？解决什么实际问题？
2. **背景 (Background)** - 相关的技术背景知识
3. **同类方法的缺陷 (Limitations)** - 现有方法有什么问题？
4. **解决的问题 (Problem)** - 本文具体要解决什么问题？
5. **方法 (Methodology)** - 提出的方法是什么？如何工作的？
6. **实验 (Experiments)** - 实验设置和结果
7. **结论 (Conclusion)** - 总结和未来展望

要求：
- 使用Markdown格式
- 语言通俗易懂，适合技术人员阅读
- 可以包含Mermaid流程图（使用```mermaid代码块）
- 可以包含伪代码说明关键算法
- 每个模块内容充实，有深度"""

        # 构建上下文
        context_parts = [f"## 论文原文\n{paper_content[:15000]}"]
        
        if code_analysis:
            context_parts.append(f"## 代码分析\n{code_analysis[:5000]}")
        
        if knowledge_contents:
            knowledge_text = "\n\n".join(knowledge_contents[:3])
            context_parts.append(f"## 背景知识\n{knowledge_text[:3000]}")
        
        prompt = "\n\n".join(context_parts) + "\n\n请基于以上内容生成技术博客。"
        
        return self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=8000
        )
    
    def analyze_code(self, code_summary: str, paper_summary: str) -> str:
        """分析代码与论文的对应关系
        
        Args:
            code_summary: 代码结构摘要
            paper_summary: 论文摘要
            
        Returns:
            str: 代码分析结果
        """
        system_prompt = """你是一个代码分析专家，擅长理解学术论文的代码实现。

请分析代码仓库的结构，并说明：
1. 代码的整体架构
2. 核心模块和功能
3. 关键算法的实现位置
4. 与论文方法的对应关系

请用中文回答，结构清晰。"""

        prompt = f"""## 论文摘要
{paper_summary}

## 代码结构
{code_summary}

请分析这个代码仓库的实现细节。"""

        return self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=3000
        )


# 全局实例
llm_processor = LLMProcessor()

