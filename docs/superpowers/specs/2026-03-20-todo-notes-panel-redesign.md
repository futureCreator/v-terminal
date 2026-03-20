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
- 좌측: `"{remaining} remaining"` (11px, label-tertiary)
- 우측: `"{completed}/{total}"` (11px, JetBrains Mono, label-disabled)
- 할 일이 0개일 때는 카운터 바를 숨긴다

#### 1.3 원형 체크박스

현재 사각형(rounded rect) 체크박스를 원형으로 변경한다 (macOS Reminders와 동일):
- 미완료: 18x18px 원, 1.5px stroke, label-tertiary 색상
- 완료: 18x18px 원, accent(#0a84ff) fill, 흰색 체크 아이콘

#### 1.4 Progressive Disclosure — Completed 섹션

완료된 항목을 인라인에서 분리하여 별도 섹션으로 이동:
- 리스트 하단에 `"Completed"` 토글 (chevron + 라벨)
- 기본 접힌 상태 (완료 항목 숨김)
- 펼치면 완료 항목 표시 (opacity: 0.4, line-through)
- 토글 우측에 `"Clear All"` 링크 (10px, label-disabled, 클릭 시 완료 항목 일괄 삭제)
- 완료 항목이 0개면 Completed 섹션 자체를 숨긴다

#### 1.5 하단 "+ New Todo" 버튼

현재 하단 텍스트 입력 필드를 "+ New Todo" 버튼으로 교체:
- 하단 고정, border-top separator
- 좌측: 파란 원 안 + 아이콘 (16x16px, accent fill)
- 우측: "New Todo" 텍스트 (13px, accent color)
- 클릭 시 리스트 하단에 새 항목이 추가되며 인라인 편집 모드 진입
- i18n: `t('todo.newTodo')` 키 사용

#### 1.6 아이템 인터랙션 유지

- 인라인 편집: 텍스트 클릭 → contentEditable (기존 유지)
- 삭제: 아이템 hover 시 우측에 X 버튼 노출 (기존 유지)
- 체크: 원형 체크박스 클릭 → 완료 처리 후 Completed 섹션으로 이동

#### 1.7 상태 관리 변경

- `collapsed` state 제거 (collapsible 없어짐)
- `completedCollapsed` state 추가 (Completed 섹션 접힘/펼침, 기본값: true)
- 기존 `useTodoStore` 인터페이스는 변경 없음

### 2. Notes Panel Redesign

#### 2.1 배경 차별화

노트 패널의 배경색을 터미널(#1c1c1e)에서 elevated(#232325)로 변경하여 시각적으로 구분한다.

- `.note-panel--embedded`의 background를 `--bg-note`로 변경
- `--bg-note: #232325` CSS 변수를 theme.css에 추가
- CodeMirror 에디터의 배경도 동일하게 적용

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

#### 2.4 상태 관리

`noteConfigStore` (새로 생성 또는 기존 noteStore 확장):
- `backgroundStyle: "none" | "ruled" | "grid" | "dots"` (기본값: `"grid"`)
- localStorage 키: `v-terminal:note-config`

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
| `src/components/SettingsModal/AppearanceTab.tsx` | Notes 섹션 추가 |
| `src/styles/theme.css` | `--bg-note: #232325` 변수 추가 |
| `src/store/noteConfigStore.ts` | 새 파일: backgroundStyle 상태 관리 |
| `src/locales/en/translation.json` | 새 i18n 키 추가 |
| `src/locales/ko/translation.json` | 새 i18n 키 추가 |

## Out of Scope

- 노트 패널의 마크다운 에디터 기능 변경
- 투두 아이템의 드래그앤드롭 순서 변경
- 투두 아이템에 우선순위/태그 추가
- 라이트 테마 대응 (현재 다크 테마만 지원)
