# v-terminal Project Notes

## 버전 관리

버전을 업데이트할 때 반드시 아래 두 파일을 함께 수정해야 한다:

1. `package.json` - `version` 필드
2. `src-tauri/tauri.conf.json` - `version` 필드

Tauri는 설치파일 버전을 `src-tauri/tauri.conf.json`에서 읽기 때문에, 이 파일을 누락하면 빌드 결과물의 버전이 이전 버전으로 표시된다.

## 이 앱의 용도
이 앱은 윈도우에서 빌드해서 윈도우 환경에서 사용하려고 함.
