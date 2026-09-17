[README.md](https://github.com/user-attachments/files/32322251/README.md)# 수급 & 목표 트래커

GitHub Pages 배포용 버전입니다. 메인 화면에는 목표만 표시되며, 상단 메뉴에서 각 관리 화면으로 이동할 수 있습니다.

## 파일 구성

- `goal-tracker.html`: 앱 화면
- `js/01-state.js`: 상태 모델, 기본값, 저장/불러오기, 날짜·정산 계산
- `js/02-render.js`: 화면 렌더링 및 보스/목표/수익 정산 UI
- `js/03-goal-actions.js`: 재화·캐릭터·목표·세부 목표 조작 및 표시 유틸리티
- `js/04-backup-nexon.js`: 백업/복원 및 넥슨 캐릭터 정보 연동
- `js/05-main.js`: 앱 시작 및 주기적인 날짜 갱신 처리
- `js/06-navigation.js`: 메인 메뉴와 섹션 전환 처리

`goal-tracker.html`과 `js` 폴더를 같은 위치에 두고 HTML을 열면 됩니다. GitHub Pages의 기본 주소로 사용하려면 `goal-tracker.html`을 `index.html`로 이름 변경하세요.
