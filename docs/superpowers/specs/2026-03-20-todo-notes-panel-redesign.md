# Todo Tab & Notes Panel Redesign

## Overview

사이드패널의 Todo 탭과 노트 패널의 디자인을 Apple HIG에 맞춰 개선한다. Todo 탭은 불필요한 collapsible 구조를 제거하고 macOS Reminders 스타일로 재설계한다. 노트 패널은 터미널과의 시각적 차별화, 여백 확대, 선택 가능한 배경 패턴을 적용한다.

## Motivation

- Todo 탭의 collapsible 헤더가 타이머 패널과의 일관성을 위해 존재하지만, 투두 하나뿐이라 접기/펼치기가 무의미
- 노트 패널이 터미널과 동일한 배경(#1c1c1e)을 사용해 경계감이 없음
- 노트 텍스트가 가장자리에 붙어있어 답답함
- 노트다운 분위기가 부재

## Design

### 1. Todo Tab Redesign

#### 1.1 Collapsible 제거 → Full Panel

현재 `TodoSection`의 collapsible 헤더(chevron + "TODO" 라벨)를 제거한다. Todo 리스트가 탭 전체 영역을 사용한다.

#### 1.2 상단 카운터 바

collapsible 헤더 자리에 카운터 바를 배치한다:
- 좌측: `"{remaining} remaining"` (11px, label-tertiary) — i18n: `t('todo.remaining', { count })`
- 우측: `"{completed}/{total}"` (11px, JetBrains Mono, label-disabled)
- 할 일이 0개일 때는 카운터 바를 숨긴다

#### 1.2.1 빈 상태 (Empty State)

할 일이 0개일 때 패널 중앙에 빈 상태 안내를 표시한다:
- 체크리스트 아이콘 (24x24px, label-tertiary)
- `"No tasks yet"` 텍스트 (13px, label-tertiary) — i18n: `t('todo.empty')`
- 하단 "+ New Todo" 버튼은 빈 상태에서도 항상 표시

#### 1.3 원형 체크박스

현재 사각형(rounded rect) 체크박스를 원형으로 변경한다 (macOS Reminders와 동일):
- 미완료: 18x18px 원, 1.5px stroke, label-tertiary 색상
- 완료: 18x18px 원, accent(#0a84ff) fill, 흰색 체크 아이콘

#### 1.4 Progressive Disclosure — Completed 섹션

완료된 항목을 인라인에서 분리하여 별도 섹션으로 이동:
- 리스트 하단에 `"Completed"` 토글 (chevron + 라벨) — i18n: `t('todo.completedSection')`
- 기본 접힌 상태 (완료 항목 숨김)
- 펼치면 완료 항목 표시 (opacity: 0.4, line-through)
- 토글 우측에 `"Clear All"` 링크 (10px, label-disabled, 클릭 시 완료 항목 일괄 삭제) — i18n: `t('todo.clearAll')`
- 완료 항목이 0개면 Completed 섹션 자체를 숨긴다

#### 1.5 하단 "+ New Todo" 버튼

현재 하단 텍스트 입력 필드를 "+ New Todo" 버튼으로 교체:
- 하단 고정, border-top separator
- 좌측: 파란 원 안 + 아이콘 (16x16px, accent fill)
- 우측: "New Todo" 텍스트 (13px, accent color)
- 클릭 시 리스트 하단(Completed 섹션 위)에 빈 텍스트의 새 항목이 추가되며 contentEditable에 자동 포커스
- blur 시 텍스트가 비어있으면 항목 삭제 (기존 `handleBlurEdit` 동작 유지)
- Enter 키로 편집 확정 후, 연속 추가를 위해 또 다른 새 항목 자동 생성
- i18n: `t('todo.newTodo')` 키 사용

#### 1.6 아이템 인터랙션 유지

- 인라인 편집: 텍스트 클릭 → contentEditable (기존 유지)
- 삭제: 아이템 hover 시 우측에 X 버튼 노출 (기존 유지)
- 체크: 원형 체크박스 클릭 → 300ms opacity 페이드 아웃 후 Completed 섹션으로 이동 (Apple HIG의 meaningful motion)
- fontSize 바인딩: 터미널 폰트 크기 설정(`terminalConfigStore.fontSize`)이 투두 텍스트에도 적용되는 기존 동작 유지

#### 1.7 상태 관리 변경

- `collapsed` state 제거 (collapsible 없어짐)
- `completedCollapsed` state 추가 (Completed 섹션 접힘/펼침, 기본값: true, 컴포넌트 로컬 state — 탭 전환 시 리셋되어도 무방)
- 기존 `useTodoStore` 인터페이스는 변경 없음
- 기존 `.todo-section`의 `max-height: 50%` 제약 제거 (SidePanel에서 단독으로 전체 영역 사용)

### 2. Notes Panel Redesign

#### 2.1 배경 차별화

노트 패널의 배경색을 터미널(#1c1c1e)에서 elevated(#232325)로 변경하여 시각적으로 구분한다.

- `.note-panel--embedded`의 background를 `--bg-elevated`(#242426)로 변경 (기존 theme 변수 재활용)
- CodeMirror 에디터의 배경도 동일하게 `--bg-elevated` 적용

#### 2.2 패딩 확대

CodeMirror 에디터 영역의 패딩을 확대한다:
- 현재: ~4-6px
- 변경: 20px 24px (상하 20px, 좌우 24px)
- CodeMirror의 `.cm-content` padding으로 적용

#### 2.3 배경 패턴 (4종, 설정 선택)

노트 배경에 CSS background-image로 패턴을 적용한다. 기본값은 `grid`.

| Style | CSS | Description |
|-------|-----|-------------|
| `none` | 없음 | 패턴 없이 단색 배경 |
| `ruled` | `repeating-linear-gradient(transparent, transparent 22px, rgba(255,255,255,0.04) 22px, rgba(255,255,255,0.04) 23px)` | 수평 줄 노트 |
| `grid` | `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 20px 20px` | 모눈종이 격자 (기본값) |
| `dots` | `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px); background-size: 16px 16px` | 점 격자 |

> **Note:** 패턴 CSS 값은 다크 테마 전용 (`rgba(255,255,255,...)` 기반). 라이트 테마 지원 시 별도 CSS 변수화 필요. 현재는 다크 테마만 지원하므로 하드코딩 유지.

#### 2.4 상태 관리

새 파일 `src/store/noteConfigStore.ts` 생성 (`browserConfigStore.ts` 패턴 참조):
- `backgroundStyle: "none" | "ruled" | "grid" | "dots"` (기본값: `"grid"`)
- localStorage 키: `v-terminal:note-config`
- `noteStore.ts`(문서 콘텐츠 관리)와는 별도 관심사이므로 독립 파일로 생성

### 3. Settings Integration

#### 3.1 Appearance 탭에 Notes 섹션 추가

SettingsModal의 AppearanceTab 하단에 "Notes" 섹션을 추가한다:
- 섹션 헤더: `"Notes"` (11px, uppercase, label-tertiary)
- "Background Style" 행:
  - 좌측: 라벨 텍스트
  - 우측: 4개의 미니 프리뷰 버튼 (40x32px each)
    - 각 버튼에 해당 배경 패턴 축소 프리뷰
    - 선택된 항목: 2px accent border
    - 미선택: 1px border (bg-panel-border)
- 하단에 라벨 텍스트: "None · Ruled · Grid · Dots" (11px, label-disabled)
- i18n: `t('settings.notes')`, `t('settings.notesBgStyle')`, `t('settings.notesBgNone')`, `t('settings.notesBgRuled')`, `t('settings.notesBgGrid')`, `t('settings.notesBgDots')` 키 사용

## Files to Modify

| File | Change |
|------|--------|
| `src/components/NotePanel/TodoSection.tsx` | Collapsible 제거, 원형 체크박스, 카운터 바, Completed 섹션, "+ New Todo" 버튼 |
| `src/components/NotePanel/NotePanel.css` | Todo 관련 스타일 전면 재작성, 노트 패널 배경/패딩 변경 |
| `src/components/NotePanel/NotePanel.tsx` | 배경 패턴 CSS 적용 (noteConfigStore 연동) |
| `src/components/NotePanel/NoteEditor.tsx` | CodeMirror 배경색/패딩 변경 |
| `src/components/SettingsModal/SettingsModal.tsx` | AppearanceTab 함수 내 Notes 섹션 추가 |
| `src/store/noteConfigStore.ts` | 새 파일: backgroundStyle 상태 관리 (browserConfigStore 패턴) |
| `src/locales/en.json` | todo.remaining, todo.empty, todo.completedSection, todo.clearAll, todo.newTodo, settings.notes, settings.notesBgStyle 등 키 추가 |
| `src/locales/ko.json` | 위와 동일한 키의 한국어 번역 추가 |

## Out of Scope

- 노트 패널의 마크다운 에디터 기능 변경
- 투두 아이템의 드래그앤드롭 순서 변경
- 투두 아이템에 우선순위/태그 추가
- 라이트 테마 대응 (현재 다크 테마만 지원)
