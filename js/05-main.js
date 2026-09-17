/* 수급 & 목표 트래커 - 기능별 분리 파일 */
loadState();

// 탭을 켜둔 채로 자정을 넘기는 경우를 대비해 1분마다 날짜 변경 여부를 확인
setInterval(() => {
  if (applyDailyIfNeeded()) {
    persist();
    renderAll();
  } else {
    // 목요일 00시 / 매달 1일 00시 경계를 지나면 정산 버튼 상태도 갱신
    renderBossCharacters();
  }
}, 60 * 1000);
