# GitCode Vision

中文 | [English](#english)

## 中文

GitCode Vision 是一个代码项目分析与可视化工具，支持两种数据来源：

- GitHub 公开仓库分析
- 本地项目目录分析

应用会读取项目结构，调用 AI 识别语言、技术栈和入口文件，并进一步生成函数调用链、功能模块划分、可视化全景图以及可导出的分析结果。

### 主要功能

- GitHub / 本地项目双模式分析
- 通用数据源抽象，统一支持文件列表、文件读取、内容搜索
- AI 项目分析：主语言、技术栈、候选入口文件
- 入口文件研判与函数调用链递归下钻
- 功能模块聚类与模块筛选
- 函数调用全景图展示
- 全景图导出 PNG 图片
- Markdown 分析报告导出
- 分析历史本地持久化
- 历史记录来源标识：区分 GitHub 项目与本地项目
- 设置面板：支持 AI / GitHub 相关配置
- 日志面板 AI 调用统计：调用次数、输入 Tokens、输出 Tokens
- 自定义 favicon 与应用标题

### 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- React Router
- `@xyflow/react`
- `react-syntax-highlighter`

### 运行环境

- Node.js 18+
- npm 9+
- 推荐使用 Chromium 内核浏览器进行本地目录分析

### 快速开始

1. 安装依赖

```bash
npm install
```

2. 在项目根目录创建 `.env`

```env
BASE_URL=https://your-llm-api-base-url/v1
API_KEY=your_api_key
MODEL=your_model_name
GITHUB_TOKEN=your_github_token
MAX_DRILL_DOWN_DEPTH=2
KEY_SUB_FUNCTION_LIMIT=10
APP_URL=http://localhost:3000
```

3. 启动开发环境

```bash
npm run dev
```

4. 打开浏览器访问

```text
http://localhost:3000
```

### 环境变量说明

- `BASE_URL`：AI 接口基础地址，最终请求为 `${BASE_URL}/chat/completions`
- `API_KEY`：AI 接口密钥
- `MODEL`：AI 模型名称
- `GITHUB_TOKEN`：可选，用于提升 GitHub API 访问配额
- `MAX_DRILL_DOWN_DEPTH`：最大下钻层数，默认 `2`
- `KEY_SUB_FUNCTION_LIMIT`：每次函数分析时识别的关键调用子函数数量上限，默认 `10`
- `APP_URL`：预留变量，当前前端流程未直接使用

### 设置功能

应用右上角提供设置按钮，支持以下配置项：

- AI Base URL
- AI API Key
- AI 模型名称
- GitHub Token
- 最大下钻层数
- 关键调用子函数数量

设置会持久化存储在本地；如果检测到环境变量，则环境变量优先，并在设置窗口中显示当前生效值。

### 使用说明

#### GitHub 模式

1. 在首页选择 `GitHub 项目分析`
2. 输入仓库地址，例如：

```text
https://github.com/owner/repo
```

3. 进入分析页后，系统会自动拉取仓库结构并启动 AI 分析

#### 本地模式

1. 在首页选择 `本地项目分析`
2. 点击按钮选择本地目录
3. 浏览器授权后，系统会递归读取本地项目并进入同一套分析流程

### 可用脚本

- `npm run dev`：启动开发服务器
- `npm run build`：构建生产版本
- `npm run preview`：预览构建结果
- `npm run lint`：执行 TypeScript 类型检查

### 项目结构

```text
src/
  components/
    PanoramaPanel.tsx
    SettingsModal.tsx
  lib/
    analysisHistory.ts
    appSettings.ts
    dataSources.ts
  pages/
    Home.tsx
    Analyze.tsx
  types/
    file-system-access.d.ts
public/
  favicon.svg
```

### 注意事项

- 本地目录分析依赖浏览器的 File System Access API
- 如果 AI 接口出现 `Failed to fetch`，通常是 Base URL、网络连通性或 CORS 配置问题
- `.env` 不应提交真实密钥
- 前端当前直接请求 AI 接口，若服务端不支持浏览器跨域访问，建议改成后端代理

---

## English

GitCode Vision is a project analysis and visualization tool for two kinds of sources:

- GitHub public repositories
- Local project folders

It reads project structure, calls an AI endpoint to identify languages, tech stack, and entry files, then builds function call chains, module grouping, panorama visualization, and exportable analysis artifacts.

### Features

- Dual-mode analysis for GitHub and local projects
- Shared data source abstraction for listing, reading, and searching files
- AI-based project analysis: languages, tech stack, candidate entry files
- Entry-file verification and recursive function drill-down
- Functional module grouping and filtering
- Function call panorama view
- Panorama export to PNG
- Markdown analysis export
- Local history persistence
- Source badges in history for GitHub vs local projects
- Settings modal for AI / GitHub configuration
- AI usage stats in log panel: call count, input tokens, output tokens
- Custom favicon and app title

### Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- React Router
- `@xyflow/react`
- `react-syntax-highlighter`

### Requirements

- Node.js 18+
- npm 9+
- Chromium-based browser recommended for local folder analysis

### Quick Start

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file in the project root

```env
BASE_URL=https://your-llm-api-base-url/v1
API_KEY=your_api_key
MODEL=your_model_name
GITHUB_TOKEN=your_github_token
MAX_DRILL_DOWN_DEPTH=2
KEY_SUB_FUNCTION_LIMIT=10
APP_URL=http://localhost:3000
```

3. Start the dev server

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

### Environment Variables

- `BASE_URL`: AI API base URL, final request path is `${BASE_URL}/chat/completions`
- `API_KEY`: AI API key
- `MODEL`: model name
- `GITHUB_TOKEN`: optional, increases GitHub API rate limits
- `MAX_DRILL_DOWN_DEPTH`: max drill-down depth, default `2`
- `KEY_SUB_FUNCTION_LIMIT`: max number of key sub-functions extracted per step, default `10`
- `APP_URL`: reserved variable, currently not directly used by frontend flow

### Settings

The top-right settings button lets you configure:

- AI Base URL
- AI API Key
- AI model name
- GitHub Token
- Max drill-down depth
- Key sub-function limit

Settings are persisted locally. If environment variables are detected, they take precedence and are shown in the settings UI.

### Notes

- Local project analysis depends on the browser File System Access API
- `Failed to fetch` from AI requests usually means Base URL, network, or CORS issues
- Never commit real secrets from `.env`
- If your AI provider does not support browser-side CORS, use a backend proxy
