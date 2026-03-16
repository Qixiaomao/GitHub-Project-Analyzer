# GitHub Project Analyzer

涓枃 | [English](#english)

## 涓枃

GitHub Project Analyzer 鏄竴涓?GitHub 浠撳簱浠ｇ爜鍒嗘瀽涓庡彲瑙嗗寲宸ュ叿銆傝緭鍏ヤ粨搴撳湴鍧€鍚庯紝搴旂敤浼氭媺鍙栭」鐩粨鏋勶紝璋冪敤 AI 鐢熸垚椤圭洰鍒嗘瀽缁撴灉锛屽苟灞曠ず鍑芥暟璋冪敤鍏ㄦ櫙鍥句笌鍙鍑虹殑 Markdown 鍒嗘瀽鏂囨。銆?
### 鍔熻兘鐗规€?
- GitHub 浠撳簱缁撴瀯鎷夊彇涓庢枃浠舵爲娴忚
- AI 鍒嗘瀽锛氫富瑕佽瑷€銆佹妧鏈爤銆佸€欓€夊叆鍙ｆ枃浠?- 鍏ュ彛鏂囦欢鐮斿垽涓庡嚱鏁拌皟鐢ㄩ摼涓嬮捇
- 鍔熻兘妯″潡鑱氱被锛堝彲鎸夋ā鍧楃瓫閫夛級
- 鍙鍖栬皟鐢ㄥ叧绯诲浘锛坄@xyflow/react`锛?- 鍒嗘瀽鍘嗗彶鏈湴鎸佷箙鍖栵紙`localStorage`锛?- 鍒嗘瀽缁撴灉瀵煎嚭涓?`.md`

### 鎶€鏈爤

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- React Router
- React Flow (`@xyflow/react`)
- `react-syntax-highlighter`

### 鐜瑕佹眰

- Node.js 18+锛堝缓璁?LTS锛?- npm 9+

### 蹇€熷紑濮?
1. 瀹夎渚濊禆

```bash
npm install
```

2. 鍦ㄩ」鐩牴鐩綍鍒涘缓 `.env`锛堝弬鑰冧笅闈㈡ā鏉匡級

```env
BASE_URL=https://your-llm-api-base-url
API_KEY=your_api_key
MODEL=your_model_name
GITHUB_TOKEN=your_github_token
MAX_DRILL_DOWN_DEPTH=2
APP_URL=http://localhost:3000
```

3. 鍚姩寮€鍙戠幆澧?
```bash
npm run dev
```

4. 鎵撳紑娴忚鍣ㄨ闂?`http://localhost:3000`

### 鐜鍙橀噺璇存槑

- `BASE_URL`锛歀LM API 鍩虹鍦板潃锛堜唬鐮佷腑浼氳姹?`${BASE_URL}/chat/completions`锛?- `API_KEY`锛歀LM API 瀵嗛挜
- `MODEL`锛氭ā鍨嬪悕
- `GITHUB_TOKEN`锛氬彲閫夛紝鎻愬崌 GitHub API 璁块棶閰嶉
- `MAX_DRILL_DOWN_DEPTH`锛氬嚱鏁拌皟鐢ㄩ摼鏈€澶т笅閽诲眰绾э紝榛樿 `2`
- `APP_URL`锛氶」鐩腑棰勭暀鍙橀噺锛堝綋鍓嶅墠绔€昏緫鏈洿鎺ヤ娇鐢級

### 鍙敤鑴氭湰

- `npm run dev`锛氬紑鍙戞ā寮忥紙绔彛 `3000`锛?- `npm run build`锛氱敓浜ф瀯寤?- `npm run preview`锛氶瑙堟瀯寤轰骇鐗?- `npm run lint`锛歍ypeScript 绫诲瀷妫€鏌?
### 椤圭洰缁撴瀯

```text
src/
  components/
    PanoramaPanel.tsx      # 鍑芥暟璋冪敤鍏ㄦ櫙鍥?  lib/
    analysisHistory.ts     # 鍒嗘瀽鍘嗗彶涓?Markdown 鐢熸垚
  pages/
    Home.tsx               # 浠撳簱鍦板潃杈撳叆涓庡巻鍙插垪琛?    Analyze.tsx            # 鍒嗘瀽涓绘祦绋嬩笌椤甸潰
```

### 浣跨敤娴佺▼

1. 鍦ㄩ椤佃緭鍏?GitHub 浠撳簱 URL锛堝 `https://github.com/owner/repo`锛?2. 杩涘叆鍒嗘瀽椤碉紝鑷姩鎷夊彇浠撳簱淇℃伅涓庢枃浠舵爲
3. AI 杈撳嚭璇█/鎶€鏈爤/鍏ュ彛鏂囦欢锛屽苟缁х画鐢熸垚鍑芥暟璋冪敤閾句笌妯″潡鍒掑垎
4. 鍦ㄥ彸渚ф煡鐪嬭皟鐢ㄥ浘锛岀偣鍑昏妭鐐瑰彲瀹氫綅婧愮爜
5. 瀵煎嚭 Markdown 鍒嗘瀽鏂囦欢

### 娉ㄦ剰浜嬮」

- 褰撳墠涓昏闈㈠悜鍏紑浠撳簱锛涚鏈変粨搴撻渶纭繚 token 鏉冮檺鍜岃法鍩熺瓥鐣ラ兘姝ｇ‘銆?- `.env*` 宸茶 `.gitignore` 蹇界暐锛屼笉瑕佹彁浜ょ湡瀹炲瘑閽ャ€?- 鍓嶇浼氱洿鎺ヨ姹備綘閰嶇疆鐨?LLM 鎺ュ彛锛岃纭鎺ュ彛鍏煎 `chat/completions`銆?
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

