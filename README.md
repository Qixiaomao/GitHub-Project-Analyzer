# GitHub Project Analyzer

中文 | [English](#english)

## 中文

GitHub Project Analyzer 是一个 GitHub 仓库代码分析与可视化工具。输入仓库地址后，应用会拉取项目结构，调用 AI 生成项目分析结果，并展示函数调用全景图与可导出的 Markdown 分析文档。

### 功能特性

- GitHub 仓库结构拉取与文件树浏览
- AI 分析：主要语言、技术栈、候选入口文件
- 入口文件研判与函数调用链下钻
- 功能模块聚类（可按模块筛选）
- 可视化调用关系图（`@xyflow/react`）
- 分析历史本地持久化（`localStorage`）
- 分析结果导出为 `.md`

### 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- React Router
- React Flow (`@xyflow/react`)
- `react-syntax-highlighter`

### 环境要求

- Node.js 18+（建议 LTS）
- npm 9+

### 快速开始

1. 安装依赖

```bash
npm install
```

2. 在项目根目录创建 `.env`（参考下面模板）

```env
BASE_URL=https://your-llm-api-base-url
API_KEY=your_api_key
MODEL=your_model_name
GITHUB_TOKEN=your_github_token
MAX_DRILL_DOWN_DEPTH=2
APP_URL=http://localhost:3000
```

3. 启动开发环境

```bash
npm run dev
```

4. 打开浏览器访问 `http://localhost:3000`

### 环境变量说明

- `BASE_URL`：LLM API 基础地址（代码中会请求 `${BASE_URL}/chat/completions`）
- `API_KEY`：LLM API 密钥
- `MODEL`：模型名
- `GITHUB_TOKEN`：可选，提升 GitHub API 访问配额
- `MAX_DRILL_DOWN_DEPTH`：函数调用链最大下钻层级，默认 `2`
- `APP_URL`：项目中预留变量（当前前端逻辑未直接使用）

### 可用脚本

- `npm run dev`：开发模式（端口 `3000`）
- `npm run build`：生产构建
- `npm run preview`：预览构建产物
- `npm run lint`：TypeScript 类型检查

### 项目结构

```text
src/
  components/
    PanoramaPanel.tsx      # 函数调用全景图
  lib/
    analysisHistory.ts     # 分析历史与 Markdown 生成
  pages/
    Home.tsx               # 仓库地址输入与历史列表
    Analyze.tsx            # 分析主流程与页面
```

### 使用流程

1. 在首页输入 GitHub 仓库 URL（如 `https://github.com/owner/repo`）
2. 进入分析页，自动拉取仓库信息与文件树
3. AI 输出语言/技术栈/入口文件，并继续生成函数调用链与模块划分
4. 在右侧查看调用图，点击节点可定位源码
5. 导出 Markdown 分析文件

### 注意事项

- 当前主要面向公开仓库；私有仓库需确保 token 权限和跨域策略都正确。
- `.env*` 已被 `.gitignore` 忽略，不要提交真实密钥。
- 前端会直接请求你配置的 LLM 接口，请确认接口兼容 `chat/completions`。

---

## English

GitHub Project Analyzer is a GitHub repository analysis and visualization tool. After you provide a repo URL, it fetches project structure, calls an AI endpoint for analysis, visualizes function call chains, and lets you export a Markdown report.

### Features

- GitHub repository fetching and file tree browsing
- AI analysis: main languages, tech stack, candidate entry files
- Entry-file verification and function-call drill-down
- Functional module grouping with module filter
- Call-graph visualization via `@xyflow/react`
- Local analysis history persistence (`localStorage`)
- Markdown export for analysis results

### Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- React Router
- React Flow (`@xyflow/react`)
- `react-syntax-highlighter`

### Requirements

- Node.js 18+ (LTS recommended)
- npm 9+

### Quick Start

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file in the project root

```env
BASE_URL=https://your-llm-api-base-url
API_KEY=your_api_key
MODEL=your_model_name
GITHUB_TOKEN=your_github_token
MAX_DRILL_DOWN_DEPTH=2
APP_URL=http://localhost:3000
```

3. Run development server

```bash
npm run dev
```

4. Open `http://localhost:3000`

### Environment Variables

- `BASE_URL`: Base URL of your LLM API (`${BASE_URL}/chat/completions` is used)
- `API_KEY`: API key for your LLM provider
- `MODEL`: model name
- `GITHUB_TOKEN`: optional, improves GitHub API rate limits
- `MAX_DRILL_DOWN_DEPTH`: max depth for function drill-down (default `2`)
- `APP_URL`: reserved variable (currently not directly used by frontend logic)

### Scripts

- `npm run dev`: start dev server on port `3000`
- `npm run build`: production build
- `npm run preview`: preview build output
- `npm run lint`: TypeScript type checking

### Project Layout

```text
src/
  components/
    PanoramaPanel.tsx
  lib/
    analysisHistory.ts
  pages/
    Home.tsx
    Analyze.tsx
```

### Usage

1. Enter a GitHub repo URL on the home page.
2. The app fetches repo metadata and file tree.
3. AI generates languages/stack/entry candidates, then call-chain/module results.
4. Inspect the call graph and click nodes to open source files.
5. Export the generated Markdown report.

### Notes

- Public repositories are the primary target flow.
- Keep `.env` secrets out of version control.
- Ensure your configured LLM endpoint is compatible with `chat/completions` style requests.
