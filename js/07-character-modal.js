/* 수급 & 목표 트래커 - 캐릭터 추가 모달 (닉네임 검색 -> 미리보기 -> 추가) */

let pendingCharData = null; // 검색으로 찾은, 아직 추가 확정 전인 캐릭터 정보

function openCharAddModal() {
  pendingCharData = null;
  const modal = document.getElementById('charAddModal');
  const nickInput = document.getElementById('charAddNickInput');
  const preview = document.getElementById('charAddPreview');
  const status = document.getElementById('charAddStatus');

  nickInput.value = '';
  preview.innerHTML = '';
  status.textContent = '';
  status.classList.remove('error');
  modal.style.display = 'flex';
  nickInput.focus();
}

function closeCharAddModal() {
  document.getElementById('charAddModal').style.display = 'none';
  pendingCharData = null;
}

async function searchNexonCharacterForAdd() {
  const nickInput = document.getElementById('charAddNickInput');
  const preview = document.getElementById('charAddPreview');
  const status = document.getElementById('charAddStatus');
  const name = nickInput.value.trim();

  preview.innerHTML = '';
  status.classList.remove('error');

  const proxyUrl = (state.nexonProxyUrl || '').trim();
  const myApiKey = getNexonApiKey();

  if (!name) {
    status.textContent = '닉네임을 입력하세요.';
    status.classList.add('error');
    return;
  }
  if (!proxyUrl || !myApiKey) {
    status.textContent = '"넥슨 정보" 메뉴에서 프록시 주소와 본인 API 키를 먼저 저장해주세요. 지금은 "수동 추가"로 바로 등록할 수 있어요.';
    status.classList.add('error');
    return;
  }

  status.textContent = '검색 중...';

  try {
    const res = await fetch(`${proxyUrl}?character_name=${encodeURIComponent(name)}`, {
      headers: { 'x-user-nexon-key': myApiKey }
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      status.textContent = '오류: ' + (data.error || '캐릭터를 찾을 수 없습니다.');
      status.classList.add('error');
      return;
    }

    pendingCharData = data;
    status.textContent = '';

    const imgSrc = data.character_image || '';
    preview.innerHTML = `
      <div class="char-preview-card">
        <div class="char-preview-top">
          ${imgSrc ? `<img class="char-preview-img" src="${imgSrc}" alt="${escapeHtml(data.character_name)}">` : ''}
          <div>
            <div class="char-preview-name">${escapeHtml(data.character_name)}</div>
            <div class="char-preview-stat">레벨 <b>${data.character_level}</b></div>
            <div class="char-preview-stat">직업 <b>${escapeHtml(data.character_class || '-')}</b></div>
            <div class="char-preview-stat">월드 <b>${escapeHtml(data.world_name || '-')}</b></div>
          </div>
        </div>
        <button class="btn-primary char-preview-add-btn" onclick="confirmAddNexonCharacter()">추가</button>
      </div>
    `;
  } catch (e) {
    status.textContent = '요청 중 오류가 발생했어요. 프록시 주소와 Worker 배포 상태를 확인해주세요.';
    status.classList.add('error');
  }
}

function confirmAddNexonCharacter() {
  if (!pendingCharData) return;
  const data = pendingCharData;

  let c = state.characters.find(ch => ch.name === data.character_name);
  if (!c) {
    const weekly = {};
    const monthly = {};
    state.resources.forEach(r => { weekly[r.id] = 0; monthly[r.id] = 0; });
    c = {
      id: uid(),
      name: data.character_name,
      weekly,
      monthly,
      lastSettled: {},
      settlementLog: { weekly: [], monthly: [] }
    };
    state.characters.push(c);
  }

  c.nexonInfo = {
    level: data.character_level,
    jobClass: data.character_class,
    worldName: data.world_name,
    guildName: data.character_guild_name,
    image: data.character_image,
    lastSynced: todayStr()
  };

  persist();
  closeCharAddModal();
  goToWeeklyBossSettlement();
}

// 닉네임 조회 없이 빈 캐릭터 카드만 바로 추가 (기존 "+ 캐릭터 추가"와 동일한 수동 추가)
function manualAddCharacterFromModal() {
  addCharacter();
  closeCharAddModal();
  goToWeeklyBossSettlement();
}

// 추가한 캐릭터가 바로 보이도록 "보스 수익 > 주간" 화면으로 이동
function goToWeeklyBossSettlement() {
  if (currentBossTab !== 'weekly') {
    switchBossTab('weekly');
  } else {
    renderBossCharacters();
    renderBossExtra();
  }
  if (typeof showSection === 'function') {
    showSection('boss');
  }
}

// Enter 키로도 검색되도록
document.addEventListener('DOMContentLoaded', () => {
  const nickInput = document.getElementById('charAddNickInput');
  if (nickInput) {
    nickInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') searchNexonCharacterForAdd();
    });
  }
});
