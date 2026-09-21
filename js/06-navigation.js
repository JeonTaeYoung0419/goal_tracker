/* 수급 & 목표 트래커 - 섹션 메뉴 */
(function () {
  function showSection(sectionName) {
    const target = document.getElementById('page-' + sectionName);
    if (!target) return;

    document.querySelectorAll('.page-section').forEach(function (section) {
      section.classList.toggle('active', section === target);
    });

    document
      .querySelectorAll('.main-nav button[data-section]')
      .forEach(function (button) {
        button.classList.toggle(
          'active',
          button.getAttribute('data-section') === sectionName
        );
      });

    // 탭을 열 때 해당 화면을 최신 상태로 다시 그립니다.
    if (
      sectionName === 'boss' &&
      typeof window.renderBossCharacters === 'function'
    ) {
      window.renderBossCharacters();

      if (typeof window.renderBossExtra === 'function') {
        window.renderBossExtra();
      }
    } else if (
      sectionName === 'daily' &&
      typeof window.renderDailyHunting === 'function'
    ) {
      window.renderDailyHunting();
    } else if (
      sectionName === 'settle' &&
      typeof window.renderSettlement === 'function'
    ) {
      window.renderSettlement();
    }
  }

  // 외부 JavaScript에서 사용할 수 있도록 전역 함수로 등록합니다.
  window.showSection = showSection;

  function initNavigation() {
    document
      .querySelectorAll('.main-nav button[data-section]')
      .forEach(function (button) {
        button.addEventListener('click', function () {
          showSection(button.getAttribute('data-section'));
        });
      });

    // 처음에는 목표 탭만 표시합니다.
    showSection('goals');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
})();
