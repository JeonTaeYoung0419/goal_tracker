/* 수급 & 목표 트래커 - 기능별 분리 파일 */
function addGoal() {
  const input = document.getElementById('newGoalTitle');
  const title = input.value.trim();
  if (!title) return;
  state.goals.push({ id: uid(), title, subGoals: [] });
  input.value = '';
  persist(); renderGoals();
}

function deleteGoal(id) {
  state.goals = state.goals.filter(g => g.id !== id);
  persist(); renderGoals();
}

function moveGoal(id, direction) {
  const idx = state.goals.findIndex(g => g.id === id);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= state.goals.length) return;
  const tmp = state.goals[idx];
  state.goals[idx] = state.goals[newIdx];
  state.goals[newIdx] = tmp;
  persist(); renderGoals();
}

function moveSubGoal(goalId, subGoalId, direction) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  const idx = goal.subGoals.findIndex(sg => sg.id === subGoalId);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= goal.subGoals.length) return;
  const tmp = goal.subGoals[idx];
  goal.subGoals[idx] = goal.subGoals[newIdx];
  goal.subGoals[newIdx] = tmp;
  persist(); renderGoals();
}

function addSubGoal(goalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  const title = document.getElementById(`sgTitle-${goalId}`).value.trim();
  const resourceId = document.getElementById(`sgRes-${goalId}`).value;
  const rawInput = document.getElementById(`sgTarget-${goalId}`).value;
  const res = state.resources.find(r => r.id === resourceId);
  const target = toRawValue(rawInput, res);
  if (!title || !resourceId || !target || target <= 0) return;
  goal.subGoals.push({ id: uid(), title, resourceId, target });
  persist(); renderGoals();
}

function updateSubGoalTitle(goalId, subGoalId, value) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  const sg = goal.subGoals.find(s => s.id === subGoalId);
  if (!sg) return;
  sg.title = value.trim() || sg.title;
  persist(); renderGoals();
}

function updateSubGoalTarget(goalId, subGoalId, value) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  const sg = goal.subGoals.find(s => s.id === subGoalId);
  if (!sg) return;
  const res = state.resources.find(r => r.id === sg.resourceId);
  const raw = toRawValue(value, res);
  sg.target = raw > 0 ? raw : sg.target;
  persist(); renderGoals();
}

function deleteSubGoal(goalId, subGoalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  goal.subGoals = goal.subGoals.filter(sg => sg.id !== subGoalId);
  persist(); renderGoals();
}

function completeSubGoal(goalId, subGoalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  const idx = goal.subGoals.findIndex(sg => sg.id === subGoalId);
  if (idx === -1) return;
  const [sg] = goal.subGoals.splice(idx, 1);
  sg._originalIndex = idx; // 취소 시 원래 위치로 복원하기 위해 기억해둠

  const cur = Number(state.resourceStock[sg.resourceId]) || 0;
  state.resourceStock[sg.resourceId] = Math.max(0, cur - sg.target);

  if (!goal.completedSubGoals) goal.completedSubGoals = [];
  goal.completedSubGoals.push(sg);

  persist(); renderAll();
}

function toggleCompletedView(goalId) {
  expandedCompleted[goalId] = !expandedCompleted[goalId];
  renderGoals();
}

function restoreSubGoal(goalId, subGoalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal || !goal.completedSubGoals) return;
  const idx = goal.completedSubGoals.findIndex(sg => sg.id === subGoalId);
  if (idx === -1) return;
  const [sg] = goal.completedSubGoals.splice(idx, 1);

  const cur = Number(state.resourceStock[sg.resourceId]) || 0;
  state.resourceStock[sg.resourceId] = cur + sg.target;

  if (!goal.subGoals) goal.subGoals = [];
  const insertAt = Math.min(
    typeof sg._originalIndex === 'number' ? sg._originalIndex : goal.subGoals.length,
    goal.subGoals.length
  );
  delete sg._originalIndex;
  goal.subGoals.splice(insertAt, 0, sg);

  persist(); renderAll();
}

function deleteCompletedSubGoal(goalId, subGoalId) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal || !goal.completedSubGoals) return;
  goal.completedSubGoals = goal.completedSubGoals.filter(sg => sg.id !== subGoalId);
  persist(); renderGoals();
}

/* ---------------- UTIL ---------------- */

function fmt(n) { return Math.round(n).toLocaleString('ko-KR'); }

function unitDivisorFor(resource) {
  return (resource && typeof resource.unitDivisor === 'number' && resource.unitDivisor > 0) ? resource.unitDivisor : 1;
}
function unitLabelFor(resource) {
  return (resource && resource.unitLabel) ? resource.unitLabel : '';
}
// 저장된 원시 값(raw) -> 화면에 보여줄 단위 값 (예: 1,250,000,000 -> 12.5)
function toDisplayValue(raw, resource) {
  const div = unitDivisorFor(resource);
  const v = (Number(raw) || 0) / div;
  return Math.round(v * 100) / 100;
}
// 사용자가 입력한 단위 값 -> 저장할 원시 값 (예: 12.5 -> 1,250,000,000)
function toRawValue(displayValue, resource) {
  const div = unitDivisorFor(resource);
  return Math.round((Number(displayValue) || 0) * div);
}
// 원시 값을 재화의 단위에 맞춰 사람이 읽기 좋은 문자열로 변환 (예: "12.5억", 단위가 없으면 "1,234")
function fmtUnit(raw, resource) {
  const div = unitDivisorFor(resource);
  if (div <= 1) return fmt(raw);
  const v = toDisplayValue(raw, resource);
  return `${v.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${unitLabelFor(resource)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

