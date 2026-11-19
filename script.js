try { localStorage.getItem('_t') } catch (e) { const m = {}; Object.defineProperty(window, 'localStorage', { value: { getItem: k => k in m ? m[k] : null, setItem: (k, v) => { m[k] = String(v) }, removeItem: k => { delete m[k] } } }) }
'use strict';
const PROD_KEY = 'nogifes_visual_v1', TEST_KEY = 'nogifes_date_test_v1', FLAG_KEY = 'nogifes_test_mode_enabled';
let testMode = false;
let KEY = PROD_KEY;
const ITEM_CAP = 99999, ITEM_COST = 875;
const SONGS = [['最後のTightHug', 212, 81], ['サヨナラの意味 向井葉月セレモニー', 213, 81], ['三番目の風', 214, 81], ['渋谷ブルース', 200, 75]];
const TABLE = { 81: [930, 898, 868, 836, 806, 774], 75: [858, 828, 800, 772, 744, 714] };
const TYPES = ['仕事/学校', '授業・勉強', '食事・休憩', 'その他'];
const escapeAttr = v => String(v ?? '').replace(/[&"'<>]/g, c => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }[c]));
const defaults = () => ({ initialized: false, start: '', days: 10, mode: 'both', song: -1, eventSeconds: 0, bonus: null, network: 26, day: 0, daysData: {}, history: [], bonusChanges: [] });
let s; try { s = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { s = defaults() }
const APP_VERSION = '2026.11.19.71';
// Restore isolated test mode after page reload.
try { testMode = localStorage.getItem(FLAG_KEY) === '1'; if (testMode) { KEY = TEST_KEY; s = { ...defaults(), ...JSON.parse(localStorage.getItem(TEST_KEY) || '{}') }; } } catch(e) { testMode = false; KEY = PROD_KEY; }
let simulationCache = null;
let freshPreview = null; // 保存しない再計算結果。ページを再読込すると解除
let previewActive = false;
const comparisonKey = () => KEY + '_recalculated_comparison_v64';
function saveComparison() {
  if (!freshPreview?.valid || freshPreview.days?.length !== s.days) {
    alert('全日程の再計算が完了していません。'); return;
  }
  try {
    localStorage.setItem(comparisonKey(), JSON.stringify({
      createdAt: new Date().toISOString(),
      start: s.start, days: s.days, mode: s.mode,
      result: freshPreview
    }));
    alert('再計算結果を比較用として別保存しました。元の確定データは変更していません。');
    render();
  } catch (e) {
    alert('比較結果を保存できませんでした（容量不足など）：' + (e?.message || e));
  }
}
function loadComparison() {
  try {
    const raw = localStorage.getItem(comparisonKey());
    if (!raw) { alert('別保存された再計算結果はありません。'); return; }
    const data = JSON.parse(raw);
    if (data.start !== s.start || data.days !== s.days || data.mode !== s.mode ||
        !data.result?.valid || data.result.days?.length !== s.days) {
      alert('保存した比較結果は現在のイベント設定と一致しません。'); return;
    }
    freshPreview = data.result;
    previewActive = true;
    page = 'result';
    render();
  } catch (e) { alert('比較結果を読み込めませんでした：' + (e?.message || e)); }
}

const $ = id => document.getElementById(id), save = () => { simulationCache = null; s.savedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(s)) } catch (e) { } cloudDirty() };
const localDayString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const currentDay = () => testMode && s.testClock ? new Date(s.testClock + 'T12:00:00') : new Date();
// 計測時は仮確定。日付変更後にだけ本確定する。
const freezeThrough = (index) => {
  if (!s.initialized || !s.start || index < 0) return;
  if (!s.snapshots) s.snapshots = {};
  let changed = false;
  for (let i = 0; i <= Math.min(index, s.days - 1); i++) {
    const snap = s.snapshots[i];
    if (snap && !snap.finalized) {
      snap.finalized = true;
      snap.confirmed = true;
      snap.frozenAt = localDayString(currentDay());
      changed = true;
    }
  }
  if (changed) save();
};
const rollover = () => {
  if (!s.initialized || !s.start) return;
  const now = localDayString(currentDay());
  // 起動中・再起動後のどちらでも、過去日の仮確定を本確定する。
  const past = Math.min(todayIndex() - 1, s.days - 1);
  if (past >= 0) freezeThrough(past);
  if (!s.lastSeenDate || now !== s.lastSeenDate) {
    s.lastSeenDate = now;
    if (todayIndex() >= 0 && todayIndex() < s.days) {
      const n = todayIndex();
      if (n > 0 && !s.todayOnlyMigrated?.[n] && !s.snapshots?.[n]?.finalized) {
        const prior = s.snapshots?.[n - 1]?.settings || s.daysData[n - 1] || s.daysData[0];
        if (prior) {
          const next = JSON.parse(JSON.stringify(prior));
          next.confirmed = false; next.lossMinutes = 0; next.tabDone = {accuracy:false,sleep:false,bg:false,loss:false};
          (next.activities || []).forEach(a => a.confirmed = false);
          s.daysData[n] = next;
          if (!s.todayOnlyMigrated) s.todayOnlyMigrated = {};
          s.todayOnlyMigrated[n] = true;
        }
      }
      s.day = n;
    }
    save();
  }
};
const confirmMeasuredDay = (index, result) => {
  if (!s.snapshots) s.snapshots = {};
  if (index !== todayIndex()) throw Error('当日のみ計測できます');
  const record = result.days[index];
  if (!record || record.errors.length) throw Error('計算結果を仮確定できません');
  s.snapshots[index] = { ...record, algo: ALGO_VER, confirmed: true, finalized: false,
    settings: JSON.parse(JSON.stringify(predictionData(index))), measuredAt: new Date().toISOString() };
  dayData(index).confirmed = true;
  save();
};
// 設定を変えたら、当日の仮確定だけを破棄して再計測可能にする。
const invalidateProvisional = () => {
  if (s.snapshots?.[s.day] && !s.snapshots[s.day].finalized && s.day === todayIndex()) {
    delete s.snapshots[s.day];
  }
};
const switchMode = (on) => {
  if (on === testMode) return;
  if (on && !localStorage.getItem(TEST_KEY)) {
    const copy = JSON.parse(localStorage.getItem(PROD_KEY) || JSON.stringify(defaults()));
    copy.testClock = copy.start || localDayString(new Date()); copy.snapshots = {}; copy.lastSeenDate = copy.testClock;
    localStorage.setItem(TEST_KEY, JSON.stringify(copy));
  }
  testMode = on; KEY = on ? TEST_KEY : PROD_KEY; localStorage.setItem(FLAG_KEY, on ? '1' : '0');
  s = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  page = s.initialized ? 'settings' : 'setup'; render();
};
const jp = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const dateAt = (i) => { const [y, m, d] = (s.start || '2026-11-13').split('-').map(Number); return new Date(y, m - 1, d + i) };
const todayIndex = () => { if (!s.start) return 0; const d = currentDay(), t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return Math.floor((t - dateAt(0)) / 86400000) };
const newActivity = (name = '仕事/学校') => ({ name, mode: 'normal', duration: '00:00:00', startTime: '09:00', endTime: '10:00', confirmed: false });
const dayData = (i) => {
  if (!s.daysData[i]) s.daysData[i] = { accuracy: [0, 0, 0, 0, 0, 0], wake: '00:00:00', wakeManual: true, bedtime: '00:00', activities: [i === 0 ? {...newActivity(), startTime: '15:00', endTime: '16:00'} : newActivity()], lossMinutes: 0, confirmed: false };
  const d = s.daysData[i]; if (!d.bedtime) d.bedtime = '00:00';
  if (d.wakeManual === undefined) d.wakeManual = false;
  // Migrate unused legacy default rows without discarding configured rows.
  if (Array.isArray(d.activities) && d.activities.length === 4 && d.activities.map(a => a.name).join('|') === '仕事|授業・勉強|食事・休憩|その他') {
    d.activities = d.activities.filter((a, j) => j === 0 || a.confirmed || activityDuration(a) > 0);
    d.activities[0].name = '仕事/学校';
  }
  if (!Array.isArray(d.activities) || !d.activities.length) d.activities = [i === 0 ? {...newActivity(), startTime: '15:00', endTime: '16:00'} : newActivity()];
  if (i === 0 && d.activities.length === 1 && !d.activities[0].confirmed && d.activities[0].name === '仕事/学校' && d.activities[0].startTime === '09:00' && d.activities[0].endTime === '10:00') { d.activities[0].startTime = '15:00'; d.activities[0].endTime = '16:00'; }
  return d;
};
// 時刻指定BG。過去の「実行時間」データは保持し、時刻指定への変更は利用者が行う。
const clockSec = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 3600 + +m[2] * 60 : NaN; };
const hasSlot = a => a.startTime != null && a.endTime != null;
const slotBounds = (a, day, start) => {
  const from = clockSec(a.startTime), to = clockSec(a.endTime);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return null;
  let begin = day * 86400 + from, finish = day * 86400 + to;
  // 00:00～翌朝の指定は日付をまたぐものとして扱う。
  if (finish <= begin) finish += 86400;
  // 前夜のBGが早く終了しても、日中BGの設定時刻を「翌日」に飛ばさない。
  // 実際の起床が予定BG開始より遅い場合は、BGを起床直後に後ろ倒しする。
  // 実際の起床が予定BG開始より早ければ、元の時刻を維持する。
  if (day > 0 && begin < start) {
    const duration = finish - begin;
    begin = start;
    finish = begin + duration;
  }
  return { begin, finish };
};
const validateSlots = (d, day, dayStart, dayEnd) => {
  const slots = [];
  for (const a of d.activities) {
    if (!hasSlot(a)) continue;
    const b = slotBounds(a, day, dayStart);
    if (!b) return `${a.name}：開始時刻と終了時刻を正しく設定してください`;
    if (b.begin < dayStart || b.finish > dayEnd) return `${a.name}：BG時間が活動可能時間の範囲外です`;
    if (a.mode === 'event' && Math.ceil((b.finish-b.begin)/(s.eventSeconds+15)) > 114) return `${a.name}：イベント曲BGは114回までです`;
    slots.push({ ...b, a });
  }
  slots.sort((x,y)=>x.begin-y.begin);
  for (let i=1;i<slots.length;i++) if(slots[i].begin<slots[i-1].finish) return `${slots[i-1].a.name}と${slots[i].a.name}のBG時間が重複しています`;
  return '';
};
const activityDuration = a => hasSlot(a) ? Math.max(0, ((clockSec(a.endTime) - clockSec(a.startTime) + 86400) % 86400)) : sec(a.duration);
let selectedBgDetail = null;
const bgScheduleBar = (d, day) => {
  // Only show the colored block once the individual activity has been confirmed.
  const blocks = d.activities.map((a, index) => {
    if (!a.confirmed || !hasSlot(a)) return null;
    const b = slotBounds(a, day, day * 86400);
    if (!b) return null;
    const start = Math.max(0, b.begin - day * 86400);
    const end = Math.min(86400, b.finish - day * 86400);
    if (end <= start) return null;
    return {start, end, index, mode:a.mode, name:a.name,
      startTime:a.startTime, endTime:a.endTime, duration:b.finish-b.begin,
      color:a.mode==='normal'?'#8b5cf6':'#13a5b6'};
  }).filter(Boolean);
  // v34: 起床・就寝から自動生成する閲覧専用の就寝イベントBG帯。
  // 日付をまたぐ場合は当日側と翌日側に分けて表示する。
  if (day < s.days - 1) {
    const bed = sec(d.bedtime), wake = sec(d.wake);
    const end = wake <= bed ? wake + 86400 : wake;
    for (const [begin, finish] of [[bed, Math.min(end, 86400)]]) {
      if (finish > begin) blocks.push({start:begin, end:finish, index:-1, mode:'event', name:'就寝BG（自動）', startTime:d.bedtime, endTime:d.wake, duration:end-bed, color:'#13a5b6', sleep:true});
    }
  }
  const ticks=[0,6,12,18,24].map(h=>`<span>${String(h).padStart(2,'0')}:00</span>`).join('');
  const active = blocks.find(b => b.index === selectedBgDetail && selectedBgDetailDay === day);
  const details = active ? `<div class="bg-detail" role="region" aria-label="BG設定の詳細">
    <div class="bg-detail-head"><strong>BG設定の詳細</strong><button type="button" data-action="closeBgDetail" aria-label="詳細を閉じる">×</button></div>
    <div><span>項目名</span><strong>${escapeAttr(active.name)}</strong></div>
    <div><span>BGの種類</span><strong>${active.sleep?'就寝中イベント曲BG':active.mode==='normal'?'通常曲BG':'イベント曲BG'}</strong></div>
    <div><span>対象曲</span><strong>${active.mode==='normal'?escapeAttr(SONGS[s.song]?.[0] || '未設定'):'イベント曲'}</strong></div>
    <div><span>設定時間帯</span><strong>${escapeAttr(active.startTime)}〜${escapeAttr(active.endTime)}</strong></div>
    <div><span>設定BG時間</span><strong>${fmt(active.duration)}</strong></div>
    <p>※手打ち曲の完走待ちやBG曲の完走により、実際の開始・終了時刻は変わる場合があります。</p>
  </div>` : '';
  return `<div class="bg-timeline"><div class="bg-ticks">${ticks}</div><div class="bg-track" aria-label="24時間のBGスケジュール">${blocks.map(b=>`<button type="button" class="bg-bar-block" data-action="showBgDetail" data-index="${b.index}" title="${escapeAttr(b.name)}：${escapeAttr(b.startTime)}〜${escapeAttr(b.endTime)}" aria-label="${escapeAttr(b.name)}、${b.mode==='normal'?'通常曲BG':'イベント曲BG'}、${escapeAttr(b.startTime)}から${escapeAttr(b.endTime)}、詳細を表示" style="left:${b.start/864}%;width:${(b.end-b.start)/864}%;background-color:${b.color}!important;opacity:1;display:block"></button>`).join('')}</div><div class="bg-legend"><span>■ 通常曲BG（紫）</span><span>■ イベント曲BG（青）</span><span>■ その他：手打ち</span></div>${details}</div>`;
};
let selectedBgDetailDay = -1;
const activeIndex = () => Math.min(Math.max(todayIndex(), 0), s.days - 1);
const todayEditable = () => todayIndex() >= 0 && todayIndex() < s.days;
// v23: 編集できるのは当日だけ。未来日は当日設定から予測し、保存済みの未来設定は参照しない。
const isFinalDay = i => i === s.days - 1 && i > 0;
const copyDay = source => {
  const copy = JSON.parse(JSON.stringify(source));
  copy.confirmed = false;
  copy.tabDone = { accuracy:false, sleep:false, bg:false, loss:false };
  if (Array.isArray(copy.activities)) copy.activities.forEach(a => a.confirmed = false);
  return copy;
};
// v26: 設定値の継承と日付固有の時間条件を分離する。
// 過去=保存済み、当日=編集可能な実データ、未来=当日設定の読み取り専用コピー。
// 予測時にBGの「決定」状態を消すと全BGが無視されるため保持する。
const predictionData = i => {
  const now = activeIndex();
  if (i < todayIndex()) return s.snapshots?.[i]?.settings || dayData(i);
  if (i === now) {
    if (!s.daysData[i]) s.daysData[i] = copyDay(dayData(0));
    if (!s.todayOnlyMigrated) s.todayOnlyMigrated = {};
    s.todayOnlyMigrated[i] = true;
    if (!s.individualDays) s.individualDays = {};
    s.individualDays[i] = true;
    return dayData(i);
  }
  const base = predictionData(now);
  const predicted = JSON.parse(JSON.stringify(base));
  // ロス時間は日付固有。未来日には当日のロス時間を引き継がない。
  predicted.lossMinutes = 0;
  // BG時間帯・精度は従来どおり未来日予測に使用する。
  // 未来日の編集・保存はしない。
  if (isFinalDay(i)) {
    predicted.wake = '00:00:00';
    predicted.bedtime = '23:59';
  }
  return predicted;
};
// 初日・通常日・最終日の時間枠は、設定のコピーからではなく日付で決める。
const simulationDayWindow = (day, previousSleepEnd, bedtimeSeconds, eventEnd) => {
  const base = day * 86400;
  const start = day === 0 ? 54000 : previousSleepEnd;
  if (day === s.days - 1) return {start, end:eventEnd};
  let end = base + bedtimeSeconds;
  while (end <= start) end += 86400;
  // 日付を跨ぐ就寝でも、1日の日中が24時間以上にならないようにする。
  // 保存済み前日の終了が翌日まで食い込んだ場合は、前日側の時刻を優先する。
  if (end - start > 86400) end = start + 86400;
  return {start,end};
};
const editDayData = () => predictionData(s.day);
const canEditDay = () => s.day === todayIndex() && todayEditable() && !s.snapshots?.[s.day]?.finalized;
const sec = t => { const a = String(t || '0').split(':').map(Number); return a.length === 3 ? a[0] * 3600 + a[1] * 60 + a[2] : a.length === 2 ? a[0] * 3600 + a[1] * 60 : 0 };
const fmt = t => { t = Math.max(0, Math.floor(t)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` };
const num = n => Math.round(n).toLocaleString('ja-JP');
const modeText = m => m === 'both' ? '手打ち＆バクグラ（混合）' : 'フルバックグラウンド';
const row = (label, control) => `<div class="row"><span class="label">${label}</span><div class="control">${control}</div></div>`;
const panel = (title, body, ico = '✦') => `<section class="panel"><h2>${title}</h2>${body}</section>`;
const btn = (label, action, cls = 'primary') => `<button class="${cls}" data-action="${action}">${label}</button>`;
const dayLabel = i => `${i + 1}日目 (${jp(dateAt(i))})`;
let page = s.initialized ? 'play' : 'setup';
let playTab = 'accuracy';
const tabDone = d => { if (!d.tabDone) d.tabDone = { accuracy: false, sleep: false, bg: false, loss: false }; return d.tabDone };
const resetTab = (d, key) => { invalidateProvisional(); tabDone(d)[key] = false; d.confirmed = false };
function render() { rollover(); if (!s.initialized && page !== 'setup') page = 'setup'; const titles = { setup: '初期設定画面', play: 'プレイ画面', result: 'Result（結果）', settings: '設定画面', history: 'セット履歴', help: '使い方' }; $('subtitle').textContent = (testMode ? '【テスト ' + (s.testClock || '') + '】 ' : '') + titles[page]; document.querySelectorAll('[data-page]').forEach(b => { b.classList.toggle('active', b.dataset.page === page); b.disabled = !s.initialized }); $('nav').classList.toggle('hidden', page === 'setup'); $('content').innerHTML = ({ setup: renderSetup, play: renderPlay, result: renderResult, settings: renderSettings, history: renderHistory, help: renderHelp }[page])(); }
function settingsFields(initial) { return panel('プレイの基本設定', row('プレイ方法', `<div class="seg"><button data-action="mode" data-value="both" class="${s.mode === 'both' ? 'selected' : ''}">手打ち＆バクグラ</button><button data-action="mode" data-value="fullBackground" class="${s.mode === 'fullBackground' ? 'selected' : ''}">フルバクグラ</button></div>`) + row('通常曲（共通）', `<select data-field="song"><option value="-1" ${s.song < 0 ? 'selected' : ''}>選択してください</option>${SONGS.map((a, i) => `<option value="${i}" ${s.song === i ? 'selected' : ''}>${a[0]}</option>`).join('')}</select>`) + row('イベント曲時間', `<button class="timebtn" data-wheel="eventSeconds">${s.eventSeconds > 0 ? fmt(s.eventSeconds).slice(3) : '未設定'}（分:秒）</button>`) + row('特攻値', `<input data-field="bonus" type="number" min="0" max="9999" value="${s.bonus ?? ''}" placeholder="未設定"> % <output>${s.bonus === null || s.bonus === '' ? '—' : num(eventPt(s.bonus)) + ' pt'}</output>`), '♧') + (s.mode === 'both' ? panel('回線速度（手打ち時のみ）', `<div class="seg">${[24, 26, 28].map((n, i) => `<button data-action="network" data-value="${n}" class="${s.network === n ? 'selected' : ''}">${['速い', '普通', '遅い'][i]}<br>(${n}秒)</button>`).join('')}</div>`, '◎') : '') + `<button class="primary wide" data-action="saveSettings">✓ 設定を保存</button>` + (initial ? '' : `<button class="danger wide" data-action="end">⚑ イベント終了</button>`) }
function renderSetup() { return renderTestControls() + panel('イベント情報', row('イベント開始日', `<input data-field="start" type="date" value="${s.start}">`) + row('イベント日数', `<select data-field="days">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${s.days === i + 1 ? 'selected' : ''}>${i + 1}日</option>`).join('')}</select>`) + `<p class="note">イベント初日は15:00開始、最終日は23:59:59終了です。</p>`, '▣') + settingsFields(true) }
function renderTestControls() {
  const clock = testMode ? (s.testClock || localDayString(new Date())) : '';
  const current = testMode && s.start ? todayIndex() : -1;
  const status = current < 0 ? 'イベント開始前' : current >= s.days ? 'イベント終了後' : `${current + 1}日目`;
  return panel('日付変更テストモード',
    `<p class="note">本番の設定・計測結果とは別のデータで、翌日の本確定を確認できます。</p>` +
    row('モード', `<strong>${testMode ? 'テスト中（本番データと分離）' : '本番モード'}</strong>`) +
    btn(testMode ? 'テストを終了して本番に戻る' : 'テストモードを開始', 'toggleTest', testMode ? 'ghost' : 'primary') +
    (testMode ? `<div class="test-clock-panel">` +
      row('テスト上の日付', `<strong>${clock}（${status}）</strong>`) +
      `<p class="note">当日を計測して仮確定 → 翌日へ進む → 前日が本確定になることを確認してください。</p>` +
      `<button class="primary wide" data-action="testNextDay">翌日へ進む（前日を本確定）</button>` +
      row('指定日まで進む', `<input id="testDate" type="date" min="${clock}" value="${clock}">`) +
      `<button class="ghost wide" data-action="testSetDate">指定日へ進む</button>` +
      `<button class="ghost wide" data-action="resetTest">テスト用データを初期化</button>` +
      `<p class="note">テスト内の変更は本番データに反映されません。過去日に戻す場合はテスト用データを初期化してください。</p></div>` : '')
  );
}
function renderSettings() { return renderTestControls() + panel('アプリ情報', row('バージョン', `<span class="soft">${APP_VERSION}</span>`) + `<p class="note">更新後はバージョン番号が変わったことを確認してください。保存済みの設定・確定データは保持されます。</p>`, '▣') + panel('イベント情報', row('イベント日数', `<span class="soft">${s.days}日（変更不可）</span>`) + row('イベント終了日時', `<span class="soft">${jp(dateAt(s.days - 1))} 23:59</span>`) + `<p class="note">イベント期間中は日数・終了日時を変更できません。</p>`, '▣') + settingsFields(false) }
function datebar() { return `<div class="datebar"><button data-action="prev" ${s.day <= 0 ? 'disabled' : ''}>❮</button><strong>▣ ${dayLabel(s.day)}</strong><button data-action="next" ${s.day >= s.days - 1 ? 'disabled' : ''}>❯</button></div>` }
// 設定済みの楽曲からバクグラの1セット実行可能時間を算出する。
// 通常曲は3時間の設定枠内に開始できる曲を最後まで再生する。
// イベント曲は最大114回、最終回後の15秒待機は含めない。
function bgDurationInfo() {
  const song = SONGS[s.song] || SONGS[0];
  const normalCycle = song[1] + 15;
  const normalRuns = Math.floor(10800 / normalCycle) + 1;
  const normalSeconds = normalRuns * normalCycle;
  const eventSeconds = 114 * (s.eventSeconds + 15) - 15;
  const readable = t => `${Math.floor(t / 3600)}時間${Math.floor(t % 3600 / 60)}分${t % 60}秒`;
  const songTime = t => `${Math.floor(t / 60)}分${t % 60}秒`;
  return { normalSeconds, eventSeconds, normalRuns, normalText: readable(normalSeconds), eventText: readable(eventSeconds), songName: song[0], songDuration: songTime(song[1]), eventDuration: songTime(s.eventSeconds) };
}
function autoWakeFromBedtime(bedtime) {
  const duration = bgDurationInfo().eventSeconds;
  return fmt((sec(bedtime) + duration) % 86400);
}
function bgDurationPanel() {
  const b = bgDurationInfo();
  return `<div class="bg-duration-info" aria-label="バクグラ連続実行可能時間"><div class="bg-duration-heading">バクグラ連続実行可能時間</div><div class="bg-duration-line"><span>通常曲バクグラ</span><strong>${b.normalText}</strong></div><p>（${escapeAttr(b.songName)}：${b.songDuration}）</p><div class="bg-duration-line"><span>イベント曲バクグラ</span><strong>${b.eventText}</strong></div><p>（イベント曲：${b.eventDuration}）</p></div>`;
}
// フルバクグラ専用：日付・睡眠・日別スナップショットに依存せず225時間を一括計算。
const FULL_BG_SECONDS = 225 * 3600;
function simulateFullBackground() {
  const song = SONGS[s.song] || SONGS[0];
  const normalTime = song[1] + 15, eventTime = s.eventSeconds + 15;
  const gain = TABLE[song[2]][5], pt = eventPt(s.bonus);
  if (normalTime <= 0 || eventTime <= 15 || gain <= 0) return { valid: false, error: '楽曲時間を確認してください' };
  // 225時間全体でイベント曲の最大回数を探索する。
  // 通常曲を必要以上に増やさず、同じイベント回数なら残アイテムを最小化する。
  const maxEvents = Math.ceil(FULL_BG_SECONDS / s.eventSeconds) + 1;
  let best = null;
  for (let target = maxEvents; target >= 0; target--) {
    const normals = Math.ceil(target * ITEM_COST / gain);
    // 必要アイテムの理論上の最小補充時間でも間に合わなければ不採用。
    const lowerTime = normals * normalTime + target * eventTime - 15 * Math.ceil(target / 114);
    if (lowerTime - s.eventSeconds >= FULL_BG_SECONDS) continue;
    let inv = 0, n = 0, e = 0, normalSeconds = 0, eventSeconds = 0, sets = 0;
    // 実際にアイテム上限を守れる順番で実行できるか確認。
    while (e < target) {
      const canEvent = Math.min(114, target - e, Math.floor(inv / ITEM_COST));
      if (canEvent > 0 && (inv + gain > ITEM_CAP || n >= normals || inv >= 114 * ITEM_COST)) {
        e += canEvent; inv -= canEvent * ITEM_COST; eventSeconds += canEvent * eventTime - 15; sets++;
      } else if (n < normals && inv + gain <= ITEM_CAP) {
        n++; inv += gain; normalSeconds += normalTime;
      } else if (canEvent > 0) {
        e += canEvent; inv -= canEvent * ITEM_COST; eventSeconds += canEvent * eventTime - 15; sets++;
      } else break;
    }
    if (e !== target) continue;
    const elapsed = normalSeconds + eventSeconds;
    if (elapsed - s.eventSeconds >= FULL_BG_SECONDS) continue;
    best = {      
valid: true, totalPt: e * pt, totalItems: e * ITEM_COST, totalTime: elapsed, eventWindow: FULL_BG_SECONDS,
      inv, earned: n * gain, spent: e * ITEM_COST, normalRuns: n, eventRuns: e, normalSeconds, eventSeconds, sets, idleSeconds: Math.max(0, FULL_BG_SECONDS - elapsed)    
};
    break;
  }
  return best || { valid: false, error: '225時間内に成立するプレイ順序を計算できませんでした' };
}
function renderFullBgResult() {
  const saved = s.fullBgResult;
  const r = saved && saved.settings?.song === s.song && saved.settings?.eventSeconds === s.eventSeconds && saved.settings?.bonus === s.bonus ? saved : simulateFullBackground();
  if (!r.valid) return panel('計算エラー', `<p class="error">${r.error}</p>`);
  return panel('フルバックグラウンド・総合結果', `<div class="points">${num(r.totalPt)} pt</div>${row('計算時間', fmt(FULL_BG_SECONDS))}${row('実プレイ時間', fmt(r.totalTime))}${row('未使用時間', fmt(r.idleSeconds))}${row('イベント終了時の残りアイテム', num(r.inv) + ' 個')}`) +
    panel('225時間のプレイ内訳', `<table class="table"><thead><tr><th>種類</th><th>回数</th><th>時間</th></tr></thead><tbody><tr><td>通常曲バクグラ</td><td>${num(r.normalRuns)} 回</td><td>${fmt(r.normalSeconds)}</td></tr><tr><td>イベント曲バクグラ</td><td>${num(r.eventRuns)} 回</td><td>${fmt(r.eventSeconds)}</td></tr></tbody></table>`) +
    panel('アイテム収支', `${row('獲得アイテム', num(r.earned) + ' 個')}${row('消費アイテム', num(r.spent) + ' 個')}${row('残りアイテム', num(r.inv) + ' 個')}`) +
    `<button class="primary wide" data-action="back">戻る</button><p class="small">日付・起床就寝・日別確定データは計算に使用しません。イベント全体225時間のシミュレーション結果です。</p>`;
}
function renderPlay() {
  if (s.mode === 'fullBackground') return panel('フルバックグラウンド（225時間）', `<p class="note">日付・就寝時間・精度・バクグラ時間の設定は不要です。225時間を一括計算します。</p><button class="primary wide" data-action="measureFullBg">計測する</button>`);
  if (isFinalDay(s.day) && playTab === 'sleep') playTab = 'bg';
  const d = predictionData(s.day), full = s.mode === 'fullBackground', editable = canEditDay(), done = tabDone(d);
  const tabs = [['accuracy', '精度'], ...(isFinalDay(s.day) ? [] : [['sleep', '起床・就寝']]), ['bg', 'バクグラ時間'], ['loss', 'ロス時間'], ['measure', '計測']];
  const tabBar = `<div class="play-tabs" role="tablist" aria-label="プレイ設定">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${playTab === id}" class="play-tab ${playTab === id ? 'active' : ''}" data-play-tab="${id}">${label}${id !== 'measure' && done[id] ? '<span class="tab-check" aria-label="設定完了">✓</span>' : ''}</button>`).join('')}</div>`;
  const disabled = editable ? '' : 'disabled';
  const future = s.day > todayIndex();
  const past = s.day < todayIndex();
  const individualPanel = panel('日別設定', `<p class="small">設定・計測できるのは当日のみです。未来日は当日の設定から自動予測し、編集できません。過去日は本確定データを表示します。</p><div class="row"><span class="label">${dayLabel(s.day)}</span><div class="control"><strong>${future ? '予測（編集不可）' : past ? '本確定（閲覧のみ）' : '当日（編集可能）'}</strong></div></div>${isFinalDay(s.day) ? '<p class="note">最終日は就寝なし・23:59:59終了。最終日が当日になったら専用設定を編集できます。</p>' : ''}`);

  let body = '';
  if (playTab === 'accuracy') {
    body = panel('精度設定（手打ち時のみ）', full ? '<p class="note">フルバクグラでは精度設定は不要です（Dコン100%）。</p>' : `<div class="acc">${['フルエクセレント', 'フルコン', 'A', 'B', 'C', 'D'].map((a, i) => `<label>${a}<select data-accuracy="${i}" ${disabled}>${Array.from({ length: 11 }, (_, j) => `<option value="${j * 10}" ${d.accuracy[i] === j * 10 ? 'selected' : ''}>${j * 10}%</option>`).join('')}</select></label>`).join('')}</div><p class="note">合計 ${d.accuracy.reduce((a, b) => a + b, 0)}%（100%にしてください）</p>`) + `<button class="primary wide" data-action="finishAccuracy" ${disabled}>決定して次へ</button>`;
  } else if (playTab === 'sleep') {
    if (s.day === s.days - 1) { body = panel('最終日の設定', `<p class="note">最終日は就寝せず、イベント終了の23:59:59までプレイします。起床・就寝時刻の設定は不要です。</p><button class="primary wide" data-action="finishSleep" ${disabled}>確認して次へ</button>`); }
    else body = panel('起床・就寝時刻', row('就寝時刻', `<button class="timebtn" data-wheel="bedtime" ${disabled}>${d.bedtime}</button>`) + row('起床時刻', `<button class="timebtn" data-wheel="wake" ${disabled}>${d.wake}</button>`) + row('起床から就寝まで', `<span class="soft">${fmt(awakeSeconds(d))}</span>`) + `<p class="small">就寝BGはバクグラ時間タブへ自動反映されます。就寝時刻に開始し、所持アイテム分だけイベント曲BGを実行します。</p>` + bgDurationPanel() + `<button class="primary wide" data-action="finishSleep" ${disabled}>決定して次へ</button>`);
  } else if (playTab === 'bg') {
    const acts = d.activities.map((a, i) => `<div class="activity"><div class="activity-name"><input class="activity-name-input" type="text" data-activity-name="${i}" value="${escapeAttr(a.name)}" maxlength="40" placeholder="項目名" ${disabled}></div><div class="seg"><button data-action="activityMode" data-index="${i}" data-value="normal" class="${a.mode === 'normal' ? 'selected' : ''}" ${disabled}>通常曲BG</button><button data-action="activityMode" data-index="${i}" data-value="event" class="${a.mode === 'event' ? 'selected' : ''}" ${disabled}>イベント曲BG</button></div><div class="bg-clock-row"><label>開始 <button type="button" class="timebtn" data-wheel="bgStart" data-index="${i}" ${disabled}>${escapeAttr(a.startTime || '09:00')}</button></label><label>終了 <button type="button" class="timebtn" data-wheel="bgEnd" data-index="${i}" ${disabled}>${escapeAttr(a.endTime || '10:00')}</button></label></div><div class="activity-confirm"><button class="primary" data-action="activityConfirm" data-index="${i}" ${disabled}>決定</button><span class="check-slot">${a.confirmed ? '<span class="check">✓</span>' : ''}</span></div>${i > 0 ? `<button class="remove-activity" data-action="removeActivity" data-index="${i}" ${disabled}>×</button>` : '<span class="remove-placeholder"></span>'}</div>`).join('');
    const total = d.activities.reduce((x, a) => x + activityDuration(a), 0);
    body = panel('時刻指定バクグラ', `<p class="small">日中BGの開始・終了時刻を指定します。就寝BGは起床・就寝タブから自動反映され、就寝時刻に開始します。</p>${bgScheduleBar(d,s.day)}${acts}${s.day < s.days - 1 ? `<div class="activity" aria-label="就寝BG 自動設定"><strong>就寝BG（自動）</strong><div class="seg"><span>イベント曲BGのみ・編集不要</span></div><div class="bg-clock-row">開始 ${escapeAttr(d.bedtime)}　終了 翌 ${escapeAttr(d.wake)}</div><p class="small">所持アイテムと起床までの時間から最大114回を自動計算。早く終了した場合は、その時刻から翌日の計算を開始します。</p></div>` : ''}<button class="ghost wide" data-action="addActivity" ${disabled}>＋ 項目追加</button><div class="total"><span>日中BG設定時間合計</span><strong>${fmt(total)}</strong></div><button class="primary wide" data-action="finishBg" ${disabled}>決定して次へ</button>`);
  } else if (playTab === 'loss') {
    body = panel('ロス時間の設定', `<p class="small">バクグラ終了後の更新忘れなど、手打ち・バクグラのどちらも実行しない時間を1日合計で設定します。</p><div class="row"><span class="label">ロス時間（時間・分）</span><div class="control"><input type="number" min="0" max="23" step="1" data-loss="hours" value="${Math.floor((d.lossMinutes || 0) / 60)}" ${disabled} style="width:65px"> 時間 <input type="number" min="0" max="59" step="1" data-loss="minutes" value="${(d.lossMinutes || 0) % 60}" ${disabled} style="width:65px"> 分</div></div><p class="note">ロス時間中はアイテムもptも増えません。バクグラ時間は減らさず、残りの手打ち時間から差し引きます。</p><button class="primary wide" data-action="finishLoss" ${disabled}>決定して次へ</button>`);
  } else {
    const items = [['accuracy', '精度設定'], ...(isFinalDay(s.day) ? [] : [['sleep', '起床・就寝']]), ['bg', 'バクグラ時間'], ['loss', 'ロス時間']];
    const all = items.every(([id]) => id === 'sleep' && isFinalDay(s.day) ? true : done[id]);
    body = panel('設定確認', items.map(([id, label]) => `<button class="review-row" data-play-tab="${id}"><span>${label}</span><span class="${done[id] ? 'check' : 'pending'}">${done[id] ? '✓ 設定完了' : '未確定'}　›</span></button>`).join('') + `<p class="small">当日は設定確定後に計測できます。未来日は編集せずに予測結果を確認できます。</p><button class="primary wide" data-action="measureDay" ${future || (all && editable) ? '' : 'disabled'}>${future ? '予測を表示' : s.day === activeIndex() ? '計測する' : '結果を表示'}</button>${s.snapshots?.[s.day] && !s.snapshots[s.day].finalized ? '<p class="note">仮確定中：当日は設定を変更して再計測できます。翌日になると本確定します。</p>' : ''}`);
  }
  return datebar() + individualPanel + tabBar + body;
}
function awakeSeconds(d) { const w = sec(d.wake), b = sec(d.bedtime); return (b - w + 86400) % 86400 || 86400 }
function activityAvailableSeconds(d) {
  const day = s.day;
  if (Number(day) === s.days - 1) return 86399;
  if (Number(day) !== 0) return awakeSeconds(d);
  // 初日だけは起床時刻ではなくイベント開始15:00を基準にする。
  const start = 15 * 3600, bed = sec(d.bedtime);
  return (bed <= start ? bed + 86400 : bed) - start;
}
function activityTimeError(d, index) {
  const a=d.activities[index]; if(!a) return '項目が見つかりません';
  const day=s.day, start=day===0?54000:day*86400+(isFinalDay(day)?0:sec(d.wake));
  const bed=sec(d.bedtime); let end=day===s.days-1?day*86400+86399:day*86400+bed;
  if(end<=start) end+=86400;
  if(hasSlot(a)) { if(day===0 && (clockSec(a.startTime)<54000 || clockSec(a.endTime)<54000)) return `${a.name}：初日は15:00以降を選択してください`; return validateSlots(d,day,start,end); }
  const duration=sec(a.duration),available=activityAvailableSeconds(d);
  return duration>available?`${a.name}：活動時間を超えています`:'';
}
function allActivityTimeError(d) { for(let i=0;i<d.activities.length;i++){if(!d.activities[i].name.trim()) return '項目名を入力してください';const e=activityTimeError(d,i);if(e)return e;}return '';}
// 起床・就寝の決定時点で、曲の途中終了をしない条件を検証する。
function sleepScheduleError(d, checkActivities = false) {
  const wake = sec(d.wake), bed = sec(d.bedtime), cycle = s.eventSeconds + 15;
  if (!s.eventSeconds || cycle <= 15) return 'イベント曲の時間を設定してください';
  const sleepSpan = (wake - bed + 86400) % 86400;
  if (sleepSpan === 0) return '起床時刻と就寝時刻を同じにできません';
  // v34: 所持アイテム分だけ就寝イベントBGを実行し、早期終了後は起床まで待機する。
  // 114回分の所持数や起床までのBG完走は必須ではない。
  const day = activeIndex(), start = day === 0 ? 54000 : sec(d.wake);
  let bedAt = sec(d.bedtime); if (bedAt <= start) bedAt += 86400;
  // 15:00開始で翌01:00就寝など、初日の日付をまたぐ就寝も有効。
  const available = bedAt - start;
  const total = d.activities.reduce((n, a) => n + activityDuration(a), 0);
  if (checkActivities && total > available) return `バクグラ設定時間エラー：プレイ可能${fmt(available)}、バクグラ設定合計${fmt(total)}、超過${fmt(total - available)}`;
  return '';
}
// 手打ち精度はプレイ単位で配分する。毎回、目標比率に対して
// 最も不足している精度を選び、同点なら FE→FC→A→B→C→D を優先。
// 例: FE70% / A30% の10回は FE7回・A3回になる。
function createManualGainSchedule(accuracy, itemTable) {
  const counts = [0, 0, 0, 0, 0, 0], prefix = [0], gains = [];
  const next = () => {
    const turn = gains.length + 1;
    let choice = -1, deficit = -Infinity;
    for (let i = 0; i < 6; i++) {
      if (!(accuracy[i] > 0)) continue;
      const score = turn * accuracy[i] - counts[i] * 100;
      if (score > deficit) { deficit = score; choice = i }
    }
    if (choice < 0) choice = 5;
    counts[choice]++;
    const gain = itemTable[choice];
    gains.push(gain); prefix.push(prefix[prefix.length - 1] + gain);
    return gain;
  };
  return { next, total: (n) => { while (gains.length < n) next(); return prefix[n] }, at: (n) => { while (gains.length <= n) next(); return gains[n] } };
}
function eventPt(b) { return 1150 * (1 + b / 100) + 288 }
// 実時刻（イベント初日の0時を0秒とする）で日中・睡眠を連結する。
// バクグラの設定時間は短縮しない。曲の最終待機15秒は計上しない。
function simulateCandidate(stopAfterDay = null, selectionPolicy = 'carry') {
  // v35: 就寝BGに使うアイテムを残す候補と日中消費する候補を比較する。
  const [policyName, sleepPercentText] = selectionPolicy.split('|sleep');
  selectionPolicy = policyName;
  const sleepPercent = sleepPercentText === undefined ? 100 : Math.min(100, Math.max(0, Number(sleepPercentText) || 0));
  const sleepRunMatch = selectionPolicy.match(/Sleep(10[0-9]|11[0-4])$/);
  const fixedSleepRuns = sleepRunMatch ? Number(sleepRunMatch[1]) : null;
  if (sleepRunMatch) selectionPolicy = selectionPolicy.slice(0, -sleepRunMatch[0].length);
  // 診断ログは計測のたびに初期化。未定義の配列への push による停止を防ぐ。
  window.__nogifesOptimizationTrace = [];
  let inv = 0, totalPt = 0, totalItems = 0, totalTime = 0, previousSleepEnd = null;
  const days = [], song = SONGS[s.song] || SONGS[0], isFull = s.mode === 'fullBackground';
  const normalBg = song[1] + 15, eventBg = s.eventSeconds + 15;
  const normalManual = song[1] + s.network, eventManual = s.eventSeconds + s.network + 1;
  const bgGain = TABLE[song[2]][5], pt = bg => eventPt(s.bonus + (bg ? 0 : 144));
  // 就寝BGで実行可能な上限は114回。アイテム上限99,999とは別物。
  // 時刻境界の切り上げで115回と推定しても99,999個を要求しない。
  const sleepReserveItems = (seconds) =>
    Math.min(114, Math.max(0, Math.ceil((seconds + 15) / eventBg))) * ITEM_COST;
  const eventEnd = (s.days - 1) * 86400 + 86399;
  for (let day = 0; day < s.days; day++) {
    // 本確定した過去日だけを固定。仮確定した当日や未来日の結果は
    // 設定変更・日付変更に追従して常に最新ロジックで予測し直す。
    const savedRecord = s.snapshots && s.snapshots[day];
    // v76: 計測済みの過去日は仮確定フラグのままでも再計算しない。
    // 画面の日付と実時計がずれた場合も、過去日の保存記録を優先する。
    // 本確定済みの日は日付に関係なく再計算・再検証しない。
    // 過去日の仮確定も確定データとしてそのまま引き継ぐ。
    const frozen = savedRecord && (savedRecord.finalized || day < todayIndex()) ? savedRecord : null;
    if (frozen) {
      // 確定済みの日は候補探索の対象外。再計算したように見せない。
      const record = { ...frozen, errors: [], confirmed: true, fromSnapshot: true };
      days.push(record);
      // 確定結果の終了在庫・終了時刻を翌日へ直接引き継ぐ。
      inv = Number(record.inv) || 0;
      previousSleepEnd = record.dayEnd;
      totalPt += record.points; totalItems += record.spent;
      totalTime += (record.bgNormalSeconds || 0) + (record.bgEventSeconds || 0) + (record.manualNormalSeconds || 0) + (record.manualEventSeconds || 0);
      continue;
    }
    const d = predictionData(day), accuracy = d.accuracy || [0, 0, 0, 0, 0, 100];
    const gainSchedule = createManualGainSchedule(accuracy, TABLE[song[2]]);
    const manualGainAt = () => gainSchedule.at(manualNormal);
    const errors = []; let normalRuns = 0, eventRuns = 0, manualNormal = 0, manualEvent = 0; const log = []; let phase = 0;
    let earned = 0, spent = 0, points = 0, used = 0;
    let bgNormalSeconds = 0, bgEventSeconds = 0, sleepEventSeconds = 0, sleepEventRuns = 0, manualNormalSeconds = 0, manualEventSeconds = 0;
    const wake = sec(d.wake), bed = sec(d.bedtime);
    const base = day * 86400;
    // 日中は前夜のバクグラ終了後から。初日は15時開始。
    const {start, end} = simulationDayWindow(day, previousSleepEnd, bed, eventEnd);
    const bedAt = day === s.days - 1 ? end : end;
    const awakeAvailable = Math.max(0, end - start);
    // 就寝時刻が翌日01:00など日付をまたぐ場合、起床時刻が同日01:00と
    // 解釈されて睡眠時間0秒にならないよう、就寝後の最初の起床時刻を採用する。
    const sleepTargetBase = base + 86400 + wake;
    const sleepTarget = day === s.days - 1 ? null
      : sleepTargetBase + (sleepTargetBase <= end ? 86400 : 0);
    if (day === s.days - 1 && start >= eventEnd) errors.push('最終日の開始時刻がイベント終了後です');
    if (!isFull && accuracy.reduce((a, b) => a + b, 0) !== 100) errors.push('精度の合計が100%ではありません');
    const acts = d.activities.filter(a => a.confirmed && activityDuration(a) > 0);
    const configured = acts.reduce((v, a) => v + activityDuration(a), 0);
    // バクグラは指定した時間を優先する。曲を途中で切らないため、最後の1曲の完走分も予約する。
    const reservedBg = acts.reduce((v, a) => {
      const cycle = a.mode === 'normal' ? normalBg : eventBg;
      return v + Math.ceil(activityDuration(a) / cycle) * cycle;
    }, 0);
    // 入力された時間だけで判定する。曲完走による数十秒の超過は
    // 実際の就寝開始を後ろにずらして吸収し、ここではエラーにしない。
    const lossSeconds = Math.max(0, Number(d.lossMinutes) || 0) * 60;
    if (configured + lossSeconds > awakeAvailable) {
      errors.push(`${day + 1}日目：バクグラとロス時間の設定合計が活動可能時間を超えています（活動可能 ${fmt(awakeAvailable)}、バクグラ ${fmt(configured)}、ロス ${fmt(lossSeconds)}）`);
    }
    // 手打ち時間は完走分も含めた実行時間から差し引く。
    // 予約時間が活動時間を超える場合は手打ち枠をゼロとし、就寝開始を調整する。
    let free = Math.max(0, awakeAvailable - reservedBg - lossSeconds);
    const gainNormal = bg => {
      const gain = bg ? bgGain : manualGainAt(), time = bg ? normalBg : normalManual;
      if (inv + gain > ITEM_CAP || (!bg && free <= 0)) return false;
      inv += gain; earned += gain; used += time; log.push(['n', bg ? 1 : 0, time, gain, 0, phase]);
      if (bg) { normalRuns++; bgNormalSeconds += time } else { manualNormal++; manualNormalSeconds += time; free -= time }
      return true;
    };
    const playEvent = (bg, timeOverride) => {
      const time = timeOverride ?? (bg ? eventBg : eventManual);
      if (inv < ITEM_COST || (!bg && free <= 0)) return false;
      inv -= ITEM_COST; spent += ITEM_COST; points += pt(bg); used += time; log.push(['e', bg ? 1 : 0, time, -ITEM_COST, pt(bg), phase]);
      if (bg) { eventRuns++; bgEventSeconds += time } else { manualEvent++; manualEventSeconds += time; free -= time }
      return true;
    };
    let finalClockEnd = end; // 最終日の曲完走時刻（スロット内のcursorを外側へ引き継ぐ）
    let actualDaytimeEnd = null; // 時刻指定BGの実際の最終カーソル
    const useClockSlots = acts.some(hasSlot);
    if (useClockSlots && !errors.length) {
      const invalid=validateSlots(d,day,start,end);
      if(invalid) errors.push(invalid);
      const slots=acts.map(a=>({a,...slotBounds(a,day,start)})).sort((x,y)=>x.begin-y.begin);
      let cursor=start;
      // 日中の手打ちは時系列で実行。就寝BGに必要なアイテムを最優先で確保する。
      // 予約されたイベントBGの必要アイテムも事前に見積もる。
      const sleepNeed = day < s.days - 1 ? Math.min(ITEM_CAP, (fixedSleepRuns === null ? Math.floor(sleepReserveItems(sleepTarget - bedAt) * sleepPercent / 100 / ITEM_COST) : Math.min(fixedSleepRuns, Math.floor(sleepReserveItems(sleepTarget - bedAt) / ITEM_COST))) * ITEM_COST) : 0; // v35: 最終就寝区間のみ目標在庫を確保
      const futureNeed=(index)=>slots.slice(index).filter(x=>x.a.mode==='event').reduce((n,x)=>n+Math.ceil((x.finish-x.begin)/eventBg)*ITEM_COST,0);
      // v13: BGで区切られた手打ち区間ごとに、時間・アイテム・ptを同時に探索する。
      // 最終日以外は次のBGと就寝BGの必要数を確保し、最終日は残アイテムを抑える。
      // v57: 残り回数を実行可能な順序に並べる。イベント曲を全て先に
      // 消費すると、後半の通常曲で上限を超えるため、補充可能なら補充を優先する。
      const manualOrder = (normalCount, eventCount, initialStock, initialNormal) => {
        let stock=initialStock, ni=initialNormal, nn=normalCount, ee=eventCount;
        const order=[];
        while (nn || ee) {
          const gain=nn ? gainSchedule.at(ni) : 0;
          if (nn && stock + gain <= ITEM_CAP) {
            stock += gain; ni++; nn--; order.push('n');
          } else if (ee && stock >= ITEM_COST) {
            stock -= ITEM_COST; ee--; order.push('e');
          } else return null;
        }
        return {stock,order};
      };
      const manualUntil=(deadline, need)=>{
        const available=Math.max(0,deadline-cursor);
        const lastSegment=deadline===end;
        const minimum=lastSegment ? sleepNeed : Math.min(ITEM_CAP,need);
        const gainStart=gainSchedule.total(manualNormal);
        const maxN=Math.floor(available/normalManual);
        let best=null, minimumIdle=available;
        const feasible=[];
        for(let n=0;n<=maxN;n++){
          const gain=gainSchedule.total(manualNormal+n)-gainStart;
          const maxE=Math.floor((available-n*normalManual)/eventManual);
          // 所持数が一時的に上限を超えないよう、イベント曲を先行実行できる回数も確認。
          const minE=Math.max(0,Math.ceil((inv+gain-ITEM_CAP)/ITEM_COST));
          const itemE=Math.floor((inv+gain-minimum)/ITEM_COST);
          for(let e=minE;e<=Math.min(maxE,itemE);e++){
            const remain=inv+gain-e*ITEM_COST;
            if(remain<minimum||remain>ITEM_CAP)continue;
            // 実行順は、通常曲を入れられるときに補充し、上限に近いときイベント曲を消費。
            // 必要なら先にイベント曲を行うので、アイテム残数の推移を検証する。
            const planned=manualOrder(n,e,inv,manualNormal);
            if (!planned || planned.stock !== remain) continue;
            const idle=available-n*normalManual-e*eventManual;
            minimumIdle=Math.min(minimumIdle,idle);
            feasible.push({n,e,remain,idle});
          }
        }
        // v19: 次区間で使える在庫を評価しつつ、端数時間を放置しない。
        // まずイベント曲換算の獲得可能回数（現在＋将来分）を最大化する。
        // 同じ回数なら手打ち枠の消化を優先し、さらに在庫の余裕を比較する。
        // 将来のBG用に確保した最低必要数は持越し得点に加えない。
        const hasLaterManual = !lastSegment || day < s.days - 1;
        const carryLimit = Math.min(ITEM_CAP, Math.max(minimum, need) + 12 * ITEM_COST);
        const availableCarry = c => hasLaterManual
          ? Math.max(0, Math.min(c.remain, carryLimit) - minimum) : 0;
        let bestScore = -Infinity;
        for (const c of feasible) {
          const carry = availableCarry(c);
          // 持越しの端数は次の通常曲と合わせて使えるため微小な価値を持つ。
          // ただし数分の空白を作るほど優先しない。
          const futureRuns = Math.floor(carry / ITEM_COST);
          const fraction = (carry % ITEM_COST) / ITEM_COST;
          const score = c.e + futureRuns + fraction * 0.08;
          if (!best || score > bestScore + 1e-9 ||
              (Math.abs(score - bestScore) < 1e-9 &&
               (c.idle < best.idle || (c.idle === best.idle && c.remain < best.remain)))) {
            best = c;
            bestScore = score;
          }
        }
        // 同じイベント曲換算回数の候補なら、残り時間を積極的に使用。
        // 最大スコアから0.08以内（持越し端数の評価分）では未使用時間を優先する。
        const near = feasible.filter(c => {
          const carry = availableCarry(c);
          return c.e + Math.floor(carry / ITEM_COST) + (carry % ITEM_COST) / ITEM_COST * 0.08 >= bestScore - 0.080000001;
        });
        if (near.length) {
          near.sort((x,y) => x.idle-y.idle || y.e-x.e || y.remain-x.remain);
          best=near[0];
        }
        // v22: 全日を実際に再生して比較するための探索方針。
        // 各区間で「実行可能」と確認された候補のみを選び、
        // 持越しアイテムとイベント曲回数のバランスを複数パターン試す。
        if (selectionPolicy !== 'carry' && feasible.length) {
          const projected = c => {
            const carry = availableCarry(c);
            return c.e + Math.floor(carry / ITEM_COST) +
              (carry % ITEM_COST) / ITEM_COST * 0.08;
          };
          const tolerance = selectionPolicy === 'fill' ? 1.000000001 :
            selectionPolicy === 'tight' ? 0.080000001 :
            selectionPolicy === 'balanced' ? 0.500000001 :
            selectionPolicy === 'flexible' ? 1.500000001 : 2.000000001;
          const choices = feasible.filter(c => projected(c) >= bestScore - tolerance);
          if (choices.length) {
            // 手打ちの端数を先に詰めるが、同じ端数なら将来に
            // 持ち越すアイテムを優先する探索方針も含める。
            if (selectionPolicy === 'reserve') {
              choices.sort((a,b) => b.remain-a.remain || a.idle-b.idle || b.e-a.e);
            } else if (selectionPolicy === 'balanced') {
              choices.sort((a,b) =>
                (a.idle + Math.max(0, a.remain-minimum)*0.025) -
                (b.idle + Math.max(0, b.remain-minimum)*0.025) ||
                b.e-a.e);
            } else if (selectionPolicy === 'flexible') {
              choices.sort((a,b) =>
                (a.idle - a.e*0.45) - (b.idle - b.e*0.45) ||
                b.remain-a.remain);
            } else {
              choices.sort((a,b) => a.idle-b.idle || b.e-a.e || a.remain-b.remain);
            }
            best = choices[0];
          }
        }
        // v31: BGで区切られた全ての手打ち区間について、現在の在庫から
        // 「イベント消費→通常補充」を含む実行可能な回数の組合せを直接選ぶ。
        // 次のイベントBGに必要なアイテムは minimum で確保済み。
        // 将来の持越しを過大評価してプレイ可能な時間を放置しない方針を追加。
        if ((selectionPolicy === 'active' || selectionPolicy === 'activeReserve') && feasible.length) {
          const reserve = selectionPolicy === 'activeReserve' ? 3 * ITEM_COST : 0;
          const candidates = feasible.filter(c => c.remain >= minimum + reserve);
          const pool = candidates.length ? candidates : feasible;
          pool.sort((a,b) => b.e-a.e || a.idle-b.idle || b.remain-a.remain);
          best = pool[0];
        }
        // v30: 就寝前の手打ち時間全体で「イベント消費→通常補充」を
        // 組み合わせ、就寝BGの必要アイテムを残せる実行可能な計画を選ぶ。
        // 先に決めた近似スコアよりも、実際のイベント曲回数と時間を優先。
        if (lastSegment && feasible.length) {
          let optimal = null;
          for (const c of feasible) {
            const planned=manualOrder(c.n,c.e,inv,manualNormal);
            if (!planned || planned.stock !== c.remain || planned.stock < minimum) continue;
            const order=planned.order;
            const candidate = {...c, order};
            // v73: 就寝前は必要在庫を維持したうえで、余った時間を優先して埋める。
          // イベント曲を1回多くするために数分間を捨てる候補を避ける。
          // 候補のpt差がイベント曲1回を超える場合は従来のpt優先を維持する。
          if (!optimal ||
              (candidate.e >= optimal.e - 1 && candidate.idle < optimal.idle) ||
              (candidate.idle === optimal.idle && candidate.e > optimal.e) ||
              (candidate.e > optimal.e + 1)) optimal = candidate;
          }
          if (optimal) best = optimal;
        }
        if(!best)return;
        let n=best.n,e=best.e,guard=0;
        if (best.order) {
          for (const step of best.order) {
            const ok = step === 'n' ? gainNormal(false) : playEvent(false);
            if (!ok) { errors.push(`${day+1}日目：手打ち最適化の実行順に矛盾があります`); break; }
            cursor += step === 'n' ? normalManual : eventManual;
          }
        } else {
          while((n||e)&&guard++<20000){
            if(n&&inv+manualGainAt()<=ITEM_CAP){if(!gainNormal(false))break;cursor+=normalManual;n--;}
            else if(e&&inv>=ITEM_COST){if(!playEvent(false))break;cursor+=eventManual;e--;}
            else {errors.push(`${day+1}日目：手打ち最適化の実行順に矛盾があります`);break;}
          }
        }
        // v28: 就寝前に在庫上限付近で停止した場合も、イベント曲で空きを作り、
        // 通常曲で補充する組合せを追加探索する。就寝BG用の必要数は維持する。
        // 最初の計画が終了した後の実在庫と実時刻を使用するため、
        // 予測上だけのプレイを加算せず、ログと時間も一致させる。
        const extraAvailable = Math.max(0, deadline - cursor);
        if (extraAvailable >= Math.min(normalManual, eventManual) && !errors.length) {
          const gainBase = gainSchedule.total(manualNormal);
          let extraBest = null;
          for (let extraN = 0; extraN <= Math.floor(extraAvailable / normalManual); extraN++) {
            const gained = gainSchedule.total(manualNormal + extraN) - gainBase;
            const extraMaxE = Math.min(
              Math.floor((extraAvailable - extraN * normalManual) / eventManual),
              Math.floor((inv + gained - minimum) / ITEM_COST)
            );
            const extraMinE = Math.max(0, Math.ceil((inv + gained - ITEM_CAP) / ITEM_COST));
            for (let extraE = extraMinE; extraE <= extraMaxE; extraE++) {
              const remaining = inv + gained - extraE * ITEM_COST;
              if (remaining < minimum || remaining > ITEM_CAP) continue;
              const planned=manualOrder(extraN,extraE,inv,manualNormal);
              if (!planned || planned.stock !== remaining) continue;
              const order=planned.order;
              const idle = extraAvailable - extraN * normalManual - extraE * eventManual;
              const c = {e: extraE, idle, remain: remaining, order};
              if (!extraBest || c.e > extraBest.e ||
                  (c.e === extraBest.e && (c.idle < extraBest.idle ||
                   (c.idle === extraBest.idle && c.remain < extraBest.remain)))) extraBest = c;
            }
          }
          if (extraBest && extraBest.order.length) {
            for (const step of extraBest.order) {
              const ok = step === 'n' ? gainNormal(false) : playEvent(false);
              if (!ok) { errors.push(`${day+1}日目：就寝前の追加プレイに失敗しました`); break; }
              cursor += step === 'n' ? normalManual : eventManual;
            }
          }
        }
        // 最終日は、余剰アイテムを消費できる連続時間があるかを別途診断する。
        // 合計の未使用時間が曲1回分あっても、BGで分断されていれば使用できない。
        if (day === s.days - 1 && deadline === end) {
          const tail = Math.max(0, deadline - cursor);
          const extraEventsByItems = Math.floor(inv / ITEM_COST);
          window.__nogifesOptimizationTrace.push({
            day:day+1, freeBefore:available, itemsBefore:inv,
            selectedNormalBefore:best.n, selectedEvent:best.e,
            selectedNormalAfter:0, selectedSeconds:available-tail,
            status:`v51：最終区間の残り${tail}秒 / イベント曲1回${eventManual}秒 / 残アイテム${inv}個 / 終了前開始可能${tail>0 && extraEventsByItems>0 ? 1 : 0}回`
          });
        }
        window.__nogifesOptimizationTrace.push({day:day+1,freeBefore:available,itemsBefore:inv,selectedNormalBefore:best.n,selectedEvent:best.e,selectedNormalAfter:0,selectedSeconds:available-Math.max(0,deadline-cursor),status:`v32：区間内消費補充 / 空白${Math.max(0,deadline-cursor)}秒 / 次区間必要${minimum}個`});
      };
      // 既存のfreeは時刻指定では各曲の制限に使用せず、時刻カーソルで管理する。
      free=awakeAvailable+86400;
      for(let i=0;i<slots.length && !errors.length;i++){
        const x=slots[i],count=Math.ceil((x.finish-x.begin)/(x.a.mode==='normal'?normalBg:eventBg));
        // v29: BG開始前に「就寝時の99,750個」まで要求しない。
        // それを要求すると、初日の15:00〜BG開始までに達成不可能となり、
        // 手打ち計画が空のまま時刻だけBG開始まで飛んでしまう。
        // この時点で必要なのは、直後のイベント曲BGで消費する分だけ。
        // 就寝BG用の確保は最終手打ち区間で行う。
        const needed = x.a.mode === 'event'
          ? Math.ceil(Math.max(0, x.finish - x.begin) / eventBg) * ITEM_COST
          : 0;
        manualUntil(x.begin, needed);
        // 手打ち曲は完走するため、BG開始は遅れるが終了予定は固定。
        cursor=Math.max(cursor,x.begin);
        if(x.a.mode==='event'){
          const required=Math.ceil(Math.max(0,x.finish-cursor)/eventBg)*ITEM_COST;
          if(inv<required){
            // 事前補充できなければ、BGの前に手打ち通常曲で補充する。
            let guard=0;
            while(inv<required && guard++<500 && !errors.length){
              if(inv+manualGainAt()>ITEM_CAP){errors.push(`${day+1}日目：${x.a.name}のアイテムを補充できません`);break;}
              gainNormal(false);cursor+=normalManual;
            }
          }
        }
        let runs=0;
        while(cursor<x.finish && !errors.length && runs++<12000){
          if(x.a.mode==='normal'){
            if(inv+bgGain>ITEM_CAP){
              errors.push(`${x.a.name}：通常曲BG中にアイテム上限99,999個を超えます（開始前にイベント曲で消費するかBG時間を短縮してください）`);break;
            }
            if(!gainNormal(true)){errors.push(`${x.a.name}：通常曲BGを実行できません`);break;}
            cursor+=normalBg;
          }else{
            if(inv<ITEM_COST){errors.push(`${day+1}日目のアイテムが${ITEM_COST-inv}個足りません。日中の通常曲BG時間、イベント曲BG時間を見直してください`);break;}
            playEvent(true);cursor+=eventBg;
          }
        }
      }
      if(!errors.length) {
        manualUntil(end,sleepNeed);
        // v39: 就寝BG用在庫を確保した後も、長い空白を作らない。
        // 手打ちの「イベント消費→通常曲補充」を追加で探索する。
        // 最終在庫が就寝BG目標を下回る候補は採用しない。
        // 既存の計画が終了した実時刻・実在庫を起点にする。
        let remaining = Math.max(0, end - cursor);
        if (remaining >= Math.min(normalManual, eventManual)) {
          const initial = inv, initialN = manualNormal;
          const maxN = Math.floor(remaining / normalManual);
          let best = null;
          for (let n = 0; n <= maxN; n++) {
            const gained = gainSchedule.total(initialN+n) - gainSchedule.total(initialN);
            const maxE = Math.min(Math.floor((remaining-n*normalManual)/eventManual), Math.floor((initial+gained-sleepNeed)/ITEM_COST));
            const minE = Math.max(0, Math.ceil((initial+gained-ITEM_CAP)/ITEM_COST));
            for (let e = minE; e <= maxE; e++) {
              if (!n && !e) continue;
              const ending = initial+gained-e*ITEM_COST;
              if (ending < sleepNeed || ending > ITEM_CAP) continue;
              // 必要ならイベント曲を先行して空きを作る。
              let stock=initial, normalIndex=initialN, nn=n, ee=e;
              const order=[];
              while (nn || ee) {
                const g=nn ? gainSchedule.at(normalIndex) : 0;
                if (ee && stock>=ITEM_COST) {stock-=ITEM_COST;ee--;order.push('e');}
                else if (nn && stock+g<=ITEM_CAP) {stock+=g;normalIndex++;nn--;order.push('n');}
                else break;
              }
              if (nn || ee || stock!==ending) continue;
              const seconds=n*normalManual+e*eventManual;
              // v73: 追加プレイではイベント曲1回分以内の差なら
              // プレイ可能時間を埋める候補を選ぶ（就寝BG用在庫は確保済み）。
              if (!best || (e>=best.e-1 && seconds>best.seconds) ||
                  (seconds===best.seconds && e>best.e) || e>best.e+1)
                best={n,e,seconds,order};
            }
          }
          if (best) {
            for (const action of best.order) {
              const ok=action==='n' ? gainNormal(false) : playEvent(false);
              if (!ok) {errors.push(`${day+1}日目：就寝前の追加プレイに失敗しました`);break;}
              cursor+=action==='n' ? normalManual : eventManual;
            }
          }
        }
      }
      // v52: 最終日は終了時刻より前に開始できる最後の1曲を完走させる。
      // 直前の手打ち最適化が終了した実時刻と在庫を使い、ログ・pt・消費も通常処理で記録する。
      // これより後にBG枠は存在しないため、時刻を超過する曲は1曲だけ許可する。
      if (day === s.days - 1 && !errors.length && cursor < end) {
        const tailBefore = Math.max(0, end - cursor);
        const inventoryBefore = inv;
        let added = '';
        if (inv >= ITEM_COST && playEvent(false)) {
          cursor += eventManual;
          added = 'イベント曲手打ち';
        } // v58: イベント曲を追加できない場合、最終時刻直前に
        // 通常曲だけ追加して残アイテムを増やすことはしない。
        window.__nogifesOptimizationTrace.push({
          day: day + 1, freeBefore: tailBefore, itemsBefore: inventoryBefore,
          selectedNormalBefore: 0, selectedEvent: added === 'イベント曲手打ち' ? 1 : 0,
          selectedNormalAfter: added === '通常曲手打ち' ? 1 : 0,
          selectedSeconds: added === 'イベント曲手打ち' ? eventManual : added ? normalManual : 0,
          status: `v52：終了前の残り${tailBefore}秒から${added || '追加なし'}を開始 / 終了超過${Math.max(0,cursor-end)}秒 / 最終残数${inv}個`
        });
      }
      if (day === s.days - 1) finalClockEnd = Math.max(end, cursor);
      actualDaytimeEnd = cursor;
      // 時刻指定BGでは古い一括時間配分ロジックを二重実行しない。
      free=0;
    }
    if (!useClockSlots) {
    // 日中バクグラは設定時間を専有し、上限回避・アイテム補充には空き手打ち時間を使用。
    for (const a of acts) {
      if (errors.length) break;
      const duration = sec(a.duration), cycle = a.mode === 'normal' ? normalBg : eventBg;
      // 通常曲BGは3時間制限なし。指定時間全体を一括計算する。
      let remaining = duration;
      while (remaining > 0 && !errors.length) {
        const chunk = remaining;
        const count = a.mode === 'normal' ? Math.ceil(chunk / normalBg) : Math.min(114, Math.ceil(chunk / eventBg));
        if (count === 0) break;
        if (a.mode === 'event' && remaining > 114 * eventBg - 15) { errors.push(`${a.name}：イベントバクグラの連続実行114回を超えています。設定を分割してください`); break }
        // イベント曲バクグラは1曲ごとに補充せず、開始前に必要分を一括確保する。
        // 1回875個、最大114回＝99,750個。所持上限99,999個は厳守する。
        if (a.mode === 'event') {
          const targetItems = count * ITEM_COST;
          while (inv < targetItems && !errors.length) {
            if (isFull || !gainNormal(false)) {
              errors.push(`${day + 1}日目・${a.name}：イベントバクグラ${count}回分のアイテムを事前補充できません（必要${targetItems}個、所持${inv}個、残り手打ち枠 ${fmt(Math.max(0, free))}）`);
            }
          }
        }
        for (let j = 0; j < count && !errors.length; j++) {
          if (a.mode === 'normal') {
            if (inv + bgGain > ITEM_CAP && !errors.length) {
              errors.push(`${a.name}：通常曲BG中にアイテム上限99,999個を超えます`); break;
              // 上限に来そうなら、残りの通常曲バクグラぶんの空きを作るまでイベント曲をまとめて走らせる
              const rem = count - j;
              const need = Math.min(Math.floor(inv / ITEM_COST), Math.max(1, Math.ceil((inv + rem * bgGain - ITEM_CAP) / ITEM_COST)));
              for (let m = 0; m < need && !errors.length; m++) { if (isFull || !playEvent(false)) errors.push(`${a.name}：上限回避のイベント曲手打ち時間が不足しています`) }
              while (inv + bgGain > ITEM_CAP && !errors.length) { if (isFull || !playEvent(false)) errors.push(`${a.name}：上限回避のイベント曲手打ち時間が不足しています`) }
            }
            if (!errors.length && !gainNormal(true)) errors.push(`${a.name}：通常曲バクグラを実行できません`);
          } else {
            // 必要アイテムはバクグラ開始前に確保済み。ここでは連続消費のみ。
            if (!playEvent(true, j === count - 1 ? s.eventSeconds : eventBg)) errors.push(`${a.name}：イベントバクグラを実行できません`);
          }
          if (errors.length) break;
        }
        remaining -= chunk;
      }
    }
    // バクグラを先に確保した残り時間のみを手打ちに使う。
    // 手打ち補充はすでにfreeから引いているため、二重に差し引かない。
    // 実際のバクグラ時間が予約と異なる場合のみ差分を反映する。
    free = Math.max(0, free - (bgNormalSeconds + bgEventSeconds - reservedBg));
    // 交互プレイを避け、上限近くまで通常曲をまとめて実行してからイベント曲を連続実行。
    // 就寝前は残りの時間で貯め直す。曲の完走による端数は従来通り許容。
    if (!isFull && !errors.length && day === s.days - 1) {
      // 最終日: 時間内でイベント曲の回数を最大化し、同回数なら残アイテムを最小化。
      // 整数の精度配分を使い、通常曲の獲得量を回数ごとに厳密に積算する。
      const maxNormals = Math.max(0, Math.floor(free / normalManual));
      let gains = 0, best = { n: 0, e: Math.min(Math.floor(inv / ITEM_COST), Math.floor(free / eventManual)), remain: inv };
      best.remain = inv - best.e * ITEM_COST;
      for (let n = 1; n <= maxNormals; n++) {
        gains += gainSchedule.at(manualNormal + n - 1);
        const e = Math.max(0, Math.min(Math.floor((free - n * normalManual) / eventManual), Math.floor((inv + gains) / ITEM_COST)));
        const remain = inv + gains - e * ITEM_COST;
        if (e > best.e || (e === best.e && remain < best.remain)) best = { n, e, remain };
      }
      // 可能な限りまとめて通常曲を行い、上限に達した場合のみイベント曲を連続消費。
      let n = best.n, e = best.e, guard = 0;
      while ((n > 0 || e > 0) && guard++ < 10000) {
        if (n > 0) {
          if (inv + manualGainAt() <= ITEM_CAP) { if (!gainNormal(false)) break; n--; continue }
          // アイテム上限回避: 必要な空きができるまでイベント曲をまとめて実行。
          const needed = Math.ceil((inv + manualGainAt() - ITEM_CAP) / ITEM_COST);
          if (e < needed) break;
          for (let j = 0; j < needed; j++) { if (!playEvent(false)) break; e-- }
          continue;
        }
        if (e > 0) { if (!playEvent(false)) break; e-- }
      }
    }
    if (!isFull && !errors.length && day < s.days - 1) {
      const sleepNeed = day < s.days - 1 ? Math.min(ITEM_CAP, (fixedSleepRuns === null ? Math.floor(sleepReserveItems(sleepTarget - bedAt) * sleepPercent / 100 / ITEM_COST) : Math.min(fixedSleepRuns, Math.floor(sleepReserveItems(sleepTarget - bedAt) / ITEM_COST))) * ITEM_COST) : 0; // v35
      let guard = 0;
      // 通常曲を上限付近までまとめて実行 → イベント曲を連続実行。
      // 就寝用アイテムを貯める最終フェーズではイベント曲に切り替えない。
      let phaseMode = 'collect';
      while (free > 0 && guard++ < 6000) {
        // 残り4時間以内に入ったら、端数が数分になる前に整数回数を最適化する。
        // 旧処理は残り1時間まで貯蓄・消費を続けてしまい、曲1回未満の
        // 余りを確定させていた。イベント曲を連続消費→通常曲を連続補充する。
        // アイテム不足のまま4時間圏内に入る日も最適化対象にする。
        // 以前の「inv >= sleepNeed」条件は、補充中の日を除外して
        // 最後の端数だけを残す原因になっていた。
        // 必要アイテムを集めるだけの時間がない段階で探索しても、
        // 全候補が失敗する。最適化の空振りを抑え、通常の補充を優先する。
        const optimisticGain = Math.max(...TABLE[song[2]]);
        const minimumCollectSeconds = Math.max(0, Math.ceil((sleepNeed - inv) / optimisticGain)) * normalManual;
        if (free <= 14400 && free >= minimumCollectSeconds) {
          // 上限付近で停止しないよう「通常曲→イベント曲→通常曲」の
          // 3段階を比較する。各段階のアイテム上限と就寝用残数を検証する。
          // 探索に解がなければ従来のプレイループに戻す。
          const maxN = Math.floor(free / normalManual);
          const maxE = Math.floor(free / eventManual);
          const gainStart = gainSchedule.total(manualNormal);
          let best = { first: 0, e: 0, last: 0, seconds: 0 };
          for (let first = 0; first <= maxN; first++) {
            const firstSeconds = first * normalManual;
            if (firstSeconds > free) break;
            const firstItems = inv + gainSchedule.total(manualNormal + first) - gainStart;
            if (firstItems > ITEM_CAP) break;
            const eventLimit = Math.min(
              Math.floor((free - firstSeconds) / eventManual),
              Math.floor(firstItems / ITEM_COST)
            );
            for (let e = 0; e <= eventLimit; e++) {
              const spentSeconds = firstSeconds + e * eventManual;
              const afterEvent = firstItems - e * ITEM_COST;
              const lastLimit = Math.floor((free - spentSeconds) / normalManual);
              // 最後の通常曲を最大回数に固定せず、上限・就寝用残数を満たす
              // 最大の回数を探索する（回数が増えるほどアイテムも増加）。
              let lo = 0, hi = lastLimit;
              while (lo < hi) {
                const mid = Math.ceil((lo + hi) / 2);
                const gained = gainSchedule.total(manualNormal + first + mid) -
                  gainSchedule.total(manualNormal + first);
                if (afterEvent + gained <= ITEM_CAP) lo = mid;
                else hi = mid - 1;
              }
              const last = lo;
              const endingItems = afterEvent + gainSchedule.total(manualNormal + first + last) -
                gainSchedule.total(manualNormal + first);
              if (endingItems < sleepNeed) continue;
              const seconds = spentSeconds + last * normalManual;
              if (seconds > best.seconds || (seconds === best.seconds && e > best.e)) {
                best = { first, e, last, seconds };
              }
            }
          }
          window.__nogifesOptimizationTrace.push({
            day: day + 1, freeBefore: free, itemsBefore: inv, sleepNeed,
            maxNormal: maxN, maxEvent: maxE,
            selectedNormalBefore: best.first, selectedEvent: best.e,
            selectedNormalAfter: best.last, selectedSeconds: best.seconds,
            status: best.seconds > 0 ? '候補採用予定' : '候補なし'
          });
          if (best.seconds > 0) {
            // 探索で検証した順番のまま実行し、失敗した場合は
            // 早期終了させず既存ループに処理を戻す。
            let completed = true;
            for (let j = 0; j < best.first; j++) if (!gainNormal(false)) { completed = false; break; }
            if (completed) for (let j = 0; j < best.e; j++) if (!playEvent(false)) { completed = false; break; }
            if (completed) for (let j = 0; j < best.last; j++) if (!gainNormal(false)) { completed = false; break; }
            window.__nogifesOptimizationTrace[window.__nogifesOptimizationTrace.length - 1].status =
              completed ? '実行完了' : '実行途中で失敗・通常ループへ';
            if (completed) break;
          }
        }
        const nextGain = manualGainAt();
        const canNormal = inv + nextGain <= ITEM_CAP;
        const canEvent = inv >= ITEM_COST;
        const remainingCollect = Math.max(0, Math.ceil((sleepNeed - inv) / Math.max(1, nextGain)));
        const reserveTime = remainingCollect * normalManual;
        // イベント曲の一括消費が終わったら就寝用のアイテムを集める。
        // 通常曲とイベント曲を1回ずつ交互に切り替えることはしない。
        const finalCollect = day < s.days - 1 && (phaseMode === 'final' || (phaseMode === 'spend' && free <= reserveTime + eventManual));
        if (finalCollect) {
          phaseMode = 'final';
          if (inv >= sleepNeed) {
            // 余り時間が長い場合も、イベント曲を先にまとめて消費して
            // 就寝用のアイテムを回復できる組合せを探す。
            const maxN = Math.floor(free / normalManual);
            const maxE = Math.min(Math.floor(free / eventManual), Math.floor(inv / ITEM_COST));
            let best = { n: 0, e: 0, seconds: 0 };
            const gainStart = gainSchedule.total(manualNormal);
            for (let e = 0; e <= maxE; e++) {
              const afterEvent = inv - e * ITEM_COST;
              for (let n = 0; n <= maxN; n++) {
                const seconds = e * eventManual + n * normalManual;
                if (seconds > free) break;
                const afterNormal = afterEvent + gainSchedule.total(manualNormal + n) - gainStart;
                if (afterNormal < sleepNeed || afterNormal > ITEM_CAP) continue;
                if (seconds > best.seconds || (seconds === best.seconds && e > best.e)) best = { n, e, seconds };
              }
            }
            for (let j = 0; j < best.e; j++) playEvent(false);
            for (let j = 0; j < best.n; j++) gainNormal(false);
            break;
          }
          if (canNormal) { gainNormal(false); continue }
          // 上限付近で通常曲を追加できない場合、イベント曲をまとめて消費し、
          // 通常曲を連続補充して就寝用残数に戻せる組合せを探す。
          const remainingNormal = Math.floor(free / normalManual);
          const remainingEvent = Math.min(Math.floor(free / eventManual), Math.floor(inv / ITEM_COST));
          let recovery = null;
          for (let e = 1; e <= remainingEvent; e++) {
            const afterEvent = inv - e * ITEM_COST;
            for (let n = 1; n <= remainingNormal; n++) {
              const duration = e * eventManual + n * normalManual;
              if (duration > free) break;
              const afterNormal = afterEvent + gainSchedule.total(manualNormal + n) - gainSchedule.total(manualNormal);
              if (afterNormal < sleepNeed || afterNormal > ITEM_CAP) continue;
              if (!recovery || duration > recovery.duration) recovery = {e,n,duration};
            }
          }
          if (recovery) {
            for (let j = 0; j < recovery.e; j++) playEvent(false);
            for (let j = 0; j < recovery.n; j++) gainNormal(false);
          } else if (inv >= sleepNeed && canEvent && free >= eventManual) {
            // 最終補充が不要ならイベント曲を続けられる場合がある。
            // 就寝用残数を減らす場合は実行しない。
            if (inv - ITEM_COST >= sleepNeed) playEvent(false);
          }
          break;
        }
        if (phaseMode === 'collect') {
          if (canNormal) { gainNormal(false); continue }
          phaseMode = 'spend';
        }
        if (phaseMode === 'spend') {
          if (canEvent) {
            // 最後のイベント曲まで連続で消費し、次の通常曲フェーズへ移る。
            playEvent(false);
            if (inv < ITEM_COST) phaseMode = 'collect';
            continue;
          }
          phaseMode = 'collect';
          if (canNormal) { gainNormal(false); continue }
          break;
        }
      }

    }
    // 就寝用アイテムの確保後も、残りの手打ち時間を使い切れる組合せを探す。
    // 先にイベント曲をまとめて消費し、続けて通常曲で補充するため、
    // 通常曲とイベント曲を1回ずつ交互にするループは作らない。
    if (!isFull && !errors.length && day < s.days - 1 && free >= Math.min(normalManual, eventManual)) {
      const sleepNeed = day < s.days - 1 ? Math.min(ITEM_CAP, (fixedSleepRuns === null ? Math.floor(sleepReserveItems(sleepTarget - bedAt) * sleepPercent / 100 / ITEM_COST) : Math.min(fixedSleepRuns, Math.floor(sleepReserveItems(sleepTarget - bedAt) / ITEM_COST))) * ITEM_COST) : 0; // v35
      const maxNormals = Math.min(250, Math.floor(free / normalManual));
      const maxEvents = Math.min(114, Math.floor(free / eventManual), Math.floor(inv / ITEM_COST));
      let best = { n: 0, e: 0, seconds: 0 };
      // イベント曲を先に消費するので、現在の所持数を超えて使わない。
      // 補充後の所持数が上限以内かつ就寝用必要数以上になる案だけ採用。
      for (let e = 0; e <= maxEvents; e++) {
        const afterEvents = inv - e * ITEM_COST;
        for (let n = 0; n <= maxNormals; n++) {
          const seconds = e * eventManual + n * normalManual;
          if (seconds > free) break;
          const afterCollect = afterEvents + gainSchedule.total(manualNormal + n) - gainSchedule.total(manualNormal);
          if (afterCollect < sleepNeed || afterCollect > ITEM_CAP) continue;
          if (seconds > best.seconds || (seconds === best.seconds && e > best.e)) best = { n, e, seconds };
        }
      }
      for (let j = 0; j < best.e; j++) playEvent(false);
      for (let j = 0; j < best.n; j++) gainNormal(false);
    }
      // 旧方式: 最適化後に残った端数も、アイテム条件を満たす曲があれば消化する。
      // 就寝用の必要個数を割るイベント曲は実行しない。
      if (!isFull && !errors.length) {
        const reserve = 0; // v33
        let guard = 0;
        while (free >= Math.min(normalManual, eventManual) && guard++ < 1000) {
          if (free >= eventManual && inv >= ITEM_COST && inv - ITEM_COST >= reserve) {
            if (!playEvent(false)) break;
          } else if (free >= normalManual && inv + manualGainAt() <= ITEM_CAP) {
            if (!gainNormal(false)) break;
          } else break;
        }
      }
    } // 時刻指定ではない旧データの時間配分処理ここまで
    // 最後の曲が就寝予定時刻を超えた場合、実際の就寝開始をその終了時刻に調整。
    // 時刻指定BGは「曲ごとの所要時間合計」ではなく、実時刻カーソルで判定する。
    // BG枠の重複や曲完走による食い込みを二重計上しない。
    const summedDaytimeUsed = bgNormalSeconds + manualNormalSeconds + manualEventSeconds +
      (bgEventSeconds - sleepEventSeconds) + lossSeconds;
    const daytimeUsed = useClockSlots && actualDaytimeEnd !== null
      ? Math.max(0, actualDaytimeEnd - start) + lossSeconds : summedDaytimeUsed;
    const songOverrun = Math.max(normalBg, eventBg, normalManual, eventManual);
    if (daytimeUsed > awakeAvailable + songOverrun)
      errors.push(`${day + 1}日目：日中の実行時間が活動可能時間を超えています（当日使用${fmt(daytimeUsed)}、当日活動可能${fmt(awakeAvailable)}、超過${fmt(daytimeUsed - awakeAvailable)}）。バクグラの時間帯を確認してください`);
    const adjustedBedAt = day === s.days - 1 ? null : Math.max(bedAt, start + daytimeUsed); // v34: 就寝BGの開始基準
    // 就寝中114回に必要な99,750個を確保できなければ計算を成立させない。
    // アイテム上限を超えるような仮想的な補充は行わない。
    if (day < s.days - 1 && !errors.length) {
      const sleepSpan = sleepTarget - adjustedBedAt;
      const requiredRuns = Math.ceil((sleepSpan + 15) / eventBg);
      if (requiredRuns > 0 && requiredRuns <= 114) {
        const requiredItems = requiredRuns * ITEM_COST;
      }
    }
    let sleepAvailable = 0, sleepEnd = null;
    if (day < s.days - 1 && !errors.length) {
      if (sleepTarget <= adjustedBedAt) errors.push('起床時刻は就寝時刻より後にしてください');
      else {
        sleepAvailable = sleepTarget - adjustedBedAt;
        // v33: 就寝BGは開始時の所持アイテムをすべて使える範囲で回す。
        // 起床時刻を超えない回数に制限し、途中終了後は起床まで待機。
        // 通常曲BGによる就寝中の補充は行わない。
        const timeRuns = Math.max(0, Math.floor((sleepAvailable + 15) / eventBg));
        // v59: 固定回数候補は実行時にもその回数を上限とする。
        // v58以前は113回候補でも実行時に114回まで回り、候補の差が消えていた。
        const policyRunCap = fixedSleepRuns === null ? 114 : fixedSleepRuns;
        const count = Math.min(policyRunCap, timeRuns, Math.floor(inv / ITEM_COST));
        {
          sleepEventRuns = count;
          phase = 1;
          sleepEventSeconds = count > 0 ? count * eventBg - 15 : 0;
          for (let j = 0; j < count && !errors.length; j++) {
            const elapsed = j === count - 1 ? s.eventSeconds : eventBg;
            if (!playEvent(true, elapsed)) errors.push('就寝中イベント曲BGを実行できません');
          }
          sleepEnd = sleepTarget; // BGが早期終了しても設定起床時刻まで待機する
        }
      }
    }
    if (day < s.days - 1 && sleepEnd !== null) previousSleepEnd = sleepEnd;
    if (inv < 0 || inv > ITEM_CAP) errors.push('アイテム上限エラー');
    totalPt += points; totalItems += spent; totalTime += used;
    days.push({      
log, points, earned, spent, inv, normalRuns, eventRuns, manualNormal, manualEvent,
      bgNormalSeconds, bgEventSeconds, sleepEventSeconds, sleepEventRuns, manualNormalSeconds, manualEventSeconds,
      confirmed: d.confirmed, errors, awakeAvailable, sleepAvailable, daytimeUsed, dayStart: start, dayEnd: day < s.days - 1 ? sleepEnd : Math.max(finalClockEnd, start + daytimeUsed),
      adjustedBedAt, lossSeconds, idleSeconds: Math.max(0, awakeAvailable - daytimeUsed)    
});
    if (errors.length || (stopAfterDay !== null && day >= stopAfterDay)) break;
  }
  return { days, totalPt, totalItems, totalTime, valid: days.length === s.days && days.every(d => d.errors.length === 0), eventWindow: s.days * 86400 - 54000 };
}

// v22: 複数の実行可能な計画を全イベント期間で再生し、
// 実際のptを最優先、同ptなら未使用秒、さらに同値なら最終在庫で比較。
// 各日のBG・就寝設定と確定済み日付は全候補で共通。
// 厳密な全探索ではなく、候補方針を増やした近似探索。
function simulate(stopAfterDay = null) {
  const policies = ['carrySleep113', 'activeSleep113', 'balancedSleep113', 'fillSleep113', 'carrySleep112', 'activeSleep112', 'balancedSleep112', 'carrySleep111', 'activeSleep111', 'carrySleep110', 'activeSleep110', 'carrySleep108', 'activeSleep108', 'carrySleep105', 'activeSleep105', 'carrySleep100', 'activeSleep100', 'carry', 'fill', 'tight', 'balanced', 'flexible', 'reserve', 'active', 'activeReserve', 'carry|sleep100', 'balanced|sleep100', 'active|sleep100', 'fill|sleep100', 'carry|sleep50', 'active|sleep50', ...[90,94,96,97,98,99].flatMap(p => ['carry','balanced','active'].map(mode => `${mode}|sleep${p}`))];
  const idle = r => r.days.reduce((n,d) => n + (d.idleSeconds || 0), 0);
  const lastInv = r => r.days.length ? r.days[r.days.length - 1].inv : Infinity;
  const eligible = r => r.days.length > 0 && r.days.every(d => !d.errors?.length) &&
    (stopAfterDay !== null || r.valid);
  let winner = null, winningTrace = [], winnerPolicy = '', fallback = null, fallbackTrace = [];
  const candidateFailures = [];
  const candidateComparisons = [];
  for (const policy of policies) {
    let candidate;
    try { candidate = simulateCandidate(stopAfterDay, policy); }
    catch (err) {
      candidateFailures.push({policy, day: '?', message: `JavaScript例外: ${err?.stack || err}`});
      continue;
    }
    const trace = window.__nogifesOptimizationTrace || [];
    if (!candidate.valid && stopAfterDay === null) {
      const failed = candidate.days.findIndex(d => (d.errors || []).length);
      candidateFailures.push({policy, day: failed >= 0 ? failed + 1 : candidate.days.length + 1,
        message: failed >= 0 ? candidate.days[failed].errors.join(' / ') : '計算結果が途中で終了',
        start: candidate.days.at(-1)?.dayStart, end: candidate.days.at(-1)?.dayEnd,
        inv: candidate.days.at(-1)?.inv});
    }
    // 失敗した候補でも、最も先の日付まで進んだ結果を残す。
    // 以前は最初の失敗候補だけを採用し、3日目の原因が表示されなかった。
    if (!fallback || candidate.days.length > fallback.days.length ||
        (candidate.days.length === fallback.days.length &&
         candidate.days.at(-1)?.errors?.length < fallback.days.at(-1)?.errors?.length)) {
      fallback = candidate; fallbackTrace = trace;
    }
    candidateComparisons.push({
      policy, valid: eligible(candidate), days: candidate.days.length,
      firstFrozen: Boolean(candidate.days[0]?.fromSnapshot),
      totalPt: candidate.totalPt, firstIdle: candidate.days[0]?.idleSeconds ?? null,
      firstSleepRuns: candidate.days[0]?.sleepEventRuns ?? null,
      firstSleepAvailable: candidate.days[0]?.sleepAvailable ?? null,
      firstSleepBgSeconds: candidate.days[0]?.sleepEventSeconds ?? null,
      firstInv: candidate.days[0]?.inv ?? null, totalIdle: idle(candidate),
      finalInv: lastInv(candidate),
      errors: candidate.days.flatMap((d,i) => (d.errors || []).map(e => `${i+1}日目: ${e}`)).join(' / ')
    });
    if (!eligible(candidate)) continue;
    const sleepRuns = r => r.days.reduce((n, d) => n + (d.sleepEventRuns || 0), 0);
    let better = !winner;
    if (winner) {
      const diff = sleepRuns(candidate) - sleepRuns(winner);
      // v54: 以前は就寝BG回数差が大きいだけで、総獲得ptが低い候補に
      // 無条件で切り替わる場合があった。全期間のptを最優先し、
      // 同ptの場合のみ未使用時間、就寝BG回数、残アイテムで比較する。
      // v56: prevent an almost-equivalent total-pt plan from wasting two hours on day one.
      // One idle hour has a small penalty, capped at 0.15% of total points, so points
      // remain the priority for materially different plans.
      // v58: 2時間の待機を選ぶ原因は114回BG用の99,750個を
      // 先に固定し、2時間で消費→補充しても必要残数に戻せないこと。
      // 113回などの候補を全日ptと待機時間の両方で比較する。
      // 15分の空白をイベント曲手打ち1回分の機会損失として評価。
      // ただし、長時間の空白だけで大幅にptが低い候補を採用しないよう上限を設定。
      // v73: 初日だけでなく最終日までの未使用秒数を評価する。
      // ただし獲得ptを大幅に犠牲にしないよう、最大10曲分の重みとする。
      const penalty = r => Math.min(eventPt(s.bonus + 144) * 10,
        idle(r) / 900 * eventPt(s.bonus + 144));
      const sleepShortfall = r => r.days.reduce((sum, d, i) => {
        if (i === s.days - 1 || !(d.sleepAvailable > 0)) return sum;
        const cycle = s.eventSeconds + 15;
        const maximum = Math.min(114, Math.floor((d.sleepAvailable + 15) / cycle));
        return sum + Math.max(0, maximum - (d.sleepEventRuns || 0));
      }, 0);
      // Missing overnight plays are a real loss of event points, not idle daytime.
      // Penalize each omitted feasible run so a daytime-only candidate cannot win
      // merely because its overnight inventory was spent before bedtime.
      const score = r => r.totalPt - penalty(r) - sleepShortfall(r) * eventPt(s.bonus);
      better = score(candidate) > score(winner) + 0.0001 ||
        (Math.abs(score(candidate) - score(winner)) < 0.0001 && candidate.totalPt > winner.totalPt) ||
        (Math.abs(score(candidate) - score(winner)) < 0.0001 && candidate.totalPt === winner.totalPt && idle(candidate) < idle(winner)) ||
        (Math.abs(score(candidate) - score(winner)) < 0.0001 && candidate.totalPt === winner.totalPt && idle(candidate) === idle(winner) && diff > 0) ||
        (Math.abs(score(candidate) - score(winner)) < 0.0001 && candidate.totalPt === winner.totalPt && idle(candidate) === idle(winner) && diff === 0 && lastInv(candidate) < lastInv(winner));
    }
    if (better) {
      winner = candidate;
      winningTrace = trace;
      winnerPolicy = policy;
    }
  }
  const result = winner || fallback || {days:[],totalPt:0,totalItems:0,totalTime:0,valid:false,eventWindow:s.days*86400-54000};
  window.__nogifesCandidateComparisons = candidateComparisons;
  result.candidateComparisons = candidateComparisons;
  result.optimizationSummary = {
    policy: winnerPolicy,
    totalIdleSeconds: idle(result),
    dailyIdleSeconds: result.days.map(d => d.idleSeconds || 0),
    totalPt: result.totalPt,
    confirmedDays: result.days.filter(d => d.fromSnapshot).length
  };
  window.__nogifesCandidateFailures = candidateFailures;
  result.candidateFailures = candidateFailures;
  window.__nogifesOptimizationTrace = winner ? winningTrace : fallbackTrace;
  window.__nogifesOptimizationTrace.push({day:'全体',
    status:'v50：途中計測キャッシュ分離・全日予測診断・採用=' + (winnerPolicy || '計算エラー') + (result?.days?.at(-1)?.errors?.length ? '／' + result.days.at(-1).errors.join('／') : ''),
    freeBefore:idle(result), itemsBefore:lastInv(result)});
  return result;
}

// 診断専用。シミュレーション結果は変更せず、日別の実行履歴をCSVに書き出す。
function downloadSimulationDiagnostics() {
  const result = cachedSimulation();
  const song = SONGS[s.song] || SONGS[0];
  const normalManual = song[1] + s.network;
  const eventManual = s.eventSeconds + s.network + 1;
  const headers = [
    '日','日付','記録種別','連番','フェーズ','曲','方式','所要秒',
    '開始からの累積秒','獲得アイテム','消費アイテム','操作後アイテム',
    '獲得pt','活動可能秒','日中使用秒','日中未使用秒',
    '手打ち通常回数','手打ちイベント回数','就寝バクグラ回数',
    '就寝用必要アイテム','就寝開始予定秒','実際の就寝開始秒',
    '翌日開始秒','ロス秒','エラー'
  ];
  const rows = [headers];
  const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  let previousInv = 0;
  for (let i = 0; i < result.days.length; i++) {
    const day = result.days[i];
    const setting = predictionData(i);
    const log = Array.isArray(day.log) ? day.log : [];
    const initialInv = previousInv;
    let inv = initialInv, elapsed = 0;
    const wake = sec(setting.wake);
    const bedAt = day.adjustedBedAt == null ? null : (i * 86400 + sec(setting.bedtime));
    const required = 0; // v33: 就寝時の固定必要アイテムは廃止
    const base = [i + 1, jp(dateAt(i))];
    const metrics = [
      day.awakeAvailable, day.daytimeUsed, day.idleSeconds,
      day.manualNormal, day.manualEvent, day.sleepEventRuns,
      required, bedAt, day.adjustedBedAt, day.dayEnd,
      day.lossSeconds, (day.errors || []).join(' / ')
    ];
    rows.push([...base,'日別概要',0,'','','',0,0,0,0,initialInv,0,...metrics]);
    for (let j = 0; j < log.length; j++) {
      const entry = log[j];
      const [kind, bg, seconds, itemDelta, points, phase] = entry;
      elapsed += seconds;
      inv += itemDelta;
      rows.push([...base,'プレイ',j + 1,phase === 1 ? '就寝中' : '日中',
        kind === 'n' ? '通常曲' : 'イベント曲',
        bg ? 'バクグラ' : '手打ち',
        seconds,elapsed,
        itemDelta > 0 ? itemDelta : 0,
        itemDelta < 0 ? -itemDelta : 0,
        inv,points,...metrics]);
    }
    rows.push([...base,'日別終了',log.length,'','','',0,elapsed,
      day.earned,day.spent,day.inv,day.points,...metrics]);
    previousInv = day.inv;
  }
  // 失敗候補もCSVに記録。これまでのCSVは成功した2日分しか出力していなかった。
  rows.push(['全体', '', '予測実行範囲', '', `開始=1日目 / 予定終了=${s.days}日目 / 実際=${result.days.length}日目 / 有効=${result.valid}`, '', '', '', '', '', '', result.days.at(-1)?.inv ?? '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  for (let i = 0; i < result.days.length; i++) {
    const d = result.days[i];
    rows.push([i+1, jp(dateAt(i)), '予測日別状態', '', `開始=${d.dayStart} / 終了=${d.dayEnd} / エラー=${(d.errors || []).join(' / ') || 'なし'}`, '', '', '', '', '', '', d.inv, '', '', '', '', '', '', '', '', '', '', '', '', '']);
  }
  // v60: すべての探索候補の結果を診断CSVに記録。
  for (const c of (result.candidateComparisons || [])) {
    rows.push(['全体', '', '候補比較', '', c.policy,
      c.firstFrozen ? '初日確定済み・再計算なし' : (c.valid ? '有効' : '無効'), c.days, c.firstIdle ?? '',
      c.firstSleepRuns ?? '', c.totalPt, c.firstInv ?? '',
      c.finalInv ?? '', c.totalIdle, '', '', '', '', '', '', '', c.errors || '']);
  }
  for (const failure of (result.candidateFailures || window.__nogifesCandidateFailures || [])) {
    rows.push([failure.day, '', '予測失敗候補', '', failure.policy, '', '',
      '', '', '', '', failure.inv ?? '', '', failure.start ?? '', failure.end ?? '',
      '', '', '', '', '', '', '', '', '', failure.message]);
  }
  for (const trace of (window.__nogifesOptimizationTrace || [])) {
    rows.push([trace.day, '', '最適化判定', '', trace.status, '', '',
      trace.freeBefore, '', '', '', trace.itemsBefore, '',
      trace.sleepNeed, trace.maxNormal, trace.maxEvent,
      trace.selectedNormalBefore, trace.selectedEvent, trace.selectedNormalAfter,
      trace.selectedSeconds]);
  }
  rows.push(['検証メモ','','全日合計','','','','',0,0,0,0,0,0,
    '', '',result.days.reduce((n,d)=>n+(d.idleSeconds||0),0)]);
  const finalDay = result.days[result.days.length - 1];
  if (finalDay && result.days.length === s.days) {
    rows.push(['検証メモ','','最終日残アイテム',finalDay.inv,
      'イベント曲消費個数',ITEM_COST,
      'イベント曲手打ち秒',eventManual,
      '日中未使用秒合計',finalDay.idleSeconds,
      '注記','v52：最終時刻までに開始した最後の曲は終了時刻超過でも完走']);
  }
  rows.push(['検証メモ','','通常曲手打ち秒',normalManual,'イベント曲手打ち秒',eventManual]);
  const content = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], {type:'text/csv;charset=utf-8'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'nogifes_simulation_diagnostics.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// キャッシュはページ内だけで保持し、更新時には必ず新しいコードで再計算する。
// 日別計測の simulate(day) は途中結果。全日程の予測キャッシュに混ぜない。
let simulationCacheSignature = null;
function currentSimulationSignature() {
  // s.day（表示中の日）や保存日時ではなく、計算に必要な設定のみを比較する。
  // 日付の切替・仮確定の変更・BG設定変更を自動検知する。
  return JSON.stringify({
    now: todayIndex(), start: s.start, days: s.days, mode: s.mode,
    song: s.song, network: s.network, eventSeconds: s.eventSeconds, bonus: s.bonus,
    daysData: s.daysData, todayOnlyMigrated: s.todayOnlyMigrated,
    snapshots: Object.fromEntries(Object.entries(s.snapshots || {})
      .filter(([day, record]) => record && Number(day) < todayIndex()))
  });
}
function cachedSimulation() {
  if (previewActive && freshPreview) return freshPreview;
  const signature = currentSimulationSignature();
  if (!simulationCache || simulationCache.partial || simulationCache.days.length < s.days || simulationCacheSignature !== signature) {
    simulationCache = simulate();
    simulationCache.partial = false;
    simulationCacheSignature = currentSimulationSignature();
  }
  return simulationCache;
}
// v62: 保存済みの確定日を一切変更せず、全日を一時的に再計算する。
function previewFromFirstDay() {
  const savedSnapshots = s.snapshots;
  const savedCache = simulationCache;
  const savedTrace = window.__nogifesOptimizationTrace;
  const savedFailures = window.__nogifesCandidateFailures;
  const savedComparisons = window.__nogifesCandidateComparisons;
  try {
    const current = simulationCache && !simulationCache.partial ? simulationCache : simulate();
    s.snapshots = {};
    simulationCache = null;
    const fresh = simulate();
    if (fresh.valid && fresh.days.length === s.days) freshPreview = fresh;
    const oldFirst = current.days?.[0];
    const newFirst = fresh.days?.[0];
    const fmtIdle = v => {
      const n = Math.max(0, Math.round(Number(v) || 0));
      return `${Math.floor(n / 3600)}時間${String(Math.floor(n % 3600 / 60)).padStart(2,'0')}分${String(n % 60).padStart(2,'0')}秒`;
    };
    const lines = [
      '【初日からの再計算プレビュー】',
      '確定データ・設定・保存内容は変更しません。',
      '',
      `現在の初日待機：${fmtIdle(oldFirst?.idleSeconds)}`,
      `再計算の初日待機：${newFirst ? fmtIdle(newFirst.idleSeconds) : '計算失敗'}`,
      `現在の初日就寝BG：${oldFirst?.sleepEventRuns ?? '不明'}回`,
      `再計算の初日就寝BG：${newFirst?.sleepEventRuns ?? '不明'}回`,
      `現在の全日pt：${current.totalPt?.toLocaleString('ja-JP') ?? '不明'}`,
      `再計算の全日pt：${fresh.totalPt?.toLocaleString('ja-JP') ?? '不明'}`,
      `再計算完了：${fresh.days.length}/${s.days}日`,
      `再計算の判定：${fresh.valid ? '成功' : 'エラーあり'}`
    ];
    if (!fresh.valid) {
      lines.push(...(fresh.candidateFailures || []).slice(0,3).map(x =>
        `${x.policy}（${x.day}日目）：${x.message}`));
    }
    if (fresh.valid && fresh.days.length === s.days) {
      lines.push('', '「OK」を押すと再計算プレビューを表示します。');
      previewActive = true;
    }
    alert(lines.join('\n'));
  } catch (err) {
    alert('再計算プレビューでエラー：' + (err?.message || String(err)));
  } finally {
    s.snapshots = savedSnapshots;
    simulationCache = savedCache;
    window.__nogifesOptimizationTrace = savedTrace;
    window.__nogifesCandidateFailures = savedFailures;
    window.__nogifesCandidateComparisons = savedComparisons;
    if (previewActive && freshPreview) {
      page = 'result';
      render();
    }
  }
}
function renderResult() { if (s.mode === 'fullBackground') return renderFullBgResult();
  const hasComparison = (() => { try { return !!localStorage.getItem(comparisonKey()); } catch (_) { return false; } })();
  const previewToolbar = previewActive && freshPreview
    ? panel('再計算プレビュー表示中',
        '<p class="note">元の確定データは変更しません。Resultとシミュレーションは再計算結果を表示中です。</p>' +
        '<button class="primary wide" data-action="saveFreshComparison">再計算結果を別保存</button>' +
        '<button class="ghost wide" data-action="exitFreshPreview">保存済みの確定結果に戻す</button>')
    : (hasComparison ? panel('再計算結果の比較保存',
        '<p class="note">確定結果とは別に保存した再計算結果を確認できます。</p>' +
        '<button class="ghost wide" data-action="loadFreshComparison">別保存した再計算結果を表示</button>' +
        '<button class="ghost wide" data-action="deleteFreshComparison">比較用の保存結果を削除</button>') : '');
 const r = cachedSimulation(); const selectedDay = r.days[s.day]; const selectedHasError = !selectedDay || (selectedDay.errors || []).length > 0; if (selectedHasError) { const current = r.days[s.day] || s.snapshots?.[s.day]; const warnings = r.days.flatMap((d, i) => (d.errors || []).map(msg => `<p class="error">${i + 1}日目（予測エラー）：${msg}</p>`)).join('') || `<p class="error">${s.day + 1}日目の予測データを生成できませんでした。前日までの設定・アイテム引継ぎを確認してください。</p>`;
    const failureDay = r.days.findIndex(x => (x.errors || []).length);
    const details = failureDay >= 0 ? r.days[failureDay] : r.days.at(-1);
    const firstFailure = (r.candidateFailures || []).find(x => x.day === s.day + 1) || (r.candidateFailures || [])[0];
    const diagnostic = `<p class="note">診断情報：計算済み ${r.days.length}/${s.days}日、失敗日 ${failureDay >= 0 ? failureDay + 1 : r.days.length + 1}日目、開始 ${details?.dayStart == null ? '不明' : fmt(details.dayStart)}、終了 ${details?.dayEnd == null ? '不明' : fmt(details.dayEnd)}、残アイテム ${details?.inv ?? '不明'}個</p>` + (firstFailure ? `<p class="error">計算候補 ${escapeAttr(firstFailure.policy)}：${escapeAttr(firstFailure.message)}</p>` : ''); return previewToolbar + panel('計測結果・予測状況', `${current ? row('選択日の獲得pt', num(current.points) + ' pt') + row('選択日の残りアイテム', num(current.inv) + ' 個') : ''}<p class="note">未来日の予測にエラーがあるため、イベント全体の合計は未確定です。当日の計測結果は保存されています。</p>${warnings}${diagnostic}<button class="ghost wide" data-action="previewFirstDay">初日から再計算（保存せず比較）</button><button class="ghost wide" data-action="downloadDiagnostics">診断CSVを保存</button><button class="primary wide" data-action="back">プレイ画面へ戻る</button>`, '!'); } const d = r.days[s.day], actual = todayIndex(); const list = r.days.map((x, i) => `<tr><td>${i + 1}日目（${jp(dateAt(i))}） <span class="pill ${!previewActive && Boolean(s.snapshots?.[i]) ? 'done' : ''}">${previewActive ? '再計算' : s.snapshots?.[i]?.finalized ? '本確定' : s.snapshots?.[i] ? '仮確定' : i === todayIndex() ? '未計測' : '予測'}</span></td><td>${num(x.points)} pt</td></tr>`).join(''); const bgNormal = d.bgNormalSeconds, bgEvent = d.bgEventSeconds, manual = d.manualNormalSeconds + d.manualEventSeconds; const sum = bgNormal + bgEvent + manual || 1; return previewToolbar + (!r.valid ? panel('未来日の予測に関する注意', '<p class="note">選択日の詳細は表示できますが、未来日の一部に計算エラーがあるため、以下の合計ptは計算済み日までの暫定値です。イベント全体の確定値ではありません。</p>' + r.days.flatMap((day, i) => (day.errors || []).map(msg => `<p class="error">${i + 1}日目：${msg}</p>`)).join(''), '!') : '') + panel(r.valid ? '総合結果' : '計算済み日までの暫定結果', `<div class="points">${num(r.totalPt)} pt</div>${row('使用アイテム数', num(r.totalItems) + ' 個')}${row('イベント終了時の残りアイテム数', num(r.days.at(-1).inv) + ' 個')}${row('イベント全体時間', fmt(r.eventWindow))}${row('実プレイ時間（合計）', fmt(r.totalTime))}${row('日中の未使用時間（合計）', fmt(r.days.reduce((v, x) => v + x.idleSeconds, 0)))}`, '▥') + panel('日別獲得ポイント', `<table class="table"><thead><tr><th>日付</th><th>獲得イベントpt</th></tr></thead><tbody>${list}</tbody></table>`, '▣') + panel('時間配分グラフ（選択日）', `<div class="stack"><span style="width:${bgNormal / sum * 100}%;background:#8721e4"></span><span style="width:${bgEvent / sum * 100}%;background:#19b5b8"></span><span style="width:${manual / sum * 100}%;background:#f068b4"></span></div><div class="legend"><span><i style="background:#8721e4"></i>通常バクグラ</span><span><i style="background:#19b5b8"></i>イベントバクグラ</span><span><i style="background:#f068b4"></i>手打ち</span></div>`, '▥') + datebar() + panel('選択日の時間枠', `${row('活動可能時間', fmt(d.awakeAvailable))}${row('ロス時間', fmt(d.lossSeconds || 0))}${row('日中の未使用時間', fmt(d.idleSeconds))}${row('実際の就寝開始', d.adjustedBedAt == null ? '—（最終日は就寝なし）' : fmt(d.adjustedBedAt % 86400))}${row('就寝中バクグラ', s.day === s.days - 1 ? '—（最終日は実施なし）' : fmt(d.sleepEventSeconds))}`, '◷') + panel('選択日のプレイ内訳', `<table class="table"><thead><tr><th>種類</th><th>回数</th><th>時間</th></tr></thead><tbody><tr><td>通常曲（バクグラ）</td><td>${num(d.normalRuns)} 回</td><td>${fmt(d.bgNormalSeconds)}</td></tr><tr><td>通常曲（手打ち）</td><td>${num(d.manualNormal)} 回</td><td>${fmt(d.manualNormalSeconds)}</td></tr><tr><td>イベント曲（バクグラ・日中）</td><td>${num(d.eventRuns - d.sleepEventRuns)} 回</td><td>${fmt(d.bgEventSeconds - d.sleepEventSeconds)}</td></tr><tr><td>イベント曲（バクグラ・就寝中）</td><td>${num(d.sleepEventRuns)} 回</td><td>${fmt(d.sleepEventSeconds)}</td></tr><tr><td>イベント曲（手打ち）</td><td>${num(d.manualEvent)} 回</td><td>${fmt(d.manualEventSeconds)}</td></tr></tbody></table>`, '◷') + (d.errors.length ? panel('計算上の注意', d.errors.map(x => `<p class="error">${x}</p>`).join(''), '!') : '') + panel('アイテム収支', `${row('獲得アイテム数', num(d.earned) + ' 個')}${row('消費アイテム数', num(d.spent) + ' 個')}${row('残りアイテム数', num(d.inv) + ' 個')}`, '▧') + `<button class="ghost wide" data-action="previewFirstDay">初日から再計算（保存せず比較）</button><button class="ghost wide" data-action="downloadDiagnostics">計算ログをCSVで保存</button><p class="small">診断用：日別の未使用時間・アイテム残数・プレイ順序を確認できます。設定は変更されません。</p><button class="primary wide" data-action="back">❮ 戻る</button><p class="small">※数値は設定から算出するシミュレーション値です。日付の経過だけでは実プレイの獲得実績を検証できません。</p>` }
function renderHistory() { if (s.mode === 'fullBackground') return panel('セット履歴', '<p class="note">フルバクグラは225時間一括計算のため、日別セット履歴はありません。</p>'); return panel('セット履歴', `<p class="small">各日の計測確定状況です。</p><table class="table"><thead><tr><th>日付</th><th>状態</th></tr></thead><tbody>${Array.from({ length: s.days }, (_, i) => `<tr><td>${dayLabel(i)}</td><td>${i > todayIndex() ? '予測（編集不可）' : s.snapshots?.[i]?.finalized ? '本確定（変更不可）' : s.snapshots?.[i] ? '仮確定（変更可能）' : '未計測'}</td></tr>`).join('')}</tbody></table>`, '◷') }
function renderHelp() { return panel('使い方', `<p>① 初期設定でイベント日程・プレイ方法・楽曲・特攻値を設定します。</p><p>② 今日のプレイ画面でバクグラの種類・時間と精度を設定します。未来の日付は今日の設定から予測します。</p><p>③ 各項目の「決定」を押した後、「計測する」でその日の設定と結果を仮確定します。翌日になると本確定して変更できなくなります。</p><p>④ Resultでは当日は仮確定、翌日以降は本確定、未来日は予測として表示します。</p><p>⑤ イベント終了時は設定画面から「イベント終了」を押します。</p>`, '?') }
let wheelTarget = null;
function wheelOpen(target, index) {
  wheelTarget = { target, index }; const d = dayData(s.day);
  const value = target === 'eventSeconds' ? fmt(s.eventSeconds || 0)
    : target === 'activity' ? d.activities[index].duration
    : target === 'bgStart' ? (d.activities[index]?.startTime || '09:00') + ':00'
    : target === 'bgEnd' ? (d.activities[index]?.endTime || '10:00') + ':00'
    : target === 'wake' ? d.wake : d.bedtime + ':00';
  const a = value.split(':').map(Number);
  const hourMax = (target === 'wake' || target === 'bedtime' || target === 'bgStart' || target === 'bgEnd') ? 23 : 24;
  for (const [id, max, v] of [['wh', hourMax, a[0]], ['wm', 59, a[1]], ['ws', 59, a[2] || 0]]) {
    $(id).innerHTML = Array.from({ length: max + 1 }, (_, i) => `<option value="${i}" ${i === v ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`).join('');
  }
  $('wsWrap').classList.toggle('hidden', target === 'bedtime' || target === 'activity' || target === 'bgStart' || target === 'bgEnd');
  $('wheelTitle').textContent = target === 'bgStart' ? 'バクグラ開始時刻' : target === 'bgEnd' ? 'バクグラ終了時刻' : target === 'activity' ? 'バクグラ実行時間' : target === 'wake' ? '起床時刻' : target === 'bedtime' ? '就寝時刻' : 'イベント曲時間';
  $('wheelModal').hidden = false;
  // iOS/Androidで末尾の時刻が隠れないようネイティブ選択UIを使用。
  $('wh').scrollTop = 0;
}
function wheelSave() {
  const h = +$('wh').value, m = +$('wm').value, ss = +$('ws').value;
  const target = wheelTarget.target, clock = ['wake', 'bedtime', 'bgStart', 'bgEnd'].includes(target);
  if ((clock && h === 24) || (h === 24 && (m !== 0 || (!clock && target !== 'activity' && ss !== 0)))) { alert('24時間を選択した場合、分・秒は00にしてください'); return }
  const v = fmt(h * 3600 + m * 60 + (['bedtime', 'activity', 'bgStart', 'bgEnd'].includes(target) ? 0 : ss)), d = dayData(s.day);
  if (target === 'eventSeconds') {
    s.eventSeconds = h * 3600 + m * 60 + ss;
    // 手動で設定した起床時刻は変更しない。
    for (const day of Object.values(s.daysData)) {
      if (day && !day.wakeManual) { day.wake = autoWakeFromBedtime(day.bedtime || '00:00'); resetTab(day, 'sleep'); }
    }
  }
  else if (target === 'bgStart' || target === 'bgEnd') {
    if (!canEditDay()) { alert('この日のBG時間は編集できません'); return; }
    const index = wheelTarget.index, activity = d.activities[index];
    if (!activity) return;
    const field = target === 'bgStart' ? 'startTime' : 'endTime';
    const old = activity[field];
    activity[field] = v.slice(0, 5);
    if (s.day === 0 && clockSec(activity[field]) < 54000) {
      activity[field] = old;
      alert('初日のBG時刻は15:00以降に設定してください'); return;
    }
    // 開始・終了の片方だけを編集中の段階では重複判定しない。
    // 例: 09:00-10:00 を 18:00-19:00 に変更する際、
    // 開始を18:00にした瞬間の 18:00-翌10:00 を誤って確定扱いしない。
    // 両時刻を入力した後、項目の「決定」で検証する。
    activity.confirmed = false; resetTab(d, 'bg');
  }
  else if (target === 'activity') {
    const index = wheelTarget.index, old = d.activities[index].duration;
    d.activities[index].duration = v;
    const error = activityTimeError(d, index);
    if (error) { d.activities[index].duration = old; alert(error); return }
    d.activities[index].confirmed = false; resetTab(d, 'bg');
  } else if (target === 'wake' || target === 'bedtime') {
    if (target === 'bedtime') {
      d.bedtime = v.slice(0, 5);
      d.wake = autoWakeFromBedtime(d.bedtime);
      d.wakeManual = false;
    } else {
      d.wake = v;
      d.wakeManual = true;
    }
    resetTab(d, 'sleep'); resetTab(d, 'bg');
    // Revalidate all existing activity confirmations after the day length changes.
    if (allActivityTimeError(d)) d.activities.forEach(a => a.confirmed = false);
  }
  save(); $('wheelModal').hidden = true; render();
}
document.addEventListener('input', e => { const k = e.target?.dataset?.loss; if (!k) return; if (!canEditDay()) return; const d = editDayData(); const h = document.querySelector('[data-loss="hours"]'); const m = document.querySelector('[data-loss="minutes"]'); if (!h || !m) return; const hours = Math.min(23, Math.max(0, Number(h.value) || 0)), minutes = Math.min(59, Math.max(0, Number(m.value) || 0)); d.lossMinutes = hours * 60 + minutes; resetTab(d, 'loss'); save() });
// 計測中表示：重い同期計算を始める前にブラウザへ描画機会を渡す。
let measurementBusy = false;
function showMeasurementLoading(message = '計算中です…') {
  let overlay = document.getElementById('measurementLoading');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'measurementLoading';
    overlay.className = 'measurement-loading';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="measurement-loading-dialog"><div class="measurement-spinner" aria-hidden="true"></div><h2 id="measurementLoadingTitle">計算中です…</h2><p>イベントの計算と再生データを準備しています。完了後、自動的にResultへ移動します。</p></div>';
    document.body.appendChild(overlay);
  }
  overlay.querySelector('#measurementLoadingTitle').textContent = message;
  overlay.hidden = false;
  document.body.setAttribute('aria-busy', 'true');
}
function hideMeasurementLoading() {
  const overlay = document.getElementById('measurementLoading');
  if (overlay) overlay.hidden = true;
  document.body.removeAttribute('aria-busy');
}
function measureWithLoading(action) {
  if (measurementBusy) return;
  measurementBusy = true;
  showMeasurementLoading();
  // 二段階の描画待ちによりローディングを画面へ反映してから計算する。
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
    try { action(); }
    catch (error) {
      console.error('計測処理エラー:', error);
      alert('計測処理でエラーが発生しました。\n' + (error?.message || String(error)));
    }
    finally { measurementBusy = false; hideMeasurementLoading(); }
  }, 0)));
}
document.addEventListener('click', e => {  
if (measurementBusy) { e.preventDefault(); return; }
const pt = e.target.closest('[data-play-tab]'); if (pt) { playTab = pt.dataset.playTab; render(); return } const wheel = e.target.closest('[data-wheel]'); if (wheel) { if (page === 'play' && !canEditDay()) return; wheelOpen(wheel.dataset.wheel, +wheel.dataset.index || 0); return } const nav = e.target.closest('[data-page]'); if (nav) { if (nav.dataset.page === 'result' && s.mode !== 'fullBackground') { const check = cachedSimulation(); if (!check.valid && s.day <= todayIndex()) { const failedIndex = check.days.findIndex(d => (d.errors || []).length);
            const failure = failedIndex >= 0 ? check.days[failedIndex] : null;
            alert(`計算が成立しないためResultへ移動できません（${failedIndex >= 0 ? failedIndex + 1 + '日目' : '日付不明'}）。\n` + (failure?.errors.join('\n') || 'バクグラ設定を確認してください')); return } } page = nav.dataset.page; render(); return } const b = e.target.closest('[data-action]'); if (!b) return; const act = b.dataset.action; if (act === 'saveFreshComparison') { saveComparison(); return; }
  if (act === 'loadFreshComparison') { loadComparison(); return; }
  if (act === 'deleteFreshComparison') {
    if (confirm('比較用の再計算結果だけを削除しますか？ 確定データは残ります。')) {
      localStorage.removeItem(comparisonKey()); render();
    }
    return;
  }
  if (act === 'exitFreshPreview') { previewActive = false; freshPreview = null; render(); return; }
  if (act === 'previewFirstDay') { previewFromFirstDay(); return; } if (act === 'downloadDiagnostics') { downloadSimulationDiagnostics(); return; }
  if (act === 'showBgDetail') { selectedBgDetail = Number(b.dataset.index); selectedBgDetailDay = s.day; render(); return; }
  if (act === 'closeBgDetail') { selectedBgDetail = null; render(); return; }
  if (page === 'play' && !canEditDay() && ['finishAccuracy', 'finishSleep', 'finishBg', 'finishLoss', 'confirmDay', 'activityMode', 'activityConfirm', 'addActivity', 'removeActivity'].includes(act)) return;
  if (act === 'measureFullBg') { measureWithLoading(() => { const result = simulateFullBackground(); if (!result.valid) { alert(result.error); return } s.fullBgResult = { ...result, settings: { song: s.song, eventSeconds: s.eventSeconds, bonus: s.bonus } }; save(); page = 'result'; render(); }); return }
  if (act === 'toggleTest') { switchMode(!testMode); return }
  if (act === 'testNextDay' || act === 'testSetDate') {
    if (!testMode) return;
    const old = s.testClock || localDayString(new Date());
    const target = act === 'testNextDay' ? localDayString(new Date(new Date(old + 'T12:00:00').getTime() + 86400000)) : $('testDate')?.value;
    if (!target || target <= old) { alert('現在より後の日付を選択してください'); return }
    const first = dateAt(0), before = new Date(target + 'T12:00:00');
    const lastIndex = Math.round((new Date(before.getFullYear(), before.getMonth(), before.getDate()) - first) / 86400000) - 1;
    freezeThrough(lastIndex); s.testClock = target; s.lastSeenDate = target; s.day = activeIndex(); save(); page = 'play'; render(); return;
  }
  if (act === 'resetTest') {
    if (!testMode || !confirm('テスト用データだけを初期化しますか？ 本番データは残ります。')) return;
    const copy = JSON.parse(localStorage.getItem(PROD_KEY) || JSON.stringify(defaults()));
    copy.testClock = copy.start || localDayString(new Date()); copy.snapshots = {}; copy.lastSeenDate = copy.testClock;
    s = { ...defaults(), ...copy }; save(); page = s.initialized ? 'settings' : 'setup'; render(); return;
  }
  const d = editDayData(), i = +b.dataset.index; if (page === 'play' && !canEditDay() && ['activityMode', 'activityConfirm', 'confirmDay', 'addActivity', 'removeActivity'].includes(act)) return; if (act === 'finishAccuracy') { if (s.mode === 'both' && d.accuracy.reduce((a, v) => a + v, 0) !== 100) { alert('精度の合計を100%にしてください'); return } tabDone(d).accuracy = true; save(); playTab = isFinalDay(s.day) ? 'bg' : 'sleep' } else if (act === 'finishSleep') { const err = s.day === s.days - 1 ? null : sleepScheduleError(d); if (err) { alert(err); return } tabDone(d).sleep = true; save(); playTab = 'bg' } else if (act === 'finishBg') { if (!isFinalDay(s.day) && !tabDone(d).sleep) { alert('先に起床・就寝時刻を確定してください'); playTab = 'sleep'; render(); return } const err = (s.day === s.days - 1 ? null : sleepScheduleError(d, true)) || allActivityTimeError(d); if (err) { alert('バクグラ設定不可：' + err); return } if (d.activities.some(a => activityDuration(a) > 0 && !a.confirmed)) { alert('バクグラ時間を設定した項目は、それぞれ「決定」を押してください'); return } tabDone(d).bg = true; save(); playTab = 'loss' } else if (act === 'finishLoss') { const available = activityAvailableSeconds(d); const bg = d.activities.reduce((v, a) => v + activityDuration(a), 0); if ((d.lossMinutes || 0) * 60 + bg > available) { alert('ロス時間とバクグラ時間の合計が活動可能時間を超えています'); return } tabDone(d).loss = true; save(); playTab = 'measure' } else if (act === 'measureDay') { rollover(); if (s.day > todayIndex()) { measureWithLoading(() => { page = 'result'; render(); }); return } if (!canEditDay()) { alert('この日の計測・変更はできません'); return } if (!['accuracy', 'bg', 'loss'].every(key => tabDone(d)[key]) || (!isFinalDay(s.day) && !tabDone(d).sleep)) { alert(isFinalDay(s.day) ? '精度・バクグラ時間・ロス時間を決定してください' : '4つの設定タブを決定してください'); return } const oldSnap = s.snapshots && s.snapshots[s.day]; if (oldSnap && oldSnap.finalized) { alert('本確定済みの日は再計測できません'); return } if (oldSnap) { delete s.snapshots[s.day]; simulationCache = null; } measureWithLoading(() => { const check = simulate(s.day); if (!check.days[s.day] || check.days[s.day].errors.length) { if (oldSnap) s.snapshots[s.day] = oldSnap; const failedIndex = check.days.findIndex(x => (x.errors || []).length > 0);
          const failure = failedIndex >= 0 ? check.days[failedIndex] : check.days[s.day];
          const failedDayLabel = failedIndex >= 0 ? `${failedIndex + 1}日目` : `${s.day + 1}日目`;
          alert(`計測できません（${failedDayLabel}）。\n` + (failure?.errors?.join('\n') || '設定を見直してください')); return } confirmMeasuredDay(s.day, check); simulationCache = null; page = 'result'; render(); }); return } else if (act === 'mode') { s.mode = b.dataset.value; save() } else if (act === 'network') { s.network = +b.dataset.value; save() } else if (act === 'prev') s.day = Math.max(0, s.day - 1); else if (act === 'next') s.day = Math.min(s.days - 1, s.day + 1); else if (act === 'addActivity') { const names = TYPES.filter(name => !d.activities.some(a => a.name === name)); const name = names[0] || `追加項目${d.activities.length + 1}`; d.activities.push(s.day === 0 ? {...newActivity(name), startTime:'15:00', endTime:'16:00'} : newActivity(name)); resetTab(d, 'bg'); save() } else if (act === 'removeActivity') { if (i > 0 && i < d.activities.length) { d.activities.splice(i, 1); resetTab(d, 'bg'); save() } } else if (act === 'activityMode') { d.activities[i].mode = b.dataset.value; d.activities[i].confirmed = false; resetTab(d, 'bg'); save() } else if (act === 'activityConfirm') { if (Number.isInteger(i) && i >= 0 && i < d.activities.length) { if (!d.activities[i].name.trim()) { alert('項目名を入力してください'); return } const error = activityTimeError(d, i); if (error) { alert(error); return } d.activities[i].confirmed = true; resetTab(d, 'bg'); save() } } else if (act === 'confirmDay') { if (s.mode === 'both' && d.accuracy.reduce((a, v) => a + v, 0) !== 100) { alert('精度の合計を100%にしてください'); return } if (d.activities.some(a => !a.name.trim())) { alert('バクグラ項目名を入力してください'); return } const timeError = allActivityTimeError(d); if (timeError) { alert(timeError); return } if (d.activities.some(a => activityDuration(a) > 0 && !a.confirmed)) { alert('実行時間を入力した項目は「決定」を押してください'); return } const check = simulate(); if (!check.valid) { const failure = check.days.find(x => x.errors.length); alert('設定したバクグラ時間を実行できないため確定できません。\n' + (failure?.errors.join('\n') || '設定を見直してください')); return } save(); alert('設定を保存しました。計測するを押すと結果が確定します') } else if (act === 'saveSettings') { if (!s.start) { alert('イベント開始日を入力してください'); return } if (!(s.song >= 0 && s.song < SONGS.length)) { alert('通常曲を選択してください'); return } if (!(s.eventSeconds > 0)) { alert('イベント曲時間を入力してください'); return } if (s.bonus === null || s.bonus === '' || !Number.isFinite(Number(s.bonus)) || s.bonus < 0 || s.bonus > 9999) { alert('特攻値は0～9999%で入力してください'); return } s.initialized = true; s.day = activeIndex(); save(); page = 'play' } else if (act === 'end') { $('confirmModal').hidden = false; return } else if (act === 'back') { page = 'play'; playTab = 'measure'; } render()
});
document.addEventListener('change', e => { const f = e.target.dataset.field; if (f) { if (f === 'start') s.start = e.target.value; else s[f] = f === 'bonus' && e.target.value === '' ? null : +e.target.value; save(); render() } const slotSide=e.target.dataset.slotTime;
  if(slotSide){if(!canEditDay())return;const d=editDayData(),idx=+e.target.dataset.index,a=d.activities[idx];if(!a)return;
    if(s.day===0 && clockSec(e.target.value)<54000){alert('初日は15:00以降の時刻を選択してください');render();return;}
    a[slotSide==='start'?'startTime':'endTime']=e.target.value;
    a.confirmed=false;resetTab(d,'bg');save();render();return;}
  const nameIndex = e.target.dataset.activityName; if (nameIndex !== undefined) { if (!canEditDay()) return; const d = dayData(s.day); const name = e.target.value.trim(); if (!name) { alert('項目名を入力してください'); render(); return } if (d.activities.some((a, i) => i !== +nameIndex && a.name === name)) { alert('同じ項目名は使用できません'); render(); return } d.activities[+nameIndex].name = name; d.activities[+nameIndex].confirmed = false; resetTab(d, 'bg'); save(); render(); return } const idx = e.target.dataset.accuracy; if (idx !== undefined) { if (!canEditDay()) return; const d = dayData(s.day); d.accuracy[+idx] = +e.target.value; resetTab(d, 'accuracy'); save(); render() } });
$('wheelCancel').onclick = () => $('wheelModal').hidden = true; $('wheelOk').onclick = wheelSave; $('endCancel').onclick = () => $('confirmModal').hidden = true; $('endOk').onclick = () => { localStorage.removeItem(KEY); s = defaults(); page = 'setup'; $('confirmModal').hidden = true; render() }; render();
(function () {
  const H = 44; let commits = []; const prev = wheelOpen;
  function build(id) {
    const sel = $(id), label = sel.parentElement;
    label.querySelectorAll('.wheel').forEach(n => n.remove());
    const wrap = document.createElement('div'); wrap.className = 'wheel';
    const sc = document.createElement('div'); sc.className = 'wheel-scroll'; sc.setAttribute('role', 'listbox');
    const n = sel.options.length, C = 9, mid = 4, frag = document.createDocumentFragment(), items = [];
    for (let k = 0; k < n * C; k++) { const b = document.createElement('div'); b.className = 'wheel-item'; b.textContent = sel.options[k % n].textContent; b.dataset.i = k; frag.appendChild(b); items.push(b) }
    sc.appendChild(frag);
    const band = document.createElement('div'); band.className = 'wheel-band';
    wrap.append(sc, band); label.appendChild(wrap);
    let timer = 0, raf = 0;
    let pl = 0, ph = -1;
    const paint = () => { raf = 0; const c = sc.scrollTop / H, lo = Math.max(0, Math.floor(c) - 4), hi = Math.min(items.length - 1, Math.ceil(c) + 4); for (let i = Math.min(lo, pl); i <= Math.max(hi, ph); i++) { const el = items[i]; if (!el) continue; if (i < lo || i > hi) { el.style.opacity = ''; el.style.transform = ''; el.classList.remove('on'); continue } const d = Math.max(-3, Math.min(3, i - c)), a = Math.abs(d); el.style.opacity = Math.max(.15, 1 - a * .3); el.style.transform = 'perspective(320px) rotateX(' + (-d * 24) + 'deg) scale(' + (1 - a * .04) + ')'; el.classList.toggle('on', a < .5) } pl = lo; ph = hi };
    const idx = () => Math.round(sc.scrollTop / H);
    const commit = () => { sel.selectedIndex = ((idx() % n) + n) % n };
    // 端に近づいたら、同じ数字の真ん中のセットへ静かに戻す（ぐるぐる回るホイール）
    const recenter = () => { const i = idx(); if (i < n * 3 || i >= n * 6) sc.scrollTop = (n * mid + ((i % n) + n) % n) * H };
    commits.push(commit);
    sc.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); clearTimeout(timer); timer = setTimeout(() => { commit(); recenter() }, 90) }, { passive: true });
    sc.addEventListener('click', e => { const t = e.target.closest('.wheel-item'); if (t) sc.scrollTo({ top: t.dataset.i * H, behavior: 'smooth' }) });
    sc.scrollTop = (n * mid + sel.selectedIndex) * H; paint();
  }
  wheelOpen = function (t, i) { prev(t, i); commits = [];['wh', 'wm', 'ws'].forEach(build) };
  // 決定を押した瞬間にも、ホイールの位置を確定してから保存する

  document.addEventListener('click', e => { if (e.target.closest('#wheelOk')) commits.forEach(f => f()) }, true);
})();
(function () {
  let raf = 0, tl = null, tlKey = '', T = 0, playing = false, last = 0, dur = 30, samples = [], maxInv = 1, winS = 0, winE = 1, dayIdx = -1, selDay = null, base = { pt: 0, n: 0, e: 0, nm: 0, em: 0 };
  const N = 480, q = id => document.getElementById(id);
  function buildMixed() {
    let r = cachedSimulation();
    // 未来日の予測エラーで全体がinvalidでも、計算済みの日の履歴は再生可能にする。
    if (!r || !Array.isArray(r.days) || !r.days.length) return null;
    // 計測済みの日は保存時点の結果で実行順が無い場合があるので、今の設定（精度・就寝～起床・バクグラ時間）で計算し直して使う
    let recomputed = false, staleFail = false;
    // 計測済みの日も、いまの設定（精度・就寝～起床・バクグラ時間）で計算し直して再生する
    // v41: 保存済み日の再シミュレーションは省略。計測時に確定した履歴を使用する。
    const song = SONGS[s.song] || SONGS[0], gain = TABLE[song[2]][5], origin = 54000;
    const seg = []; let t = 0, inv = 0, n = 0, e = 0, nm = 0, em = 0, p = 0, curDay = 0;
    const add = (type, d, delta, pg, label, cls, bg) => { if (!(d > 0)) return; seg.push({ t, d, type, i0: inv, i1: inv + delta, n, e, nm, em, p, pg, label, cls, day: curDay }); t += d; inv += delta; if (type === 'n') { if (bg) n++; else nm++ } else if (type === 'e') { if (bg) e++; else em++; p += pg } };
    // 旧データの確定済み日（実行順の記録なし）は回数から目安の順番を作る
    // 就寝前の手打ちは、交互にしないで「通常曲を上限まで→イベント曲をまとめて」のブロック順に並べる（回数と時間はそのまま）
    const reorderTail = (log, v0) => {
      let last = -1; log.forEach((a, k) => { if (a[1] === 1 && a[5] !== 1) last = k });
      const from = last + 1; let to = from; while (to < log.length && log[to][5] !== 1) to++;
      const tail = log.slice(from, to);
      if (tail.length < 2) return log;
      let v = v0; for (let k = 0; k < from; k++)v += log[k][3];
      const nq = tail.filter(a => a[0] === 'n'), eq = tail.filter(a => a[0] === 'e'), out = [];
      while (nq.length || eq.length) {
        if (nq.length && v + nq[0][3] <= ITEM_CAP) { while (nq.length && v + nq[0][3] <= ITEM_CAP) { const a = nq.shift(); out.push(a); v += a[3] } }
        else if (eq.length && v >= ITEM_COST) {
          const room = nq.length ? Math.max(1, Math.ceil((v + nq.length * nq[0][3] - ITEM_CAP) / ITEM_COST)) : eq.length;
          const k = Math.min(eq.length, Math.floor(v / ITEM_COST), room);
          for (let q = 0; q < k; q++) { out.push(eq.shift()); v -= ITEM_COST }
        } else return log;
      }
      return log.slice(0, from).concat(out, log.slice(to));
    };
    const fallback = (x, v0) => {
      const bgN = x.normalRuns || 0, mN = x.manualNormal || 0, mg = mN ? Math.round((x.earned - bgN * gain) / mN) : 0;
      const nq = [], eq = [], out = []; let v = v0;
      for (let k = 0; k < bgN; k++)nq.push(['n', 1, song[1] + 15, gain, 0, 0]);
      for (let k = 0; k < mN; k++)nq.push(['n', 0, song[1] + s.network, mg, 0, 0]);
      const dE = Math.max(0, (x.eventRuns || 0) - (x.sleepEventRuns || 0));
      for (let k = 0; k < dE; k++)eq.push(['e', 1, s.eventSeconds + 15, -ITEM_COST, eventPt(s.bonus), 0]);
      for (let k = 0; k < (x.manualEvent || 0); k++)eq.push(['e', 0, s.eventSeconds + s.network + 1, -ITEM_COST, eventPt(s.bonus + 144), 0]);
      while (nq.length || eq.length) {
        let a;
        if (eq.length && v >= ITEM_COST && (!nq.length || v + nq[0][3] > ITEM_CAP || v >= 114 * ITEM_COST)) a = eq.shift();
        else if (nq.length && v + nq[0][3] <= ITEM_CAP) a = nq.shift();
        else a = (eq.length ? eq : nq).shift();
        out.push(a); v += a[3];
      }
      for (let k = 0; k < (x.sleepEventRuns || 0); k++)out.push(['e', 1, k === x.sleepEventRuns - 1 ? s.eventSeconds : s.eventSeconds + 15, -ITEM_COST, eventPt(s.bonus), 1]);
      return out;
    };
    r.days.forEach((x, i) => {
      curDay = i; const day = i + 1, log0 = Array.isArray(x.log) ? x.log : fallback(x, inv), log = log0; // 実際の計算順を維持
      const name = a => day + '日目 ' + (a[0] === 'n' ? (a[1] ? (a[5] === 1 ? '就寝中 通常曲バクグラ' : '通常曲バクグラ') : '通常曲（手打ち）') : (a[5] === 1 ? '就寝中 イベント曲バクグラ' : a[1] ? 'イベント曲バクグラ' : 'イベント曲（手打ち）'));
      const startRel = (x.dayStart == null ? origin : x.dayStart) - origin;
      if (startRel > t) add('i', startRel - t, 0, 0, (i > 0 ? i + '日目の就寝中（アイテム切れ・待機）' : day + '日目 待機'), 'idle');
      for (const a of log) { if (a[5] !== 1) add(a[0], a[2], a[3], a[4], name(a), a[0] === 'e' ? 'ev' : '', a[1]) }
      const bedRel = (x.adjustedBedAt != null ? x.adjustedBedAt : x.dayEnd) - origin;
      if (bedRel > t) add('i', bedRel - t, 0, 0, day + '日目 空き時間（待機）', 'idle');
      for (const a of log) { if (a[5] === 1) add(a[0], a[2], a[3], a[4], name(a), a[0] === 'e' ? 'ev' : '', a[1]) }
    });
    const AL = ['FE', 'FC', 'A', 'B', 'C', 'D'];
    const dayInfo = r.days.map((x, i) => {
      const d = predictionData(i), acc = (d.accuracy || []).map((v, j) => v ? AL[j] + ' ' + v + '%' : '').filter(Boolean).join(' / ') || '-';
      const bg = (d.activities || []).filter(a => a.confirmed && activityDuration(a) > 0).map(a => (a.mode === 'event' ? 'イベントバクグラ ' : '通常バクグラ ') + a.duration.slice(0, 5)).join('、') || 'なし';
      return (i + 1) + '日目の設定：精度 ' + acc + '｜就寝 ' + d.bedtime + ' → 起床 ' + String(d.wake) + '｜日中バクグラ ' + bg;
    });
    return { seg, total: t, normals: n, events: e, nm, em, mixed: true, dayInfo, note: recomputed ? '※計測済みの日も、いまの設定で計算し直して再生しています' : (staleFail ? '※いまの設定では計算が成立しません（' + staleFail + '）。計測済みの結果で表示しています' : ''), pt: p, clock: T => fmt((origin + T) % 86400), totalLabel: '（実際の時刻で表示・全体 ' + fmt(t) + '）' };
  }
  function build() {
    if (s.mode === 'both') return buildMixed();
    const r = simulateFullBackground(); if (!r.valid) return null;
    const song = SONGS[s.song], gain = TABLE[song[2]][5], pt = eventPt(s.bonus), nt = song[1] + 15, et = s.eventSeconds + 15, target = r.eventRuns, normals = Math.ceil(target * ITEM_COST / gain);
    const seg = []; let t = 0, inv = 0, n = 0, e = 0, sets = 0, p = 0;
    const push = (type, d, delta) => { seg.push({ t, d, type, i0: inv, i1: inv + delta, n, e, p, sets }); t += d; inv += delta; if (type === 'n') n++; else { e++; p += pt } };
    const runSet = c => { sets++; for (let k = 0; k < c; k++)push('e', k === c - 1 ? et - 15 : et, -ITEM_COST) };
    while (e < target) {
      const can = Math.min(114, target - e, Math.floor(inv / ITEM_COST));
      if (can > 0 && (inv + gain > ITEM_CAP || n >= normals || inv >= 114 * ITEM_COST)) runSet(can);
      else if (n < normals && inv + gain <= ITEM_CAP) push('n', nt, gain);
      else if (can > 0) runSet(can);
      else break;
    }
    return { seg, total: t, normals: n, events: e, pt: p, perEvent: pt, sets };
  }
  function stateAt(x) {
    const seg = tl.seg; if (!seg.length) return { g: null, f: 0, inv: 0, pt: 0, n: 0, e: 0, done: true };
    if (x >= tl.total) { const g = seg[seg.length - 1]; return { g, f: 1, inv: g.i1, pt: tl.pt, n: tl.normals, e: tl.events, nm: tl.nm || 0, em: tl.em || 0, done: true } }
    let lo = 0, hi = seg.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (seg[m].t <= x) lo = m; else hi = m - 1 }
    const g = seg[lo], f = Math.min(1, Math.max(0, (x - g.t) / g.d));
    return { g, f, inv: g.i0, pt: g.p, n: g.n, e: g.e, nm: g.nm || 0, em: g.em || 0, done: false };
  }
  function setupCanvas() {
    const c = q('simChart'); if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 320, h = 150;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawChart(st) {
    const c = q('simChart'); if (!c) return;
    const ctx = c.getContext('2d'), w = c.clientWidth || 320, h = 150, pad = 8;
    const X = i => pad + i / N * (w - 2 * pad), Y = v => h - pad - (v / maxInv) * (h - 2 * pad);
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); samples.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
    ctx.strokeStyle = '#cdbbea'; ctx.lineWidth = 1.5; ctx.stroke();
    const pos = Math.max(0, Math.min(N, (T - winS) / (winE - winS) * N)), k = Math.floor(pos);
    ctx.beginPath(); ctx.moveTo(X(0), Y(samples[0]));
    for (let i = 1; i <= k; i++)ctx.lineTo(X(i), Y(samples[i]));
    const cx = X(pos), cy = Y(st.inv); ctx.lineTo(cx, cy);
    const stroke = ctx.createLinearGradient(pad, 0, w - pad, 0); stroke.addColorStop(0, '#7c3aed'); stroke.addColorStop(.6, '#db2777'); stroke.addColorStop(1, '#f59e0b');
    ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(cx, h - pad); ctx.lineTo(X(0), h - pad); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h); fill.addColorStop(0, 'rgba(168,85,247,.32)'); fill.addColorStop(1, 'rgba(168,85,247,.02)');
    ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 6.2832); ctx.fillStyle = '#db2777'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }
  function paint() {
    if (!tl || !q('simClock')) return;
    const st = stateAt(T), g = st.g;
    q('simClock').textContent = tl.clock ? tl.clock(T) : fmt(T);
    q('simBarFill').style.width = (Math.max(0, Math.min(1, (T - winS) / (winE - winS))) * 100) + '%';
    q('simInv').textContent = num(st.inv) + ' \u500b';
    q('simInvFill').style.width = Math.min(100, st.inv / ITEM_CAP * 100) + '%';
    q('simPt').textContent = num(st.pt - base.pt);
    q('simN').textContent = num(st.n - base.n) + ' \u56de';
    q('simE').textContent = num(st.e - base.e) + ' \u56de';
    const now = q('simNow');
    if (st.done) { now.className = 'sim-now done'; now.innerHTML = '<i></i>\u5b8c\u4e86\uff1a\u3059\u3079\u3066\u306e\u30d7\u30ec\u30a4\u304c\u7d42\u308f\u308a\u307e\u3057\u305f' }
    else if (!g) { now.className = 'sim-now'; now.innerHTML = '<i></i>再生可能なプレイ履歴がありません' }
    else if (g.type === 'n') { now.className = 'sim-now'; now.innerHTML = '<i></i>\u901a\u5e38\u66f2BG\u5b9f\u884c\u4e2d\uff08' + num(g.n + 1) + '\u56de\u76ee\uff09\u30a2\u30a4\u30c6\u30e0\u3092\u7372\u5f97' }
    else { now.className = 'sim-now ev'; now.innerHTML = '<i></i>\u30a4\u30d9\u30f3\u30c8\u66f2BG\u5b9f\u884c\u4e2d\uff08\u30bb\u30c3\u30c8' + num(g.sets) + '\u30fb' + num(g.e + 1) + '\u56de\u76ee\uff09' }
    const seek = q('simSeek');
    if (seek && !seek.dataset.dragging) seek.value = Math.round(Math.max(0, Math.min(1, (T - winS) / Math.max(1, winE - winS))) * 1000);
    if (g && g.label && !st.done) { now.className = 'sim-now' + (g.cls ? ' ' + g.cls : ''); now.innerHTML = '<i></i>' + g.label }
    if (dayIdx >= 0 && T >= winE) { now.className = 'sim-now done'; now.innerHTML = '<i></i>この日の再生が終わりました' }
    if (q('simInfo') && g && tl.dayInfo) q('simInfo').textContent = (tl.dayInfo[g.day] || '') + (tl.note ? '\n' + tl.note : '');
    if (q('simNM')) { q('simNM').textContent = num(st.nm - base.nm) + ' 回'; q('simEM').textContent = num(st.em - base.em) + ' 回' }
    drawChart(st);
  }
  function tick(ts) {
    if (!playing) return;
    T = Math.min(winE, T + (ts - last) / 1000 * (winE - winS) / dur); last = ts; paint();
    if (T >= winE) { playing = false; q('simPlay').textContent = '\u25b6 \u3082\u3046\u4e00\u5ea6' } else raf = requestAnimationFrame(tick);
  }
  function speedLabel() { const e = q('simSpeed'); if (e && tl) e.textContent = '\u7d04' + Math.round((winE - winS) / dur).toLocaleString('ja-JP') + '\u500d\u901f\u3067\u518d\u751f' }
  function dayRanges() {
    if (tl.mixed) { const r = []; tl.seg.forEach(g => { const a = r[g.day]; if (!a) r[g.day] = [g.t, g.t + g.d]; else a[1] = g.t + g.d }); for (let i = 0; i < r.length; i++)if (!r[i]) r[i] = [i ? r[i - 1][1] : 0, i ? r[i - 1][1] : 0]; return r }
    const n = Math.max(1, Math.ceil(tl.total / 86400)), r = []; for (let i = 0; i < n; i++)r.push([i * 86400, Math.min(tl.total, (i + 1) * 86400)]); return r;
  }
  function dayLabel(i) { return tl.mixed ? (i + 1) + '日目（' + jp(dateAt(i)) + '）' : (i + 1) + '日目（経過' + (i * 24) + '〜' + Math.min((i + 1) * 24, Math.ceil(tl.total / 3600)) + '時間）' }
  function setWindow(d) {
    selDay = d; dayIdx = d;
    if (d < 0) { winS = 0; winE = tl.total; base = { pt: 0, n: 0, e: 0, nm: 0, em: 0 } }
    else { const r = tl.ranges[d]; winS = r[0]; winE = Math.max(r[1], r[0] + 1); const b = stateAt(winS); base = { pt: b.pt, n: b.n, e: b.e, nm: b.nm || 0, em: b.em || 0 } }
    T = winS; samples = []; maxInv = 1;
    for (let i = 0; i <= N; i++) { const v = stateAt(winS + i / N * (winE - winS)).inv; samples.push(v); if (v > maxInv) maxInv = v }
    maxInv *= 1.08;
  }
  function applyWindow(d) {
    playing = false; cancelAnimationFrame(raf);
    setWindow(d);
    const sel = q('simDay'); if (sel) sel.value = String(d);
    q('simPlay').textContent = '\u25b6 \u518d\u751f'; speedLabel(); paint();
  }
  function initSim() {
    cancelAnimationFrame(raf); playing = false; T = 0;
    if (!q('simChart')) return;
    const key = JSON.stringify([s.song, s.eventSeconds, s.bonus]);
    if (!tl || tlKey !== key || s.mode === 'both') { tl = build(); tlKey = key }
    if (!tl || !tl.seg || !tl.seg.length) {
      const now = q('simNow');
      if (now) now.textContent = 'プレイ履歴がありません。計算結果・予測エラーを確認してください。';
      const play = q('simPlay'); if (play) play.disabled = true;
      return;
    }
    q('simPlay').disabled = false;
    tl.ranges = dayRanges();
    if (selDay === null || selDay >= tl.ranges.length) selDay = 0; // 初回は必ず1日目から再生
    setWindow(selDay);
    q('simTotal').textContent = tl.totalLabel || ('/ ' + fmt(tl.total));
    if (tl.mixed && !q('simInfo')) { const info = document.createElement('div'); info.id = 'simInfo'; info.className = 'sim-info'; q('simNow').insertAdjacentElement('afterend', info) }
    if (tl.mixed) { const box = q('simPt').parentElement.parentElement; box.classList.add('mixed'); box.innerHTML = `<div class='wide'><small>イベントpt</small><b id='simPt'>0</b></div><div><small>通常曲<br>バクグラ</small><b id='simN'>0 回</b></div><div><small>通常曲<br>手打ち</small><b id='simNM'>0 回</b></div><div><small>イベント曲<br>バクグラ</small><b id='simE'>0 回</b></div><div><small>イベント曲<br>手打ち</small><b id='simEM'>0 回</b></div>` }
    if (!q('simDay')) { const box = document.createElement('div'); box.className = 'sim-days'; box.innerHTML = `<select id='simDay' aria-label='再生する日'></select><button class='ghost' id='simPrevDay'>◀ 前の日</button><button class='ghost' id='simNextDay'>次の日 ▶</button>`; const ctrl = q('simDur').parentElement; ctrl.parentElement.insertBefore(box, ctrl) }
    q('simDay').innerHTML = `<option value='-1'>全期間をまとめて再生</option>` + tl.ranges.map((r, i) => `<option value='${i}'>${dayLabel(i)}</option>`).join('');
    q('simDay').value = String(selDay);
    q('simDay').onchange = e => applyWindow(+e.target.value);
    q('simPrevDay').onclick = () => applyWindow(Math.max(0, (selDay < 0 ? 0 : selDay) - 1));
    q('simNextDay').onclick = () => applyWindow(Math.min(tl.ranges.length - 1, (selDay < 0 ? 0 : selDay) + 1));
    q('simDur').value = String(dur); speedLabel();
    setupCanvas(); paint();
    q('simPlay').onclick = () => {
      if (T >= winE) T = winS;
      playing = !playing;
      q('simPlay').textContent = playing ? '\u23f8 \u4e00\u6642\u505c\u6b62' : '\u25b6 \u518d\u751f';
      if (playing) { last = performance.now(); raf = requestAnimationFrame(tick) }
    };
    q('simReset').onclick = () => { playing = false; cancelAnimationFrame(raf); T = winS; q('simPlay').textContent = '\u25b6 \u518d\u751f'; paint() };
    q('simDur').onchange = e => { dur = +e.target.value; speedLabel() };
    const seek = q('simSeek');
    const seekTo = value => {
      const fraction = Math.max(0, Math.min(1, Number(value) / 1000));
      if (!Number.isFinite(fraction)) return;
      T = winS + fraction * Math.max(1, winE - winS);
      paint();
    };
    seek.onpointerdown = () => {
      seek.dataset.dragging = '1';
      playing = false;
      cancelAnimationFrame(raf);
      q('simPlay').textContent = '▶ 再生';
    };
    seek.oninput = e => seekTo(e.target.value);
    seek.onchange = e => { seekTo(e.target.value); delete seek.dataset.dragging; paint(); };
    seek.onpointerup = () => { delete seek.dataset.dragging; paint(); };
    seek.onpointercancel = () => { delete seek.dataset.dragging; paint(); };
    seek.onkeydown = e => {
      if (['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)) {
        playing = false; cancelAnimationFrame(raf);
        q('simPlay').textContent = '▶ 再生';
      }
    };
  }
  const SIMHTML = "<section class='panel'><h2>\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u518d\u751f</h2><div id='simNow' class='sim-now'><i></i>\u518d\u751f\u3092\u62bc\u3059\u3068\u958b\u59cb\u3057\u307e\u3059</div><div class='sim-clock' id='simClock'>00:00:00</div><div class='sim-sub'>\u7d4c\u904e\u6642\u9593 <span id='simTotal'></span></div><div class='sim-bar'><i id='simBarFill'></i></div><canvas id='simChart' height='150'></canvas><div class='sim-gauge-top'><span>\u6240\u6301\u30a2\u30a4\u30c6\u30e0</span><b id='simInv'>0 \u500b</b></div><div class='sim-bar big'><i id='simInvFill'></i></div><div class='sim-stats'><div><small>\u30a4\u30d9\u30f3\u30c8pt</small><b id='simPt'>0</b></div><div><small>\u901a\u5e38\u66f2BG</small><b id='simN'>0 \u56de</b></div><div><small>\u30a4\u30d9\u30f3\u30c8\u66f2BG</small><b id='simE'>0 \u56de</b></div></div><input id='simSeek' type='range' min='0' max='1000' value='0' aria-label='\u6642\u9593\u3092\u79fb\u52d5'><div class='sim-ctrl'><button class='primary' id='simPlay'>\u25b6 \u518d\u751f</button><button class='ghost' id='simReset'>\u23ee \u6700\u521d\u304b\u3089</button><select id='simDur' aria-label='\u518d\u751f\u306e\u901f\u3055'><option value='15'>15\u79d2\u3067\u4e00\u901a\u308a\uff08\u901f\u3044\uff09</option><option value='30'>30\u79d2\u3067\u4e00\u901a\u308a</option><option value='60'>60\u79d2\u3067\u4e00\u901a\u308a</option><option value='120'>2\u5206\u3067\u4e00\u901a\u308a\uff08\u3086\u3063\u304f\u308a\uff09</option></select></div><p class='small' id='simSpeed'></p></section>";
  const _rr = renderResult;
  renderResult = function () {
    const h = _rr();
    if (s.mode !== 'both' || h.includes('計測結果・予測状況')) return h;
    const i = h.indexOf('<h2>日別獲得ポイント'), j = i < 0 ? -1 : h.lastIndexOf('<section', i);
    return j < 0 ? h : h.slice(0, j) + SIMHTML + h.slice(j);
  };
  const _frb = renderFullBgResult;
  renderFullBgResult = function () {
    const h = _frb();
    if (h.includes('\u8a08\u7b97\u30a8\u30e9\u30fc')) return h;
    const i = h.indexOf('<h2>225\u6642\u9593\u306e\u30d7\u30ec\u30a4\u5185\u8a33'), j = i < 0 ? -1 : h.lastIndexOf('<section', i);
    return j < 0 ? h : h.slice(0, j) + SIMHTML + h.slice(j);
  };
  const _render = render;
  let lastPageForSim = null;
  render = function () {
    cancelAnimationFrame(raf);
    playing = false;
    // Resultへ入り直す際は前回選択（8日目など）を引き継がない。
    if (page === 'result' && lastPageForSim !== 'result') selDay = 0;
    lastPageForSim = page;
    _render();
    if (page === 'result') requestAnimationFrame(() => { if (page === 'result') { try { initSim(); } catch (err) { console.error('Simulation initialization failed:', err); const el = q('simNow'); if (el) el.textContent = '再生初期化エラー: ' + (err && err.message || err); } } });
    else initSim();
  };
  window.addEventListener('resize', () => { if (q('simChart') && tl) { setupCanvas(); paint() } });
})();
// ===== 設定の保存：この端末（localStorage）＋ 自分専用のクラウド保存（db）=====
var cloudRef = null, cloudTimer = 0;
function cloudDirty() {
  if (!cloudRef || testMode) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => { try { cloudRef.set({ json: JSON.stringify(s), savedAt: s.savedAt || Date.now() }).catch(() => { }) } catch (e) { } }, 1200);
}
(async () => {
  try {
    if (!window.claude || !claude.use || testMode) return;
    const db = await claude.use('db'), user = await claude.use('user');
    if (!db || !user) return;
    const id = await user.id(); if (!id) return;
    cloudRef = db.collection('data/users/' + id).doc('state');
    const snap = await cloudRef.get();
    if (snap.exists) {
      const c = JSON.parse(snap.data().json || '{}'), cloudAt = snap.data().savedAt || c.savedAt || 0;
      // 初期設定が済んでいるクラウドの設定を優先して復元（この端末が未設定、または保存のほうが新しい場合）
      if (c.initialized && (!s.initialized || cloudAt > (s.savedAt || 0))) {
        s = { ...defaults(), ...c };
        try { localStorage.setItem(KEY, JSON.stringify(s)) } catch (e) { }
        refreshOldSnapshots();
        page = s.initialized ? 'play' : 'setup'; render();
        return;
      }
    }
    if (s.initialized) cloudDirty();
  } catch (e) { }
})();
// ===== 古い計算で確定した日を、いまの計算（待機なし・就寝中の通常曲バクグラなど）で作り直す =====
var ALGO_VER = 5;
function refreshOldSnapshots() {
  try {
    if (!s.initialized || !s.snapshots) return false;
    const idx = Object.keys(s.snapshots).map(Number).sort((a, b) => a - b).filter(i => (s.snapshots[i].algo || 0) < ALGO_VER);
    if (!idx.length) return false;
    let changed = false;
    for (const i of idx) {
      const saved = s.snapshots[i]; delete s.snapshots[i];
      let rec = null; try { rec = simulate().days[i] } catch (e) { }
      if (rec && !rec.errors.length) { s.snapshots[i] = { ...rec, algo: ALGO_VER, confirmed: true, finalized: saved.finalized ?? true, settings: saved.settings, frozenAt: saved.frozenAt }; changed = true }
      else s.snapshots[i] = saved;
    }
    if (changed) save();
    return changed;
  } catch (e) { return false }
}
// v77: 確定済みデータの自動再計算・上書きを禁止。
// 旧バージョンの確定記録も保存したまま利用する。
// 初日からの比較は previewFromFirstDay() を明示操作した場合のみ実行。
// refreshOldSnapshots() は呼び出さない。
