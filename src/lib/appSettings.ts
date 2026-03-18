export interface AppSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  githubToken: string;
  maxDrillDownDepth: number;
  keySubFunctionLimit: number;
}

export type AppSettingsEnvValues = Partial<AppSettings>;

const STORAGE_KEY = 'gitcode-vision-settings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  baseUrl: '',
  apiKey: '',
  model: '',
  githubToken: '',
  maxDrillDownDepth: 2,
  keySubFunctionLimit: 10,
};

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readEnvSettings = (): AppSettingsEnvValues => ({
  baseUrl: process.env.BASE_URL || undefined,
  apiKey: process.env.API_KEY || undefined,
  model: process.env.MODEL || undefined,
  githubToken: process.env.GITHUB_TOKEN || undefined,
  maxDrillDownDepth: process.env.MAX_DRILL_DOWN_DEPTH
    ? parsePositiveInt(process.env.MAX_DRILL_DOWN_DEPTH, DEFAULT_APP_SETTINGS.maxDrillDownDepth)
    : undefined,
  keySubFunctionLimit: process.env.KEY_SUB_FUNCTION_LIMIT
    ? parsePositiveInt(process.env.KEY_SUB_FUNCTION_LIMIT, DEFAULT_APP_SETTINGS.keySubFunctionLimit)
    : undefined,
});

export const readStoredSettings = (): Partial<AppSettings> => {
  if (!hasStorage()) {
    return {};
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...parsed,
      maxDrillDownDepth: parsePositiveInt(
        parsed.maxDrillDownDepth ? String(parsed.maxDrillDownDepth) : undefined,
        DEFAULT_APP_SETTINGS.maxDrillDownDepth,
      ),
      keySubFunctionLimit: parsePositiveInt(
        parsed.keySubFunctionLimit ? String(parsed.keySubFunctionLimit) : undefined,
        DEFAULT_APP_SETTINGS.keySubFunctionLimit,
      ),
    };
  } catch {
    return {};
  }
};

export const resolveAppSettings = (): AppSettings => ({
  ...DEFAULT_APP_SETTINGS,
  ...readStoredSettings(),
  ...readEnvSettings(),
});

export const persistAppSettings = (settings: AppSettings) => {
  if (!hasStorage()) {
    return settings;
  }

  const nextSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    maxDrillDownDepth: parsePositiveInt(String(settings.maxDrillDownDepth), DEFAULT_APP_SETTINGS.maxDrillDownDepth),
    keySubFunctionLimit: parsePositiveInt(String(settings.keySubFunctionLimit), DEFAULT_APP_SETTINGS.keySubFunctionLimit),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
};

export const syncAppSettingsWithEnv = () => {
  const resolved = resolveAppSettings();
  if (hasStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
  }
  return resolved;
};
