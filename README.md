[README.md](https://github.com/user-attachments/files/32321912/README.md)
# 수급 & 목표 트래커

HTML 안에 있던 JavaScript를 기능별 파일로 분리한 버전입니다.

## 파일 구성

- `js/01-state.js`: 상태 모델, 기본값, 저장/불러오기, 날짜·정산 계산
- `js/02-render.js`: 화면 렌더링 및 보스/목표/수익 정산 UI
- `js/03-goal-actions.js`: 재화·캐릭터·목표·세부 목표 조작 및 표시 유틸리티
- `js/04-backup-nexon.js`: 백업/복원 및 넥슨 캐릭터 정보 연동
- `js/05-main.js`: 앱 시작 및 주기적인 날짜 갱신 처리

`goal-tracker.html`과 `js` 폴더를 같은 위치에 두고 HTML을 열면 됩니다.
