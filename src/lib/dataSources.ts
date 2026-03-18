import { resolveAppSettings } from './appSettings';

export type DataSourceKind = 'github' | 'local';

export interface DataSourceFileEntry {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  url: string;
}

export interface DataSourceProjectInfo {
  sourceKind: DataSourceKind;
  name: string;
  fullName: string;
  description: string;
  projectUrl: string;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  updatedAt: string;
  owner?: string;
  repo?: string;
  locationLabel?: string;
}

export interface CodeDataSource {
  kind: DataSourceKind;
  getProjectInfo(): Promise<DataSourceProjectInfo>;
  listFiles(): Promise<DataSourceFileEntry[]>;
  readFile(path: string): Promise<string | null>;
  searchFilesByContent(query: string, candidatePaths?: string[]): Promise<string[]>;
}

const buildGitHubHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  const githubToken = resolveAppSettings().githubToken;
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
};

const buildRawGitHubHeaders = (): HeadersInit => ({
  Accept: 'text/plain; charset=utf-8',
});

export const buildTreeFromEntries = (entries: DataSourceFileEntry[]) => {
  const root: DataSourceFileEntry[] = [];
  const map: Record<string, DataSourceFileEntry & { children?: DataSourceFileEntry[]; isOpen?: boolean }> = {};

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === b.type) {
      return a.path.localeCompare(b.path);
    }
    return a.type === 'tree' ? -1 : 1;
  });

  sortedEntries.forEach((item) => {
    const node = {
      ...item,
      children: item.type === 'tree' ? [] : undefined,
      isOpen: false,
    };

    map[item.path] = node;
    const parts = item.path.split('/');
    if (parts.length === 1) {
      root.push(node);
      return;
    }

    const parentPath = parts.slice(0, -1).join('/');
    if (map[parentPath]?.children) {
      map[parentPath].children!.push(node);
    }
  });

  return root;
};

class GitHubDataSource implements CodeDataSource {
  kind: DataSourceKind = 'github';
  private repoInfoPromise: Promise<DataSourceProjectInfo> | null = null;
  private treePromise: Promise<DataSourceFileEntry[]> | null = null;
  private contentCache = new Map<string, Promise<string | null>>();

  constructor(
    private readonly owner: string,
    private readonly repo: string,
  ) {}

  async getProjectInfo() {
    if (!this.repoInfoPromise) {
      this.repoInfoPromise = (async () => {
        const repoRes = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}`, {
          headers: buildGitHubHeaders(),
        });

        if (!repoRes.ok) {
          if (repoRes.status === 404) {
            throw new Error('仓库不存在或当前不可访问');
          }
          if (repoRes.status === 403) {
            throw new Error('GitHub API 访问频率受限，请稍后重试');
          }
          throw new Error('获取 GitHub 仓库信息失败');
        }

        const repoData = await repoRes.json();
        return {
          sourceKind: 'github' as const,
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description || '',
          projectUrl: repoData.html_url,
          defaultBranch: repoData.default_branch,
          language: repoData.language,
          stargazersCount: repoData.stargazers_count,
          forksCount: repoData.forks_count,
          openIssuesCount: repoData.open_issues_count,
          updatedAt: repoData.updated_at,
          owner: this.owner,
          repo: this.repo,
          locationLabel: `${this.owner}/${this.repo}`,
        };
      })();
    }

    return this.repoInfoPromise;
  }

  async listFiles() {
    if (!this.treePromise) {
      this.treePromise = (async () => {
        const projectInfo = await this.getProjectInfo();
        const treeRes = await fetch(
          `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${projectInfo.defaultBranch}?recursive=1`,
          { headers: buildGitHubHeaders() },
        );

        if (!treeRes.ok) {
          throw new Error('获取 GitHub 文件列表失败');
        }

        const treeData = await treeRes.json();
        return (treeData.tree || []).map((item: any) => ({
          path: item.path,
          name: item.path.split('/').pop() || item.path,
          type: item.type,
          url: item.url,
        })) as DataSourceFileEntry[];
      })();
    }

    return this.treePromise;
  }

  async readFile(path: string) {
    if (!this.contentCache.has(path)) {
      this.contentCache.set(
        path,
        (async () => {
          try {
            const projectInfo = await this.getProjectInfo();
            const res = await fetch(
              `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${projectInfo.defaultBranch}/${encodeURI(path)}`,
              { headers: buildRawGitHubHeaders() },
            );
            if (!res.ok) {
              return null;
            }
            return await res.text();
          } catch {
            return null;
          }
        })(),
      );
    }

    return this.contentCache.get(path)!;
  }

  async searchFilesByContent(query: string, candidatePaths?: string[]) {
    const files = candidatePaths || (await this.listFiles()).filter((item) => item.type === 'blob').map((item) => item.path);
    const matches: string[] = [];

    for (const path of files) {
      const content = await this.readFile(path);
      if (content && content.includes(query)) {
        matches.push(path);
      }
    }

    return matches;
  }
}

const SKIPPED_LOCAL_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  'target',
  'bin',
  'obj',
]);

class LocalFileSystemDataSource implements CodeDataSource {
  kind: DataSourceKind = 'local';
  private fileEntriesPromise: Promise<DataSourceFileEntry[]> | null = null;
  private fileHandleMap = new Map<string, FileSystemFileHandle>();
  private contentCache = new Map<string, Promise<string | null>>();

  constructor(
    readonly id: string,
    private readonly directoryHandle: FileSystemDirectoryHandle,
  ) {}

  async getProjectInfo() {
    const now = new Date().toISOString();
    return {
      sourceKind: 'local' as const,
      name: this.directoryHandle.name,
      fullName: this.directoryHandle.name,
      description: 'Local workspace folder',
      projectUrl: `local://${this.id}`,
      defaultBranch: 'local',
      language: null,
      stargazersCount: 0,
      forksCount: 0,
      openIssuesCount: 0,
      updatedAt: now,
      locationLabel: this.directoryHandle.name,
    };
  }

  async listFiles() {
    if (!this.fileEntriesPromise) {
      this.fileEntriesPromise = this.walkDirectory(this.directoryHandle);
    }

    return this.fileEntriesPromise;
  }

  async readFile(path: string) {
    if (!this.contentCache.has(path)) {
      this.contentCache.set(
        path,
        (async () => {
          try {
            const handle = this.fileHandleMap.get(path);
            if (!handle) {
              return null;
            }
            const file = await handle.getFile();
            return await file.text();
          } catch {
            return null;
          }
        })(),
      );
    }

    return this.contentCache.get(path)!;
  }

  async searchFilesByContent(query: string, candidatePaths?: string[]) {
    const files = candidatePaths || (await this.listFiles()).filter((item) => item.type === 'blob').map((item) => item.path);
    const matches: string[] = [];

    for (const path of files) {
      const content = await this.readFile(path);
      if (content && content.includes(query)) {
        matches.push(path);
      }
    }

    return matches;
  }

  private async walkDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    parentPath = '',
  ): Promise<DataSourceFileEntry[]> {
    const entries: DataSourceFileEntry[] = [];

    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === 'directory' && SKIPPED_LOCAL_DIRECTORIES.has(name)) {
        continue;
      }

      const path = parentPath ? `${parentPath}/${name}` : name;
      entries.push({
        path,
        name,
        type: handle.kind === 'directory' ? 'tree' : 'blob',
        url: `local://${this.id}/${encodeURIComponent(path)}`,
      });

      if (handle.kind === 'directory') {
        const childEntries = await this.walkDirectory(handle as FileSystemDirectoryHandle, path);
        entries.push(...childEntries);
      } else {
        this.fileHandleMap.set(path, handle as FileSystemFileHandle);
      }
    }

    return entries;
  }
}

const localDataSourceRegistry = new Map<string, LocalFileSystemDataSource>();

export const createGitHubDataSource = (owner: string, repo: string) => new GitHubDataSource(owner, repo);

export const registerLocalDirectoryDataSource = (directoryHandle: FileSystemDirectoryHandle) => {
  const id = globalThis.crypto?.randomUUID?.() || `local-${Date.now()}`;
  const source = new LocalFileSystemDataSource(id, directoryHandle);
  localDataSourceRegistry.set(id, source);
  return source;
};

export const getRegisteredLocalDataSource = (id: string) => localDataSourceRegistry.get(id) || null;

export const supportsLocalDirectoryPicker =
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
