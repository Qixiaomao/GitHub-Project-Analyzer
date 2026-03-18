import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FolderOpen, Github, HardDrive, Search } from 'lucide-react';
import { readProjectHistory, type ProjectAnalysisRecord } from '../lib/analysisHistory';
import {
  registerLocalDirectoryDataSource,
  supportsLocalDirectoryPicker,
} from '../lib/dataSources';

type AnalysisMode = 'github' | 'local';

export default function Home() {
  const [mode, setMode] = useState<AnalysisMode>('github');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ProjectAnalysisRecord[]>([]);
  const [selectedLocalFolder, setSelectedLocalFolder] = useState('');
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(readProjectHistory());
  }, []);

  const handleAnalyzeGithub = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('请输入 GitHub 项目地址');
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== 'github.com') {
        setError('请输入有效的 GitHub 地址，例如 https://github.com/owner/repo');
        return;
      }

      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        setError('请输入完整的 GitHub 仓库地址，例如 https://github.com/owner/repo');
        return;
      }

      navigate(`/analyze?source=github&owner=${pathParts[0]}&repo=${pathParts[1]}`);
    } catch {
      setError('请输入有效的 URL');
    }
  };

  const handleSelectLocalFolder = async () => {
    setError('');

    if (!supportsLocalDirectoryPicker) {
      setError('当前浏览器不支持本地目录选择，请使用最新版 Chromium 浏览器访问。');
      return;
    }

    try {
      setIsPickingDirectory(true);
      const directoryHandle = await window.showDirectoryPicker();
      const source = registerLocalDirectoryDataSource(directoryHandle);
      setSelectedLocalFolder(directoryHandle.name);
      navigate(`/analyze?source=local&localId=${source.id}`);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        setError('选择本地目录失败，请重试。');
      }
    } finally {
      setIsPickingDirectory(false);
    }
  };

  const openHistoryRecord = (record: ProjectAnalysisRecord) => {
    const source = record.sourceKind || 'github';
    if (source === 'local') {
      navigate(`/analyze?source=local&history=${record.id}`);
      return;
    }

    navigate(`/analyze?source=github&owner=${record.owner}&repo=${record.repo}&history=${record.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-2xl shadow-lg ${mode === 'github' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
            {mode === 'github' ? (
              <Github className="w-12 h-12 text-white" />
            ) : (
              <FolderOpen className="w-12 h-12 text-white" />
            )}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">GitCode Vision</h1>
          <p className="text-lg text-slate-600">
            在 GitHub 仓库分析和本地项目分析之间自由切换，统一查看代码结构与调用链路
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('github');
                setError('');
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'github'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              GitHub 项目分析
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('local');
                setError('');
              }}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                mode === 'local'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              本地项目分析
            </button>
          </div>

          {mode === 'github' ? (
            <form onSubmit={handleAnalyzeGithub} className="mt-4 space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm text-lg transition-all"
                  placeholder="https://github.com/facebook/react"
                />
              </div>

              {error && <p className="text-red-500 text-sm text-left pl-2">{error}</p>}

              <button
                type="submit"
                className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                开始分析
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </form>
          ) : (
            <div className="mt-4 space-y-4 text-left">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">选择本地项目目录</div>
                    <p className="mt-1 text-sm text-slate-500">
                      通过浏览器授权目录访问后，系统会递归读取项目文件并进入同一套分析流程。
                    </p>
                    {selectedLocalFolder && (
                      <p className="mt-3 text-xs font-mono text-emerald-700 break-all">
                        已选择: {selectedLocalFolder}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectLocalFolder}
                    disabled={isPickingDirectory}
                    className="shrink-0 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {isPickingDirectory ? '选择中...' : '选择本地路径'}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm pl-2">{error}</p>}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="pt-2 text-left">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900">历史分析记录</h2>
              <span className="text-xs text-slate-500">{history.length} 条</span>
            </div>
            <div className="grid gap-3">
              {history.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => openHistoryRecord(record)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{record.projectName}</div>
                      <div className="mt-1 font-mono text-xs text-slate-500 break-all">{record.projectUrl}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${
                          record.sourceKind === 'local'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {record.sourceKind === 'local' ? (
                          <HardDrive className="mr-1 h-3 w-3" />
                        ) : (
                          <Github className="mr-1 h-3 w-3" />
                        )}
                        {record.sourceKind === 'local' ? '本地项目' : 'GitHub'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                        {new Date(record.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(record.aiAnalysis?.mainLanguages || []).slice(0, 3).map((language) => (
                      <span key={language} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600">
                        {language}
                      </span>
                    ))}
                    {(record.aiAnalysis?.techStack || []).slice(0, 3).map((tech) => (
                      <span key={tech} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600">
                        {tech}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <p className="text-sm text-slate-500">
            GitHub 模式支持公开仓库；本地模式依赖浏览器目录授权，建议在 `localhost` 环境下使用。
          </p>
        </div>
      </div>
    </div>
  );
}
