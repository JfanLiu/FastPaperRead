"""
处理管道 - 步骤化处理论文
已重构：移除MCP和Claude Code依赖，使用本地处理器
"""
import asyncio
import os
import logging
import markdown
from typing import Tuple, Optional
from datetime import datetime

from .project_state import ProjectState
from ..processors.pdf_processor import PDFProcessor
from ..processors.git_processor import GitProcessor
from ..processors.llm_processor import LLMProcessor
from ..processors.search_processor import SearchProcessor
from config import Config

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PipelineProcessor:
    """步骤化处理管道"""
    
    def __init__(self):
        self.config = Config()
        self.pdf_processor = PDFProcessor()
        self.git_processor = GitProcessor()
        self.llm_processor = LLMProcessor()
        self.search_processor = SearchProcessor()
        
        # 确保目录存在
        os.makedirs(self.config.TEMP_DIR, exist_ok=True)
    
    def _run_async(self, coro):
        """运行异步函数的辅助方法"""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # 如果已经在事件循环中，创建新循环
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, coro)
                    return future.result()
            else:
                return loop.run_until_complete(coro)
        except RuntimeError:
            return asyncio.run(coro)
    
    def create_project(self, pdf_url: str, git_url: str = "") -> Tuple[ProjectState, str]:
        """步骤1: 项目初始化"""
        try:
            state = ProjectState()
            state.pdf_url = pdf_url.strip() if pdf_url else None
            state.git_url = git_url.strip() if git_url else None
            
            if not state.pdf_url:
                raise ValueError("PDF链接不能为空")
            
            state.update_step(1, "completed", f"项目已创建，PDF: {state.pdf_url}")
            
            message = f"✅ 项目创建成功！\n项目ID: {state.project_id}\nPDF: {state.pdf_url}"
            if state.git_url:
                message += f"\nGit: {state.git_url}"
            
            logger.info(f"Created project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ 项目创建失败: {str(e)}"
            logger.error(error_msg)
            return ProjectState(), error_msg
    
    def download_pdf_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤2A: 下载PDF"""
        try:
            if not state.can_execute_step(2):
                return state, "❌ 无法执行此步骤：请先完成项目初始化"
            
            state.update_step(2, "running", "正在下载PDF...")
            
            pdf_path = self._run_async(
                self.pdf_processor.download_pdf(state.pdf_url)
            )
            
            state.pdf_path = pdf_path
            state.update_step(2, "completed", f"PDF已下载至: {pdf_path}")
            
            message = f"✅ PDF下载成功！\n文件路径: {pdf_path}"
            logger.info(f"Downloaded PDF for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ PDF下载失败: {str(e)}"
            state.update_step(2, "failed", str(e))
            logger.error(f"PDF download failed: {e}")
            return state, error_msg
    
    def clone_git_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤2B: 克隆Git代码"""
        try:
            if not state.git_url:
                return state, "⚠️ 未提供Git链接，跳过代码克隆"
            
            git_result = self._run_async(
                self.git_processor.clone_and_analyze(state.git_url)
            )
            
            state.git_path = git_result["path"]
            message = f"✅ Git仓库克隆成功！\n目录: {git_result['path']}"
            logger.info(f"Cloned git repo for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ Git克隆失败: {str(e)}"
            logger.error(f"Git clone failed: {e}")
            return state, error_msg
    
    def pdf_to_tex_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤3: PDF转Markdown（使用MinerU）"""
        try:
            if not state.can_execute_step(3):
                return state, "❌ 无法执行此步骤：请先下载PDF"
            
            state.update_step(3, "running", "正在使用MinerU转换PDF...")
            
            # 使用新的PDF处理器
            tex_path, extracted_git_url = self.pdf_processor.process_pdf_to_tex(state.pdf_path)
            
            state.tex_path = tex_path
            state.extracted_git_url = extracted_git_url
            state.update_step(3, "completed", f"Markdown文件已生成: {tex_path}")
            
            message = f"✅ PDF转换成功！\nMarkdown文件: {tex_path}"
            if extracted_git_url:
                message += f"\n🔗 发现Git链接: {extracted_git_url}"
                if not state.git_url:
                    state.git_url = extracted_git_url
            
            logger.info(f"Converted PDF for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ PDF转换失败: {str(e)}"
            state.update_step(3, "failed", str(e))
            logger.error(f"PDF conversion failed: {e}")
            return state, error_msg
    
    def search_knowledge_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤4A: 使用Tavily自动搜索知识库"""
        try:
            if not state.tex_path:
                return state, "⚠️ 没有论文内容，跳过知识库搜索"
            
            # 读取论文内容
            with open(state.tex_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # 使用LLM提取关键词
            keywords = self.llm_processor.extract_keywords(content)
            logger.info(f"Extracted keywords: {keywords}")
            
            # 使用Tavily搜索
            keyword_list = keywords.split()
            urls = self._run_async(
                self.search_processor.search_for_paper_context(keyword_list)
            )
            
            # 添加到知识库
            added_count = 0
            for url in urls:
                if url not in state.knowledge_base:
                    state.knowledge_base.append(url)
                    added_count += 1
            
            message = f"✅ 知识库搜索完成！\n关键词: {keywords}\n新增 {added_count} 个相关链接"
            logger.info(f"Knowledge search completed for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ 知识库搜索失败: {str(e)}"
            logger.error(f"Knowledge search failed: {e}")
            return state, error_msg
    
    def manage_knowledge_step(self, state: ProjectState, action: str, url: str) -> Tuple[ProjectState, str]:
        """步骤4B: 手动管理知识库"""
        try:
            if action == "add":
                if url and url not in state.knowledge_base:
                    state.knowledge_base.append(url)
                    message = f"✅ 已添加知识库链接: {url}"
                elif url in state.knowledge_base:
                    message = f"⚠️ 链接已存在: {url}"
                else:
                    message = "❌ 链接不能为空"
            elif action == "remove":
                if url in state.knowledge_base:
                    state.knowledge_base.remove(url)
                    message = f"✅ 已移除知识库链接: {url}"
                else:
                    message = f"⚠️ 链接不存在: {url}"
            else:
                message = f"❌ 未知操作: {action}"
            
            return state, message
            
        except Exception as e:
            error_msg = f"❌ 知识库管理失败: {str(e)}"
            logger.error(f"Knowledge management failed: {e}")
            return state, error_msg
    
    def analyze_code_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤5: 代码分析（使用LLM替代Claude Code）"""
        try:
            if not state.can_execute_step(5):
                return state, "⚠️ 没有代码路径，跳过代码分析"
            
            state.update_step(5, "running", "正在分析代码...")
            
            # 读取论文内容
            with open(state.tex_path) as f:
                tex_content = f.read()
            
            # 生成论文摘要
            paper_summary = self.llm_processor.generate_summary(tex_content)
            
            # 获取代码结构
            code_structure = self._get_code_structure(state.git_path)
            
            # 使用LLM分析代码
            code_analysis = self.llm_processor.analyze_code(code_structure, paper_summary)
            
            # 保存分析结果
            analysis_path = f'{self.config.TEMP_DIR}/code_analysis.md'
            with open(analysis_path, 'w', encoding='utf-8') as f:
                f.write(code_analysis)
            
            # 同时保存论文摘要
            summary_path = f'{self.config.TEMP_DIR}/summary.md'
            with open(summary_path, 'w', encoding='utf-8') as f:
                f.write(paper_summary)
            
            state.code_analysis = "ok"
            state.update_step(5, "completed", "代码分析完成")
            
            message = "✅ 代码分析完成！\n- 项目结构已分析\n- 代码逻辑已提取\n- 与论文对应关系已分析"
            logger.info(f"Code analysis completed for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ 代码分析失败: {str(e)}"
            state.update_step(5, "failed", str(e))
            logger.error(f"Code analysis failed: {e}")
            return state, error_msg
    
    def _get_code_structure(self, repo_path: str, max_depth: int = 3) -> str:
        """获取代码仓库结构"""
        structure_lines = []
        
        def walk_dir(path: str, depth: int = 0):
            if depth >= max_depth:
                return
            
            try:
                items = sorted(os.listdir(path))
                for item in items:
                    if item.startswith('.') or item in ['__pycache__', 'node_modules', 'venv', '.git']:
                        continue
                    
                    item_path = os.path.join(path, item)
                    indent = "  " * depth
                    
                    if os.path.isdir(item_path):
                        structure_lines.append(f"{indent}📁 {item}/")
                        walk_dir(item_path, depth + 1)
                    else:
                        structure_lines.append(f"{indent}📄 {item}")
            except PermissionError:
                pass
        
        walk_dir(repo_path)
        return "\n".join(structure_lines)
    
    def understand_paper_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤6: 论文理解生成"""
        try:
            if not state.can_execute_step(6):
                return state, "❌ 无法执行此步骤：请先完成PDF转换"
            
            state.update_step(6, "running", "正在理解论文...")
            
            # 读取论文内容
            with open(state.tex_path) as f:
                tex_content = f.read()
            
            # 获取知识库内容
            knowledge_contents = []
            for url in state.knowledge_base[:5]:
                try:
                    content = self._run_async(
                        self.search_processor.get_page_content(url)
                    )
                    if content:
                        knowledge_contents.append(content[:2000])
                except Exception as e:
                    logger.warning(f"获取知识库内容失败 {url}: {e}")
            
            # 使用LLM分析
            analysis = self.llm_processor.analyze_with_knowledge(tex_content, knowledge_contents)
            
            # 保存结果
            output_path = f"{self.config.TEMP_DIR}/knowledge_out.md"
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(analysis)
            
            state.update_step(6, "completed", "论文理解完成")
            state.paper_analysis = 'ok'
            
            logger.info(f"Paper understanding completed for project {state.project_id}")
            return state, f"✅ 论文理解完成！\n分析结果已保存至: {output_path}"
            
        except Exception as e:
            error_msg = f"❌ 论文理解失败: {str(e)}"
            state.update_step(6, "failed", str(e))
            logger.error(f"Paper understanding failed: {e}")
            return state, error_msg
    
    def generate_blog_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤7: 生成结构化Blog"""
        try:
            state.update_step(7, "running", "正在生成Blog...")
            
            # 读取论文内容
            with open(state.tex_path) as f:
                tex_content = f.read()
            
            # 读取代码分析（如果有）
            code_content = ""
            code_analysis_path = f"{self.config.TEMP_DIR}/code_analysis.md"
            if os.path.exists(code_analysis_path):
                with open(code_analysis_path, "r", encoding="utf-8") as f:
                    code_content = f.read()
            
            # 获取知识库内容
            knowledge_contents = []
            for url in state.knowledge_base[:3]:
                try:
                    content = self._run_async(
                        self.search_processor.get_page_content(url)
                    )
                    if content:
                        knowledge_contents.append(content[:2000])
                except Exception:
                    pass
            
            # 生成Blog
            blog_content = self.llm_processor.generate_blog(
                paper_content=tex_content,
                code_analysis=code_content,
                knowledge_contents=knowledge_contents
            )
            
            # 保存Blog
            blog_path = f"{self.config.TEMP_DIR}/blog.md"
            with open(blog_path, "w", encoding="utf-8") as f:
                f.write(blog_content)
            
            state.blog_content = markdown.markdown(
                blog_content,
                extensions=['tables', 'fenced_code', 'codehilite']
            )
            state.update_step(7, "completed", "Blog生成完成")
            
            message = "✅ Blog生成完成！\n已生成7个模块的结构化内容"
            logger.info(f"Blog generated for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ Blog生成失败: {str(e)}"
            state.update_step(7, "failed", str(e))
            logger.error(f"Blog generation failed: {e}")
            return state, error_msg
    
    def render_blog_step(self, state: ProjectState) -> Tuple[ProjectState, str]:
        """步骤8: HTML渲染输出"""
        try:
            if not state.can_execute_step(8):
                return state, "❌ 无法执行此步骤：请先生成Blog"
            
            state.update_step(8, "running", "正在渲染HTML...")
            
            # 读取Blog内容
            blog_path = f"{self.config.TEMP_DIR}/blog.md"
            with open(blog_path, "r", encoding="utf-8") as f:
                blog_md = f.read()
            
            # 渲染HTML
            html_path = f"{self.config.TEMP_DIR}/blog_{state.project_id[:8]}.html"
            html_content = self._render_html(blog_md, state)
            
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html_content)
            
            state.html_output = html_path
            state.update_step(8, "completed", f"HTML已生成: {html_path}")
            
            message = f"✅ HTML渲染完成！\n文件路径: {html_path}"
            logger.info(f"HTML rendering completed for project {state.project_id}")
            return state, message
            
        except Exception as e:
            error_msg = f"❌ HTML渲染失败: {str(e)}"
            state.update_step(8, "failed", str(e))
            logger.error(f"HTML rendering failed: {e}")
            return state, error_msg
    
    def _render_html(self, blog_md: str, state: ProjectState) -> str:
        """渲染HTML模板"""
        # 将Markdown转换为HTML
        html_body = markdown.markdown(
            blog_md,
            extensions=['tables', 'fenced_code', 'codehilite', 'toc']
        )
        
        # 构建完整HTML
        html_template = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>论文解读 - FastPaperReader</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet">
    <style>
        :root {{
            --primary-color: #2563eb;
            --bg-color: #f8fafc;
            --text-color: #1e293b;
            --card-bg: #ffffff;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            line-height: 1.8;
        }}
        .container {{
            max-width: 900px;
            padding: 2rem;
        }}
        .article-header {{
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid #e2e8f0;
        }}
        .article-title {{
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary-color);
            margin-bottom: 1rem;
        }}
        .article-meta {{
            color: #64748b;
            font-size: 0.9rem;
        }}
        .article-content {{
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .article-content h1 {{
            font-size: 1.8rem;
            color: var(--primary-color);
            margin-top: 2rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--primary-color);
        }}
        .article-content h2 {{
            font-size: 1.5rem;
            color: #3b82f6;
            margin-top: 1.5rem;
        }}
        .article-content h3 {{
            font-size: 1.25rem;
            color: #6366f1;
        }}
        .article-content pre {{
            background: #1e293b;
            border-radius: 8px;
            padding: 1rem;
            overflow-x: auto;
        }}
        .article-content code {{
            font-family: 'Fira Code', 'Monaco', monospace;
            font-size: 0.9rem;
        }}
        .article-content blockquote {{
            border-left: 4px solid var(--primary-color);
            padding-left: 1rem;
            color: #64748b;
            font-style: italic;
        }}
        .article-content table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }}
        .article-content th, .article-content td {{
            border: 1px solid #e2e8f0;
            padding: 0.75rem;
            text-align: left;
        }}
        .article-content th {{
            background: #f1f5f9;
        }}
        .toc {{
            position: fixed;
            right: 2rem;
            top: 50%;
            transform: translateY(-50%);
            background: var(--card-bg);
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 200px;
            display: none;
        }}
        @media (min-width: 1200px) {{
            .toc {{
                display: block;
            }}
        }}
        .knowledge-sources {{
            margin-top: 2rem;
            padding: 1rem;
            background: #f1f5f9;
            border-radius: 8px;
        }}
        .knowledge-sources h4 {{
            margin-bottom: 0.5rem;
            color: #475569;
        }}
        .knowledge-sources ul {{
            margin: 0;
            padding-left: 1.5rem;
        }}
        .knowledge-sources a {{
            color: var(--primary-color);
            text-decoration: none;
        }}
        .knowledge-sources a:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header class="article-header">
            <h1 class="article-title">📚 论文解读</h1>
            <div class="article-meta">
                <span>🕐 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}</span>
                <span class="mx-2">|</span>
                <span>🤖 由 FastPaperReader 生成</span>
            </div>
        </header>
        
        <article class="article-content">
            {html_body}
        </article>
        
        <div class="knowledge-sources">
            <h4>📖 参考资源</h4>
            <ul>
                {"".join(f'<li><a href="{url}" target="_blank">{url[:60]}...</a></li>' for url in state.knowledge_base[:5]) if state.knowledge_base else '<li>无外部参考</li>'}
            </ul>
        </div>
    </div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
    </script>
</body>
</html>'''
        
        return html_template


# 全局pipeline实例
pipeline = PipelineProcessor()
