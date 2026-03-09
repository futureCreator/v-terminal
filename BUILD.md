# 빌드 방법

## 사전 준비

1. **Rust 설치** (Windows):
   ```
   winget install Rustlang.Rustup
   ```
   또는 https://rustup.rs 에서 다운로드

2. **Tauri 시스템 의존성** (Windows):
   - Microsoft C++ Build Tools (Visual Studio Build Tools)
   - WebView2 Runtime (Windows 11은 기본 내장)

3. **Node.js + pnpm**:
   ```
   winget install OpenJS.NodeJS
   npm install -g pnpm
   ```

4. **JetBrains Mono Nerd Font 폰트 파일**:
   - https://www.nerdfonts.com/font-downloads 에서 `JetBrainsMono` 다운로드
   - 압축 해제 후 아래 파일들을 `public/fonts/` 폴더에 복사:
     - `JetBrainsMonoNerdFont-Regular.ttf`
     - `JetBrainsMonoNerdFont-Bold.ttf`
     - `JetBrainsMonoNerdFont-Italic.ttf`

## 개발 실행

```bash
pnpm install
pnpm tauri dev
```

## 프로덕션 빌드

```bash
pnpm tauri build
```

빌드된 인스톨러: `src-tauri/target/release/bundle/`
