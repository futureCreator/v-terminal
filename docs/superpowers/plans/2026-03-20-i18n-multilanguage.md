# i18n Multilanguage Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add internationalization support with English and Korean using react-i18next, with OS-based language auto-detection and a language selector in Settings.

**Architecture:** react-i18next + i18next for translation, single JSON file per language (~150-180 keys), no separate Zustand store — i18next's built-in language state + localStorage for persistence. Language selector in Appearance tab of SettingsModal.

**Tech Stack:** react-i18next, i18next, React 18, TypeScript, Zustand (existing stores unchanged)

**Spec:** `docs/superpowers/specs/2026-03-20-i18n-multilanguage-design.md`

---

### Task 1: Install Dependencies and Create i18n Infrastructure

**Files:**
- Modify: `package.json`
- Create: `src/i18n.ts`
- Create: `src/locales/en.json`
- Create: `src/locales/ko.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install react-i18next and i18next**

```bash
cd /Users/handongho/.openclaw/workspace/projects/v-terminal
npm install react-i18next i18next
```

- [ ] **Step 2: Create `src/i18n.ts`**

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

const LOCALE_KEY = "v-terminal:locale";

function detectLocale(): string {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === "en" || saved === "ko") return saved;

  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("ko")) return "ko";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
  lng: detectLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function changeLanguage(lng: string) {
  i18n.changeLanguage(lng);
  localStorage.setItem(LOCALE_KEY, lng);
}

export default i18n;
```

- [ ] **Step 3: Create initial `src/locales/en.json`**

Start with an empty structure with all top-level categories. Full keys will be populated in subsequent tasks as each component is migrated.

```json
{
  "settings": {
    "title": "Settings",
    "appearance": "Appearance",
    "terminal": "Terminal",
    "browser": "Browser",
    "language": "Language",
    "font": "Font",
    "fontNotAvailable": "Font not available — using fallback",
    "alsoAdjustable": "Also adjustable with Ctrl +/-",
    "theme": "Theme",
    "auto": "Auto",
    "cursor": "Cursor",
    "cursorStyle": "Cursor Style",
    "block": "Block",
    "underline": "Underline",
    "bar": "Bar",
    "cursorBlink": "Cursor Blink",
    "display": "Display",
    "lineHeight": "Line Height",
    "scrollbackLines": "Scrollback Lines",
    "homePage": "Home Page",
    "defaultHomePage": "Default: google.com",
    "onboarding": "Onboarding",
    "showWelcomePage": "Show Welcome Page",
    "showWelcomeDesc": "Show the welcome page again on next new tab"
  },
  "command": {
    "newTab": "New Tab",
    "newTabDesc": "Open a new terminal tab",
    "closeCurrentTab": "Close Current Tab",
    "closeCurrentTabDesc": "Close the active tab",
    "enableBroadcast": "Enable Broadcast",
    "disableBroadcast": "Disable Broadcast",
    "broadcastDesc": "Send keyboard input to all panels in the current tab simultaneously",
    "previousTab": "Previous Tab",
    "previousTabDesc": "Switch to the tab on the left",
    "nextTab": "Next Tab",
    "nextTabDesc": "Switch to the tab on the right",
    "showToolkit": "Show Toolkit",
    "hideToolkit": "Hide Toolkit",
    "toolkitDesc": "Toggle the side panel with notes, timers, and tools",
    "showBrowser": "Show Browser",
    "hideBrowser": "Hide Browser",
    "browserDesc": "Toggle the browser side panel",
    "sshProfiles": "SSH Profiles",
    "sshProfilesDesc": "Manage and connect to saved SSH servers",
    "settings": "Settings",
    "settingsDesc": "Configure appearance, terminal, and font settings",
    "zoomCurrentPanel": "Zoom Current Panel",
    "zoomCurrentPanelDesc": "Toggle fullscreen for the focused panel",
    "previousPanel": "Previous Panel",
    "previousPanelDesc": "Move focus to the previous panel",
    "nextPanel": "Next Panel",
    "nextPanelDesc": "Move focus to the next panel",
    "panel1": "1 Panel",
    "panels2": "2 Panels",
    "panels3": "3 Panels",
    "panels4": "4 Panels",
    "columns4": "4 Columns",
    "panels6": "6 Panels",
    "panels9": "9 Panels",
    "splitLayout": "Split the current tab into {{layout}}",
    "clearClipboardHistory": "Clear Clipboard History",
    "categoryTab": "Tab",
    "categoryTabList": "Tab List",
    "categoryLayout": "Layout",
    "categoryClipboard": "Clipboard",
    "categorySwitchConnection": "Switch Connection"
  },
  "commandPalette": {
    "searchCommands": "Search commands...",
    "switchToTab": "Switch to tab...",
    "switchConnection": "Switch connection...",
    "changeLayout": "Change layout...",
    "restoreBackground": "Restore background tab...",
    "searchClipboard": "Search clipboard history...",
    "noResults": "No results for \"{{query}}\"",
    "try": "Try",
    "hintTabs": "Tabs",
    "hintBackground": "Background",
    "hintConnect": "Connect",
    "hintLayout": "Layout",
    "hintClipboard": "Clipboard",
    "commandPalette": "Command Palette",
    "broadcastInput": "Broadcast Input"
  },
  "welcome": {
    "slide1Title": "Everything at your fingertips",
    "slide1Desc": "Press Ctrl+K to access tabs, layouts, clipboard history, and more. No mouse needed.",
    "slide2Title": "Your workspace, your way",
    "slide2Desc": "Switch between single to 9-panel layouts instantly. Each panel connects independently to Local, SSH, or WSL — mix them freely in one view.",
    "slide3Title": "Stay focused, stay in flow",
    "slide3Desc": "Notes and Pomodoro timers live in your sidebar. No app switching needed.",
    "slide4Title": "Browse without leaving",
    "slide4Desc": "Open a built-in browser panel right next to your terminal. Look up docs, check dashboards, or preview your work — all without breaking your flow.",
    "skip": "Skip",
    "next": "Next",
    "getStarted": "Get Started"
  },
  "session": {
    "layout": "Layout",
    "connection": "Connection",
    "allSame": "All Same",
    "perPanel": "Per Panel",
    "localShell": "Local Shell",
    "powerShell": "PowerShell",
    "note": "Note",
    "markdownEditor": "Markdown editor",
    "panel": "Panel {{n}}",
    "open": "Open"
  },
  "ssh": {
    "authTitle": "SSH Authentication",
    "noKeyFound": "No SSH key found for this host. Enter the password for the remote server.",
    "authFailed": "Authentication failed. Please try again.",
    "profiles": "SSH Profiles",
    "savedServers": "Saved Servers",
    "addServer": "Add Server",
    "noSavedServers": "No saved servers",
    "addFirstServer": "Click + to add your first server",
    "name": "Name",
    "host": "Host",
    "port": "Port",
    "username": "Username",
    "identityFile": "Identity File",
    "optional": "(optional)",
    "commandPreview": "Command Preview"
  },
  "wsl": {
    "authTitle": "WSL Authentication",
    "sudoRequired": "openssh-server is not installed in this WSL distro. Your sudo password is required for the one-time installation."
  },
  "browser": {
    "title": "Browser",
    "back": "Back",
    "forward": "Forward",
    "reload": "Reload",
    "home": "Home",
    "enterUrl": "Enter URL...",
    "retry": "Retry"
  },
  "tab": {
    "closeTab": "Close Tab",
    "renameTab": "Rename Tab"
  },
  "window": {
    "minimize": "Minimize",
    "maximize": "Maximize",
    "zoom": "Zoom",
    "close": "Close"
  },
  "toast": {
    "welcomePageReset": "Welcome page will show on next new tab"
  },
  "timer": {
    "focus": "Focus",
    "break": "Break",
    "longBreak": "Long Break",
    "start": "Start",
    "pause": "Pause",
    "resume": "Resume",
    "reset": "Reset",
    "activeTimers": "Active Timers",
    "clearDone": "Clear Done",
    "done": "Done",
    "remove": "Remove",
    "selectPreset": "Select a preset to start a timer",
    "sessions": "{{count}} sessions",
    "sessionsIdle": "{{count}} sessions",
    "beforeLongBreak": "before long break",
    "sessionsLabel": "Sessions",
    "pomodoro": "Pomodoro",
    "timerLabel": "Timer",
    "running": "running",
    "paused": "paused",
    "runningCount": "{{count}} running",
    "pausedCount": "{{count}} paused",
    "runningAndPaused": "{{running}} running, {{paused}} paused",
    "nextAlarm": "Next {{time}}"
  },
  "alarm": {
    "weekdays": ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    "noAlarmsSet": "No alarms set",
    "newAlarm": "New Alarm",
    "addAlarm": "Add Alarm",
    "labelOptional": "Label (optional)",
    "alarms": "Alarms"
  },
  "todo": {
    "title": "TODO",
    "addTask": "Add a task...",
    "clearCompleted": "Clear completed",
    "markComplete": "Mark complete",
    "markIncomplete": "Mark incomplete",
    "delete": "Delete"
  },
  "note": {
    "placeholder": "Type your markdown note here...",
    "markdown": "Markdown"
  },
  "connection": {
    "connectionLost": "Connection lost",
    "clickToReconnect": "Click to reconnect",
    "connecting": "Connecting...",
    "password": "Password",
    "connect": "Connect",
    "cancel": "Cancel",
    "newSession": "New Session",
    "switchConnection": "Switch Connection",
    "switchToLocal": "Switch to a local terminal session",
    "switchToNote": "Switch to a markdown note editor",
    "switchToWsl": "Switch to WSL: {{distro}}",
    "switchToSsh": "Switch to SSH: {{target}}"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "close": "Close",
    "open": "Open",
    "settings": "Settings",
    "on": "ON"
  },
  "toolbar": {
    "newTab": "New Tab",
    "moreOptions": "More options",
    "layout": "Layout",
    "toolkit": "Toolkit",
    "single": "Single"
  }
}
```

- [ ] **Step 4: Create `src/locales/ko.json`**

Same structure as `en.json` with Korean translations:

```json
{
  "settings": {
    "title": "설정",
    "appearance": "모양",
    "terminal": "터미널",
    "browser": "브라우저",
    "language": "언어",
    "font": "글꼴",
    "fontNotAvailable": "글꼴을 사용할 수 없습니다 — 대체 글꼴 사용 중",
    "alsoAdjustable": "Ctrl +/-로도 조절 가능",
    "theme": "테마",
    "auto": "자동",
    "cursor": "커서",
    "cursorStyle": "커서 스타일",
    "block": "블록",
    "underline": "밑줄",
    "bar": "막대",
    "cursorBlink": "커서 깜빡임",
    "display": "표시",
    "lineHeight": "줄 높이",
    "scrollbackLines": "스크롤 기록 줄 수",
    "homePage": "홈페이지",
    "defaultHomePage": "기본값: google.com",
    "onboarding": "온보딩",
    "showWelcomePage": "환영 페이지 표시",
    "showWelcomeDesc": "다음 새 탭에서 환영 페이지를 다시 표시합니다"
  },
  "command": {
    "newTab": "새 탭",
    "newTabDesc": "새 터미널 탭 열기",
    "closeCurrentTab": "현재 탭 닫기",
    "closeCurrentTabDesc": "활성 탭 닫기",
    "enableBroadcast": "브로드캐스트 켜기",
    "disableBroadcast": "브로드캐스트 끄기",
    "broadcastDesc": "현재 탭의 모든 패널에 키보드 입력을 동시에 전송",
    "previousTab": "이전 탭",
    "previousTabDesc": "왼쪽 탭으로 전환",
    "nextTab": "다음 탭",
    "nextTabDesc": "오른쪽 탭으로 전환",
    "showToolkit": "도구 표시",
    "hideToolkit": "도구 숨기기",
    "toolkitDesc": "메모, 타이머, 도구가 있는 사이드 패널 전환",
    "showBrowser": "브라우저 표시",
    "hideBrowser": "브라우저 숨기기",
    "browserDesc": "브라우저 사이드 패널 전환",
    "sshProfiles": "SSH 프로필",
    "sshProfilesDesc": "저장된 SSH 서버 관리 및 연결",
    "settings": "설정",
    "settingsDesc": "모양, 터미널, 글꼴 설정 구성",
    "zoomCurrentPanel": "현재 패널 확대",
    "zoomCurrentPanelDesc": "포커스된 패널 전체 화면 전환",
    "previousPanel": "이전 패널",
    "previousPanelDesc": "이전 패널로 포커스 이동",
    "nextPanel": "다음 패널",
    "nextPanelDesc": "다음 패널로 포커스 이동",
    "panel1": "1 패널",
    "panels2": "2 패널",
    "panels3": "3 패널",
    "panels4": "4 패널",
    "columns4": "4 열",
    "panels6": "6 패널",
    "panels9": "9 패널",
    "splitLayout": "현재 탭을 {{layout}}(으)로 분할",
    "clearClipboardHistory": "클립보드 기록 지우기",
    "categoryTab": "탭",
    "categoryTabList": "탭 목록",
    "categoryLayout": "레이아웃",
    "categoryClipboard": "클립보드",
    "categorySwitchConnection": "연결 전환"
  },
  "commandPalette": {
    "searchCommands": "명령 검색...",
    "switchToTab": "탭 전환...",
    "switchConnection": "연결 전환...",
    "changeLayout": "레이아웃 변경...",
    "restoreBackground": "백그라운드 탭 복원...",
    "searchClipboard": "클립보드 기록 검색...",
    "noResults": "\"{{query}}\"에 대한 결과 없음",
    "try": "시도",
    "hintTabs": "탭",
    "hintBackground": "백그라운드",
    "hintConnect": "연결",
    "hintLayout": "레이아웃",
    "hintClipboard": "클립보드",
    "commandPalette": "명령 팔레트",
    "broadcastInput": "브로드캐스트 입력"
  },
  "welcome": {
    "slide1Title": "모든 것을 손끝에서",
    "slide1Desc": "Ctrl+K를 눌러 탭, 레이아웃, 클립보드 기록 등에 액세스하세요. 마우스가 필요 없습니다.",
    "slide2Title": "나만의 작업 공간",
    "slide2Desc": "1개부터 9개 패널 레이아웃까지 즉시 전환하세요. 각 패널은 Local, SSH, WSL에 독립적으로 연결됩니다.",
    "slide3Title": "집중하세요, 흐름을 유지하세요",
    "slide3Desc": "메모와 포모도로 타이머가 사이드바에 있습니다. 앱 전환이 필요 없습니다.",
    "slide4Title": "터미널을 떠나지 않고 브라우징",
    "slide4Desc": "터미널 옆에 내장 브라우저 패널을 열어보세요. 문서 검색, 대시보드 확인, 작업 미리보기를 흐름을 깨지 않고 할 수 있습니다.",
    "skip": "건너뛰기",
    "next": "다음",
    "getStarted": "시작하기"
  },
  "session": {
    "layout": "레이아웃",
    "connection": "연결",
    "allSame": "모두 동일",
    "perPanel": "패널별",
    "localShell": "로컬 셸",
    "powerShell": "PowerShell",
    "note": "메모",
    "markdownEditor": "마크다운 편집기",
    "panel": "패널 {{n}}",
    "open": "열기"
  },
  "ssh": {
    "authTitle": "SSH 인증",
    "noKeyFound": "이 호스트에 대한 SSH 키를 찾을 수 없습니다. 원격 서버의 비밀번호를 입력하세요.",
    "authFailed": "인증 실패. 다시 시도해 주세요.",
    "profiles": "SSH 프로필",
    "savedServers": "저장된 서버",
    "addServer": "서버 추가",
    "noSavedServers": "저장된 서버 없음",
    "addFirstServer": "+ 버튼을 눌러 첫 번째 서버를 추가하세요",
    "name": "이름",
    "host": "호스트",
    "port": "포트",
    "username": "사용자 이름",
    "identityFile": "인증 키 파일",
    "optional": "(선택 사항)",
    "commandPreview": "명령 미리보기"
  },
  "wsl": {
    "authTitle": "WSL 인증",
    "sudoRequired": "이 WSL 배포판에 openssh-server가 설치되어 있지 않습니다. 일회성 설치를 위해 sudo 비밀번호가 필요합니다."
  },
  "browser": {
    "title": "브라우저",
    "back": "뒤로",
    "forward": "앞으로",
    "reload": "새로고침",
    "home": "홈",
    "enterUrl": "URL 입력...",
    "retry": "재시도"
  },
  "tab": {
    "closeTab": "탭 닫기",
    "renameTab": "탭 이름 변경"
  },
  "window": {
    "minimize": "최소화",
    "maximize": "최대화",
    "zoom": "확대/축소",
    "close": "닫기"
  },
  "toast": {
    "welcomePageReset": "다음 새 탭에서 환영 페이지가 표시됩니다"
  },
  "timer": {
    "focus": "집중",
    "break": "휴식",
    "longBreak": "긴 휴식",
    "start": "시작",
    "pause": "일시정지",
    "resume": "재개",
    "reset": "초기화",
    "activeTimers": "활성 타이머",
    "clearDone": "완료 삭제",
    "done": "완료",
    "remove": "삭제",
    "selectPreset": "프리셋을 선택하여 타이머를 시작하세요",
    "sessions": "{{count}} 세션",
    "sessionsIdle": "{{count}} 세션",
    "beforeLongBreak": "긴 휴식까지",
    "sessionsLabel": "세션",
    "pomodoro": "포모도로",
    "timerLabel": "타이머",
    "running": "실행 중",
    "paused": "일시정지",
    "runningCount": "{{count}}개 실행 중",
    "pausedCount": "{{count}}개 일시정지",
    "runningAndPaused": "{{running}}개 실행 중, {{paused}}개 일시정지",
    "nextAlarm": "다음 {{time}}"
  },
  "alarm": {
    "weekdays": ["월", "화", "수", "목", "금", "토", "일"],
    "noAlarmsSet": "설정된 알람 없음",
    "newAlarm": "새 알람",
    "addAlarm": "알람 추가",
    "labelOptional": "라벨 (선택 사항)",
    "alarms": "알람"
  },
  "todo": {
    "title": "할 일",
    "addTask": "할 일 추가...",
    "clearCompleted": "완료 항목 삭제",
    "markComplete": "완료로 표시",
    "markIncomplete": "미완료로 표시",
    "delete": "삭제"
  },
  "note": {
    "placeholder": "마크다운 메모를 입력하세요...",
    "markdown": "마크다운"
  },
  "connection": {
    "connectionLost": "연결 끊김",
    "clickToReconnect": "클릭하여 재연결",
    "connecting": "연결 중...",
    "password": "비밀번호",
    "connect": "연결",
    "cancel": "취소",
    "newSession": "새 세션",
    "switchConnection": "연결 전환",
    "switchToLocal": "로컬 터미널 세션으로 전환",
    "switchToNote": "마크다운 메모 편집기로 전환",
    "switchToWsl": "WSL로 전환: {{distro}}",
    "switchToSsh": "SSH로 전환: {{target}}"
  },
  "common": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "close": "닫기",
    "open": "열기",
    "settings": "설정",
    "on": "켜짐"
  },
  "toolbar": {
    "newTab": "새 탭",
    "moreOptions": "더 보기",
    "layout": "레이아웃",
    "toolkit": "도구",
    "single": "단일"
  }
}
```

- [ ] **Step 5: Update `src/main.tsx` to import i18n**

Add `import "./i18n";` before the App import:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import { App } from "./App";
import "./styles/fonts.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Verify the app still compiles**

```bash
cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/i18n.ts src/locales/en.json src/locales/ko.json src/main.tsx package.json package-lock.json
git commit -m "feat: add i18n infrastructure with react-i18next"
```

---

### Task 2: Migrate SettingsModal (Language Selector + All Settings Strings)

**Files:**
- Modify: `src/components/SettingsModal/SettingsModal.tsx`
- Modify: `src/components/SettingsModal/SettingsModal.css`

- [ ] **Step 1: Add Language selector and `useTranslation` to SettingsModal**

In `SettingsModal.tsx`:
- Import `useTranslation` from `react-i18next` and `changeLanguage` from `../../i18n`
- Replace all hardcoded text with `t()` calls
- Add Language selector as the first section in Appearance tab (above Font)
- The Language selector is a dropdown with "English" and "한국어" options
- Read current language from `i18n.language` and call `changeLanguage(lng)` on change

Key changes in the component:

```tsx
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../../i18n";

// Inside SettingsModal:
const { t, i18n } = useTranslation();

// Replace "Settings" → t('settings.title')
// Replace "Appearance" → t('settings.appearance')
// Replace "Terminal" → t('settings.terminal')
// Replace "Browser" → t('settings.browser')

// Inside AppearanceTab - add Language section before Font section:
// <div className="settings-section">
//   <div className="settings-section-label">{t('settings.language')}</div>
//   <div className="settings-select-wrap">
//     <select className="settings-select" value={i18n.language} onChange={(e) => changeLanguage(e.target.value)}>
//       <option value="en">English</option>
//       <option value="한국어">한국어</option>  ← value should be "ko"
//     </select>
//   </div>
// </div>

// Replace "Font" → t('settings.font')
// Replace "Font not available — using fallback" → t('settings.fontNotAvailable')
// Replace "Also adjustable with Ctrl +/-" → t('settings.alsoAdjustable')
// Replace "Theme" → t('settings.theme')
// Replace "Auto" → t('settings.auto')
// Replace "Onboarding" → t('settings.onboarding')
// Replace "Show Welcome Page" → t('settings.showWelcomePage')
// Replace "Show the welcome page again on next new tab" → t('settings.showWelcomeDesc')

// Replace "Cursor" → t('settings.cursor')
// Replace "Cursor Style" → t('settings.cursorStyle')
// Replace "Block" → t('settings.block')
// Replace "Underline" → t('settings.underline')
// Replace "Bar" → t('settings.bar')
// Replace "Cursor Blink" → t('settings.cursorBlink')
// Replace "Display" → t('settings.display')
// Replace "Line Height" → t('settings.lineHeight')
// Replace "Scrollback Lines" → t('settings.scrollbackLines')
// Replace "Home Page" → t('settings.homePage')
// Replace "Default: google.com" → t('settings.defaultHomePage')
```

Note: CURSOR_OPTIONS labels need to use `t()`. Since these are defined outside the component, convert them to a function or use `t()` inline in the render.

Also update the toast message: `"Welcome page will show on next new tab"` → `t('toast.welcomePageReset')`

- [ ] **Step 2: Add CSS for language selector**

The language selector uses the same `.settings-select-wrap` and `.settings-select` styles as existing dropdowns. A divider should be added after the Language section. No new CSS classes needed — reuse existing.

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsModal/SettingsModal.tsx
git commit -m "feat(i18n): migrate SettingsModal with language selector"
```

---

### Task 3: Migrate TitleBar and TabBar

**Files:**
- Modify: `src/components/TitleBar/TitleBar.tsx`
- Modify: `src/components/TabBar/TabBar.tsx`

- [ ] **Step 1: Migrate TitleBar**

In `TitleBar.tsx`:
- Import `useTranslation`
- Replace `title="Minimize"` → `title={t('window.minimize')}`
- Replace `title="Maximize"` → `title={t('window.maximize')}`
- Replace `title="Close"` → `title={t('window.close')}`
- Replace `title="Zoom"` → `title={t('window.zoom')}`
- Update matching `aria-label` attributes

- [ ] **Step 2: Migrate TabBar**

In `TabBar.tsx`:
- Import `useTranslation`
- Replace `title="Close Tab"` → `title={t('tab.closeTab')}`
- Replace `"Close Tab"` in context menu → `t('tab.closeTab')`
- Replace `"Rename Tab"` in context menu → `t('tab.renameTab')`

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TitleBar/TitleBar.tsx src/components/TabBar/TabBar.tsx
git commit -m "feat(i18n): migrate TitleBar and TabBar"
```

---

### Task 4: Migrate CommandPalette and paletteCommands

**Files:**
- Modify: `src/components/CommandPalette/CommandPalette.tsx`
- Modify: `src/lib/paletteCommands.tsx`

- [ ] **Step 1: Migrate paletteCommands.tsx**

This file builds command sections outside of React components, so `useTranslation` cannot be used directly. Instead, pass a `t` function as a parameter to each builder function.

Update function signatures:
```typescript
import type { TFunction } from "i18next";

export function buildTabSection(p: TabCommandsParams, t: TFunction): PaletteSection {
  // Replace "New Tab" → t('command.newTab')
  // Replace "Open a new terminal tab" → t('command.newTabDesc')
  // Replace broadcastEnabled ternary: t('command.disableBroadcast') / t('command.enableBroadcast')
  // Replace sidebarOpen ternary: t('command.hideToolkit') / t('command.showToolkit')
  // Replace browserPanelOpen ternary: t('command.hideBrowser') / t('command.showBrowser')
  // Replace all other labels and descriptions with t() calls
  // IMPORTANT: Category labels ARE displayed in the grouped view — translate them:
  //   "Tab" → t('command.categoryTab')
  //   "Tab List" → t('command.categoryTabList')
  //   "Layout" → t('command.categoryLayout')
  //   "Clipboard" → t('command.categoryClipboard')
  //   "Switch Connection" → t('command.categorySwitchConnection')
}
```

Similarly update `buildLayoutSection`, `buildClipboardSection`, `buildConnectionSection`, `buildTabListSection`.

For `buildLayoutSection`, the `LAYOUT_OPTIONS` labels need translation. Use `t()` in the map:
```typescript
export function buildLayoutSection(activeTab: Tab | undefined, onLayoutChange: (layout: Layout) => void, t: TFunction): PaletteSection {
  const options = [
    { value: 1 as Layout, labelKey: "command.panel1" },
    { value: 2 as Layout, labelKey: "command.panels2" },
    // etc.
  ];
  return {
    category: t('commandPalette.hintLayout'),
    commands: options.map(({ value, labelKey }) => ({
      label: t(labelKey),
      description: t('command.splitLayout', { layout: t(labelKey).toLowerCase() }),
      // ...
    })),
  };
}
```

For `buildConnectionSection`: translate "Local Shell", "Note", "Switch to a local terminal session", etc.

- [ ] **Step 2: Update callers in App.tsx**

In `App.tsx`, pass `t` to all palette section builders:

```typescript
import { useTranslation } from "react-i18next";

// Inside App():
const { t } = useTranslation();

const tabPaletteSection = useMemo(() => buildTabSection({...}, t), [..., t]);
const layoutPaletteSection = useMemo(() => buildLayoutSection(activeTab, handleLayoutChange, t), [..., t]);
// etc.
```

- [ ] **Step 3: Migrate CommandPalette.tsx**

In `CommandPalette.tsx`:
- Import `useTranslation`
- Replace placeholder texts with `t()` calls:
  - `"Search commands..."` → `t('commandPalette.searchCommands')`
  - `"Switch to tab..."` → `t('commandPalette.switchToTab')`
  - etc.
- Replace `"No results for"` → `t('commandPalette.noResults', { query: q })`
- Replace `"Try"` → `t('commandPalette.try')`
- Replace footer hints: `"Tabs"` → `t('commandPalette.hintTabs')`, etc.
- Replace mode label mapping with `t()` calls

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CommandPalette/CommandPalette.tsx src/lib/paletteCommands.tsx src/App.tsx
git commit -m "feat(i18n): migrate CommandPalette and paletteCommands"
```

---

### Task 5: Migrate SplitToolbar

**Files:**
- Modify: `src/components/SplitToolbar/SplitToolbar.tsx`

- [ ] **Step 1: Migrate SplitToolbar**

In `SplitToolbar.tsx`:
- Import `useTranslation`
- Replace `title="New Tab"` → `title={t('toolbar.newTab')}`
- Replace `title="More options"` → `title={t('toolbar.moreOptions')}`
- Replace `"Layout"` section label → `t('toolbar.layout')`
- Replace `"Command Palette"` → `t('commandPalette.commandPalette')`
- Replace `"Broadcast Input"` → `t('commandPalette.broadcastInput')`
- Replace `"ON"` → `t('common.on')`
- Replace `"SSH Profiles"` → `t('command.sshProfiles')`
- Replace `"Toolkit"` → `t('toolbar.toolkit')`
- Replace `"Settings"` → `t('common.settings')`
- Layout button titles: use `t()` for each label (Single, 2 Panels, etc.)

Note: `LAYOUTS` is defined at module scope. Either convert labels to keys and call `t()` in render, or move the label resolution into the render function.

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SplitToolbar/SplitToolbar.tsx
git commit -m "feat(i18n): migrate SplitToolbar"
```

---

### Task 6: Migrate WelcomePage and slides

**Files:**
- Modify: `src/components/WelcomePage/slides.ts`
- Modify: `src/components/WelcomePage/WelcomePage.tsx`

- [ ] **Step 1: Update slides.ts to use translation keys**

```typescript
export interface SlideData {
  id: string;
  headlineKey: string;
  descriptionKey: string;
  shortcutKeys: string[];
}

export const slides: SlideData[] = [
  {
    id: "command-palette",
    headlineKey: "welcome.slide1Title",
    descriptionKey: "welcome.slide1Desc",
    shortcutKeys: ["Ctrl", "K"],
  },
  {
    id: "flexible-layout",
    headlineKey: "welcome.slide2Title",
    descriptionKey: "welcome.slide2Desc",
    shortcutKeys: [],
  },
  {
    id: "productivity",
    headlineKey: "welcome.slide3Title",
    descriptionKey: "welcome.slide3Desc",
    shortcutKeys: ["Ctrl", "Shift", "N"],
  },
  {
    id: "browser",
    headlineKey: "welcome.slide4Title",
    descriptionKey: "welcome.slide4Desc",
    shortcutKeys: ["Ctrl", "Shift", "B"],
  },
];
```

- [ ] **Step 2: Update WelcomePage.tsx to use t()**

```tsx
import { useTranslation } from "react-i18next";

// Inside WelcomePage:
const { t } = useTranslation();

// Replace slide.headline → t(slide.headlineKey)
// Replace slide.description → t(slide.descriptionKey)
// Replace "Skip" → t('welcome.skip')
// Replace "Next" → t('welcome.next')
// Replace "Get Started" → t('welcome.getStarted')
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/WelcomePage/slides.ts src/components/WelcomePage/WelcomePage.tsx
git commit -m "feat(i18n): migrate WelcomePage and slides"
```

---

### Task 7: Migrate SessionPicker

**Files:**
- Modify: `src/components/SessionPicker/SessionPicker.tsx`

- [ ] **Step 1: Migrate SessionPicker**

In `SessionPicker.tsx`:
- Import `useTranslation`
- Replace `"Layout"` → `t('session.layout')`
- Replace `"Connection"` → `t('session.connection')`
- Replace `"All Same"` → `t('session.allSame')`
- Replace `"Per Panel"` → `t('session.perPanel')`
- Replace `"Open"` → `t('session.open')`
- Replace `"Panel {i + 1}"` → `t('session.panel', { n: i + 1 })`
- In `connectionOptions`, replace `"Local Shell"` → `t('session.localShell')`, `"PowerShell"` → `t('session.powerShell')`, `"Note"` → `t('session.note')`, `"Markdown editor"` → `t('session.markdownEditor')`

Note: `connectionOptions` is a `useMemo` that depends on translations, so add `t` to the dependency array. This is fine because `t` changes when language changes.

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SessionPicker/SessionPicker.tsx
git commit -m "feat(i18n): migrate SessionPicker"
```

---

### Task 8: Migrate SshManagerModal

**Files:**
- Modify: `src/components/SshManager/SshManagerModal.tsx`

- [ ] **Step 1: Migrate SshManagerModal**

In `SshManagerModal.tsx`:
- Import `useTranslation`
- Replace `"SSH Profiles"` → `t('ssh.profiles')`
- Replace `"Saved Servers"` → `t('ssh.savedServers')`
- Replace `"Add Server"` → `t('ssh.addServer')`
- Replace `"No saved servers"` → `t('ssh.noSavedServers')`
- Replace `"Click + to add your first server"` → `t('ssh.addFirstServer')`
- Replace `"Name"` → `t('ssh.name')`
- Replace `"Host"` → `t('ssh.host')`
- Replace `"Port"` → `t('ssh.port')`
- Replace `"Username"` → `t('ssh.username')`
- Replace `"Identity File"` → `t('ssh.identityFile')`
- Replace `"(optional)"` → `t('ssh.optional')`
- Replace `"Command Preview"` → `t('ssh.commandPreview')`
- Replace `"Close"` → `t('common.close')`
- Replace `"Delete"` → `t('common.delete')`
- Replace `"Save"` → `t('common.save')`

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SshManager/SshManagerModal.tsx
git commit -m "feat(i18n): migrate SshManagerModal"
```

---

### Task 9: Migrate TerminalPane (Password Dialog + Connection States)

**Files:**
- Modify: `src/components/TerminalPane/TerminalPane.tsx`
- Modify: `src/hooks/usePasswordDialog.ts`

- [ ] **Step 1: Migrate TerminalPane**

In `TerminalPane.tsx`:
- Import `useTranslation`
- Replace `"SSH Authentication"` → `t('ssh.authTitle')`
- Replace `"No SSH key found..."` → `t('ssh.noKeyFound')`
- Replace `"Authentication failed. Please try again."` → `t('ssh.authFailed')`
- Replace `"WSL Authentication"` → `t('wsl.authTitle')`
- Replace `"openssh-server..."` → `t('wsl.sudoRequired')`
- Replace `"Connecting..."` → `t('connection.connecting')`
- Replace `"Password"` → `t('connection.password')`
- Replace `"Cancel"` → `t('connection.cancel')`
- Replace `"Connect"` → `t('connection.connect')`
- Replace `"Connection lost"` → `t('connection.connectionLost')`
- Replace `"Click to reconnect"` → `t('connection.clickToReconnect')`
- Replace `"New Session"` → `t('connection.newSession')`

- [ ] **Step 2: Update usePasswordDialog default title**

In `usePasswordDialog.ts`:
- The default title `"SSH Authentication"` on line 29 should remain as-is (it's overridden by the caller anyway). No change needed here.

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TerminalPane/TerminalPane.tsx
git commit -m "feat(i18n): migrate TerminalPane password dialog and connection states"
```

---

### Task 10: Migrate LeftBrowserPanel

**Files:**
- Modify: `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx`

- [ ] **Step 1: Migrate LeftBrowserPanel**

In `LeftBrowserPanel.tsx`:
- Import `useTranslation`
- Replace `"Browser"` → `t('browser.title')`
- Replace `title="Back"` → `title={t('browser.back')}`
- Replace `title="Forward"` → `title={t('browser.forward')}`
- Replace `title="Reload"` → `title={t('browser.reload')}`
- Replace `title="Home"` → `title={t('browser.home')}`
- Replace `placeholder="Enter URL..."` → `placeholder={t('browser.enterUrl')}`
- Replace `"Retry"` → `t('browser.retry')`

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LeftBrowserPanel/LeftBrowserPanel.tsx
git commit -m "feat(i18n): migrate LeftBrowserPanel"
```

---

### Task 11: Migrate PanelContextMenu

**Files:**
- Modify: `src/components/PanelContextMenu/PanelContextMenu.tsx`

- [ ] **Step 1: Migrate PanelContextMenu**

In `PanelContextMenu.tsx`:
- Import `useTranslation`
- Replace `"Switch Connection"` → `t('connection.switchConnection')`
- Replace `"Local Shell"` → `t('session.localShell')`
- Replace `"PowerShell"` meta → `t('session.powerShell')`
- Replace `"Note"` → `t('session.note')`
- Replace `"Markdown"` meta → `t('note.markdown')` (not `session.markdownEditor` — PanelContextMenu uses the short form "Markdown", not "Markdown editor")

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PanelContextMenu/PanelContextMenu.tsx
git commit -m "feat(i18n): migrate PanelContextMenu"
```

---

### Task 12: Migrate SidePanel and TimersPanel

**Files:**
- Modify: `src/components/SidePanel/SidePanel.tsx`
- Modify: `src/components/SidePanel/TimersPanel.tsx`

- [ ] **Step 1: Migrate SidePanel**

In `SidePanel.tsx`:
- Import `useTranslation`
- Replace `title="Todos"` → `title={t('todo.title')}`
- Replace `title="Timers"` → `title={t('timer.timerLabel')}`

- [ ] **Step 2: Migrate TimersPanel**

In `TimersPanel.tsx`:
- Import `useTranslation`
- Replace `"Pomodoro"` → `t('timer.pomodoro')`
- Replace `"Timer"` → `t('timer.timerLabel')`
- Replace `"Alarms"` → `t('alarm.alarms')`
- Replace phase labels: `"Focus"` → `t('timer.focus')`, `"Break"` → `t('timer.break')`, `"Long Break"` → `t('timer.longBreak')`
- Replace status text using interpolation keys:
  - `"${runningCount} running"` → `t('timer.runningCount', { count: runningCount })`
  - `"${pausedCount} paused"` → `t('timer.pausedCount', { count: pausedCount })`
  - `"${runningCount} running, ${pausedCount} paused"` → `t('timer.runningAndPaused', { running: runningCount, paused: pausedCount })`
- Replace `"Next ${nextAlarm.time}"` → `t('timer.nextAlarm', { time: nextAlarm.time })`

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SidePanel/SidePanel.tsx src/components/SidePanel/TimersPanel.tsx
git commit -m "feat(i18n): migrate SidePanel and TimersPanel"
```

---

### Task 13: Migrate AlarmPanel Components

**Files:**
- Modify: `src/components/AlarmPanel/PomodoroSection.tsx`
- Modify: `src/components/AlarmPanel/TimerSection.tsx`
- Modify: `src/components/AlarmPanel/RecurringSection.tsx`

- [ ] **Step 1: Migrate PomodoroSection**

In `PomodoroSection.tsx`:
- Import `useTranslation`
- Replace phase labels: `"Focus"`, `"Break"`, `"Long Break"` → `t('timer.focus')`, `t('timer.break')`, `t('timer.longBreak')`
- Replace `"Start"` → `t('timer.start')`, `"Pause"` → `t('timer.pause')`, `"Resume"` → `t('timer.resume')`, `"Reset"` → `t('timer.reset')`
- Replace `title="Settings"` → `title={t('common.settings')}`
- Replace stepper labels: `"Focus"`, `"Break"`, `"Long Break"`, `"Sessions"`, `"before long break"` → appropriate `t()` calls
- Replace `"${sessionsTotal} sessions"` → `t('timer.sessionsIdle', { count: sessionsTotal })`

- [ ] **Step 2: Migrate TimerSection**

In `TimerSection.tsx`:
- Import `useTranslation`
- Replace `"Active Timers"` → `t('timer.activeTimers')`
- Replace `"Clear Done"` → `t('timer.clearDone')`
- Replace `"Select a preset to start a timer"` → `t('timer.selectPreset')`
- Replace `"Done"` → `t('timer.done')`
- Replace `"Pause"` / `"Resume"` aria-labels → `t('timer.pause')` / `t('timer.resume')`
- Replace `"Remove"` → `t('timer.remove')`

- [ ] **Step 3: Migrate RecurringSection**

In `RecurringSection.tsx`:
- Import `useTranslation`
- Replace `WEEKDAY_LABELS` array → use `t('alarm.weekdays', { returnObjects: true })` (i18next returns arrays from JSON arrays)
- Replace `"No alarms set"` → `t('alarm.noAlarmsSet')`
- Replace `"New Alarm"` → `t('alarm.newAlarm')`
- Replace `"Cancel"` → `t('common.cancel')`
- Replace `placeholder="Label (optional)"` → `placeholder={t('alarm.labelOptional')}`
- Replace `"Save"` → `t('common.save')`
- Replace `"Add Alarm"` → `t('alarm.addAlarm')`

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AlarmPanel/PomodoroSection.tsx src/components/AlarmPanel/TimerSection.tsx src/components/AlarmPanel/RecurringSection.tsx
git commit -m "feat(i18n): migrate AlarmPanel components"
```

---

### Task 14: Migrate TodoSection and NoteEditor

**Files:**
- Modify: `src/components/NotePanel/TodoSection.tsx`
- Modify: `src/components/NotePanel/NoteEditor.tsx`

- [ ] **Step 1: Migrate TodoSection**

In `TodoSection.tsx`:
- Import `useTranslation`
- Replace `"TODO"` → `t('todo.title')`
- Replace `placeholder="Add a task..."` → `placeholder={t('todo.addTask')}`
- Replace `aria-label="Clear completed"` → `aria-label={t('todo.clearCompleted')}`
- Replace `title="Clear completed"` → `title={t('todo.clearCompleted')}`
- Replace `aria-label="Delete"` → `aria-label={t('todo.delete')}`
- Replace `title="Delete"` → `title={t('todo.delete')}`
- Replace checkbox aria-labels → `t('todo.markIncomplete')` / `t('todo.markComplete')`

- [ ] **Step 2: Migrate NoteEditor placeholder**

In `NoteEditor.tsx`, the placeholder `"Type your markdown note here..."` is passed to `baseMarkdownExtensions` at CodeMirror setup time. Since this is inside a `useEffect` (not in JSX), use `i18n.t()` directly:

```typescript
import i18n from "../../i18n";

// In the useEffect where EditorState is created:
placeholderText: i18n.t('note.placeholder'),
```

Note: The placeholder won't auto-update on language change since it's set once at mount. This is acceptable — CodeMirror editors are costly to rebuild, and users would need to switch tabs or reopen the note for the new placeholder to appear.

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/NotePanel/TodoSection.tsx src/components/NotePanel/NoteEditor.tsx
git commit -m "feat(i18n): migrate TodoSection and NoteEditor"
```

---

### Task 15: Update CLAUDE.md and Final Verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md language policy**

Replace the line:
```
- 모든 내용은 영어로 표시할 것. 터미널에서 대부분의 작업이 영어이기 때문에 자연스럽게 영어로 입력을 하게하기 위함.
```

With:
```
- UI 텍스트는 react-i18next를 통해 다국어로 제공 (현재 영어/한국어 지원). 번역 키는 `src/locales/` 하위 JSON 파일에서 관리. 새로운 UI 문자열 추가 시 반드시 번역 파일에 등록하고 `t()` 함수를 사용할 것. 하드코딩 금지.
```

- [ ] **Step 2: Final TypeScript verification**

```bash
cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md language policy for i18n"
```

---

## File Map Summary

**New files (3):**
- `src/i18n.ts` — i18next init + changeLanguage helper
- `src/locales/en.json` — English translations (~170 keys)
- `src/locales/ko.json` — Korean translations (~170 keys)

**Modified files (18):**
- `package.json` — add dependencies
- `src/main.tsx` — import i18n
- `src/App.tsx` — pass `t` to palette builders (Task 4)
- `src/components/SettingsModal/SettingsModal.tsx` — language selector + all strings
- `src/components/TitleBar/TitleBar.tsx` — window control labels
- `src/components/TabBar/TabBar.tsx` — tab context menu labels
- `src/components/CommandPalette/CommandPalette.tsx` — placeholders, hints, empty state
- `src/lib/paletteCommands.tsx` — all command labels/descriptions
- `src/components/SplitToolbar/SplitToolbar.tsx` — menu labels
- `src/components/WelcomePage/slides.ts` — key identifiers
- `src/components/WelcomePage/WelcomePage.tsx` — render with t()
- `src/components/SessionPicker/SessionPicker.tsx` — all labels
- `src/components/SshManager/SshManagerModal.tsx` — all labels
- `src/components/LeftBrowserPanel/LeftBrowserPanel.tsx` — toolbar labels
- `src/components/TerminalPane/TerminalPane.tsx` — password dialog + connection states
- `src/components/PanelContextMenu/PanelContextMenu.tsx` — connection labels
- `src/components/SidePanel/SidePanel.tsx` — tab titles
- `src/components/SidePanel/TimersPanel.tsx` — section labels + status
- `src/components/AlarmPanel/PomodoroSection.tsx` — all labels
- `src/components/AlarmPanel/TimerSection.tsx` — all labels
- `src/components/AlarmPanel/RecurringSection.tsx` — weekdays + labels
- `src/components/NotePanel/TodoSection.tsx` — all labels
- `src/components/NotePanel/NoteEditor.tsx` — placeholder
- `CLAUDE.md` — language policy

**Excluded from modification (spec deviations):**
- `src/components/NotePanel/NotePanel.tsx` — listed in spec but has zero user-facing strings; no changes needed
- `src/hooks/usePasswordDialog.ts` — listed in spec but the default title is always overridden by callers in TerminalPane.tsx; no changes needed
