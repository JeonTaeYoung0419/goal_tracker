/* 수급 & 목표 트래커 - 기능별 분리 파일 */
function exportData() {
  try {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = todayStr();
    a.href = url;
    a.download = `수급-목표-트래커-백업-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('내보내기에 실패했어요. 다시 시도해주세요.');
  }
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.resources)) {
        alert('올바른 백업 파일이 아니에요.');
        return;
      }
      state = parsed;
      normalizeState();
      persist();
      renderAll();
      const saveEl = document.getElementById('saveState');
      if (saveEl) saveEl.textContent = '백업 파일에서 복원됨 · ' + new Date().toLocaleTimeString('ko-KR');
    } catch (e) {
      alert('파일을 읽는 중 문제가 발생했어요. JSON 형식인지 확인해주세요.');
    }
  };
  reader.readAsText(file);
  document.getElementById('importFileInput').value = '';
}

const NEXON_KEY_LOCAL_STORAGE = 'nexon-personal-api-key'; // 백업/내보내기 대상(state)에 포함되지 않는 개인 전용 저장소

function initNexonProxyInput() {
  const input = document.getElementById('nexonProxyUrlInput');
  if (input) input.value = state.nexonProxyUrl || '';

  const keyInput = document.getElementById('nexonApiKeyInput');
  if (keyInput) {
    try {
      keyInput.value = window.localStorage.getItem(NEXON_KEY_LOCAL_STORAGE) || '';
    } catch (e) {
      // localStorage 사용 불가 환경 - 무시
    }
  }
}

function saveNexonProxyUrl() {
  const input = document.getElementById('nexonProxyUrlInput');
  state.nexonProxyUrl = input.value.trim().replace(/\/$/, '');
  persist();
  const statusEl = document.getElementById('nexonFetchStatus');
  if (statusEl) statusEl.textContent = '프록시 주소가 저장되었어요. (이 주소는 백업 파일에도 포함됩니다)';
}

function saveNexonApiKey() {
  const input = document.getElementById('nexonApiKeyInput');
  const statusEl = document.getElementById('nexonFetchStatus');
  try {
    window.localStorage.setItem(NEXON_KEY_LOCAL_STORAGE, input.value.trim());
    if (statusEl) statusEl.textContent = '내 API 키가 이 브라우저에 저장되었어요. (백업/내보내기 파일에는 포함되지 않습니다)';
  } catch (e) {
    if (statusEl) statusEl.textContent = '이 브라우저에서는 키를 저장할 수 없어요.';
  }
}

function getNexonApiKey() {
  try {
    return window.localStorage.getItem(NEXON_KEY_LOCAL_STORAGE) || '';
  } catch (e) {
    return '';
  }
}

async function fetchNexonCharacterInfo() {
  const proxyUrl = (state.nexonProxyUrl || '').trim();
  const nameInput = document.getElementById('nexonCharName');
  const statusEl = document.getElementById('nexonFetchStatus');
  const name = nameInput.value.trim();
  const myApiKey = getNexonApiKey();

  if (!proxyUrl) {
    statusEl.textContent = '먼저 위에 프록시 서버 주소를 입력하고 저장하세요.';
    return;
  }
  if (!myApiKey) {
    statusEl.textContent = '먼저 본인의 넥슨 오픈 API 키를 입력하고 저장하세요.';
    return;
  }
  if (!name) {
    statusEl.textContent = '캐릭터 닉네임을 입력하세요.';
    return;
  }

  statusEl.textContent = '불러오는 중...';

  try {
    const res = await fetch(`${proxyUrl}?character_name=${encodeURIComponent(name)}`, {
      headers: { 'x-user-nexon-key': myApiKey }
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      statusEl.textContent = '오류: ' + (data.error || '캐릭터를 찾을 수 없습니다.');
      return;
    }

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
      lastSynced: todayStr()
    };

    persist();
    renderBossCharacters();
    nameInput.value = '';
    statusEl.textContent = `"${data.character_name}" 정보를 불러왔어요 (Lv.${data.character_level} ${data.character_class})`;
  } catch (e) {
    statusEl.textContent = '요청 중 오류가 발생했어요. 프록시 주소가 정확한지, Worker가 정상 배포됐는지 확인해주세요.';
  }
}

