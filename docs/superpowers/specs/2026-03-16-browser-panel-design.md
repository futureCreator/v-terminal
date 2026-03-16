# Browser Panel Integration

## Problem

v-terminal 사용 중 가장 빈번한 앱 전환 원인은 웹 브라우저다. Confluence, Jira, 사내 GitHub, 메일, 일정 등 사내 시스템 접속과 문서 참조를 위해 별도 브라우저로 전환해야 한다. 사내 Jira/Confluence는 API를 제공하지 않으므로 커스텀 연동이 불가능하고, 웹 페이지를 직접 렌더링하는 수밖에 없다.

기존 브라우저의 근본적 문제는 탭이 무한히 쌓이는 것이다. 탭을 닫지 않는 이유는 "나중에 다시 필요할 때 쉽게 접근하기 위해서"인데, 결국 탭이 많아지면 찾지 못하고 새로 검색하게 된다. 핵심 문제는 **정보 회수 가능성(information retrievability)**이다.

## Terminology

이 문서에서 "워크스페이스"는 코드베이스의 `Tab` 인터페이스에 해당한다. v-terminal의 탭 하나가 하나의 워크스페이스다.

## Solution

Browser를 Terminal, WSL, SSH와 동등한 **Connection Type**으로 추가한다. 기존 패널 시스템과 레이아웃을 그대로 활용하여 터미널과 브라우저를 나란히 배치할 수 있다. 사이드 툴킷(노트, 타이머)도 브라우저 패널과 함께 사용 가능하다.

## Design Principles

- **1 Panel = 1 Page.** 브라우저 패널 안에 탭을 두지 않는다. 여러 페이지가 필요하면 패널을 분할하거나 새 워크스페이스 탭을 생성한다. 이것이 기존 브라우저의 탭 문제를 해결하는 핵심 원칙이다.
- **닫아도 괜찮은 브라우저.** 닫은 페이지는 워크스페이스 히스토리에 자동 보관되며, 커맨드 팔레트(Ctrl+K)로 즉시 복원할 수 있다. 정보 손실에 대한 불안 없이 패널을 닫을 수 있다.
- **단축키 최소화.** 브라우저 전용 단축키를 두지 않는다. 뒤로가기, 새로고침, 즐겨찾기 등은 URL 바의 UI 버튼과 커맨드 팔레트로 제공한다. 앱 레벨 단축키(Ctrl+K, Ctrl+Shift+N 등)만 가로채고 나머지 키 이벤트는 웹 페이지에 전달한다.
- **브라우저 관련 커맨드는 브라우저 패널 포커스 시에만 노출.** 커맨드 팔레트에서 뒤로가기, 새로고침, 즐겨찾기 추가 등 브라우저 전용 커맨드는 현재 포커스된 패널이 브라우저일 때만 표시한다.
- **Apple HIG 준수.** 모든 UI 요소는 Apple Human Interface Guidelines를 따른다.

## Connection Type: Browser

### Session Picker (새 탭 생성)

기존 Session Picker의 Connection Type 목록에 Browser를 추가한다.

- Local Shell
- WSL
- SSH
- Saved Session
- **Browser** (신규)

Browser를 선택하면 URL 입력 필드를 표시한다. 빈 상태로 진입하면 Empty State(즐겨찾기 + 최근 방문)를 보여준다.

레이아웃 선택 시 각 패널의 Connection Type을 개별 지정할 수 있다. 예: 2-panel 레이아웃에서 좌측 Terminal, 우측 Browser.

### Panel Switching (기존 탭에서)

기존 탭에서 패널의 Connection Type을 변경할 수 있다. 두 가지 경로를 제공한다:

**우클릭 컨텍스트 메뉴:**
- 패널 영역 아무 곳에서든 우클릭 → "Switch Connection" 서브메뉴 → Connection Type 목록 (Local Shell, WSL, SSH, Browser)
- React portal로 렌더링하며, 터미널 패널과 브라우저 패널 모두에서 동일하게 동작한다.

**커맨드 팔레트 (Ctrl+K):**
- "Switch Panel → Browser", "Switch Panel → Terminal" 등의 커맨드
- 현재 포커스된 패널에 대해 동작

**전환 시 기존 세션은 종료된다.** 패널 타입이 완전히 변경되며, 이전 터미널/브라우저 세션은 유지되지 않는다. 터미널→브라우저 전환 시 PTY 세션이 종료되고, 브라우저→터미널 전환 시 WebView가 파괴된다. 확인 다이얼로그는 표시하지 않는다 (터미널 세션은 데몬에서 유지되므로 Session Picker에서 다시 attach 가능).

## Browser Panel UI

### URL Bar

패널 상단에 최소한의 URL 바를 배치한다. 브라우저 내부 탭바는 없다.

구성 요소 (좌→우):
- **뒤로가기(←)** 버튼
- **앞으로가기(→)** 버튼
- **새로고침(↻)** 버튼
- **URL 입력 필드** — 현재 페이지 주소 표시, 클릭 시 편집 가능, Enter로 이동
- **즐겨찾기(☆/★)** 버튼 — 현재 페이지의 즐겨찾기 상태를 토글

**포커스 관리:**
- URL 입력 필드 클릭 → URL 바에 포커스, 전체 선택
- Enter 입력 → 페이지 이동 후 WebView에 포커스 이동
- Escape → URL 바에서 WebView로 포커스 복귀

**로딩 상태:**
- 페이지 로딩 중 URL 바 하단에 얇은 프로그레스 바 표시 (Apple HIG의 progress indicator 패턴)

### Link Click Behavior

- **일반 클릭:** 현재 패널에서 페이지 이동. 뒤로가기 버튼으로 이전 페이지 복귀.
- **Ctrl+클릭 / 중간 클릭:** v1에서는 현재 패널에서 이동 (일반 클릭과 동일). 향후 새 패널 열기 동작 추가 가능.

> Note: 새 패널 열기는 WebView 내부 클릭 이벤트 인터셉트, 레이아웃 자동 변경 등 복잡도가 높아 v1에서 제외한다.

### Empty State

URL이 없는 빈 브라우저 패널의 초기 화면:

**상단 — Bookmarks 그리드:**
- 즐겨찾기에 저장된 사이트를 아이콘(favicon) + 이름으로 표시
- 클릭하면 해당 페이지로 이동

**하단 — Recent in this Workspace:**
- 현재 워크스페이스(탭)에서 최근 방문한 페이지 목록
- 페이지 제목, 도메인, 마지막 방문 시간 표시
- 클릭하면 해당 페이지로 이동

### Error States

- **페이지 로드 실패** (DNS 에러, 타임아웃, SSL 에러): 에러 메시지와 "다시 시도" 버튼을 표시. URL 바는 유지되어 다른 URL 입력 가능.
- **잘못된 URL**: URL 바에 인라인 에러 표시 (빨간색 테두리).
- **WebView 크래시**: "페이지를 표시할 수 없습니다" 메시지와 "새로고침" 버튼.

## Bookmarks (즐겨찾기)

### 추가

URL 바 오른쪽 ☆ 아이콘을 클릭하면 즉시 저장된다.

- 모달 없이 원클릭 저장
- 이름: 페이지 제목 자동 사용
- URL: 현재 주소 자동 기록
- 아이콘이 ★로 변경되어 저장됨을 표시

### 관리

SplitToolbar의 더보기(⋯) 메뉴 → "Manage Bookmarks" → 관리 모달 (SSH Profile 모달 패턴)

기능:
- 이름 수정
- URL 수정
- 삭제
- 수동 추가 (+ Add Bookmark)

구조: 플랫 리스트. 향후 필요 시 그룹/폴더 기능 추가 가능.

### 저장

Bookmarks는 localStorage에 저장한다 (기존 SSH Profile, Terminal Config 등과 동일한 패턴).

```typescript
interface Bookmark {
  id: string;
  name: string;
  url: string;
  favicon?: string; // 도메인의 /favicon.ico URL. 로드 실패 시 기본 아이콘 사용.
  createdAt: number;
}
```

**Favicon 전략:** `https://{domain}/favicon.ico`를 기본 경로로 사용한다. 이미지 로드 실패 시 도메인 첫 글자를 사용한 기본 아이콘을 표시한다. favicon은 URL로 저장하며, base64 인코딩하지 않는다 (localStorage 용량 절약).

## Workspace History (워크스페이스 히스토리)

브라우저 패널에서 방문한 페이지를 워크스페이스(탭) 단위로 자동 기록한다.

### 기록 항목

```typescript
interface BrowserHistoryEntry {
  url: string;
  title: string;
  favicon?: string; // /favicon.ico URL
  visitedAt: number;
  tabId: string; // 워크스페이스(탭) 연결
}
```

### 검색 및 복원 (Ctrl+K)

커맨드 팔레트에서 검색어 입력 시 워크스페이스 히스토리를 함께 검색한다.

- 검색 대상: 페이지 제목, URL
- 카테고리 라벨: "Browser History (this workspace)"
- 결과 선택 시 현재 포커스된 브라우저 패널에서 열기 (브라우저 패널이 없으면 새 패널 생성)
- 히스토리 항목에는 방문 시간 표시

### 보존 정책

- 워크스페이스(탭)당 최대 100개 항목. 초과 시 가장 오래된 항목부터 삭제.
- 워크스페이스 탭이 삭제되면 해당 히스토리도 함께 삭제.
- TTL 없음 — 워크스페이스가 존재하는 한 히스토리 유지.

### 저장

히스토리도 localStorage에 저장한다. 워크스페이스(탭) ID를 키로 사용하여 분리 저장.

## Command Palette 확장

브라우저 패널 관련 커맨드를 커맨드 팔레트에 추가한다. **브라우저 패널에 포커스가 있을 때만** 아래 커맨드가 노출된다:

- **Go Back** — 이전 페이지로 이동
- **Go Forward** — 다음 페이지로 이동
- **Reload Page** — 페이지 새로고침
- **Add to Bookmarks / Remove from Bookmarks** — 즐겨찾기 토글
- **Manage Bookmarks** — 즐겨찾기 관리 모달 열기

패널 포커스와 무관하게 항상 노출되는 커맨드:

- **Switch Panel → Browser** — 현재 패널을 브라우저로 전환
- **Switch Panel → Terminal** — 현재 패널을 터미널로 전환
- 기존 커맨드 팔레트 히스토리 검색에 브라우저 히스토리 항목 포함

## Technical Implementation

### WebView Architecture

Tauri 2의 WebView는 DOM 요소가 아닌 **네이티브 OS 오버레이**다 (`wry` 라이브러리 기반, macOS에서는 WebKit, Windows에서는 WebView2 사용). 이로 인해 다음 사항을 관리해야 한다:

**위치/크기 동기화:**
- `BrowserPane` 컴포넌트가 자신의 DOM 요소에 `ResizeObserver`를 부착한다.
- DOM 요소의 위치/크기가 변경될 때마다 Tauri API (`set_position`, `set_size`)를 호출하여 네이티브 WebView를 동기화한다.
- 레이아웃 변경, 창 리사이즈, 사이드 패널 토글 시 모두 동기화 실행.

**Z-Order 관리 (모달/오버레이 대응):**
- 커맨드 팔레트, 세팅 모달, 컨텍스트 메뉴 등 오버레이 UI가 열릴 때 모든 활성 WebView를 `hide()` 처리한다.
- 오버레이가 닫히면 `show()`로 복원한다.
- Zustand store에 `isOverlayOpen` 플래그를 두고, `BrowserPane`이 이를 구독하여 WebView visibility를 토글한다.

**탭 전환:**
- 비활성 탭의 WebView는 `hide()`로 숨긴다 (파괴하지 않음 — 페이지 상태 보존).
- 활성 탭으로 전환 시 `show()`로 복원하고 위치/크기 재동기화.
- 탭이 닫힐 때 해당 WebView를 `close()`로 파괴.

**패널 줌:**
- 패널 줌 시 WebView 크기를 전체 그리드 영역으로 확장.
- 줌 해제 시 원래 패널 크기로 복원.

### Rust Backend (Tauri Commands)

브라우저 패널을 위한 Tauri IPC 커맨드를 추가한다:

```
commands/browser_commands.rs:
- create_browser_webview(panel_id, url?) → WebView 생성, panel 영역에 배치
- navigate(panel_id, url) → 페이지 이동
- go_back(panel_id) → 뒤로가기
- go_forward(panel_id) → 앞으로가기
- reload(panel_id) → 새로고침
- close_browser_webview(panel_id) → WebView 파괴
- set_browser_bounds(panel_id, x, y, width, height) → 위치/크기 설정
- show_browser_webview(panel_id) → WebView 표시
- hide_browser_webview(panel_id) → WebView 숨김
```

**프론트엔드로 전달되는 이벤트 (Rust → React):**

```
- browser:url-changed { panelId, url }
- browser:title-changed { panelId, title }
- browser:loading-changed { panelId, isLoading }
- browser:can-go-back-changed { panelId, canGoBack }
- browser:can-go-forward-changed { panelId, canGoForward }
```

Rust에서 `on_navigation` 콜백을 통해 네비게이션 이벤트를 감지하고, `app.emit()`으로 프론트엔드에 전달한다.

### Tauri Capabilities (권한)

`src-tauri/capabilities/default.json`에 WebView 관련 권한을 추가해야 한다:

```
core:webview:allow-create-webview
core:webview:allow-set-webview-position
core:webview:allow-set-webview-size
core:webview:allow-webview-close
core:webview:allow-set-webview-focus
core:webview:allow-webview-show
core:webview:allow-webview-hide
```

### Security

- **CSP:** 브라우저 WebView는 별도의 CSP 정책을 적용한다. 앱의 메인 WebView CSP와 분리하여 외부 사이트의 스크립트/스타일 로딩을 허용한다.
- **쿠키/세션:** 모든 브라우저 패널은 동일한 쿠키 저장소를 공유한다 (하나의 사이트에 로그인하면 다른 패널에서도 인증 유지). 이는 의도된 동작이다.
- **프로토콜 제한:** `javascript:`, `data:` URL은 차단한다. `http:`, `https:`, `file://` (로컬 파일)은 허용한다.
- **Tauri API 격리:** 브라우저 WebView에서 Tauri IPC를 호출할 수 없도록 격리한다 (메인 앱 WebView에서만 IPC 가능).

### State Management

브라우저 관련 상태를 관리하기 위해 Zustand store를 추가한다.

**browserStore:**
- 패널별 현재 URL, 페이지 제목, 로딩 상태
- `canGoBack`, `canGoForward` 상태
- Rust 이벤트를 구독하여 상태 동기화

**bookmarkStore:**
- 즐겨찾기 목록 CRUD
- localStorage 기반 영속화

**browserHistoryStore:**
- 워크스페이스별 방문 기록 (탭당 최대 100개)
- localStorage 기반 영속화

### Type Extension

기존 타입을 확장한다 (실제 코드베이스 타입 기준):

```typescript
// types/terminal.ts

// PanelConnection.type에 'browser' 추가
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl' | 'browser';
  sshCommand?: string;
  shellProgram?: string;
  shellArgs?: string[];
  label?: string;
  browserUrl?: string; // browser 타입일 때 초기 URL
}

// SavedTabPanel 확장 — 브라우저 패널도 저장 가능하도록
export interface SavedTabPanel {
  panelId: string;
  ptyId: string | null; // 브라우저 패널은 null
  connection?: PanelConnection; // 패널 복원 시 connection 정보 필요
}
```

**기존 코드 수정 필요:**
- `tabStore.ts`의 `saveAndRemoveTab`, `saveAllOpenTabsToBackground` 함수가 `ptyId !== null` 조건으로 패널을 필터링한다. 브라우저 패널(`ptyId === null`)이 누락되지 않도록 필터 조건을 수정해야 한다.
- `PanelGrid` 컴포넌트에서 `connectionType`에 따라 `TerminalPane` 또는 `BrowserPane`을 조건부 렌더링한다.
- `BrowserPane`은 `TerminalPane`과 동일한 포커스 인터페이스(onFocus, focus restoration)를 제공해야 한다.

## Layout Examples

### 2-Panel: Terminal + Browser
- 좌: Terminal (로컬 개발 서버)
- 우: Browser (Confluence 문서 참조)

### 3-Panel: Terminal + Browser ×2
- 좌: Terminal (코드 작업)
- 중: Browser (Jira 티켓)
- 우: Browser (Confluence 설계 문서)

### 2-Panel + Toolkit: Terminal + Browser + Notes
- 좌: Terminal
- 우: Browser (GitHub PR)
- 사이드: Toolkit (노트에 리뷰 코멘트 정리)

## Out of Scope

- 브라우저 패널 내부 탭 — 1 Panel = 1 Page 원칙에 의해 제외
- 브라우저 전용 단축키 — 커맨드 팔레트와 UI 버튼으로 대체
- Jira/Confluence API 연동 — 사내 정책에 의해 API 사용 불가
- 파일 탐색기/코드 에디터 패널 — 별도 논의 필요
- 즐겨찾기 그룹/폴더 — 향후 필요 시 추가
- Ctrl+클릭으로 새 패널 열기 — WebView 내부 클릭 인터셉트 복잡도로 v1에서 제외
- 확인 다이얼로그 없는 패널 전환 — 터미널 세션은 데몬에서 유지되므로 재연결 가능
