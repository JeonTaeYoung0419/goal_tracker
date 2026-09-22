/* 수급 & 목표 트래커 - 기능별 분리 파일 */
/* ---------------- RENDER ---------------- */

function renderAll() {
  renderResources();
  renderGoals();
  renderBossCharacters();
  renderBossExtra();
  renderDailyHunting();
  renderSettlement();
}

function renderResources() {
  const list = document.getElementById('resList');
  if (state.resources.length === 0) {
    list.innerHTML = '<div class="empty">등록된 재화가 없습니다.<br>아래에서 재화를 추가하세요.</div>';
    return;
  }
  list.innerHTML = state.resources.map((r, i) => {
    const div = unitDivisorFor(r);
    const displayVal = toDisplayValue(stockOf(r.id), r);
    return `
    <div class="res-row-wrap">
      <div class="res-row">
        <div class="res-dot" style="background:${colorFor(i)}"></div>
        <div class="res-name">${escapeHtml(r.name)}${div > 1 ? ` <span style="color:var(--text-faint);font-size:11px;">(단위: ${escapeHtml(unitLabelFor(r))})</span>` : ''}</div>
        <input type="number" min="0" step="${div > 1 ? '0.01' : '1'}" value="${displayVal}"
          onchange="updateStock('${r.id}', this.value)">
        <button class="btn-icon res-del" onclick="deleteResource('${r.id}')" title="재화 삭제">✕</button>
      </div>
      <label class="res-weekly-toggle">
        <input type="checkbox" ${r.weeklyEnabled ? 'checked' : ''} onchange="toggleWeeklyEnabled('${r.id}', this.checked)">
        캐릭터의 주간 수익(보스)으로도 기록 가능
      </label>
      <label class="res-weekly-toggle">
        <input type="checkbox" ${r.monthlyEnabled ? 'checked' : ''} onchange="toggleMonthlyEnabled('${r.id}', this.checked)">
        캐릭터의 월간 수익(보스)으로도 기록 가능
      </label>
    </div>
  `;
  }).join('');
}

function renderGoals() {
  const list = document.getElementById('goalsList');
  if (state.goals.length === 0) {
    list.innerHTML = '<div class="empty">아직 등록된 목표가 없습니다.<br>메인 목표를 추가해 세부 목표를 관리해보세요.</div>';
    return;
  }

  // 재화별 잔여 보유량: 목표 순서(위→아래) 그대로 먼저 소모된다고 가정하고 시뮬레이션
  const remainingStock = {};
  state.resources.forEach(r => { remainingStock[r.id] = stockOf(r.id); });

  list.innerHTML = state.goals.map((goal, goalIndex) => {
    let pctSum = 0;
    let cumulativeDays = 0;
    let cumulativeBroken = false; // 이전 단계 중 예측 불가(수급 0)인 항목이 있으면 이후 전부 예측 불가

    const subRows = goal.subGoals.map((sg, sgIndex) => {
      const resIndex = state.resources.findIndex(r => r.id === sg.resourceId);
      const res = state.resources[resIndex];
      const color = resIndex >= 0 ? colorFor(resIndex) : '#5C6B80';

      let current = 0;
      if (res) {
        const remaining = remainingStock[sg.resourceId] !== undefined ? remainingStock[sg.resourceId] : 0;
        current = Math.min(remaining, sg.target);
        remainingStock[sg.resourceId] = remaining - current;
      }

      const pct = sg.target > 0 ? Math.min(100, (current / sg.target) * 100) : 0;
      pctSum += pct;
      const rate = res ? totalDailyRate(sg.resourceId) : 0;

      let etaText;
      if (current >= sg.target) {
        etaText = '목표 달성 완료';
      } else if (cumulativeBroken) {
        etaText = '이전 세부 목표 중 수급 없는 항목이 있어 예측 불가';
      } else if (rate <= 0) {
        cumulativeBroken = true;
        etaText = '현재 수급 없음 · 이후 목표 예측 불가';
      } else {
        cumulativeDays += (sg.target - current) / rate;
        etaText = sgIndex === 0
          ? `약 ${Math.ceil(cumulativeDays)}일 후 도달`
          : `이 목표까지 누적 약 ${Math.ceil(cumulativeDays)}일 소요 예상`;
      }

      const resName = res ? res.name : '(삭제된 재화)';
      const div = unitDivisorFor(res);
      const targetDisplay = toDisplayValue(sg.target, res);

      return `
        <div class="subgoal">
          <div class="subgoal-row">
            <span class="title">
              <span class="sg-order-btns">
                <button ${sgIndex === 0 ? 'disabled' : ''} onclick="moveSubGoal('${goal.id}','${sg.id}', -1)" title="위로 이동">▲</button>
                <button ${sgIndex === goal.subGoals.length - 1 ? 'disabled' : ''} onclick="moveSubGoal('${goal.id}','${sg.id}', 1)" title="아래로 이동">▼</button>
              </span>
              <input type="text" class="sg-title-input" value="${escapeHtml(sg.title)}"
                onchange="updateSubGoalTitle('${goal.id}','${sg.id}', this.value)">
              <span style="color:var(--text-faint); flex-shrink:0;">· ${escapeHtml(resName)}</span>
            </span>
            <span class="nums">${fmtUnit(current, res)} /
              <input type="number" min="0" step="${div > 1 ? '0.01' : '1'}" class="sg-target-input" value="${targetDisplay}"
                onchange="updateSubGoalTarget('${goal.id}','${sg.id}', this.value)">
              <button class="sg-complete-btn" onclick="completeSubGoal('${goal.id}','${sg.id}')" title="세부 목표 달성 처리">달성</button>
              <button class="btn-icon subgoal-del" onclick="deleteSubGoal('${goal.id}','${sg.id}')" title="세부 목표 삭제">✕</button>
            </span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${color}"></div></div>
          <div class="eta">${etaText}</div>
        </div>
      `;
    }).join('') || '<div class="empty" style="padding:16px;">세부 목표가 없습니다. 아래에서 추가하세요.</div>';

    const completedList = goal.completedSubGoals || [];
    const totalCount = goal.subGoals.length + completedList.length;
    const overallPct = totalCount ? Math.round((pctSum + completedList.length * 100) / totalCount) : 0;

    const isExpanded = !!expandedCompleted[goal.id];
    const completedSection = completedList.length ? `
      <button class="btn-ghost completed-toggle" onclick="toggleCompletedView('${goal.id}')">
        완료된 세부 목표 (${completedList.length}) ${isExpanded ? '숨기기 ▲' : '보기 ▼'}
      </button>
      ${isExpanded ? `
        <div class="completed-list">
          ${completedList.map(sg => {
            const res = state.resources.find(r => r.id === sg.resourceId);
            const resName = res ? res.name : '(삭제된 재화)';
            return `
              <div class="completed-item">
                <span><span class="ci-check">✓</span><span class="ci-title">${escapeHtml(sg.title)} · ${fmtUnit(sg.target, res)} ${escapeHtml(resName)}</span></span>
                <span class="ci-actions">
                  <button class="sg-restore-btn" onclick="restoreSubGoal('${goal.id}','${sg.id}')" title="달성 취소 (재화 원복)">취소</button>
                  <button class="btn-icon" onclick="deleteCompletedSubGoal('${goal.id}','${sg.id}')" title="기록 완전 삭제">✕</button>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    ` : '';

    const resOptions = state.resources.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');

    return `
      <div class="goal-card">
        <div class="goal-head">
          <span class="name">
            <span class="goal-order-btns">
              <button ${goalIndex === 0 ? 'disabled' : ''} onclick="moveGoal('${goal.id}', -1)" title="위로 이동">▲</button>
              <button ${goalIndex === state.goals.length - 1 ? 'disabled' : ''} onclick="moveGoal('${goal.id}', 1)" title="아래로 이동">▼</button>
            </span>
            ${escapeHtml(goal.title)}
            <button class="btn-icon" onclick="deleteGoal('${goal.id}')" title="목표 삭제" style="font-size:13px;">✕</button>
          </span>
          <span class="pct">${overallPct}%</span>
        </div>
        ${subRows}
        ${completedSection}
        <div class="subgoal-form">
          <input type="text" placeholder="세부 목표 이름" id="sgTitle-${goal.id}">
          <select id="sgRes-${goal.id}">${resOptions || '<option value="">재화 없음</option>'}</select>
          <input type="number" min="0" placeholder="목표 수량" id="sgTarget-${goal.id}">
          <button class="btn-ghost" onclick="addSubGoal('${goal.id}')">추가</button>
        </div>
      </div>
    `;
  }).join('');
}

let currentBossTab = 'weekly'; // 'weekly' | 'monthly'

function switchBossTab(tab) {
  currentBossTab = tab;
  document.getElementById('bossTabBtn-weekly').classList.toggle('active', tab === 'weekly');
  document.getElementById('bossTabBtn-monthly').classList.toggle('active', tab === 'monthly');
  renderBossCharacters();
  renderBossExtra();
}

function renderBossCharacters() {
  const grid = document.getElementById('bossGrid');
  const sub = document.getElementById('bossTabSub');
  const isWeekly = currentBossTab === 'weekly';
  const field = isWeekly ? 'weekly' : 'monthly';
  const fieldLabel = isWeekly ? '보스 (주간)' : '보스 (월간)';

  sub.textContent = isWeekly
    ? '보스로 얻는 주간 수익을 캐릭터별로 기록합니다. "보유 재화"에서 주간 수익을 체크한 재화만 표시됩니다.'
    : '보스로 얻는 월간 수익을 캐릭터별로 기록합니다. "보유 재화"에서 월간 수익을 체크한 재화만 표시됩니다.';

  const relevantResources = state.resources.filter(r => isWeekly ? r.weeklyEnabled : r.monthlyEnabled);

  const cards = state.characters.map(c => {
    let prodRows;
    if (relevantResources.length === 0) {
      prodRows = `<div style="font-size:12px;color:var(--text-faint)">${isWeekly ? '주간' : '월간'} 수익으로 기록할 재화가 없습니다. "보유 재화"에서 체크박스를 켜주세요.</div>`;
    } else {
      prodRows = relevantResources.map(r => {
        const globalIndex = state.resources.findIndex(res => res.id === r.id);
        const div = unitDivisorFor(r);
        const val = toDisplayValue(Number(c[field] && c[field][r.id]) || 0, r);
        return `
        <div class="prod-block">
          <div class="prod-block-head">
            <div class="res-dot" style="background:${colorFor(globalIndex)}"></div>
            <span>${escapeHtml(r.name)}${div > 1 ? ` (${escapeHtml(unitLabelFor(r))})` : ''}</span>
          </div>
          <div class="prod-inputs single">
            <div class="prod-input">
              <label>${fieldLabel}</label>
              <input type="number" min="0" step="${div > 1 ? '0.01' : '1'}" value="${val}"
                onchange="updateCharPeriodIncome('${c.id}','${r.id}','${field}', this.value)">
            </div>
          </div>
        </div>
      `;
      }).join('');
    }

    const canSettleNow = canSettle(c, field);
    const lastDate = c.lastSettled && c.lastSettled[field];
    let settleStatusText;
    if (relevantResources.length === 0) {
      settleStatusText = '';
    } else if (canSettleNow) {
      settleStatusText = lastDate ? `마지막 정산: ${lastDate}` : '아직 정산한 적 없음';
    } else {
      const daysLeft = daysUntilNextReset(field);
      const nextLabel = field === 'weekly' ? '다음 목요일 00시' : '다음 달 1일 00시';
      settleStatusText = `${nextLabel} 초기화까지 ${daysLeft}일 (마지막: ${lastDate})`;
    }

    const log = (c.settlementLog && c.settlementLog[field]) || [];
    const logKey = `${c.id}-${field}`;
    const isLogExpanded = !!expandedSettlementLog[logKey];
    const logSection = log.length > 0 ? `
      <button class="btn-ghost completed-toggle" onclick="toggleSettlementLog('${c.id}','${field}')">
        정산 기록 (${log.length}) ${isLogExpanded ? '숨기기 ▲' : '보기 ▼'}
      </button>
      ${isLogExpanded ? `
        <div class="completed-list">
          ${[...log].reverse().map(entry => {
            const parts = Object.keys(entry.amounts).map(resId => {
              const res = state.resources.find(r => r.id === resId);
              const resName = res ? res.name : '(삭제된 재화)';
              return `${fmtUnit(entry.amounts[resId], res)} ${escapeHtml(resName)}`;
            }).join(', ') || '획득량 없음';
            return `
              <div class="completed-item">
                <span class="ci-title">${entry.date} · ${parts}</span>
                <button class="btn-icon" onclick="deleteSettlementLogEntry('${c.id}','${field}','${entry.id}')" title="기록 삭제">✕</button>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    ` : '';

    return `
      <div class="char-card">
        ${c.nexonInfo && c.nexonInfo.image ? `
          <div class="char-thumb-wrap">
            <img src="${c.nexonInfo.image}" alt="${escapeHtml(c.name)}" class="char-thumb" onerror="this.parentElement.style.display='none'">
          </div>
        ` : ''}
        <div class="char-card-head">
          <input type="text" value="${escapeHtml(c.name)}" onchange="renameCharacter('${c.id}', this.value)">
          ${c.nexonInfo ? `<span class="char-level-badge">Lv.${c.nexonInfo.level || '?'}</span>` : ''}
          <button class="btn-icon" onclick="deleteCharacter('${c.id}')" title="캐릭터 삭제">✕</button>
        </div>

    ${prodRows}


        ${prodRows}
        ${relevantResources.length > 0 ? `
          <div class="settle-btn-row">
            <button class="sg-complete-btn settle-btn" ${canSettleNow ? '' : 'disabled'} onclick="settleCharacter('${c.id}','${field}')">
              ${isWeekly ? '주간 정산' : '월간 정산'}
            </button>
            <span class="settle-status">${settleStatusText}</span>
          </div>
          ${logSection}
        ` : ''}
      </div>
    `;
  }).join('');

  grid.innerHTML = cards + `<button class="add-char-btn" onclick="addCharacter()">+ 캐릭터 추가</button>`;
}

function renderBossExtra() {
  const box = document.getElementById('bossExtra');
  const isWeekly = currentBossTab === 'weekly';
  const relevantResources = state.resources.filter(r => isWeekly ? r.weeklyEnabled : r.monthlyEnabled);

  if (relevantResources.length === 0) {
    box.innerHTML = '';
    return;
  }

  const title = isWeekly
    ? '이번 주에만 추가로 얻은 재화 (캐릭터 구분 없이 보유량에 바로 더해집니다)'
    : '이번 달에만 추가로 얻은 재화 (캐릭터 구분 없이 보유량에 바로 더해집니다)';

  box.innerHTML = `
    <div class="weekly-extra">
      <div class="weekly-extra-title">${title}</div>
      ${relevantResources.map(r => {
        const globalIndex = state.resources.findIndex(res => res.id === r.id);
        const div = unitDivisorFor(r);
        return `
          <div class="weekly-extra-row">
            <div class="res-dot" style="background:${colorFor(globalIndex)}"></div>
            <div class="res-name">${escapeHtml(r.name)}${div > 1 ? ` (${escapeHtml(unitLabelFor(r))})` : ''}</div>
            <input type="number" min="0" step="${div > 1 ? '0.01' : '1'}" id="extraInput-${r.id}" placeholder="추가량">
            <button class="btn-ghost" onclick="addExtraIncome('${r.id}')">추가</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function addExtraIncome(resourceId) {
  const input = document.getElementById(`extraInput-${resourceId}`);
  if (!input) return;
  const r = state.resources.find(r => r.id === resourceId);
  const raw = toRawValue(input.value, r);
  if (!raw || raw <= 0) return;

  const cur = Number(state.resourceStock[resourceId]) || 0;
  state.resourceStock[resourceId] = cur + raw;

  persist(); renderAll();
}

function renderDailyHunting() {
  const list = document.getElementById('dailyList');
  const meta = document.getElementById('dailyMetaText');

  if (state.resources.length === 0) {
    list.innerHTML = '<div class="empty">등록된 재화가 없습니다.</div>';
  } else {
    list.innerHTML = state.resources.map((r, i) => {
      const div = unitDivisorFor(r);
      const val = toDisplayValue(Number(state.dailyHunting[r.id]) || 0, r);
      return `
      <div class="daily-row">
        <div class="res-dot" style="background:${colorFor(i)}"></div>
        <div class="res-name">${escapeHtml(r.name)}${div > 1 ? ` <span style="color:var(--text-faint);font-size:11px;">(${escapeHtml(unitLabelFor(r))})</span>` : ''}</div>
        <input type="number" min="0" step="${div > 1 ? '0.01' : '1'}" value="${val}"
          onchange="updateDailyHunting('${r.id}', this.value)">
      </div>
    `;
    }).join('');
  }

  meta.textContent = `마지막 적용일: ${state.lastAppliedDate || '-'} · 다음 00시부터 자동 적용됩니다.`;
}

/* ---------------- ACTIONS ---------------- */

function addResource() {
  const input = document.getElementById('newResName');
  const name = input.value.trim();
  if (!name) return;
  const r = { id: uid(), name, weeklyEnabled: false, monthlyEnabled: false, unitDivisor: 1, unitLabel: '' };
  state.resources.push(r);
  if (!state.resourceStock) state.resourceStock = {};
  if (!state.dailyHunting) state.dailyHunting = {};
  state.resourceStock[r.id] = 0;
  state.dailyHunting[r.id] = 0;
  state.characters.forEach(c => {
    if (!c.weekly) c.weekly = {};
    if (!c.monthly) c.monthly = {};
    c.weekly[r.id] = 0;
    c.monthly[r.id] = 0;
  });
  input.value = '';
  persist(); renderAll();
}

function deleteResource(id) {
  state.resources = state.resources.filter(r => r.id !== id);
  delete state.resourceStock[id];
  delete state.dailyHunting[id];
  state.characters.forEach(c => {
    delete c.weekly[id];
    if (c.monthly) delete c.monthly[id];
  });
  state.goals.forEach(g => { g.subGoals = g.subGoals.filter(sg => sg.resourceId !== id); });
  persist(); renderAll();
}

function updateStock(resourceId, value) {
  if (!state.resourceStock) state.resourceStock = {};
  const r = state.resources.find(r => r.id === resourceId);
  const raw = toRawValue(value, r);
  state.resourceStock[resourceId] = Math.max(0, raw);
  persist(); renderAll();
}

function toggleWeeklyEnabled(resourceId, checked) {
  const r = state.resources.find(r => r.id === resourceId);
  if (!r) return;
  r.weeklyEnabled = checked;
  if (!checked) {
    // 주간 수익에서 제외되면 기존에 입력된 주간 값은 0으로 정리
    state.characters.forEach(c => {
      if (c.weekly && typeof c.weekly[resourceId] === 'number') c.weekly[resourceId] = 0;
    });
  }
  persist(); renderAll();
}

function toggleMonthlyEnabled(resourceId, checked) {
  const r = state.resources.find(r => r.id === resourceId);
  if (!r) return;
  r.monthlyEnabled = checked;
  if (!checked) {
    // 월간 수익에서 제외되면 기존에 입력된 월간 값은 0으로 정리
    state.characters.forEach(c => {
      if (c.monthly && typeof c.monthly[resourceId] === 'number') c.monthly[resourceId] = 0;
    });
  }
  persist(); renderAll();
}

function addCharacter() {
  const weekly = {};
  const monthly = {};
  state.resources.forEach(r => { weekly[r.id] = 0; monthly[r.id] = 0; });
  state.characters.push({
    id: uid(),
    name: `캐릭터 ${state.characters.length + 1}`,
    weekly,
    monthly,
    lastSettled: {},
    settlementLog: { weekly: [], monthly: [] }
  });
  persist(); renderBossCharacters();
}

function deleteCharacter(id) {
  state.characters = state.characters.filter(c => c.id !== id);
  persist(); renderBossCharacters(); renderGoals();
}

function renameCharacter(id, name) {
  const c = state.characters.find(c => c.id === id);
  if (c) c.name = name.trim() || c.name;
  persist();
}

function updateCharPeriodIncome(charId, resourceId, field, value) {
  const c = state.characters.find(c => c.id === charId);
  if (!c) return;
  if (!c[field]) c[field] = {};
  const r = state.resources.find(r => r.id === resourceId);
  const raw = toRawValue(value, r);
  c[field][resourceId] = Math.max(0, raw);
  persist(); renderGoals();
}

function updateDailyHunting(resourceId, value) {
  if (!state.dailyHunting) state.dailyHunting = {};
  const r = state.resources.find(r => r.id === resourceId);
  const raw = toRawValue(value, r);
  state.dailyHunting[resourceId] = Math.max(0, raw);
  persist(); renderGoals();
}

function applyDailyNow() {
  const applied = applyDailyIfNeeded();
  persist();
  renderAll();
  const meta = document.getElementById('dailyMetaText');
  if (!applied) {
    meta.textContent = '오늘 분은 이미 적용되어 있어요.';
  }
}

function renderSettlement() {
  const grid = document.getElementById('settleGrid');
  if (!grid) return;
  if (state.resources.length === 0) {
    grid.innerHTML = '<div class="empty">등록된 재화가 없습니다.</div>';
    return;
  }

  grid.innerHTML = state.resources.map((r, i) => {
    const dailyHuntingAmt = Number(state.dailyHunting[r.id]) || 0;
    const weeklySum = state.characters.reduce((sum, c) => sum + (Number(c.weekly && c.weekly[r.id]) || 0), 0);
    const monthlySum = state.characters.reduce((sum, c) => sum + (Number(c.monthly && c.monthly[r.id]) || 0), 0);
    const totalDaily = totalDailyRate(r.id);

    return `
      <div class="settle-card">
        <div class="settle-head">
          <div class="res-dot" style="background:${colorFor(i)}"></div>
          <span>${escapeHtml(r.name)}</span>
        </div>
        <div class="settle-row"><span>일일 사냥</span><span>${fmtUnit(dailyHuntingAmt, r)} / 일</span></div>
        <div class="settle-row"><span>주간 보스 합계</span><span>${fmtUnit(weeklySum, r)} / 주</span></div>
        <div class="settle-row"><span>월간 보스 합계</span><span>${fmtUnit(monthlySum, r)} / 월</span></div>
        <div class="settle-divider"></div>
        <div class="settle-row total"><span>일 환산 총합</span><span>${fmtUnit(totalDaily, r)} / 일</span></div>
        <div class="settle-row total"><span>주 환산 총합</span><span>${fmtUnit(totalDaily * 7, r)} / 주</span></div>
        <div class="settle-row total"><span>월 환산 총합</span><span>${fmtUnit(totalDaily * 30, r)} / 월</span></div>
      </div>
    `;
  }).join('');
}

