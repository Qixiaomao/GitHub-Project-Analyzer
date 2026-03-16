import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Github, 
  Search, 
  Loader2,
  AlertCircle,
  Sparkles,
  Terminal,
  Maximize2,
  X,
  Network,
  FileText,
  Download,
  Layers3,
  RefreshCw
} from 'lucide-react';
import PanoramaPanel from '../components/PanoramaPanel';
import {
  buildAnalysisMarkdown,
  getProjectHistoryRecord,
  upsertProjectHistory,
  type RepoInfoSnapshot,
  type ProjectAnalysisRecord,
  type FunctionModuleSnapshot,
} from '../lib/analysisHistory';

interface TreeNode {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  url: string;
  children?: TreeNode[];
  isOpen?: boolean;
}

interface SubFunction {
  name: string;
  shouldDrillDown: number;
  possibleFile: string;
  description: string;
  depth?: number;
  moduleId?: string;
  moduleName?: string;
  subFunctions?: SubFunction[];
}

interface AnalyzedFunction {
  name: string;
  file: string;
  description: string;
  moduleId?: string;
  moduleName?: string;
  subFunctions?: SubFunction[];
}

interface AIAnalysisResult {
  mainLanguages: string[];
  techStack: string[];
  entryFiles: string[];
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error';
  details?: any;
}

interface RepoInfo {
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  updatedAt: string;
}

interface FunctionModule extends FunctionModuleSnapshot {}

interface AIStats {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
}

type WorkflowStatus =
  | 'idle'
  | 'fetching_repo'
  | 'analyzing_project'
  | 'evaluating_entry'
  | 'analyzing_calls'
  | 'analyzing_modules'
  | 'completed'
  | 'error';

const truncateLongStrings = (obj: any): any => {
  if (typeof obj === 'string') {
    if (obj.length > 500) {
      const truncated = obj.substring(0, 500);
      const remainingBytes = new Blob([obj.substring(500)]).size;
      return `${truncated}··· (后续还有 ${remainingBytes} 字节)`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(truncateLongStrings);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = truncateLongStrings(obj[key]);
    }
    return newObj;
  }
  return obj;
};

/**
 * 快速 JSON 有效性检查（不进行完整解析）
 */
const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

/**
 * 安全的 JSON 解析带详细错误日志
 */
const safeJSONParse = (jsonStr: string, context: string = ''): any => {
  if (!jsonStr) {
    throw new Error(`${context} - 响应内容为空`);
  }
  
  const trimmed = jsonStr.trim();
  
  // 检查是否看起来像 JSON
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error(`${context} - 响应不是 JSON 格式，开头内容: "${trimmed.substring(0, 100)}"`);
  }
  
  // 尝试解析
  try {
    return JSON.parse(trimmed);
  } catch (err: any) {
    // 提供详细的错误信息
    const preview = trimmed.length > 200 ? trimmed.substring(0, 200) + '...' : trimmed;
    throw new Error(`${context} - JSON 解析失败: ${err.message}\n响应内容: ${preview}`);
  }
};

/**
 * 调用 AI API 的辅助函数
 * 使用 BASE_URL、API_KEY 和 MODEL 从环境变量
 */
interface AIRequestConfig {
  contents: string;
  responseSchema?: {
    type: string;
    properties?: any;
    items?: any;
    description?: string;
    required?: string[];
  };
  onUsage?: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
}

const callAIAPI = async (config: AIRequestConfig): Promise<string> => {
  const baseUrl = process.env.BASE_URL;
  const apiKey = process.env.API_KEY;
  const model = process.env.MODEL;

  if (!baseUrl || !apiKey) {
    throw new Error('BASE_URL 或 API_KEY 未在 .env 中配置');
  }

  // 构建请求体
  const requestBody: any = {
    model: model || 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: config.contents
      }
    ]
  };

  // 如果有响应格式配置，尝试添加到请求体
  // 支持多种 API 的 JSON 格式强制方式
  if (config.responseSchema) {
    // 首先尝试 OpenAI 的 json_schema 方式
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: config.responseSchema,
        strict: true
      }
    };
    
    // 备选方案：简单的 JSON 模式（某些 API 支持）
    // requestBody.response_format = { type: 'json_object' };
  }

  // 发送请求到 API
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API 调用失败 (${response.status}): ${error.error?.message || response.statusText}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    const text = await response.text();
    throw new Error(`API 响应无法解析为 JSON: ${text.substring(0, 200)}`);
  }

  if (data?.usage && config.onUsage) {
    config.onUsage({
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0,
      totalTokens: data.usage.total_tokens || 0,
    });
  }
  
  // 提取响应内容
  if (data.choices && data.choices[0] && data.choices[0].message) {
    const content = data.choices[0].message.content;
    
    // 验证内容不为空
    if (!content) {
      throw new Error('API 返回的内容为空');
    }
    
    // 如果是字符串，尝试提取或验证 JSON
    if (typeof content === 'string') {
      const trimmed = content.trim();
      
      // 情况1：响应已经是 JSON（以 { 或 [ 开头）
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // 验证是否为有效的 JSON
        if (!isValidJSON(trimmed)) {
          // 尝试提取 JSON（可能有多余文本）
          const jsonMatch = extractJSONFromText(trimmed);
          if (jsonMatch) {
            return jsonMatch;
          }
          throw new Error(`API 返回的内容不是有效的 JSON: ${trimmed.substring(0, 100)}`);
        }
        return trimmed;
      }
      
      // 情况2：响应是纯文本，需要尝试提取 JSON
      const extractedJSON = extractJSONFromText(trimmed);
      if (extractedJSON) {
        console.warn('API 返回了非 JSON 格式，但成功提取了内部的 JSON');
        return extractedJSON;
      }
      
      // 情况3：完全无法提取，返回原始内容让后续处理
      console.warn('API 返回了非 JSON 格式的纯文本，内容:', trimmed.substring(0, 200));
      throw new Error(`API 返回的是纯文本而不是 JSON:\n开头: ${trimmed.substring(0, 150)}\n\n建议: 检查 BASE_URL 和 MODEL 是否正确配置，确保 API 支持 JSON 格式响应。`);
    }
    
    return JSON.stringify(content);
  }

  throw new Error(`API 响应格式异常，无法找到 choices[0].message.content: ${JSON.stringify(data).substring(0, 200)}`);
};

/**
 * 从文本中提取 JSON 对象或数组
 * 尝试找到第一个有效的 JSON 结构
 */
const extractJSONFromText = (text: string): string | null => {
  // 尝试找到第一个 { 或 [
  const jsonStartIndex = Math.min(
    text.indexOf('{') >= 0 ? text.indexOf('{') : Infinity,
    text.indexOf('[') >= 0 ? text.indexOf('[') : Infinity
  );
  
  if (jsonStartIndex === Infinity) {
    return null; // 没有找到 JSON 的开始
  }
  
  // 从 { 或 [ 开始尝试解析
  const substring = text.substring(jsonStartIndex);
  
  // 尝试找到匹配的 } 或 ]
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < substring.length; i++) {
    const char = substring[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      
      // 如果找到了匹配的关闭括号
      if ((braceCount === 0 && bracketCount === 0) && (char === '}' || char === ']')) {
        const potentialJSON = substring.substring(0, i + 1);
        if (isValidJSON(potentialJSON)) {
          return potentialJSON;
        }
      }
    }
  }
  
  return null;
};

/**
 * 构建GitHub API请求头
 * 如果配置了GITHUB_TOKEN，将其添加到Authorization头中
 */
const buildGitHubHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };
  
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }
  
  return headers;
};

/**
 * 构建 raw.githubusercontent.com 请求头
 * 不包含 Authorization 头以避免 CORS 预检请求失败
 */
const buildRawGitHubHeaders = (): HeadersInit => {
  return {
    'Accept': 'text/plain; charset=utf-8'
  };
};

/**
 * 根据编程语言获取函数定义的正则表达式
 */
const getFunctionRegex = (language: string): RegExp => {
  const patterns: Record<string, string> = {
    // JavaScript/TypeScript
    'javascript': `\\b(async\\s+)?function\\s+FUNC_NAME\\s*\\(|const\\s+FUNC_NAME\\s*=\\s*|let\\s+FUNC_NAME\\s*=\\s*`,
    'typescript': `\\b(async\\s+)?function\\s+FUNC_NAME\\s*\\(|const\\s+FUNC_NAME\\s*=\\s*|let\\s+FUNC_NAME\\s*=\\s*`,
    'jsx': `\\b(async\\s+)?function\\s+FUNC_NAME\\s*\\(|const\\s+FUNC_NAME\\s*=\\s*`,
    'tsx': `\\b(async\\s+)?function\\s+FUNC_NAME\\s*\\(|const\\s+FUNC_NAME\\s*=\\s*`,
    // Python
    'python': `^\\s*def\\s+FUNC_NAME\\s*\\(|^\\s*async\\s+def\\s+FUNC_NAME\\s*\\(`,
    // Java/C#
    'java': `(public|private|protected)?\\s*(static)?\\s*\\w+\\s+FUNC_NAME\\s*\\(`,
    'csharp': `(public|private|protected)?\\s*(static)?\\s*(async\\s+)?\\w+\\s+FUNC_NAME\\s*\\(`,
    // C/C++
    'c': `\\w+\\s+FUNC_NAME\\s*\\([^)]*\\)\\s*\\{`,
    'cpp': `\\w+\\s+FUNC_NAME\\s*\\([^)]*\\)\\s*\\{`,
    // Go
    'go': `func\\s+(\\(.*?\\))?\\s*FUNC_NAME\\s*\\(`,
    // PHP
    'php': `(public|private|protected)?\\s*(static)?\\s*function\\s+FUNC_NAME\\s*\\(`,
    // Ruby
    'ruby': `def\\s+FUNC_NAME\\s*(\\(|$)`,
  };
  
  const pattern = Object.values(patterns).join('|');
  return new RegExp(pattern, 'gim');
};

/**
 * 从代码中提取函数片段（前后各20行）
 * 支持多种编程语言的函数定义方式，包括C/C++、Java、Python等
 */
const extractFunctionCode = (code: string, functionName: string, language: string): string | null => {
  const lines = code.split('\n');
  
  // 构造正则表达式来精确匹配函数定义（支持更多C/C++形式）
  const funcNameEscaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    // JavaScript/TypeScript
    new RegExp(`\\b(async\\s+)?function\\s+${funcNameEscaped}\\s*\\(`, 'i'),
    new RegExp(`const\\s+${funcNameEscaped}\\s*=\\s*`, 'i'),
    new RegExp(`let\\s+${funcNameEscaped}\\s*=\\s*`, 'i'),
    // Python
    new RegExp(`def\\s+${funcNameEscaped}\\s*\\(`, 'i'),
    new RegExp(`async\\s+def\\s+${funcNameEscaped}\\s*\\(`, 'i'),
    // Java/C#/C++/Go
    new RegExp(`\\b(public|private|protected)?\\s*(static)?\\s*(const\\s+)?(async\\s+)?\\w+[\\s\\*&]+${funcNameEscaped}\\s*\\(`, 'i'),
    // C/C++ (more patterns for pointer/reference return types)
    new RegExp(`\\b\\w+[\\s\\*&]+${funcNameEscaped}\\s*\\([^)]*\\)\\s*[{;]`, 'i'),
    // Go
    new RegExp(`func\\s+(\\([^)]*\\))?\\s*${funcNameEscaped}\\s*\\(`, 'i'),
    // Ruby
    new RegExp(`def\\s+${funcNameEscaped}\\s*(\\(|$)`, 'i'),
    // PHP
    new RegExp(`function\\s+${funcNameEscaped}\\s*\\(`, 'i'),
  ];
  
  for (const pattern of patterns) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const startLine = Math.max(0, i - 5);
        const endLine = Math.min(lines.length, i + 25);
        return lines.slice(startLine, endLine).join('\n');
      }
    }
  }
  
  return null;
};

/**
 * 定位函数的三阶段策略
 */
const locateFunctionInProject = async (
  functionName: string,
  preferredFile: string,
  owner: string,
  repo: string,
  branch: string,
  flatTree: any[],
  getFileContent: (path: string) => Promise<string | null>,
  addLog: (msg: string, type: 'info' | 'success' | 'error', details?: any) => void,
  onAIUsage?: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void
): Promise<{ filePath: string; code: string } | null> => {
  // 第一阶段：在上级调用文件中搜索
  if (preferredFile) {
    try {
      const content = await getFileContent(preferredFile);
      if (content && extractFunctionCode(content, functionName, preferredFile)) {
        const code = extractFunctionCode(content, functionName, preferredFile)!;
        addLog(`成功在 ${preferredFile} 中定位函数 ${functionName}`, 'success');
        return { filePath: preferredFile, code };
      }
    } catch (err) {
      // 继续下一阶段
    }
  }

  // 第二阶段：让 AI 分析可能的文件
  const codeFiles = flatTree
    .filter((item: any) => item.type === 'blob' && isCodeFile(item.path))
    .map((item: any) => item.path)
    .slice(0, 500);
  
  try {
    const aiSuggestion = await callAIAPI({
      contents: `根据以下项目文件清单和函数名，推断该函数最可能定义在哪个文件中。
函数名: ${functionName}
上级调用文件: ${preferredFile || '未知'}

项目文件清单（仅列出代码文件）:
${codeFiles.join('\n')}

请只返回最可能的文件路径，不需要其他说明。`
    });

    const suggestedFile = aiSuggestion.trim();
    if (suggestedFile && suggestedFile !== '未知' && suggestedFile !== 'unknown') {
      const content = await getFileContent(suggestedFile);
      if (content && extractFunctionCode(content, functionName, suggestedFile)) {
        const code = extractFunctionCode(content, functionName, suggestedFile)!;
        addLog(`通过 AI 推断在 ${suggestedFile} 中定位函数 ${functionName}`, 'success');
        return { filePath: suggestedFile, code };
      }
    }
  } catch (err) {
    // 继续下一阶段
  }

  // 第三阶段：在所有代码文件中搜索
  for (const file of codeFiles) {
    try {
      const content = await getFileContent(file);
      if (content && extractFunctionCode(content, functionName, file)) {
        const code = extractFunctionCode(content, functionName, file)!;
        addLog(`通过全局搜索在 ${file} 中定位函数 ${functionName}`, 'success');
        return { filePath: file, code };
      }
    } catch (err) {
      // 继续搜索
    }
  }

  addLog(`无法定位函数 ${functionName} 的源代码`, 'error');
  return null;
};

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'go', 'java', 'rs', 'c', 'cpp', 'h', 'hpp', 
  'cs', 'php', 'rb', 'swift', 'kt', 'html', 'css', 'scss', 'json', 'toml', 
  'yaml', 'yml', 'xml', 'sh', 'bat', 'ps1', 'vue', 'svelte', 'dart', 'sql', 
  'graphql', 'md', 'gradle'
]);

const isCodeFile = (path: string) => {
  const parts = path.split('/');
  const filename = parts[parts.length - 1].toLowerCase();
  if (['dockerfile', 'makefile', 'package.json', 'cargo.toml', 'go.mod', 'pom.xml', 'build.gradle'].includes(filename)) return true;
  const ext = filename.split('.').pop();
  return ext && CODE_EXTENSIONS.has(ext);
};

const LogItem = ({ log }: { log: LogEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  
  return (
    <div className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-1.5 break-all">
          <span className="text-slate-400 mt-0.5 shrink-0">{log.timestamp.toLocaleTimeString()}</span>
          <span className={`${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-emerald-600' : 'text-blue-600'}`}>
            {log.message}
          </span>
        </div>
        <div className="flex items-center shrink-0 ml-2">
          {log.details?.prompt && (
            <button 
              onClick={() => setShowPrompt(!showPrompt)} 
              className={`mr-2 px-1.5 py-0.5 rounded text-[10px] ${showPrompt ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Prompt
            </button>
          )}
          {log.details && (
            <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
      {showPrompt && log.details?.prompt && (
        <div className="mt-1.5 bg-indigo-50 text-indigo-900 p-2 rounded overflow-x-auto border border-indigo-100">
          <pre className="font-mono text-[10px] whitespace-pre-wrap break-all">
            {log.details.prompt}
          </pre>
        </div>
      )}
      {expanded && log.details && (
        <div className="mt-1.5 bg-slate-800 text-slate-300 p-2 rounded overflow-x-auto">
          <pre className="font-mono text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(truncateLongStrings(log.details), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const serializeLogs = (items: LogEntry[]) =>
  items.map((log) => ({
    ...log,
    timestamp: log.timestamp.toISOString(),
  }));

const deserializeLogs = (items: ProjectAnalysisRecord['logs']): LogEntry[] =>
  items.map((log) => ({
    ...log,
    timestamp: new Date(log.timestamp),
  }));

const MODULE_COLORS = ['#2563eb', '#0f766e', '#059669', '#ca8a04', '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#4f46e5', '#0891b2'];

const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  idle: '待开始',
  fetching_repo: '获取仓库信息',
  analyzing_project: '分析项目结构',
  evaluating_entry: '研判入口文件',
  analyzing_calls: '分析调用链',
  analyzing_modules: '划分功能模块',
  completed: '工作流结束',
  error: '工作流异常',
};

const WORKFLOW_STATUS_STYLES: Record<WorkflowStatus, string> = {
  idle: 'bg-slate-100 text-slate-600',
  fetching_repo: 'bg-blue-50 text-blue-700',
  analyzing_project: 'bg-indigo-50 text-indigo-700',
  evaluating_entry: 'bg-amber-50 text-amber-700',
  analyzing_calls: 'bg-emerald-50 text-emerald-700',
  analyzing_modules: 'bg-fuchsia-50 text-fuchsia-700',
  completed: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
};

const collectFunctionNodes = (functions: AnalyzedFunction[]): Array<{ name: string; file: string; description: string }> => {
  const nodes: Array<{ name: string; file: string; description: string }> = [];

  const walkSubFunctions = (subFunctions: SubFunction[] | undefined) => {
    if (!subFunctions) {
      return;
    }

    subFunctions.forEach((sub) => {
      nodes.push({
        name: sub.name,
        file: sub.possibleFile,
        description: sub.description,
      });
      walkSubFunctions(sub.subFunctions);
    });
  };

  functions.forEach((func) => {
    nodes.push({ name: func.name, file: func.file, description: func.description });
    walkSubFunctions(func.subFunctions);
  });

  return nodes;
};

const applyModulesToFunctions = (
  functions: AnalyzedFunction[],
  modules: FunctionModule[],
): AnalyzedFunction[] => {
  const functionModuleMap = new Map<string, FunctionModule>();
  modules.forEach((module) => {
    module.functionNames.forEach((functionName) => {
      functionModuleMap.set(functionName.toLowerCase(), module);
    });
  });

  const decorateSubFunctions = (subFunctions: SubFunction[] | undefined): SubFunction[] | undefined => {
    if (!subFunctions) {
      return undefined;
    }

    return subFunctions.map((sub) => {
      const matchedModule = functionModuleMap.get(sub.name.toLowerCase());
      return {
        ...sub,
        moduleId: matchedModule?.id,
        moduleName: matchedModule?.name,
        subFunctions: decorateSubFunctions(sub.subFunctions),
      };
    });
  };

  return functions.map((func) => {
    const matchedModule = functionModuleMap.get(func.name.toLowerCase());
    return {
      ...func,
      moduleId: matchedModule?.id,
      moduleName: matchedModule?.name,
      subFunctions: decorateSubFunctions(func.subFunctions),
    };
  });
};

const normalizeFunctionName = (name: string) => {
  if (!name) return '';
  const plain = name.trim();
  if (plain.includes('::')) {
    return plain.split('::').pop() || plain;
  }
  if (plain.includes('.')) {
    return plain.split('.').pop() || plain;
  }
  return plain;
};

const findFunctionLine = (code: string, functionName: string) => {
  const lines = code.split('\n');
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const normalized = normalizeFunctionName(functionName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const className = functionName.includes('::') ? functionName.split('::')[0] : '';
  const methodName = functionName.includes('::') ? functionName.split('::')[1] : '';
  const patterns = [
    new RegExp(`\\b${escaped}\\s*\\(`),
    new RegExp(`\\b${normalized}\\s*\\(`),
    className && methodName ? new RegExp(`\\b${className}\\s*::\\s*${methodName}\\s*\\(`) : null,
  ].filter(Boolean) as RegExp[];

  for (let i = 0; i < lines.length; i += 1) {
    if (patterns.some((pattern) => pattern.test(lines[i]))) {
      return i + 1;
    }
  }

  return 1;
};

export default function Analyze() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const historyId = searchParams.get('history');

  const [urlInput, setUrlInput] = useState(`https://github.com/${owner}/${repo}`);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [flatFileList, setFlatFileList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [targetFunctionLine, setTargetFunctionLine] = useState<number | null>(null);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const [confirmedEntryFile, setConfirmedEntryFile] = useState<{ path: string, reason: string } | null>(null);
  const [evaluatingEntry, setEvaluatingEntry] = useState(false);

  const [analyzedFunctions, setAnalyzedFunctions] = useState<AnalyzedFunction[]>([]);
  const [analyzingFunctions, setAnalyzingFunctions] = useState(false);
  const [functionModules, setFunctionModules] = useState<FunctionModule[]>([]);
  const [analyzingModules, setAnalyzingModules] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('idle');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLogFullscreen, setIsLogFullscreen] = useState(false);
  const [isMarkdownPreviewOpen, setIsMarkdownPreviewOpen] = useState(false);
  const [aiStats, setAiStats] = useState<AIStats>({ callCount: 0, inputTokens: 0, outputTokens: 0 });

  const functionAnalysisCacheRef = useRef<Map<string, SubFunction[]>>(new Map());

  const [showFileTree, setShowFileTree] = useState(true);
  const [showCodeViewer, setShowCodeViewer] = useState(true);
  const [showPanorama, setShowPanorama] = useState(true);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info', details?: any) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      message,
      type,
      details
    }]);
  };

  const trackAIUsage = (usage: { inputTokens: number; outputTokens: number }) => {
    setAiStats((prev) => ({
      callCount: prev.callCount + 1,
      inputTokens: prev.inputTokens + usage.inputTokens,
      outputTokens: prev.outputTokens + usage.outputTokens,
    }));
  };

  const restoreFromHistory = (record: ProjectAnalysisRecord) => {
    setUrlInput(record.projectUrl);
    setTree(record.fileTree);
    setFlatFileList(record.flatFileList);
    setDefaultBranch(record.defaultBranch || 'main');
    setRepoInfo(record.repoInfo as RepoInfoSnapshot | null);
    setAiAnalysis(record.aiAnalysis);
    setConfirmedEntryFile(record.confirmedEntryFile);
    setFunctionModules(record.functionModules || []);
    setActiveModuleId(null);
    setAnalyzedFunctions(record.analyzedFunctions);
    setLogs(deserializeLogs(record.logs));
    setError('');
    setSelectedFile(null);
    setFileContent('');
    setAiError('');
    setLoading(false);
    setAiLoading(false);
    setEvaluatingEntry(false);
    setAnalyzingFunctions(false);
    setAnalyzingModules(false);
    setAiStats({ callCount: 0, inputTokens: 0, outputTokens: 0 });
    functionAnalysisCacheRef.current.clear();
    setWorkflowStatus('completed');
  };

  const getCurrentAnalysisMarkdown = () => {
    if (!owner || !repo) {
      return '';
    }

    return buildAnalysisMarkdown({
      id: `${owner}-${repo}`,
      owner,
      repo,
      projectName: repoInfo?.name || repo,
      projectUrl: `https://github.com/${owner}/${repo}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultBranch,
      repoInfo,
      aiAnalysis,
      confirmedEntryFile,
      fileTree: tree,
      flatFileList,
      functionModules,
      analyzedFunctions,
      logs: serializeLogs(logs),
    });
  };

  const handleExportMarkdown = () => {
    const markdown = getCurrentAnalysisMarkdown();
    if (!markdown || !owner || !repo) {
      return;
    }

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${owner}-${repo}-analysis.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  useEffect(() => {
    if (historyId) {
      const historyRecord = getProjectHistoryRecord(historyId);
      if (historyRecord) {
        restoreFromHistory(historyRecord);
        return;
      }
      setError('未找到历史分析记录');
      setLoading(false);
      return;
    }

    if (owner && repo) {
      fetchRepoData(owner, repo);
    } else {
      navigate('/');
    }
  }, [historyId, owner, repo]);

  const fetchRepoData = async (owner: string, repo: string) => {
    setLoading(true);
    setError('');
    setTree([]);
    setFlatFileList([]);
    setSelectedFile(null);
    setFileContent('');
    setLogs([]);
    setAiStats({ callCount: 0, inputTokens: 0, outputTokens: 0 });
    functionAnalysisCacheRef.current.clear();
    setRepoInfo(null);
    setAiAnalysis(null);
    setConfirmedEntryFile(null);
    setFunctionModules([]);
    setActiveModuleId(null);
    setAnalyzedFunctions([]);
    setWorkflowStatus('fetching_repo');

    addLog(`开始校验 GitHub 项目地址: ${owner}/${repo}`, 'info');

    try {
      // 1. 获取仓库信息，主要是为了获取默认分支
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: buildGitHubHeaders()
      });
      if (!repoRes.ok) {
        if (repoRes.status === 404) throw new Error('仓库不存在或为私有仓库');
        if (repoRes.status === 403) throw new Error('API 请求频率超限，请稍后再试');
        throw new Error('获取仓库信息失败');
      }
      const repoData = await repoRes.json();
      const branch = repoData.default_branch;
      const description = repoData.description || '';
      setDefaultBranch(branch);
      setRepoInfo({
        name: repoData.name,
        fullName: repoData.full_name,
        description,
        htmlUrl: repoData.html_url,
        defaultBranch: branch,
        language: repoData.language,
        stargazersCount: repoData.stargazers_count,
        forksCount: repoData.forks_count,
        openIssuesCount: repoData.open_issues_count,
        updatedAt: repoData.updated_at,
      });
      addLog(`校验通过，获取到默认分支: ${branch}`, 'success');

      // 2. 获取整个文件树
      addLog('正在获取项目文件列表...', 'info');
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
        headers: buildGitHubHeaders()
      });
      if (!treeRes.ok) throw new Error('获取文件树失败');
      
      const treeData = await treeRes.json();
      setFlatFileList(treeData.tree.map((item: any) => item.path));
      addLog(`成功获取项目文件列表，共 ${treeData.tree.length} 个文件/目录`, 'success');
      
      // 3. 构建树形结构
      const root: TreeNode[] = [];
      const map: Record<string, TreeNode> = {};

      // 排序：文件夹在前，文件在后
      const sortedTree = treeData.tree.sort((a: any, b: any) => {
        if (a.type === b.type) return a.path.localeCompare(b.path);
        return a.type === 'tree' ? -1 : 1;
      });

      sortedTree.forEach((item: any) => {
        const parts = item.path.split('/');
        const name = parts[parts.length - 1];
        const node: TreeNode = {
          path: item.path,
          name,
          type: item.type,
          url: item.url,
          children: item.type === 'tree' ? [] : undefined,
          isOpen: false,
        };

        map[item.path] = node;

        if (parts.length === 1) {
          root.push(node);
        } else {
          const parentPath = parts.slice(0, -1).join('/');
          if (map[parentPath] && map[parentPath].children) {
            map[parentPath].children!.push(node);
          }
        }
      });

      setTree(root);
      
      // 触发 AI 分析
      analyzeWithAI(treeData.tree, description, branch);
    } catch (err: any) {
      setWorkflowStatus('error');
      setError(err.message || '发生未知错误');
      addLog(`错误: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!owner || !repo) {
      return;
    }

    if (loading) {
      return;
    }

    upsertProjectHistory({
      owner,
      repo,
      defaultBranch,
      repoInfo,
      aiAnalysis,
      confirmedEntryFile,
      fileTree: tree,
      flatFileList,
      functionModules,
      analyzedFunctions,
      logs: serializeLogs(logs),
    });
  }, [
    owner,
    repo,
    loading,
    defaultBranch,
    repoInfo,
    aiAnalysis,
    confirmedEntryFile,
    tree,
    flatFileList,
    functionModules,
    analyzedFunctions,
    logs,
  ]);

  const analyzeWithAI = async (flatTree: any[], description: string, branch: string) => {
    setAiLoading(true);
    setWorkflowStatus('analyzing_project');
    setAiError('');
    setAiAnalysis(null);
    setConfirmedEntryFile(null);
    setAnalyzedFunctions([]);

    try {
      const codeFiles = flatTree
        .filter(item => item.type === 'blob')
        .map(item => item.path)
        .filter(isCodeFile);

      addLog(`过滤非代码文件，剩余 ${codeFiles.length} 个代码文件`, 'info');

      // 限制文件列表大小，防止超出 prompt 限制
      const fileListStr = codeFiles.slice(0, 1000).join('\n');
      const prompt = `请分析以下 GitHub 项目的文件路径列表，并以 JSON 格式返回分析结果。\n\n要求：\n1. 必须返回 JSON 格式\n2. 必须包含 mainLanguages、techStack、entryFiles 三个字段\n3. 只返回 JSON，不要有其他文本\n\n分析要点：\n- 主要编程语言（如 TypeScript, Python, Java, C++）\n- 技术栈标签（如 React, Spring Boot, Express, Django）\n- 可能的主入口文件（如 main.ts, index.js, App.java, main.py）\n\n文件列表：\n${fileListStr}\n\n请仅返回 JSON 格式的结果：{\n  \"mainLanguages\": [],\n  \"techStack\": [],\n  \"entryFiles\": []\n}`;

      addLog('开始 AI 智能分析...', 'info', { prompt });

      try {
        const rawResponse = await callAIAPI({
          onUsage: trackAIUsage,
          contents: prompt,
          responseSchema: {
            type: "object",
            properties: {
              mainLanguages: { 
                type: "array", 
                items: { type: "string" },
                description: "项目使用的主要编程语言列表"
              },
              techStack: { 
                type: "array", 
                items: { type: "string" },
                description: "项目使用的技术栈标签列表"
              },
              entryFiles: { 
                type: "array", 
                items: { type: "string" },
                description: "可能的主入口文件路径列表"
              }
            },
            required: ["mainLanguages", "techStack", "entryFiles"]
          }
        });

        const result = safeJSONParse(rawResponse, 'AI 项目分析响应');
        
        setAiAnalysis(result);
        addLog('AI 分析完成', 'success', { response: result });
        
        // 触发入口文件研判
        evaluateEntryFiles(result.entryFiles, result.mainLanguages, description, flatTree, branch);
      } catch (parseErr: any) {
        console.error("JSON Parse Error:", parseErr);
        throw parseErr;
      }
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      setAiError('AI 分析失败，请稍后重试');
      setWorkflowStatus('error');
      addLog(`AI 分析失败: ${err.message}`, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const evaluateEntryFiles = async (entryFiles: string[], mainLanguages: string[], description: string, flatTree: any[], branch: string) => {
    if (!entryFiles || entryFiles.length === 0) return;
    setEvaluatingEntry(true);
    setWorkflowStatus('evaluating_entry');
    setConfirmedEntryFile(null);
    let foundEntry = false;

    for (const filePath of entryFiles) {
      addLog(`开始研判文件是否为真实入口: ${filePath}`, 'info');
      try {
        const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURI(filePath)}`, {
          headers: buildRawGitHubHeaders()
        });
        if (!res.ok) {
          addLog(`无法获取文件内容: ${filePath}`, 'error');
          continue;
        }
        const text = await res.text();
        const lines = text.split('\n');
        let contentToSend = text;
        if (lines.length > 4000) {
          const first2000 = lines.slice(0, 2000).join('\n');
          const last2000 = lines.slice(-2000).join('\n');
          contentToSend = `${first2000}\n\n... [中间省略 ${lines.length - 4000} 行] ...\n\n${last2000}`;
          addLog(`文件 ${filePath} 超过 4000 行，已截取前后各 2000 行`, 'info');
        }

        const prompt = `请研判以下文件是否是该 GitHub 项目的真实主入口文件，并以 JSON 格式返回结果。

项目链接: https://github.com/${owner}/${repo}
项目简介: ${description || '无'}
主要编程语言: ${mainLanguages.join(', ')}
当前研判文件路径: ${filePath}

文件内容:
${contentToSend}

要求：
1. 必须返回 JSON 格式
2. 必须包含 isEntryFile（boolean）和 reason（string）字段
3. 只返回 JSON，不要有其他文本

请根据文件内容和项目信息，判断这是否是项目的核心入口文件。

请仅返回 JSON 格式的结果：{\n  \"isEntryFile\": true/false,\n  \"reason\": \"...\"\n}`;

        addLog(`AI 正在研判文件: ${filePath}`, 'info', { prompt });

        try {
          const rawResponse = await callAIAPI({
            onUsage: trackAIUsage,
            contents: prompt,
            responseSchema: {
              type: "object",
              properties: {
                isEntryFile: { type: "boolean", description: "是否是真实的主入口文件" },
                reason: { type: "string", description: "研判理由" }
              },
              required: ["isEntryFile", "reason"]
            }
          });

          const result = safeJSONParse(rawResponse, `AI 入口文件研判响应 (${filePath})`);

          addLog(`文件 ${filePath} 研判结果: ${result.isEntryFile ? '是入口文件' : '不是入口文件'}`, result.isEntryFile ? 'success' : 'info', { response: result });
          
          if (result.isEntryFile) {
            foundEntry = true;
            setConfirmedEntryFile({ path: filePath, reason: result.reason });
            addLog(`已确认项目真实入口文件: ${filePath}`, 'success');
            
            // 触发子函数分析
            await analyzeSubFunctions(filePath, contentToSend, description, flatTree);
            break; // Stop evaluating further files
          }
        } catch (parseErr: any) {
          console.error("JSON Parse Error:", parseErr);
          throw parseErr;
        }
      } catch (err: any) {
        addLog(`研判文件 ${filePath} 时出错: ${err.message}`, 'error');
      }
    }
    if (!foundEntry) {
      setWorkflowStatus('completed');
    }
    setEvaluatingEntry(false);
  };

  /**
   * 获取文件内容的缓存包装函数
   */
  const getFileContentCached = async (filePath: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURI(filePath)}`, {
        headers: buildRawGitHubHeaders()
      });
      if (!res.ok) return null;
      return await res.text();
    } catch (err) {
      return null;
    }
  };

  /**
   * 检查函数是否为库函数（系统库或第三方库）
   * 如果是库函数，返回 true，否则返回 false
   */
  const isLibraryFunction = (funcName: string): boolean => {
    // 常见系统和库函数前缀模式
    const libraryPatterns = [
      // Node.js 和浏览器 API
      /^(console|window|document|navigator|location|fetch|XMLHttpRequest|setTimeout|setInterval|require|import|eval|process|fs|path|os|util|stream|Buffer)\b/i,
      // 前端框架
      /^(React|ReactDOM|Vue|Angular|Angular\$|Ember|Backbone|jQuery)\b/i,
      // 常用库
      /^(lodash|underscore|moment|dayjs|axios|fetch|request|superagent|got|ky|http|https|url|querystring)\b/i,
      // 数据库和 ORM
      /^(mongoose|sequelize|typeorm|knex|prisma|sql|mysql|postgresql|redis|mongodb)\b/i,
      // 工具库
      /^(chalk|winston|morgan|express|fastify|koa|hapi|helmet|cors|dotenv|joi)\b/i,
      // 系统函数
      /^(print|println|printf|puts|console\.|System\.|Arrays\.|Collections\.|String\.)\b/i,
      // 对象方法（通过点号调用的库函数）
      /^(Object|Array|String|Number|Math|Date|JSON|RegExp|Error|Promise|Symbol|Proxy|Reflect|Map|Set|WeakMap|WeakSet)\./i,
    ];
    
    return libraryPatterns.some(pattern => pattern.test(funcName));
  };

  /**
   * 递归分析函数调用链
   */
  const recursiveAnalyzeFunction = async (
    subFunctions: SubFunction[],
    parentFilePath: string,
    flatTree: any[],
    currentDepth: number = 0
  ): Promise<SubFunction[]> => {
    const maxDepth = parseInt(process.env.MAX_DRILL_DOWN_DEPTH || '2');
    
    if (currentDepth >= maxDepth) {
      addLog(`已达到最大递归深度 (${maxDepth})`, 'info');
      return subFunctions;
    }

    // 过滤需要下钻分析的函数（drillDown为0或1）
    const functionsToAnalyze = subFunctions.filter(func => func.shouldDrillDown >= 0);

    // 并行处理多个函数，但限制并发数
    const results = [...subFunctions];
    for (let i = 0; i < functionsToAnalyze.length; i += 3) {
      const batch = functionsToAnalyze.slice(i, i + 3);
      
      await Promise.all(batch.map(async (func) => {
        const funcIndex = results.indexOf(func);
        
        try {
          addLog(`开始分析函数 ${func.name} 的调用链 (深度: ${currentDepth + 1})`, 'info');

          // 定位函数位置
          const located = await locateFunctionInProject(
            func.name,
            func.possibleFile || parentFilePath,
            owner,
            repo,
            defaultBranch,
            flatTree,
            getFileContentCached,
            addLog
          );

          if (!located) {
            addLog(`无法定位函数 ${func.name}，停止下钻分析`, 'error');
            return;
          }

          // 提取函数代码
          const { code, filePath } = located;

          // 检查是否为系统函数或库函数
          if (isLibraryFunction(func.name)) {
            addLog(`"${func.name}" 是系统或库函数，标记无需下钻分析`, 'info');
            func.shouldDrillDown = -1;
            return;
          }

          // 让AI分析该函数的子函数
          const prompt = `请分析以下代码片段，识别其调用的关键子函数或方法（数量不超过15个），并以 JSON 数组格式返回。

函数: ${func.name}
文件: ${filePath}

代码:
${code}

要求：
1. 必须返回 JSON 数组格式
2. 数组中每个对象必须包含 name、shouldDrillDown、possibleFile、description 四个字段
3. 只返回 JSON，不要有其他文本

分析说明：
- 请提取所有直接调用的函数/方法，包括：
  - 普通函数调用：functionName()
  - 对象方法调用：object.methodName()
  - 类方法调用：ClassName.methodName()
  - 链式调用：object.method1().method2()
- 对于对象.方法的形式，请提取真实的方法名（去掉对象前缀）
  例如：tsharkManager.getNetworkAdapterInfo() → 提取 "getNetworkAdapterInfo"
- 忽略系统函数（console.log, print 等）
- 只分析该函数本身的调用，不分析嵌套函数定义

库函数识别说明（重要 - 这将加快分析速度）：
对于以下类型的函数，请将 shouldDrillDown 设置为 -1（不需要下钻分析）：
1. 系统库函数：console, window, document, fetch, process, fs, path, os, util, stream 等
2. 第三方框架：React, Vue, Angular, jQuery, Lodash, Axios, Express 等
3. 数据库/ORM：mongoose, sequelize, typeorm, prisma, redis, mongodb 等
4. 工具库：moment, dayjs, chalk, winston, joi, dotenv 等
5. Node.js 内置模块方法
6. 语言原生 API：Object.*, Array.*, String.*, Promise.*, Math.*, JSON.* 等

对于每一个识别出的子函数/方法，请提供：
1. name: 函数或方法名（如果是方法调用，提取方法名）
2. shouldDrillDown: 是否值得进一步下钻分析（-1 表示库函数/不需要下钻，0 表示不确定，1 表示项目内部函数/需要下钻）
3. possibleFile: 这个函数/方法可能定义在哪个文件中（基于命名规范推断）
4. description: 函数简介

请仅返回 JSON 数组，格式如下：
[
  {"name": "...", "shouldDrillDown": -1/0/1, "possibleFile": "...", "description": "..."}
]`;

          addLog(`AI 正在分析函数 ${func.name} 的子函数...`, 'info');

          try {
            const rawResponse = await callAIAPI({
              onUsage: trackAIUsage,
              contents: prompt,
              responseSchema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "函数名或方法名（去掉对象前缀）" },
                    shouldDrillDown: { type: "integer", description: "是否值得进一步下钻分析（-1, 0, 1）" },
                    possibleFile: { type: "string", description: "可能定义在哪个文件中" },
                    description: { type: "string", description: "函数简介功能介绍" }
                  },
                  required: ["name", "shouldDrillDown", "possibleFile", "description"]
                }
              }
            });

            const nestedFunctions = safeJSONParse(rawResponse, `AI 子函数分析响应 (${func.name})`);

            // 验证和增强库函数识别：确保库函数被标记为 -1
            const validatedFunctions = nestedFunctions.map((f: SubFunction) => {
              // 如果本地检测到库函数，强制标记为 -1
              if (isLibraryFunction(f.name)) {
                return { ...f, shouldDrillDown: -1 };
              }
              return f;
            });

            addLog(`成功识别出 ${validatedFunctions.length} 个子函数，其中库函数 ${validatedFunctions.filter((f: SubFunction) => f.shouldDrillDown === -1).length} 个`, 'success');

            // 设置深度并递归分析
            const nested = validatedFunctions.map((f: SubFunction) => ({ ...f, depth: currentDepth + 1 }));
            func.subFunctions = await recursiveAnalyzeFunction(nested, filePath, flatTree, currentDepth + 1);

            // 边分析边更新全景图
            setAnalyzedFunctions(prev => [...prev]);
          } catch (parseErr: any) {
            console.error("JSON Parse Error:", parseErr);
            throw parseErr;
          }

        } catch (err: any) {
          addLog(`分析函数 ${func.name} 时出错: ${err.message}`, 'error');
        }
      }));
    }

    return results;
  };


  const analyzeSubFunctions = async (filePath: string, fileContent: string, description: string, flatTree: any[]) => {
    setAnalyzingFunctions(true);
    setWorkflowStatus('analyzing_calls');
    addLog(`开始分析入口文件调用的子函数: ${filePath}`, 'info');

    try {
      const codeFiles = flatTree
        .filter(item => item.type === 'blob')
        .map(item => item.path)
        .filter(isCodeFile);
      const fileListStr = codeFiles.slice(0, 1000).join('\n');

      const prompt = `请分析以下入口文件，识别其调用的关键子函数（数量不超过20个），并以 JSON 数组格式返回。

项目简介: ${description || '无'}
入口文件路径: ${filePath}

项目文件列表:
${fileListStr}

文件内容:
${fileContent}

要求：
1. 必须返回 JSON 数组格式
2. 数组中每个对象必须包含 name、shouldDrillDown、possibleFile、description 四个字段
3. 只返回 JSON，不要有其他文本

库函数识别说明（重要 - 这将加快分析速度）：
对于以下类型的函数，请将 shouldDrillDown 设置为 -1（不需要下钻分析）：
1. 系统库函数：console, window, document, fetch, process, fs, path, os, util, stream 等
2. 第三方框架：React, Vue, Angular, jQuery, Lodash, Axios, Express 等
3. 数据库/ORM：mongoose, sequelize, typeorm, prisma, redis, mongodb 等
4. 工具库：moment, dayjs, chalk, winston, joi, dotenv 等
5. Node.js 内置模块和方法
6. 语言原生 API：Object.*, Array.*, String.*, Promise.*, Math.*, JSON.* 等

对于每一个识别出的子函数，请提供：
1. name: 函数名
2. shouldDrillDown: 是否值得进一步下钻分析（-1 表示库函数/不需要下钻，0 表示不确定，1 表示项目内部函数/需要下钻）
3. possibleFile: 这个函数可能定义在哪个文件中（根据 import 语句、文件路径推测，如果不知道可以为空）
4. description: 函数简介功能介绍

请仅返回 JSON 数组，格式如下：
[
  {"name": "...", "shouldDrillDown": -1/0/1, "possibleFile": "...", "description": "..."}
]
`;

      addLog(`AI 正在分析子函数...`, 'info', { prompt });

      try {
        const rawResponse = await callAIAPI({
          onUsage: trackAIUsage,
          contents: prompt,
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "函数名" },
                shouldDrillDown: { type: "integer", description: "是否值得进一步下钻分析（-1, 0, 1）" },
                possibleFile: { type: "string", description: "可能定义在哪个文件中" },
                description: { type: "string", description: "函数简介功能介绍" }
              },
              required: ["name", "shouldDrillDown", "possibleFile", "description"]
            }
          }
        });

        const subFunctions = safeJSONParse(rawResponse, 'AI 入口文件子函数分析响应');
        
        // 验证和增强库函数识别：确保库函数被标记为 -1
        const validatedSubFunctions = subFunctions.map((f: SubFunction) => {
          // 如果本地检测到库函数，强制标记为 -1
          if (isLibraryFunction(f.name)) {
            return { ...f, shouldDrillDown: -1 };
          }
          return f;
        });
        
        addLog(`成功识别出 ${validatedSubFunctions.length} 个子函数，其中库函数 ${validatedSubFunctions.filter((f: SubFunction) => f.shouldDrillDown === -1).length} 个`, 'success', { response: validatedSubFunctions });
        
        // 从文件路径中提取主函数名（如 main.c -> main）
        const mainFunctionName = filePath.split('/').pop()?.split('.')[0] || '主入口函数';
        
        const mainFunction: AnalyzedFunction = {
          name: mainFunctionName,
          file: filePath,
          description: '项目的主入口文件',
          subFunctions: validatedSubFunctions.map((f: SubFunction) => ({ ...f, depth: 0 }))
        };

        setAnalyzedFunctions([mainFunction]);

        // 开始递归分析
        addLog(`开始递归分析函数调用链...`, 'info');
        mainFunction.subFunctions = await recursiveAnalyzeFunction(
          mainFunction.subFunctions || [],
          filePath,
          flatTree,
          0
        );

        setAnalyzedFunctions([mainFunction]);
        addLog(`函数调用链分析完成！`, 'success');
        await analyzeFunctionModules([mainFunction], description, true);
      } catch (parseErr: any) {
        console.error("JSON Parse Error:", parseErr);
        throw parseErr;
      }

    } catch (err: any) {
      setWorkflowStatus('error');
      addLog(`分析子函数时出错: ${err.message}`, 'error');
    } finally {
      setAnalyzingFunctions(false);
    }
  };

  const analyzeFunctionModules = async (
    functionsToAnalyze?: AnalyzedFunction[],
    descriptionOverride?: string,
    force = false
  ) => {
    const targetFunctions = functionsToAnalyze || analyzedFunctions;
    if (!owner || !repo || targetFunctions.length === 0) {
      return;
    }

    if (!force && functionModules.length > 0) {
      addLog('已存在功能模块结果，跳过重复划分', 'info');
      setWorkflowStatus('completed');
      return;
    }

    setAnalyzingModules(true);
    setWorkflowStatus('analyzing_modules');
    addLog('开始进行功能模块划分...', 'info');

    try {
      const functionNodes = collectFunctionNodes(targetFunctions);
      const uniqueNodes = Array.from(new Map(functionNodes.map((node) => [node.name.toLowerCase(), node])).values()).slice(0, 300);
      const prompt = `请根据以下项目信息和函数节点信息，对整个函数调用全景图划分功能模块，并只返回 JSON。

项目：${owner}/${repo}
项目简介：${descriptionOverride || repoInfo?.description || '无'}
编程语言：${(aiAnalysis?.mainLanguages || []).join(', ') || repoInfo?.language || '未知'}
技术栈：${(aiAnalysis?.techStack || []).join(', ') || '未知'}

函数节点列表：
${JSON.stringify(uniqueNodes, null, 2)}

要求：
1. 最多划分 10 个模块
2. 每个模块必须包含 name、description、functionNames 字段
3. functionNames 中只填函数名，不要带文件路径
4. 每个函数尽量只归属一个最合适的模块
5. 只返回 JSON，不要解释

返回格式：
{
  "modules": [
    {
      "name": "模块名",
      "description": "模块职责",
      "functionNames": ["funcA", "funcB"]
    }
  ]
}`;
      addLog('AI 正在划分功能模块...', 'info', { prompt });

      const rawResponse = await callAIAPI({
        onUsage: trackAIUsage,
        contents: prompt,
        responseSchema: {
          type: 'object',
          properties: {
            modules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  functionNames: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['name', 'description', 'functionNames'],
              },
            },
          },
          required: ['modules'],
        },
      });

      const parsed = safeJSONParse(rawResponse, 'AI 功能模块划分响应');
      const modules: FunctionModule[] = (parsed.modules || []).slice(0, 10).map((module: any, index: number) => ({
        id: `module-${index + 1}`,
        name: module.name,
        description: module.description,
        color: MODULE_COLORS[index % MODULE_COLORS.length],
        functionNames: Array.from(new Set((module.functionNames || []).filter(Boolean))),
      }));

      const decoratedFunctions = applyModulesToFunctions(targetFunctions, modules);
      setFunctionModules(modules);
      setAnalyzedFunctions(decoratedFunctions);
      setActiveModuleId(null);
      setWorkflowStatus('completed');
      addLog(`功能模块划分完成，共 ${modules.length} 个模块`, 'success', { response: modules });
    } catch (err: any) {
      setWorkflowStatus('error');
      addLog(`功能模块划分失败: ${err.message}`, 'error');
    } finally {
      setAnalyzingModules(false);
    }
  };

  const handleReanalyzeModules = async () => {
    if (analyzedFunctions.length === 0) {
      addLog('尚无函数调用链，无法重新划分模块', 'error');
      return;
    }
    await analyzeFunctionModules(analyzedFunctions, repoInfo?.description || '', true);
  };

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedUrl = new URL(urlInput);
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        navigate(`/analyze?owner=${pathParts[0]}&repo=${pathParts[1]}`);
      }
    } catch (err) {
      setError('请输入有效的 GitHub URL');
    }
  };

  const fetchFileContent = async (node: TreeNode) => {
    if (node.type !== 'blob') return;
    
    setSelectedFile(node);
    setFileLoading(true);
    setFileContent('');
    setTargetFunctionLine(null);

    try {
      // 使用 raw.githubusercontent.com 获取原始文件内容
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURI(node.path)}`, {
        headers: buildRawGitHubHeaders()
      });
      if (!res.ok) throw new Error('获取文件内容失败');
      
      const text = await res.text();
      setFileContent(text);
    } catch (err: any) {
      setFileContent(`// 错误: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const findTreeNodeByPath = (nodes: TreeNode[], targetPath: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.path === targetPath) {
        return node;
      }
      if (node.children) {
        const found = findTreeNodeByPath(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };

  const openFunctionSource = async (filePath: string, functionName: string) => {
    if (!filePath) return;
    const matchedNode = findTreeNodeByPath(tree, filePath);
    const fallbackNode: TreeNode = matchedNode || {
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      type: 'blob',
      url: '',
    };

    setSelectedFile(fallbackNode);
    setFileLoading(true);
    setShowCodeViewer(true);
    setFileContent('');

    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${encodeURI(filePath)}`, {
        headers: buildRawGitHubHeaders()
      });
      if (!res.ok) throw new Error('无法获取函数所在文件内容');
      const text = await res.text();
      setFileContent(text);
      const line = findFunctionLine(text, functionName);
      setTargetFunctionLine(line);
      addLog(`已定位函数 ${functionName} -> ${filePath}:${line}`, 'success');
    } catch (err: any) {
      setFileContent(`// 错误: ${err.message}`);
      setTargetFunctionLine(null);
      addLog(`定位函数源码失败: ${err.message}`, 'error');
    } finally {
      setFileLoading(false);
    }
  };

  const toggleNode = (nodePath: string) => {
    const updateTree = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.path === nodePath) {
          return { ...node, isOpen: !node.isOpen };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };
    setTree(updateTree(tree));
  };

  const renderTree = (nodes: TreeNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.path} className="select-none">
        <div 
          className={`flex items-center py-1.5 px-2 hover:bg-slate-100 cursor-pointer text-sm rounded-md transition-colors ${
            selectedFile?.path === node.path ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'tree') {
              toggleNode(node.path);
            } else {
              fetchFileContent(node);
            }
          }}
        >
          <span className="w-5 flex justify-center mr-1">
            {node.type === 'tree' ? (
              node.isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
            ) : null}
          </span>
          {node.type === 'tree' ? (
            <Folder className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
          ) : (
            <File className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'tree' && node.isOpen && node.children && (
          <div>{renderTree(node.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      json: 'json',
      html: 'html',
      css: 'css',
      md: 'markdown',
      py: 'python',
      go: 'go',
      java: 'java',
      rs: 'rust',
      c: 'c',
      cpp: 'cpp',
      sh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
    };
    return map[ext || ''] || 'text';
  };

  useEffect(() => {
    if (!targetFunctionLine) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`code-line-${targetFunctionLine}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [targetFunctionLine, selectedFile?.path, fileContent]);

  const currentMarkdown = getCurrentAnalysisMarkdown();

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0 z-10">
        <div 
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
        >
          <div className="bg-indigo-600 p-1.5 rounded-lg mr-3">
            <Github className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">GitCode Vision</span>
        </div>
        
        {/* Panel Toggles */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowFileTree(!showFileTree)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showFileTree ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            文件列表
          </button>
          <button 
            onClick={() => setShowCodeViewer(!showCodeViewer)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showCodeViewer ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            源码
          </button>
          <button 
            onClick={() => setShowPanorama(!showPanorama)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${showPanorama ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            全景图
          </button>
        </div>
      </header>

      {/* Main Content - Resizable Panels */}
      <div className="flex-1 flex overflow-hidden">
        <Group orientation="horizontal">
          {/* Left Column - Info Panel */}
          <Panel defaultSize={20} minSize={15} className="flex flex-col bg-slate-50">
            <div className="p-4 border-b border-slate-200 shrink-0">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">项目分析</h2>
              <form onSubmit={handleAnalyze} className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                  placeholder="输入 GitHub 项目地址..."
                />
              </form>
            </div>
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              
              {/* Log Panel */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center">
                      <Terminal className="w-3 h-3 mr-1 text-slate-400" /> 工作日志
                    </h3>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${WORKFLOW_STATUS_STYLES[workflowStatus]}`}>
                      工作流状态: {WORKFLOW_STATUS_LABELS[workflowStatus]}
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsLogFullscreen(true)} 
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="全屏查看"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {logs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">暂无日志</p>
                  ) : (
                    logs.map(log => <LogItem key={log.id} log={log} />)
                  )}
                </div>
              </div>

              {/* Analysis Overview */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">分析概览</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">仓库</span>
                    <span className="font-mono text-slate-800 truncate max-w-[120px]" title={`${owner}/${repo}`}>{owner}/{repo}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">默认分支</span>
                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">{defaultBranch}</span>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center">
                        <FileText className="w-3 h-3 mr-1 text-amber-500" /> 工程文件
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsMarkdownPreviewOpen(true)}
                          disabled={!currentMarkdown}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          <Maximize2 className="mr-1.5 h-3 w-3" />
                          全屏
                        </button>
                        <button
                          type="button"
                          onClick={handleExportMarkdown}
                          disabled={!currentMarkdown}
                          className="inline-flex items-center rounded-md bg-amber-500 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <Download className="mr-1.5 h-3 w-3" />
                          导出
                        </button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-[11px] font-medium text-slate-600">工程文件</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {owner && repo ? `${repo.toUpperCase()}_ANALYSIS.md` : 'ANALYSIS.md'}
                        </span>
                      </div>
                      <div className="max-h-72 overflow-auto bg-white">
                        <SyntaxHighlighter
                          language="markdown"
                          style={prism}
                          customStyle={{
                            margin: 0,
                            padding: '0.9rem',
                            background: '#ffffff',
                            fontSize: '12px',
                            lineHeight: '1.55',
                          }}
                          showLineNumbers={false}
                          wrapLines={true}
                        >
                          {currentMarkdown || '# 暂无工程文件\n\n等待分析结果生成后，这里会展示完整的 Markdown 工程文件。'}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center">
                        <Layers3 className="w-3 h-3 mr-1 text-indigo-500" /> 功能模块
                      </h4>
                      <button
                        type="button"
                        onClick={handleReanalyzeModules}
                        disabled={analyzingModules || analyzedFunctions.length === 0}
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <RefreshCw className={`mr-1.5 h-3 w-3 ${analyzingModules ? 'animate-spin' : ''}`} />
                        重新分析模块
                      </button>
                    </div>
                    {functionModules.length === 0 ? (
                      <p className="text-xs text-slate-400">暂无模块结果，可点击“重新分析模块”发起。</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveModuleId(null)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            activeModuleId === null
                              ? 'border-slate-800 bg-slate-800 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          全部
                        </button>
                        {functionModules.map((module) => (
                          <button
                            key={module.id}
                            type="button"
                            onClick={() => setActiveModuleId((prev) => (prev === module.id ? null : module.id))}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-opacity ${
                              activeModuleId && activeModuleId !== module.id ? 'opacity-60' : 'opacity-100'
                            }`}
                            style={{
                              borderColor: module.color,
                              backgroundColor: activeModuleId === module.id ? module.color : `${module.color}22`,
                              color: activeModuleId === module.id ? '#ffffff' : module.color,
                            }}
                            title={module.description}
                          >
                            {module.name} ({module.functionNames.length})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI Analysis Section */}
                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1 text-indigo-500" /> AI 智能分析
                    </h4>
                    {aiLoading ? (
                      <div className="flex flex-col items-center justify-center py-4 space-y-2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        <span className="text-xs text-slate-500">正在分析项目结构...</span>
                      </div>
                    ) : aiError ? (
                      <div className="text-xs text-red-500 text-center py-2">{aiError}</div>
                    ) : aiAnalysis ? (
                      <div className="space-y-4">
                        <div>
                          <span className="text-xs text-slate-500 block mb-1.5">主要语言</span>
                          <div className="flex flex-wrap gap-1.5">
                            {aiAnalysis.mainLanguages.map(lang => (
                              <span key={lang} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[11px] font-medium">{lang}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block mb-1.5">技术栈</span>
                          <div className="flex flex-wrap gap-1.5">
                            {aiAnalysis.techStack.map(tech => (
                              <span key={tech} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[11px] font-medium">{tech}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block mb-1.5">入口文件</span>
                          <div className="flex flex-col gap-1.5">
                            {aiAnalysis.entryFiles.map(file => {
                              const isConfirmed = confirmedEntryFile?.path === file;
                              return (
                                <div key={file} className={`text-[11px] font-mono px-2 py-1.5 rounded border ${isConfirmed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-transparent text-slate-700'}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="truncate" title={file}>{file}</span>
                                    {isConfirmed && <Sparkles className="w-3 h-3 text-emerald-500 shrink-0 ml-1" />}
                                  </div>
                                  {isConfirmed && (
                                    <div className="mt-1.5 text-[10px] text-emerald-600 font-sans border-t border-emerald-100 pt-1.5 leading-relaxed">
                                      {confirmedEntryFile.reason}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {evaluatingEntry && (
                            <div className="flex items-center mt-3 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                              <Loader2 className="w-3 h-3 animate-spin mr-1.5 text-indigo-400" />
                              正在逐个研判入口文件...
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center italic">暂无分析数据</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {showFileTree && (
            <>
              <Separator className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />
              {/* Middle Column - File Tree */}
              <Panel defaultSize={20} minSize={15} className="flex flex-col bg-white">
                <div className="h-10 flex items-center px-4 border-b border-slate-200 bg-slate-50 shrink-0">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">资源管理器</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                  {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-sm">加载项目结构...</span>
                    </div>
                  ) : error ? (
                    <div className="p-4 text-center">
                      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  ) : tree.length > 0 ? (
                    renderTree(tree)
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">空仓库</div>
                  )}
                </div>
              </Panel>
            </>
          )}

          {showCodeViewer && (
            <>
              <Separator className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />
              {/* Code Viewer */}
              <Panel defaultSize={30} minSize={20} className="flex flex-col bg-white">
                {selectedFile ? (
                  <>
                    <div className="h-10 flex items-center px-4 bg-slate-50 border-b border-slate-200 shrink-0">
                      <File className="w-4 h-4 text-slate-400 mr-2" />
                      <span className="text-sm text-slate-700 font-mono">{selectedFile.path}</span>
                    </div>
                    <div className="flex-1 overflow-auto relative">
                      {fileLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        </div>
                      ) : null}
                      <SyntaxHighlighter
                        language={getLanguage(selectedFile.name)}
                        style={prism}
                        customStyle={{
                          margin: 0,
                          padding: '1rem',
                          background: 'transparent',
                          fontSize: '14px',
                          lineHeight: '1.5',
                        }}
                        showLineNumbers={true}
                        wrapLines={true}
                        lineProps={(lineNumber) => ({
                          id: `code-line-${lineNumber}`,
                          style: targetFunctionLine === lineNumber
                            ? { backgroundColor: '#fef3c7', display: 'block' }
                            : { display: 'block' },
                        })}
                      >
                        {fileContent || ' '}
                      </SyntaxHighlighter>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <Github className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg">在左侧选择一个文件以查看代码</p>
                  </div>
                )}
              </Panel>
            </>
          )}

          {showPanorama && (
            <>
              <Separator className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-col-resize" />
              {/* Panorama Panel */}
              <Panel defaultSize={30} minSize={20} className="flex flex-col bg-slate-50">
                <div className="h-10 flex items-center px-4 border-b border-slate-200 bg-white shrink-0">
                  <Network className="w-4 h-4 text-indigo-500 mr-2" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">函数调用全景图</span>
                  {analyzingFunctions && (
                    <div className="ml-auto flex items-center text-xs text-indigo-500">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      正在分析...
                    </div>
                  )}
                </div>
                <div className="flex-1 relative">
                  <PanoramaPanel
                    analyzedFunctions={analyzedFunctions}
                    functionModules={functionModules}
                    activeModuleId={activeModuleId}
                    onNodeOpenSource={openFunctionSource}
                  />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>

      {/* Fullscreen Log Modal */}
      {isLogFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 md:p-12">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-base font-semibold text-slate-800 flex items-center">
                <Terminal className="w-5 h-5 mr-2 text-slate-500" /> 工作日志 (全屏)
              </h3>
              <button 
                onClick={() => setIsLogFullscreen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar space-y-3">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 italic">暂无日志</div>
              ) : (
                logs.map(log => <LogItem key={log.id} log={log} />)
              )}
            </div>
          </div>
        </div>
      )}

{isMarkdownPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 md:p-12">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full flex flex-col overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h3 className="text-base font-semibold text-slate-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-slate-500" /> 工程文件（全屏）
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="inline-flex items-center rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  导出 .md
                </button>
                <button 
                  onClick={() => setIsMarkdownPreviewOpen(false)} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              <SyntaxHighlighter
                language="markdown"
                style={prism}
                customStyle={{
                  margin: 0,
                  minHeight: '100%',
                  padding: '1.5rem',
                  background: '#ffffff',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
                showLineNumbers={true}
                wrapLines={true}
              >
                {currentMarkdown || '# 暂无工程文件\n\n等待分析结果生成后，这里会展示完整的 Markdown 工程文件。'}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
