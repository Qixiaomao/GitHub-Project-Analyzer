import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Search, ArrowRight } from 'lucide-react';
import { readProjectHistory, type ProjectAnalysisRecord } from '../lib/analysisHistory';

export default function Home() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ProjectAnalysisRecord[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(readProjectHistory());
  }, []);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('请输入 GitHub 项目地址');
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== 'github.com') {
        setError('请输入有效的 GitHub 地址 (例如: https://github.com/owner/repo)');
        return;
      }

      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        setError('请输入完整的项目地址 (例如: https://github.com/owner/repo)');
        return;
      }

      const owner = pathParts[0];
      const repo = pathParts[1];

      navigate(`/analyze?owner=${owner}&repo=${repo}`);
    } catch (err) {
      setError('请输入有效的 URL');
    }
  };

  const openHistoryRecord = (record: ProjectAnalysisRecord) => {
    navigate(`/analyze?owner=${record.owner}&repo=${record.repo}&history=${record.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-8 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg">
            <Github className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            GitCode Vision
          </h1>
          <p className="text-lg text-slate-600">
            输入 GitHub 项目地址，即刻开启代码结构可视化分析
          </p>
        </div>

        <form onSubmit={handleAnalyze} className="mt-8 space-y-4">
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
          
          {error && (
            <p className="text-red-500 text-sm text-left pl-2">{error}</p>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            开始分析
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </form>

        {history.length > 0 && (
          <div className="pt-4 text-left">
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
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                      {new Date(record.updatedAt).toLocaleDateString()}
                    </span>
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

        <div className="pt-8">
          <p className="text-sm text-slate-500">
            支持公开的 GitHub 仓库。私有仓库暂不支持。
          </p>
        </div>
      </div>
    </div>
  );
}
