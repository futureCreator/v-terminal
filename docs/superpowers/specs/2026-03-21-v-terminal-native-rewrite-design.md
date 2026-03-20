# v-terminal Native Rewrite Design

Windows 네이티브 터미널 애플리케이션으로 재작성. 기존 Tauri/React 기반 v-terminal v0.19.4를 스펙 문서로 활용.

## 기술 스택

- **UI 프레임워크:** WinUI 3 + C++/WinRT
- **터미널 에뮬레이션:** ConPTY + microsoft/terminal 코어 라이브러리
- **SSH:** libssh2
- **빌드 시스템:** MSBuild (Visual Studio 솔루션)
- **다국어:** Windows 리소스 파일 (.resw)
- **데이터 저장:** JSON 파일
- **타겟 OS:** Windows 전용

## 제거된 기능

- 내장 브라우저 (Tauri WebView) — Chrome 확장 프로그램 활용이 더 적합
- 폰트 크기 단축키 (Ctrl++/-/0) — 설정에서 직접 수정
- 커맨드 팔레트 `@` 접두어 (백그라운드 탭 복원) — 레이아웃 축소 시 세션 kill 하므로 불필요

## 프로젝트 구조

```
v-terminal.sln
├── v-terminal.App/           # WinUI 3 앱 셸 (진입점, XAML Views, ViewModels)
│   ├── App.xaml
│   ├── Views/
│   │   ├── MainWindow.xaml       # 타이틀바 + 탭바 + 툴바 + 패널 그리드
│   │   ├── TerminalPane.xaml     # 단일 터미널 패널 (SwapChainPanel 기반)
│   │   ├── NotePane.xaml         # 마크다운 노트 에디터
│   │   ├── SettingsDialog.xaml   # 설정 모달
│   │   ├── CommandPalette.xaml   # Ctrl+K 팔레트
│   │   ├── SshProfileDialog.xaml # SSH 프로필 관리
│   │   └── WelcomePage.xaml      # 온보딩
│   ├── ViewModels/               # MVVM
│   └── Strings/                  # .resw 리소스
│       ├── en/Resources.resw
│       └── ko/Resources.resw
│
├── v-terminal.Terminal/      # ConPTY + VT 파서 + 렌더링 엔진
│   ├── ConPtyProcess.h/cpp       # ConPTY 프로세스 관리
│   ├── VtParser.h/cpp            # microsoft/terminal 코어 활용
│   ├── TerminalRenderer.h/cpp    # DirectWrite/Direct2D 텍스트 렌더링
│   └── TerminalBuffer.h/cpp      # 스크롤백 버퍼, 셀 데이터
│
├── v-terminal.Session/       # 세션 생명주기 관리
│   ├── SessionManager.h/cpp      # 세션 생성/제거/추적
│   ├── LocalSession.h/cpp        # ConPTY 로컬 셸
│   ├── SshSession.h/cpp          # libssh2 기반 SSH
│   └── WslSession.h/cpp          # wsl.exe 기반
│
├── v-terminal.Toolkit/       # 생산성 도구
│   ├── TodoStore.h/cpp           # TODO 리스트
│   ├── PomodoroTimer.h/cpp       # 포모도로
│   ├── CountdownTimer.h/cpp      # 카운트다운
│   ├── AlarmManager.h/cpp        # 반복 알람
│   └── ClipboardHistory.h/cpp    # 클립보드 히스토리
│
└── v-terminal.Core/          # 공통 유틸리티
    ├── Settings.h/cpp            # JSON 설정 읽기/쓰기
    ├── JsonStore.h/cpp           # 범용 JSON 파일 영속성
    ├── EventBus.h/cpp            # 컴포넌트 간 이벤트 통신
    └── Types.h                   # 공통 타입 정의
```

## 터미널 렌더링 파이프라인

```
셸 프로세스 (cmd/PowerShell)
    ↓ stdout
ConPTY (Windows Pseudo Console API)
    ↓ VT 시퀀스 바이트 스트림
VtParser (microsoft/terminal 코어)
    ↓ 파싱된 명령 (텍스트 출력, 커서 이동, 색상 변경 등)
TerminalBuffer (셀 그리드 + 스크롤백)
    ↓ 변경된 셀 데이터
TerminalRenderer (DirectWrite + Direct2D)
    ↓
SwapChainPanel (WinUI 3 XAML)
    ↓
화면 출력
```

### ConPtyProcess

- `CreatePseudoConsole()` API로 PTY 생성
- 입출력은 파이프로 비동기 읽기/쓰기
- 리사이즈는 `ResizePseudoConsole()`

### VtParser

- microsoft/terminal의 `Microsoft::Console::VirtualTerminal` 파서를 정적 라이브러리로 빌드하여 링크
- VT100/VT220/xterm 시퀀스 처리를 직접 구현하지 않음

### TerminalBuffer

- 셀 단위 그리드 (cols × rows)
- 각 셀: 문자 + 전경색 + 배경색 + 속성 (bold, italic 등)
- 스크롤백 버퍼 1,000~10,000줄 설정 가능

### TerminalRenderer

- DirectWrite로 글리프 렌더링 (JetBrains Mono 등)
- Direct2D로 배경색/커서/선택 영역 그리기
- `SwapChainPanel`에 출력하여 WinUI 3 XAML 트리에 통합

### 입력 흐름

```
키보드 입력 → WinUI 3 KeyDown → VT 시퀀스 변환 → ConPTY stdin → 셸
```

### 브로드캐스트 모드

키 입력을 현재 탭의 모든 패널 세션 stdin에 동시 전달.

## 레이아웃 시스템

XAML Grid 기반 구현.

```
MainWindow
├── TitleBar (커스텀 타이틀바)
├── TabBar (탭 관리)
├── SplitToolbar (레이아웃 전환, 브로드캐스트 토글, 툴킷 토글)
└── ContentArea (Grid)
    ├── PanelGrid (Grid — 동적 RowDefinitions/ColumnDefinitions)
    │   ├── TerminalPane 또는 NotePane [0,0]
    │   ├── TerminalPane 또는 NotePane [0,1]
    │   └── ...최대 6패널
    └── SidePanel (Toolkit — 오른쪽)
        ├── TodoView
        └── TimersView (포모도로 + 카운트다운 + 알람)
```

### 레이아웃 프리셋

| 프리셋 | Grid 구성 |
|--------|-----------|
| 1 | 1x1 |
| 2 | 1x2 (좌/우) |
| 3 | 1열 좌 + 2행 우 |
| 4 | 2x2 |
| 5 | 1열 좌 + 2x2 우 |
| 6 | 3x2 |

### 레이아웃 전환 시

- 기존 패널 세션은 유지 (세션 kill 안 함)
- 패널 수가 줄면 초과 패널의 세션은 kill
- 패널 수가 늘면 새 패널은 기본 로컬 셸 자동 연결
- `Grid.RowDefinitions`/`ColumnDefinitions`을 동적으로 재구성

### 패널별 독립 연결

- 각 패널은 자체 `PanelConnection` (Local/SSH/WSL/Note)
- 우클릭 컨텍스트 메뉴로 연결 전환
- 줌 모드: 선택한 패널을 1x1로 전환, 다시 누르면 복귀

## 세션 관리

```
SessionManager
├── createSession(type, config) → sessionId
├── killSession(sessionId)
├── resizeSession(sessionId, cols, rows)
├── writeSession(sessionId, data)
└── sessions: map<sessionId, ISession>

ISession (인터페이스)
├── LocalSession   → ConPTY + 기본 셸 (cmd.exe / PowerShell)
├── SshSession     → libssh2 + PTY 할당
└── WslSession     → ConPTY + wsl.exe -d <distro>
```

### 세션 생명주기

1. **생성** — 패널 활성화 시 `SessionManager::createSession()` 호출. UUID 발급.
2. **데이터 흐름** — 세션 stdout → 콜백으로 해당 패널의 `VtParser`에 전달
3. **리사이즈** — 패널 크기 변경 시 `ResizePseudoConsole()` 호출
4. **종료** — 패널 닫힘/레이아웃 축소/탭 닫힘 시 `killSession()`. 프로세스 종료 + 파이프 정리.
5. **앱 종료** — `SessionManager` 소멸자에서 모든 세션 일괄 kill

### SSH 세션

- libssh2로 TCP 연결 → 인증 (키 파일 또는 패스워드)
- `libssh2_channel_request_pty("xterm-256color")`로 PTY 할당
- SSH 프로필은 JSON 파일로 관리 (`ssh_profiles.json`)
- 패스워드 인증 시 다이얼로그로 입력 받음

### WSL 세션

- `wsl.exe --list --quiet`로 디스트로 목록 캐싱
- `CreatePseudoConsole()` + `wsl.exe -d <distro> --cd ~`로 프로세스 생성
- 로컬 세션과 동일한 ConPTY 파이프라인 사용

## 데이터 영속성

### 저장 위치: `%APPDATA%\v-terminal\`

```
%APPDATA%\v-terminal\
├── settings.json          # 터미널 설정 (폰트, 커서, 스크롤백, 테마, 언어)
├── workspace.json         # 탭/패널/레이아웃 + 노트 내용 포함
├── ssh_profiles.json      # SSH 프로필 목록
├── todos.json             # TODO 리스트 (전역)
├── alarms.json            # 포모도로 설정 + 반복 알람 (전역)
├── clipboard_history.json # 클립보드 히스토리 (전역, 최대 50개)
└── onboarding.json        # 온보딩 완료 여부
```

### workspace.json 구조

```json
{
  "tabs": [
    {
      "label": "Terminal 1",
      "layout": 3,
      "panels": [
        { "type": "local", "sessionConfig": {} },
        { "type": "note", "noteContent": "## 메모\n- 할일 ..." },
        { "type": "ssh", "sshProfileId": "abc-123" }
      ]
    }
  ]
}
```

### 읽기/쓰기 패턴

- `JsonStore` 클래스가 파일별 읽기/쓰기 담당
- 앱 시작 시 전체 로드, 이후 변경 시 디바운스 저장 (300ms)
- 파일 없으면 기본값으로 생성
- TODO, 알람은 전역 데이터로 앱 재시작 시 항상 복원

## 커맨드 팔레트

Ctrl+K로 토글. 퍼지 검색 지원.

### 접두어 모드

| 접두어 | 대상 | 동작 |
|--------|------|------|
| (없음) | 전체 명령 퍼지 검색 | 명령 실행 |
| `!` | 탭 목록 | 탭 리스트 표시 → 선택하면 해당 탭으로 전환 |
| `@` | 연결 전환 | 로컬/SSH/WSL/노트 목록 → 현재 패널 연결 변경 |
| `#` | 레이아웃 전환 | 1~6 프리셋 목록 → 선택하면 레이아웃 변경 |
| `$` | 클립보드 히스토리 | 히스토리 검색 → 선택하면 클립보드에 복사 |

### 명령 목록

- 탭: 새 탭, 탭 닫기, 이전/다음 탭, 브로드캐스트 토글
- 뷰: 툴킷 토글, 설정, SSH 프로필 관리, 패널 줌, 이전/다음 패널
- 연결: 로컬/SSH/WSL/노트 전환
- 클립보드: 히스토리 검색, 전체 삭제

### 구현

WinUI 3 `ContentDialog` 또는 커스텀 `Popup`으로 오버레이. `TextBox` + `ListView` 조합. 입력마다 퍼지 매칭으로 필터링.

## 테마 시스템

### 시스템 테마 연동

- `UISettings.ColorValuesChanged` 이벤트로 시스템 테마 변경 감지
- 설정에서 자동/라이트/다크 수동 선택 가능

### 테마 적용 범위

1. **앱 UI** — WinUI 3 기본 리소스(`ThemeResource`)로 자동 처리. Fluent Design 라이트/다크 기본 제공.
2. **터미널 색상** — 별도 관리. 16색 ANSI 팔레트 + 전경/배경/커서/선택 영역 색상을 테마별로 정의.

### 터미널 테마 (settings.json 내)

```json
{
  "theme": "auto",
  "terminalThemes": {
    "light": {
      "foreground": "#1d1f21",
      "background": "#ffffff",
      "cursor": "#1d1f21",
      "selectionBackground": "#b4d5fe",
      "ansi": ["#000000", "#c82829", "...16색"]
    },
    "dark": {
      "foreground": "#c5c8c6",
      "background": "#1d1f21",
      "cursor": "#c5c8c6",
      "selectionBackground": "#373b41",
      "ansi": ["#000000", "#cc6666", "...16색"]
    }
  }
}
```

초기에는 라이트/다크 두 벌로 시작. 커스텀 테마 프리셋은 추후 확장.

## 툴킷 사이드바

오른쪽 사이드 패널. Ctrl+Shift+N으로 토글.

```
SidePanel
├── 탭 전환: [Todos] [Timers]
│
├── Todos 탭
│   ├── 입력창 + 추가 버튼
│   ├── 할일 목록 (체크박스 + 텍스트 + 삭제)
│   └── 하단: 남은 개수 + 완료 항목 일괄 삭제
│
└── Timers 탭
    ├── 포모도로
    │   ├── 프로그레스 링 (Direct2D 원형)
    │   ├── 세션 점 표시 (Focus → Break → ... → LongBreak)
    │   ├── 시작/일시정지/리셋 버튼
    │   └── 설정: Focus(5-60분), Break(5-25분), LongBreak(10-120분)
    │
    ├── 카운트다운 타이머
    │   ├── 새 타이머 추가 (이름 + 시간)
    │   ├── 다수 동시 실행
    │   └── 개별 일시정지/재개/삭제
    │
    └── 반복 알람
        ├── 시간(HH:mm) + 요일 선택(월~일)
        ├── 라벨
        ├── 개별 활성/비활성 토글
        └── 알람 트리거 시 Windows ToastNotification
```

## 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+K` | 커맨드 팔레트 토글 |
| `Ctrl+Shift+T` | 새 탭 |
| `Ctrl+Shift+N` | 툴킷 사이드바 토글 |

## 설정 모달

커맨드 팔레트에서 `settings`로 접근.

```
SettingsDialog (ContentDialog)
├── Appearance 탭
│   ├── 테마: Auto / Light / Dark
│   ├── 언어: English / 한국어
│   └── 노트 배경: None / Ruled / Grid / Dots
│
├── Terminal 탭
│   ├── 폰트 선택 (JetBrains Mono, Fira Code, Cascadia Code, ...)
│   ├── 폰트 크기 (10~24pt)
│   ├── 커서 스타일: Block / Underline / Bar
│   ├── 커서 깜빡임: On / Off
│   ├── 줄 높이 (1.0~1.6)
│   └── 스크롤백 버퍼 (1,000~10,000줄)
│
└── General 탭
    └── 온보딩 초기화 버튼
```
