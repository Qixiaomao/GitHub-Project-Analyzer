export interface TreeNodeSnapshot {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  url: string;
  children?: TreeNodeSnapshot[];
  isOpen?: boolean;
}

export interface SubFunctionSnapshot {
  name: string;
  shouldDrillDown: number;
  possibleFile: string;
  description: string;
  url?: string;
  depth?: number;
  moduleId?: string;
  moduleName?: string;
  subFunctions?: SubFunctionSnapshot[];
}

export interface AnalyzedFunctionSnapshot {
  name: string;
  file: string;
  description: string;
  moduleId?: string;
  moduleName?: string;
  subFunctions?: SubFunctionSnapshot[];
}

export interface FunctionModuleSnapshot {
  id: string;
  name: string;
  description: string;
  color: string;
  functionNames: string[];
}

export interface AIAnalysisResultSnapshot {
  mainLanguages: string[];
  techStack: string[];
  entryFiles: string[];
}

export interface LogEntrySnapshot {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
  details?: unknown;
}

export interface RepoInfoSnapshot {
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

export interface ProjectAnalysisRecord {
  id: string;
  owner: string;
  repo: string;
  projectName: string;
  projectUrl: string;
  createdAt: string;
  updatedAt: string;
  defaultBranch: string;
  repoInfo: RepoInfoSnapshot | null;
  aiAnalysis: AIAnalysisResultSnapshot | null;
  confirmedEntryFile: { path: string; reason: string } | null;
  fileTree: TreeNodeSnapshot[];
  flatFileList: string[];
  functionModules: FunctionModuleSnapshot[];
  analyzedFunctions: AnalyzedFunctionSnapshot[];
  logs: LogEntrySnapshot[];
  markdown: string;
}

export interface ProjectAnalysisDraft {
  owner: string;
  repo: string;
  defaultBranch: string;
  repoInfo: RepoInfoSnapshot | null;
  aiAnalysis: AIAnalysisResultSnapshot | null;
  confirmedEntryFile: { path: string; reason: string } | null;
  fileTree: TreeNodeSnapshot[];
  flatFileList: string[];
  functionModules: FunctionModuleSnapshot[];
  analyzedFunctions: AnalyzedFunctionSnapshot[];
  logs: LogEntrySnapshot[];
}

const STORAGE_KEY = 'gitcode-vision-project-history';
const MAX_HISTORY_ITEMS = 20;

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const buildProjectUrl = (owner: string, repo: string) => `https://github.com/${owner}/${repo}`;

const normalizeDetails = (details: unknown) => {
  if (details === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return String(details);
  }
};

const formatList = (items: string[]) => (items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- None');

const formatLogs = (logs: LogEntrySnapshot[]) =>
  logs.length > 0
    ? logs
        .map((log) => {
          const details =
            log.details === undefined ? '' : `\n  details: \`${JSON.stringify(log.details)}\``;
          return `- [${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}${details}`;
        })
        .join('\n')
    : '- None';

const formatFunctionChain = (functions: AnalyzedFunctionSnapshot[]) =>
  functions.length > 0 ? `\`\`\`json\n${JSON.stringify(functions, null, 2)}\n\`\`\`` : 'No function call chain generated.';

const formatModules = (modules: FunctionModuleSnapshot[]) =>
  modules.length > 0 ? `\`\`\`json\n${JSON.stringify(modules, null, 2)}\n\`\`\`` : 'No function modules generated.';

export const buildAnalysisMarkdown = (record: Omit<ProjectAnalysisRecord, 'markdown'>) => {
  const repoInfo = record.repoInfo;
  return `# ${record.projectName}

## Project

- Name: ${record.projectName}
- URL: ${record.projectUrl}
- Owner: ${record.owner}
- Repository: ${record.repo}
- Default branch: ${record.defaultBranch || 'unknown'}
- Generated at: ${record.updatedAt}

## Repository Info

- Full name: ${repoInfo?.fullName || `${record.owner}/${record.repo}`}
- Description: ${repoInfo?.description || 'N/A'}
- Primary language: ${repoInfo?.language || 'N/A'}
- Stars: ${repoInfo?.stargazersCount ?? 'N/A'}
- Forks: ${repoInfo?.forksCount ?? 'N/A'}
- Open issues: ${repoInfo?.openIssuesCount ?? 'N/A'}
- Last updated: ${repoInfo?.updatedAt || 'N/A'}

## Main Languages

${formatList(record.aiAnalysis?.mainLanguages || [])}

## Tech Stack

${formatList(record.aiAnalysis?.techStack || [])}

## Candidate Entry Files

${formatList(record.aiAnalysis?.entryFiles || [])}

## Confirmed Entry File

${record.confirmedEntryFile ? `- Path: ${record.confirmedEntryFile.path}\n- Reason: ${record.confirmedEntryFile.reason}` : '- None'}

## File List

${formatList(record.flatFileList)}

## Full Call Chain

${formatFunctionChain(record.analyzedFunctions)}

## Function Modules

${formatModules(record.functionModules)}

## Agent Work Logs

${formatLogs(record.logs)}
`;
};

export const readProjectHistory = (): ProjectAnalysisRecord[] => {
  if (!hasStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getProjectHistoryRecord = (id: string) => readProjectHistory().find((item) => item.id === id) || null;

export const upsertProjectHistory = (draft: ProjectAnalysisDraft) => {
  if (!hasStorage()) {
    return null;
  }

  const now = new Date().toISOString();
  const projectUrl = buildProjectUrl(draft.owner, draft.repo);
  const history = readProjectHistory();
  const existing = history.find((item) => item.owner === draft.owner && item.repo === draft.repo);

  const recordBase: Omit<ProjectAnalysisRecord, 'markdown'> = {
    id: existing?.id || `${draft.owner}-${draft.repo}`,
    owner: draft.owner,
    repo: draft.repo,
    projectName: draft.repoInfo?.name || draft.repo,
    projectUrl,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    defaultBranch: draft.defaultBranch,
    repoInfo: draft.repoInfo,
    aiAnalysis: draft.aiAnalysis,
    confirmedEntryFile: draft.confirmedEntryFile,
    fileTree: draft.fileTree,
    flatFileList: draft.flatFileList,
    functionModules: draft.functionModules,
    analyzedFunctions: draft.analyzedFunctions,
    logs: draft.logs.map((log) => ({
      ...log,
      details: normalizeDetails(log.details),
    })),
  };

  const record: ProjectAnalysisRecord = {
    ...recordBase,
    markdown: buildAnalysisMarkdown(recordBase),
  };

  const nextHistory = [record, ...history.filter((item) => item.id !== record.id)].slice(0, MAX_HISTORY_ITEMS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
  return record;
};
