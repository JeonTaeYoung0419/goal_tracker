/* 수급 & 목표 트래커 - 섹션 메뉴 */
function showSection(sectionName) {
  const sections = document.querySelectorAll('.page-section');
  const buttons = document.querySelectorAll('.main-nav button[data-section]');
  const target = document.getElementById(`page-${sectionName}`);
  if (!target) return;

  sections.forEach(section => {
    section.classList.toggle('active', section === target);
  });
  buttons.forEach(button => {
    button.classList.toggle('active', button.dataset.section === sectionName);
  });

  // 메뉴를 바꿀 때도 현재 탭의 데이터가 최신 상태로 보이도록 갱신합니다.
  if (sectionName === 'boss' && typeof renderBossCharacters === 'function') {
    renderBossCharacters();
    renderBossExtra();
  }
  if (sectionName === 'daily' && typeof renderDailyHunting === 'function') {
    renderDailyHunting();
  }
  if (sectionName === 'settle' && typeof renderSettlement === 'function') {
    renderSettlement();
  }
}
