/* 수급 & 목표 트래커 - 기능별 분리 파일 */

const PALETTE = ['#E0A63D', '#4FC3B0', '#E0765A', '#9B8DF0', '#6FBF7B', '#5AA6E0', '#E07AAE', '#C9C15A'];

let state = {
  resources: [],
  characters: [],
  goals: []
};

function uid() { return Math.random().toString(36).slice(2, 10); }

function colorFor(index) { return PALETTE[index % PALETTE.length]; }

const LOCAL_KEY = 'gt-state-v1';
let storageMode = 'none'; // 'cloud' | 'local' | 'none'
let expandedCompleted = {}; // 메인 목표별 완료 목록 펼침 여부 (세션 한정, 저장 안 함)
let expandedSettlementLog = {}; // 캐릭터+주기별 정산 기록 펼침 여부 (세션 한정, 저장 안 함)

async function loadState() {
  const saveEl = document.getElementById('saveState');

  // 1) Claude 아티팩트 환경이면 window.storage(클라우드) 우선 시도
  if (window.storage && typeof window.storage.get === 'function') {
    try {
      const res = await window.storage.get('gt-state', false);
      if (res && res.value) {
        state = JSON.parse(res.value);
        normalizeState();
      } else {
        seedDefaults();
      }
      applyDailyIfNeeded();
      storageMode = 'cloud';
      await persist();
      renderAll();
      initNexonProxyInput();
      return;
    } catch (e) {
      // window.storage 사용 실패 시 localStorage로 폴백
    }
  }

  // 2) 브라우저에서 파일을 직접 열었을 때 등 - localStorage 폴백
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) {
      state = JSON.parse(raw);
      normalizeState();
    } else {
      seedDefaults();
    }
    applyDailyIfNeeded();
    storageMode = 'local';
    persist();
  } catch (e) {
    seedDefaults();
    storageMode = 'none';
    saveEl.textContent = '이 환경에서는 저장이 지원되지 않아요 (새로고침 시 초기화됨)';
  }
  renderAll();
  initNexonProxyInput();
}

function seedDefaults() {
  const meso = { id: uid(), name: '메소', weeklyEnabled: true, monthlyEnabled: false, unitDivisor: 100000000, unitLabel: '억' };
  const erda = { id: uid(), name: '솔 에르다 조각', weeklyEnabled: false, monthlyEnabled: false, unitDivisor: 1, unitLabel: '' };
  state.resources = [meso, erda];
  state.characters = [
    { id: uid(), name: '캐릭터 A', weekly: { [meso.id]: 5000000000, [erda.id]: 0 }, monthly: { [meso.id]: 0, [erda.id]: 0 }, lastSettled: {}, settlementLog: { weekly: [], monthly: [] } },
    { id: uid(), name: '캐릭터 B', weekly: { [meso.id]: 3000000000, [erda.id]: 0 }, monthly: { [meso.id]: 0, [erda.id]: 0 }, lastSettled: {}, settlementLog: { weekly: [], monthly: [] } }
  ];
  state.resourceStock = { [meso.id]: 12000000000, [erda.id]: 20 };
  state.dailyHunting = { [meso.id]: 500000000, [erda.id]: 3 };
  state.lastAppliedDate = todayStr();
  state.nexonProxyUrl = '';
  state.goals = [
    {
      id: uid(),
      title: '신규 무기 세트 획득',
      subGoals: [
        { id: uid(), title: '무기 상자 구매', resourceId: meso.id, target: 20000000000 },
        { id: uid(), title: '솔 에르다 조각 모으기', resourceId: erda.id, target: 150 }
      ],
      completedSubGoals: []
    }
  ];
}

// 이전 버전(캐릭터별 daily/weekly 객체) 데이터를 새 구조로 1회 변환:
// - weekly 값은 캐릭터별 weekly 필드로 유지
// - daily 값은 캐릭터 구분 없이 전역 dailyHunting으로 합산 이전
function normalizeState() {
  if (!state.resources) state.resources = [];
  if (!state.characters) state.characters = [];
  if (!state.goals) state.goals = [];
  if (!state.resourceStock) state.resourceStock = {};
  if (!state.dailyHunting) state.dailyHunting = {};
  if (typeof state.nexonProxyUrl !== 'string') state.nexonProxyUrl = '';

  state.goals.forEach(g => {
    if (!g.subGoals) g.subGoals = [];
    if (!g.completedSubGoals) g.completedSubGoals = [];
  });

  state.resources.forEach(r => {
    if (typeof r.weeklyEnabled !== 'boolean') {
      r.weeklyEnabled = (r.name === '메소');
    }
    if (typeof r.monthlyEnabled !== 'boolean') {
      r.monthlyEnabled = false;
    }
    if (typeof r.unitDivisor !== 'number' || r.unitDivisor <= 0) {
      r.unitDivisor = (r.name === '메소') ? 100000000 : 1;
    }
    if (typeof r.unitLabel !== 'string') {
      r.unitLabel = (r.unitDivisor > 1) ? '억' : '';
    }
    if (typeof state.dailyHunting[r.id] !== 'number') {
      state.dailyHunting[r.id] = 0;
    }
  });

  state.characters.forEach(c => {
    if (!c.weekly) c.weekly = {};
    if (!c.monthly) c.monthly = {};
    if (!c.lastSettled) c.lastSettled = {};
    if (!c.settlementLog) c.settlementLog = { weekly: [], monthly: [] };
    if (!c.settlementLog.weekly) c.settlementLog.weekly = [];
    if (!c.settlementLog.monthly) c.settlementLog.monthly = [];
    state.resources.forEach(r => {
      const oldProd = c.production && c.production[r.id];
      if (oldProd && typeof oldProd === 'object') {
        if (typeof c.weekly[r.id] !== 'number') {
          c.weekly[r.id] = Number(oldProd.weekly) || 0;
        }
        if (Number(oldProd.daily) > 0) {
          state.dailyHunting[r.id] = (Number(state.dailyHunting[r.id]) || 0) + Number(oldProd.daily);
        }
      } else if (typeof oldProd === 'number' && typeof c.weekly[r.id] !== 'number') {
        c.weekly[r.id] = oldProd;
      }
      if (typeof c.weekly[r.id] !== 'number') c.weekly[r.id] = 0;
      if (typeof c.monthly[r.id] !== 'number') c.monthly[r.id] = 0;
      if (!r.weeklyEnabled) c.weekly[r.id] = 0;
      if (!r.monthlyEnabled) c.monthly[r.id] = 0;
    });
    delete c.production;
  });

  if (!state.lastAppliedDate) {
    state.lastAppliedDate = todayStr();
  }
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}

// 마지막 적용일 이후 지난 날짜만큼 일일 사냥 수급을 보유 재화에 더함
function applyDailyIfNeeded() {
  const today = todayStr();
  if (!state.lastAppliedDate) { state.lastAppliedDate = today; return false; }
  const days = daysBetween(state.lastAppliedDate, today);
  if (days <= 0) return false;
  state.resources.forEach(r => {
    const amt = Number(state.dailyHunting[r.id]) || 0;
    if (amt > 0) {
      state.resourceStock[r.id] = (Number(state.resourceStock[r.id]) || 0) + amt * days;
    }
  });
  state.lastAppliedDate = today;
  return true;
}

function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 기준 시점에서 가장 최근에 지나간(오늘 포함) 목요일 00시의 날짜 문자열
function mostRecentThursdayStr(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=일,1=월,...4=목,...6=토
  const diff = (day - 4 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return dateToStr(d);
}

// 이번 달 1일 00시의 날짜 문자열
function thisMonthStartStr(dateObj) {
  const d = new Date(dateObj);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return dateToStr(d);
}

// 해당 주기의 "현재 정산 구간이 시작된 시점" (주간: 이번 주 목요일, 월간: 이번 달 1일)
function currentSettlePeriodStart(period) {
  const now = new Date();
  return period === 'weekly' ? mostRecentThursdayStr(now) : thisMonthStartStr(now);
}

// 다음 초기화 시점(다음 목요일 00시 / 다음 달 1일 00시)까지 남은 일수
function daysUntilNextReset(period) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let next;
  if (period === 'weekly') {
    next = new Date(mostRecentThursdayStr(now) + 'T00:00:00');
    next.setDate(next.getDate() + 7);
  } else {
    next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return Math.max(0, Math.round((next - now) / 86400000));
}

// 마지막 정산이 이번 정산 구간(이번 주 목요일 이후 / 이번 달 1일 이후) 시작 전이면 다시 정산 가능
function canSettle(character, period) {
  const periodStart = currentSettlePeriodStart(period);
  const last = character.lastSettled && character.lastSettled[period];
  if (!last) return true;
  return last < periodStart;
}

// 캐릭터별 정산 버튼: 클릭 시 해당 주기 재화만큼 보유 재화에 더함. 다음 목요일 00시(주간) / 다음 달 1일 00시(월간)가 지나야 다시 정산 가능
function settleCharacter(charId, period) {
  const c = state.characters.find(c => c.id === charId);
  if (!c) return;
  if (!canSettle(c, period)) return;

  const relevantResources = state.resources.filter(r => period === 'weekly' ? r.weeklyEnabled : r.monthlyEnabled);
  const amounts = {};
  relevantResources.forEach(r => {
    const amt = Number(c[period] && c[period][r.id]) || 0;
    if (amt > 0) {
      state.resourceStock[r.id] = (Number(state.resourceStock[r.id]) || 0) + amt;
      amounts[r.id] = amt;
    }
  });

  if (!c.lastSettled) c.lastSettled = {};
  c.lastSettled[period] = todayStr();

  if (!c.settlementLog) c.settlementLog = { weekly: [], monthly: [] };
  if (!c.settlementLog[period]) c.settlementLog[period] = [];
  c.settlementLog[period].push({ id: uid(), date: todayStr(), amounts });

  persist(); renderAll();
}

function toggleSettlementLog(charId, period) {
  const key = `${charId}-${period}`;
  expandedSettlementLog[key] = !expandedSettlementLog[key];
  renderBossCharacters();
}

function deleteSettlementLogEntry(charId, period, entryId) {
  const c = state.characters.find(c => c.id === charId);
  if (!c || !c.settlementLog || !c.settlementLog[period]) return;
  c.settlementLog[period] = c.settlementLog[period].filter(e => e.id !== entryId);
  persist(); renderBossCharacters();
}

async function persist() {
  const saveEl = document.getElementById('saveState');
  const json = JSON.stringify(state);

  if (storageMode === 'cloud') {
    try {
      await window.storage.set('gt-state', json, false);
      saveEl.textContent = '자동 저장됨 · ' + new Date().toLocaleTimeString('ko-KR');
      return;
    } catch (e) {
      // 클라우드 저장 실패 시 localStorage로 전환
      storageMode = 'local';
    }
  }

  if (storageMode === 'local') {
    try {
      window.localStorage.setItem(LOCAL_KEY, json);
      saveEl.textContent = '이 브라우저에 저장됨 · ' + new Date().toLocaleTimeString('ko-KR');
      return;
    } catch (e) {
      storageMode = 'none';
    }
  }

  saveEl.textContent = '이 환경에서는 저장이 지원되지 않아요 (새로고침 시 초기화됨)';
}

function totalDailyRate(resourceId) {
  const fromWeekly = state.characters.reduce((sum, c) => {
    const w = Number(c.weekly && c.weekly[resourceId]) || 0;
    return sum + w / 7;
  }, 0);
  const fromMonthly = state.characters.reduce((sum, c) => {
    const m = Number(c.monthly && c.monthly[resourceId]) || 0;
    return sum + m / 30;
  }, 0);
  const fromDaily = Number(state.dailyHunting && state.dailyHunting[resourceId]) || 0;
  return fromWeekly + fromMonthly + fromDaily;
}

function stockOf(resourceId) {
  if (!state.resourceStock) state.resourceStock = {};
  return Number(state.resourceStock[resourceId]) || 0;
}

