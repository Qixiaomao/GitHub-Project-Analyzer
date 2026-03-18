import { useEffect, useState } from 'react';
import { Info, Save, Settings, X } from 'lucide-react';
import type { AppSettings, AppSettingsEnvValues } from '../lib/appSettings';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  envSettings: AppSettingsEnvValues;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

const FIELD_LABELS: Record<keyof AppSettings, string> = {
  baseUrl: 'AI Base URL',
  apiKey: 'AI API Key',
  model: 'AI 模型名称',
  githubToken: 'GitHub Token',
  maxDrillDownDepth: '最大下钻层数',
  keySubFunctionLimit: '关键调用子函数数量',
};

const maskSecret = (value: string) => {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export default function SettingsModal({
  isOpen,
  settings,
  envSettings,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!isOpen) {
    return null;
  }

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...draft,
      maxDrillDownDepth: Math.max(1, Number(draft.maxDrillDownDepth) || 2),
      keySubFunctionLimit: Math.max(1, Number(draft.keySubFunctionLimit) || 10),
    });
  };

  const renderEnvHint = (key: keyof AppSettings) => {
    const value = envSettings[key];
    if (value === undefined || value === '') {
      return null;
    }

    const displayValue =
      typeof value === 'string' && (key === 'apiKey' || key === 'githubToken')
        ? maskSecret(value)
        : String(value);

    return <p className="mt-1 text-[11px] text-emerald-600">环境变量生效中: {displayValue}</p>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">设置</h2>
              <p className="text-xs text-slate-500">环境变量优先于本地持久化配置</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-800">{FIELD_LABELS.baseUrl}</span>
              <input
                type="text"
                value={draft.baseUrl}
                onChange={(e) => updateField('baseUrl', e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="https://your-api.example.com"
              />
              {renderEnvHint('baseUrl')}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">{FIELD_LABELS.model}</span>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => updateField('model', e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="gpt-4o-mini"
              />
              {renderEnvHint('model')}
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-800">{FIELD_LABELS.apiKey}</span>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => updateField('apiKey', e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="sk-..."
              />
              {renderEnvHint('apiKey')}
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-800">{FIELD_LABELS.githubToken}</span>
              <input
                type="password"
                value={draft.githubToken}
                onChange={(e) => updateField('githubToken', e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="ghp_..."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                用途: 提升 GitHub API 配额，减少公开仓库分析时的限流问题。
              </p>
              {renderEnvHint('githubToken')}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">{FIELD_LABELS.maxDrillDownDepth}</span>
              <input
                type="number"
                min={1}
                value={draft.maxDrillDownDepth}
                onChange={(e) => updateField('maxDrillDownDepth', Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {renderEnvHint('maxDrillDownDepth')}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-800">{FIELD_LABELS.keySubFunctionLimit}</span>
              <input
                type="number"
                min={1}
                value={draft.keySubFunctionLimit}
                onChange={(e) => updateField('keySubFunctionLimit', Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {renderEnvHint('keySubFunctionLimit')}
            </label>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>如果环境变量与本地存储不一致，系统启动时会自动以环境变量为准，并同步写回本地存储。</span>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Save className="mr-2 h-4 w-4" />
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
