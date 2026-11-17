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
let simulationCache = null;
const $ = id => document.getElementById(id), save = () => { simulationCache = null; s.savedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(s)) } catch (e) { } cloudDirty() };
const localDayString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const currentDay = () => testMode && s.testClock ? new Date(s.testClock + 'T12:00:00') : new Date();
const freezeThrough = (index) => {
  // 計測済みの日だけを保持する。日付変更だけでは未計測の結果を確定しない。
  if (!s.initialized || !s.start || index < 0) return;
  if (!s.snapshots) s.snapshots = {};
  let changed = false;
  for (let i = 0; i <= Math.min(index, s.days - 1); i++) {
    if (s.snapshots[i]) continue;
    // 旧データの confirmed は設定の決定だけでも立つため、確定根拠にしない。
  }
  if (changed) save();
};
const rollover = () => {
  if (!s.initialized || !s.start) return;
  const now = localDayString(currentDay());
  if (!s.lastSeenDate || now > s.lastSeenDate) {
    // 保存済みの計測結果はそのまま固定。未計測日は未確定のまま。
    const today = todayIndex();
    if (today >= 0 && today < s.days && !s.snapshots?.[today]) {
      const d = dayData(today);
      d.tabDone = { accuracy: false, sleep: false, bg: false, loss: false };
      d.confirmed = false;
      d.activities.forEach(a => a.confirmed = false);
    }
    s.lastSeenDate = now; save();
  }
};
const confirmMeasuredDay = (index, result) => {
  if (!s.snapshots) s.snapshots = {};
  const record = result.days[index];
  if (!record || record.errors.length) throw Error('計算結果を確定できません');
  s.snapshots[index] = { ...record, algo: ALGO_VER, confirmed: true, settings: JSON.parse(JSON.stringify(predictionData(index))), frozenAt: localDayString(currentDay()) };
  dayData(index).confirmed = true;
  save();
};
const switchMode = (on) => {
  if (on === testMode) return;
  if (on && !localStorage.getItem(TEST_KEY)) {
    const copy = JSON.parse(localStorage.getItem(PROD_KEY) || JSON.stringify(defaults()));
    copy.testClock = localDayString(new Date()); copy.snapshots = {}; copy.lastSeenDate = copy.testClock;
    localStorage.setItem(TEST_KEY, JSON.stringify(copy));
  }
  testMode = on; KEY = on ? TEST_KEY : PROD_KEY; localStorage.setItem(FLAG_KEY, on ? '1' : '0');
  s = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  page = s.initialized ? 'settings' : 'setup'; render();
};
const jp = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const dateAt = (i) => { const [y, m, d] = (s.start || '2026-11-13').split('-').map(Number); return new Date(y, m - 1, d + i) };
const todayIndex = () => { if (!s.start) return 0; const d = currentDay(), t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return Math.floor((t - dateAt(0)) / 86400000) };
const newActivity = (name = '仕事/学校') => ({ name, mode: 'normal', duration: '00:00:00', confirmed: false });
const dayData = (i) => {
  if (!s.daysData[i]) s.daysData[i] = { accuracy: [0, 0, 0, 0, 0, 0], wake: '00:00:00', wakeManual: true, bedtime: '00:00', activities: [newActivity()], lossMinutes: 0, confirmed: false };
  const d = s.daysData[i]; if (!d.bedtime) d.bedtime = '00:00';
  if (d.wakeManual === undefined) d.wakeManual = false;
  // Migrate unused legacy default rows without discarding configured rows.
  if (Array.isArray(d.activities) && d.activities.length === 4 && d.activities.map(a => a.name).join('|') === '仕事|授業・勉強|食事・休憩|その他') {
    d.activities = d.activities.filter((a, j) => j === 0 || a.confirmed || sec(a.duration) > 0);
    d.activities[0].name = '仕事/学校';
  }
  if (!Array.isArray(d.activities) || !d.activities.length) d.activities = [newActivity()];
  return d;
};
const activeIndex = () => Math.min(Math.max(todayIndex(), 0), s.days - 1);
const todayEditable = () => todayIndex() >= 0 && todayIndex() < s.days;
// 1日目を基本設定とし、ONの日だけ独立した設定を使う。
const isIndividual = i => i > 0 && Boolean(s.individualDays?.[i]);
const predictionData = i => i === 0 || isIndividual(i) ? dayData(i) : dayData(0);
const editDayData = () => predictionData(s.day);
const canEditDay = () => s.day === 0 || isIndividual(s.day);
const cloneBasicDay = () => {
  const src = predictionData(s.day);
  const copy = JSON.parse(JSON.stringify(src));
  copy.confirmed = false;
  copy.tabDone = { accuracy: false, sleep: false, bg: false, loss: false };
  copy.activities.forEach(a => a.confirmed = false);
  return copy;
};
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
const resetTab = (d, key) => { tabDone(d)[key] = false; d.confirmed = false };
function render() { rollover(); if (!s.initialized && page !== 'setup') page = 'setup'; const titles = { setup: '初期設定画面', play: 'プレイ画面', result: 'Result（結果）', settings: '設定画面', history: 'セット履歴', help: '使い方' }; $('subtitle').textContent = titles[page]; document.querySelectorAll('[data-page]').forEach(b => { b.classList.toggle('active', b.dataset.page === page); b.disabled = !s.initialized }); $('nav').classList.toggle('hidden', page === 'setup'); $('content').innerHTML = ({ setup: renderSetup, play: renderPlay, result: renderResult, settings: renderSettings, history: renderHistory, help: renderHelp }[page])(); }
function settingsFields(initial) { return panel('プレイの基本設定', row('プレイ方法', `<div class="seg"><button data-action="mode" data-value="both" class="${s.mode === 'both' ? 'selected' : ''}">手打ち＆バクグラ</button><button data-action="mode" data-value="fullBackground" class="${s.mode === 'fullBackground' ? 'selected' : ''}">フルバクグラ</button></div>`) + row('通常曲（共通）', `<select data-field="song"><option value="-1" ${s.song < 0 ? 'selected' : ''}>選択してください</option>${SONGS.map((a, i) => `<option value="${i}" ${s.song === i ? 'selected' : ''}>${a[0]}</option>`).join('')}</select>`) + row('イベント曲時間', `<button class="timebtn" data-wheel="eventSeconds">${s.eventSeconds > 0 ? fmt(s.eventSeconds).slice(3) : '未設定'}（分:秒）</button>`) + row('特攻値', `<input data-field="bonus" type="number" min="0" max="9999" value="${s.bonus ?? ''}" placeholder="未設定"> % <output>${s.bonus === null || s.bonus === '' ? '—' : num(eventPt(s.bonus)) + ' pt'}</output>`), '♧') + (s.mode === 'both' ? panel('回線速度（手打ち時のみ）', `<div class="seg">${[24, 26, 28].map((n, i) => `<button data-action="network" data-value="${n}" class="${s.network === n ? 'selected' : ''}">${['速い', '普通', '遅い'][i]}<br>(${n}秒)</button>`).join('')}</div>`, '◎') : '') + `<button class="primary wide" data-action="saveSettings">✓ 設定を保存</button>` + (initial ? '' : `<button class="danger wide" data-action="end">⚑ イベント終了</button>`) }
function renderSetup() { return panel('イベント情報', row('イベント開始日', `<input data-field="start" type="date" value="${s.start}">`) + row('イベント日数', `<select data-field="days">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${s.days === i + 1 ? 'selected' : ''}>${i + 1}日</option>`).join('')}</select>`) + `<p class="note">イベント初日は15:00開始、最終日は23:59:59終了です。</p>`, '▣') + settingsFields(true) }
function renderSettings() { return panel('イベント情報', row('イベント日数', `<span class="soft">${s.days}日（変更不可）</span>`) + row('イベント終了日時', `<span class="soft">${jp(dateAt(s.days - 1))} 23:59</span>`) + `<p class="note">イベント期間中は日数・終了日時を変更できません。</p>`, '▣') + settingsFields(false) }
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
  const d = predictionData(s.day), full = s.mode === 'fullBackground', editable = canEditDay() && !s.snapshots?.[s.day], done = tabDone(d);
  const tabs = [['accuracy', '精度'], ['sleep', '起床・就寝'], ['bg', 'バクグラ時間'], ['loss', 'ロス時間'], ['measure', '計測']];
  const tabBar = `<div class="play-tabs" role="tablist" aria-label="プレイ設定">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${playTab === id}" class="play-tab ${playTab === id ? 'active' : ''}" data-play-tab="${id}">${label}${id !== 'measure' && done[id] ? '<span class="tab-check" aria-label="設定完了">✓</span>' : ''}</button>`).join('')}</div>`;
  const disabled = editable ? '' : 'disabled';
  const individualPanel = panel('日別設定', `<p class="small">1日目を基本設定として使用します。個別設定をONにした日だけ変更できます。最終日は就寝なしで計算します。</p><div class="row"><span class="label">${s.day === 0 ? '基本設定（1日目）' : `${dayLabel(s.day)}の個別設定`}</span><div class="control">${s.day === 0 ? '<strong>基本設定</strong>' : `<button class="${isIndividual(s.day) ? 'primary' : 'ghost'}" data-action="toggleIndividual" ${s.snapshots?.[s.day] ? 'disabled' : ''}>${isIndividual(s.day) ? 'ON（この日専用）' : 'OFF（基本設定を使用）'}</button>`}</div></div>` + (s.day > 0 && !isIndividual(s.day) ? '<p class="note">基本設定を引き継いでいます。変更するには個別設定をONにしてください。</p>' : ''));
  let body = '';
  if (playTab === 'accuracy') {
    body = panel('精度設定（手打ち時のみ）', full ? '<p class="note">フルバクグラでは精度設定は不要です（Dコン100%）。</p>' : `<div class="acc">${['フルエクセレント', 'フルコン', 'A', 'B', 'C', 'D'].map((a, i) => `<label>${a}<select data-accuracy="${i}" ${disabled}>${Array.from({ length: 11 }, (_, j) => `<option value="${j * 10}" ${d.accuracy[i] === j * 10 ? 'selected' : ''}>${j * 10}%</option>`).join('')}</select></label>`).join('')}</div><p class="note">合計 ${d.accuracy.reduce((a, b) => a + b, 0)}%（100%にしてください）</p>`) + `<button class="primary wide" data-action="finishAccuracy" ${disabled}>決定して次へ</button>`;
  } else if (playTab === 'sleep') {
    if (s.day === s.days - 1) { body = panel('最終日の設定', `<p class="note">最終日は就寝せず、イベント終了の23:59:59までプレイします。起床・就寝時刻の設定は不要です。</p><button class="primary wide" data-action="finishSleep" ${disabled}>確認して次へ</button>`); }
    else body = panel('起床・就寝時刻', row('就寝時刻', `<button class="timebtn" data-wheel="bedtime" ${disabled}>${d.bedtime}</button>`) + row('起床時刻', `<button class="timebtn" data-wheel="wake" ${disabled}>${d.wake}</button>`) + row('起床から就寝まで', `<span class="soft">${fmt(awakeSeconds(d))}</span>`) + `<p class="small">就寝時刻を決定すると起床時刻をイベントバクグラの時間へ自動調整します。</p>` + bgDurationPanel() + `<button class="primary wide" data-action="finishSleep" ${disabled}>決定して次へ</button>`);
  } else if (playTab === 'bg') {
    const acts = d.activities.map((a, i) => `<div class="activity"><div class="activity-name"><input class="activity-name-input" type="text" data-activity-name="${i}" value="${escapeAttr(a.name)}" maxlength="40" placeholder="項目名" ${disabled}></div><div class="seg"><button data-action="activityMode" data-index="${i}" data-value="normal" class="${a.mode === 'normal' ? 'selected' : ''}" ${disabled}>通常バクグラ</button><button data-action="activityMode" data-index="${i}" data-value="event" class="${a.mode === 'event' ? 'selected' : ''}" ${disabled}>イベントバクグラ</button></div><button class="timebtn" data-wheel="activity" data-index="${i}" ${disabled}>${a.duration.slice(0, 5)}</button><div class="activity-confirm"><button class="primary" data-action="activityConfirm" data-index="${i}" ${disabled}>決定</button><span class="check-slot">${a.confirmed ? '<span class="check">✓</span>' : ''}</span></div>${i > 0 ? `<button class="remove-activity" data-action="removeActivity" data-index="${i}" ${disabled}>×</button>` : '<span class="remove-placeholder"></span>'}</div>`).join('');
    const total = d.activities.reduce((x, a) => x + sec(a.duration), 0);
    body = panel('項目ごとのバクグラ時間', `<p class="small">項目ごとにバクグラの種類と時間を設定して「決定」を押してください。</p>${acts}<button class="ghost wide" data-action="addActivity" ${disabled}>＋ 項目追加</button><div class="total"><span>本日のバクグラ合計</span><strong>${fmt(total)}</strong></div><button class="primary wide" data-action="finishBg" ${disabled}>決定して次へ</button>`);
  } else if (playTab === 'loss') {
    body = panel('ロス時間の設定', `<p class="small">バクグラ終了後の更新忘れなど、手打ち・バクグラのどちらも実行しない時間を1日合計で設定します。</p><div class="row"><span class="label">ロス時間（時間・分）</span><div class="control"><input type="number" min="0" max="23" step="1" data-loss="hours" value="${Math.floor((d.lossMinutes || 0) / 60)}" ${disabled} style="width:65px"> 時間 <input type="number" min="0" max="59" step="1" data-loss="minutes" value="${(d.lossMinutes || 0) % 60}" ${disabled} style="width:65px"> 分</div></div><p class="note">ロス時間中はアイテムもptも増えません。バクグラ時間は減らさず、残りの手打ち時間から差し引きます。</p><button class="primary wide" data-action="finishLoss" ${disabled}>決定して次へ</button>`);
  } else {
    const items = [['accuracy', '精度設定'], ['sleep', '起床・就寝'], ['bg', 'バクグラ時間'], ['loss', 'ロス時間']];
    const all = items.every(([id]) => done[id]);
    body = panel('設定確認', items.map(([id, label]) => `<button class="review-row" data-play-tab="${id}"><span>${label}</span><span class="${done[id] ? 'check' : 'pending'}">${done[id] ? '✓ 設定完了' : '未確定'}　›</span></button>`).join('') + `<p class="small">すべての設定を決定すると計測できます。</p><button class="primary wide" data-action="measureDay" ${all ? '' : 'disabled'}>${s.day === activeIndex() ? '計測する' : '予測を表示'}</button>${d.confirmed ? '<p class="note">今日の設定は確定済みです。設定を変えた場合は、もう一度「計測する」で計算し直せます。</p>' : ''}`);
  }
  return datebar() + individualPanel + tabBar + body;
}
function awakeSeconds(d) { const w = sec(d.wake), b = sec(d.bedtime); return (b - w + 86400) % 86400 || 86400 }
function activityAvailableSeconds(d) {
  const day = s.day;
  if (Number(day) === s.days - 1) { const wake = sec(d.wake); return Math.max(0, 86399 - wake) }
  if (Number(day) !== 0) return awakeSeconds(d);
  // 初日だけは起床時刻ではなくイベント開始15:00を基準にする。
  const start = 15 * 3600, bed = sec(d.bedtime);
  return (bed <= start ? bed + 86400 : bed) - start;
}
function activityTimeError(d, index) { const a = d.activities[index]; if (!a) return '項目が見つかりません'; const duration = sec(a.duration); if (duration > 86400) return `${a.name}：実行時間は24時間以内にしてください`; const available = activityAvailableSeconds(d); if (duration > available) return `${a.name}：実行時間が起床から就寝までの時間を超えています`; const total = d.activities.reduce((v, item) => v + sec(item.duration), 0); if (total > available) return `バクグラ合計${fmt(total)}が活動時間${fmt(available)}を超えています。各項目の時間を調整してください`; return '' }
function allActivityTimeError(d) { for (let i = 0; i < d.activities.length; i++) { if (!d.activities[i].name.trim()) { alert('項目名を入力してください'); return } const error = activityTimeError(d, i); if (error) return error } return '' }
// 起床・就寝の決定時点で、曲の途中終了をしない条件を検証する。
function sleepScheduleError(d, checkActivities = false) {
  const wake = sec(d.wake), bed = sec(d.bedtime), cycle = s.eventSeconds + 15;
  if (!s.eventSeconds || cycle <= 15) return 'イベント曲の時間を設定してください';
  const sleepSpan = (wake - bed + 86400) % 86400;
  if (sleepSpan === 0) return '起床時刻と就寝時刻を同じにできません';
  const count = Math.ceil((sleepSpan + 15) / cycle);
  if (count > 114) return `就寝中バクグラは最大114回です。現在の設定では${count}回必要になります。`;
  const actual = count * cycle - 15;
  if (actual < sleepSpan) return `バクグラ終了が起床時刻より早くなります（${fmt(actual)}）。起床時刻を早めるか就寝時刻を変更してください。`;
  const day = activeIndex(), start = day === 0 ? 54000 : sec(d.wake);
  let bedAt = sec(d.bedtime); if (bedAt <= start) bedAt += 86400;
  // 15:00開始で翌01:00就寝など、初日の日付をまたぐ就寝も有効。
  const available = bedAt - start;
  const total = d.activities.reduce((n, a) => n + sec(a.duration), 0);
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
function simulate(stopAfterDay = null) {
  let inv = 0, totalPt = 0, totalItems = 0, totalTime = 0, previousSleepEnd = null;
  const days = [], song = SONGS[s.song] || SONGS[0], isFull = s.mode === 'fullBackground';
  const normalBg = song[1] + 15, eventBg = s.eventSeconds + 15;
  const normalManual = song[1] + s.network, eventManual = s.eventSeconds + s.network + 1;
  const bgGain = TABLE[song[2]][5], pt = bg => eventPt(s.bonus + (bg ? 0 : 144));
  const eventEnd = (s.days - 1) * 86400 + 86399;
  for (let day = 0; day < s.days; day++) {
    const frozen = s.snapshots && s.snapshots[day];
    if (frozen) {
      const record = { ...frozen, errors: [], confirmed: true };
      days.push(record); inv = record.inv; previousSleepEnd = record.dayEnd;
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
    const start = day === 0 ? 54000 : previousSleepEnd;
    let bedAt = base + bed;
    if (bedAt <= start) bedAt += 86400;
    // 最終日は就寝開始時刻ではなくイベント終了時刻を唯一の期限とする。
    const end = day === s.days - 1 ? eventEnd : bedAt;
    const awakeAvailable = Math.max(0, end - start);
    const sleepTarget = day === s.days - 1 ? null : base + 86400 + wake;
    if (day === s.days - 1 && start >= eventEnd) errors.push('最終日の開始時刻がイベント終了後です');
    if (!isFull && accuracy.reduce((a, b) => a + b, 0) !== 100) errors.push('精度の合計が100%ではありません');
    const acts = d.activities.filter(a => a.confirmed && sec(a.duration) > 0);
    const configured = acts.reduce((v, a) => v + sec(a.duration), 0);
    // バクグラは指定した時間を優先する。曲を途中で切らないため、最後の1曲の完走分も予約する。
    const reservedBg = acts.reduce((v, a) => {
      const cycle = a.mode === 'normal' ? normalBg : eventBg;
      return v + Math.ceil(sec(a.duration) / cycle) * cycle;
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
    // 日中バクグラは設定時間を専有し、上限回避・アイテム補充には空き手打ち時間を使用。
    for (const a of acts) {
      if (errors.length) break;
      const duration = sec(a.duration), cycle = a.mode === 'normal' ? normalBg : eventBg;
      // 通常バクグラは3時間ごとのセットに分割。最終曲は設定時間内に開始できる。
      let remaining = duration;
      while (remaining > 0 && !errors.length) {
        const chunk = a.mode === 'normal' ? Math.min(10800, remaining) : remaining;
        const count = a.mode === 'normal' ? Math.ceil(chunk / normalBg) : Math.min(114, Math.ceil(chunk / eventBg));
        if (count === 0) break;
        if (a.mode === 'event' && remaining > 114 * eventBg - 15) { errors.push(`${a.name}：イベントバクグラの連続実行114回を超えています。設定を分割してください`); break }
        for (let j = 0; j < count; j++) {
          if (a.mode === 'normal') {
            if (inv + bgGain > ITEM_CAP && !errors.length) {
              // 上限に来そうなら、残りの通常曲バクグラぶんの空きを作るまでイベント曲をまとめて走らせる
              const rem = count - j;
              const need = Math.min(Math.floor(inv / ITEM_COST), Math.max(1, Math.ceil((inv + rem * bgGain - ITEM_CAP) / ITEM_COST)));
              for (let m = 0; m < need && !errors.length; m++) { if (isFull || !playEvent(false)) errors.push(`${a.name}：上限回避のイベント曲手打ち時間が不足しています`) }
              while (inv + bgGain > ITEM_CAP && !errors.length) { if (isFull || !playEvent(false)) errors.push(`${a.name}：上限回避のイベント曲手打ち時間が不足しています`) }
            }
            if (!errors.length && !gainNormal(true)) errors.push(`${a.name}：通常曲バクグラを実行できません`);
          } else {
            while (inv < ITEM_COST && !errors.length) { if (isFull || !gainNormal(false)) errors.push(`${day + 1}日目・${a.name}：イベントバクグラ用アイテムを補充する手打ち時間が不足しています（残り手打ち枠 ${fmt(Math.max(0, free))}）`) }
            if (!errors.length && !playEvent(true, j === count - 1 ? s.eventSeconds : eventBg)) errors.push(`${a.name}：イベントバクグラを実行できません`);
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
      const sleepNeed = day < s.days - 1 ? Math.min(ITEM_CAP, Math.ceil(Math.max(0, (base + 86400 + wake) - bedAt + 15) / eventBg) * ITEM_COST) : 0;
      let guard = 0;
      // 通常曲を上限付近までまとめて実行 → イベント曲を連続実行。
      // 就寝用アイテムを貯める最終フェーズではイベント曲に切り替えない。
      let phaseMode = 'collect';
      while (free > 0 && guard++ < 6000) {
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
          if (inv >= sleepNeed) break;
          if (canNormal) { gainNormal(false); continue }
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
    // 最後の曲が就寝予定時刻を超えた場合、実際の就寝開始をその終了時刻に調整。
    const daytimeUsed = bgNormalSeconds + manualNormalSeconds + manualEventSeconds + (bgEventSeconds - sleepEventSeconds) + lossSeconds;
    if (daytimeUsed > awakeAvailable + Math.max(normalBg, eventBg, normalManual, eventManual)) errors.push(`日中の実行時間が活動可能時間を超えています（使用${fmt(daytimeUsed)}、活動可能${fmt(awakeAvailable)}）。バクグラの補充時間を含めて確認してください`);
    const adjustedBedAt = day === s.days - 1 ? null : Math.max(bedAt, start + daytimeUsed);
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
        // 起床予定時刻までに開始した曲は最後まで完了。最終待機は含めない。
        const need = Math.ceil((sleepAvailable + 15) / eventBg);
        if (need > 114) errors.push(`就寝中バクグラが114回の上限を超えます（必要${need}回）`);
        else {
          // アイテムが足りない場合は、先に通常曲バクグラでアイテムを稼いでからイベント曲バクグラを回し、
          // 残りの就寝時間も通常曲バクグラで埋める（何もしない時間を作らない）
          let a1 = 0, b = Math.min(need, Math.floor(inv / ITEM_COST));
          if (b < need) {
            for (let cand = need; cand > b; cand--) {
              const a = Math.ceil(Math.max(0, cand * ITEM_COST - inv) / bgGain);
              if (a * normalBg + (cand - 1) * eventBg < sleepAvailable) { a1 = a; b = cand; break }
            }
          }
          const count = b;
          let extra = 0;
          {            
const invAfter = inv + a1 * bgGain - count * ITEM_COST;
            while (invAfter + (extra + 1) * bgGain <= ITEM_CAP && a1 * normalBg + count * eventBg + extra * normalBg < sleepAvailable) extra++;          
}
          sleepEventRuns = count; phase = 1;
          sleepEventSeconds = (a1 + extra) * normalBg + count * eventBg > 0 ? (a1 + extra) * normalBg + count * eventBg - 15 : 0;
          for (let j = 0; j < a1 && !errors.length; j++) { if (!gainNormal(true)) errors.push('就寝中の通常曲バクグラを実行できません') }
          for (let j = 0; j < count && !errors.length; j++) {
            const elapsed = (j === count - 1 && extra === 0) ? s.eventSeconds : eventBg;
            if (!playEvent(true, elapsed)) errors.push('就寝中バクグラを実行できません');
          }
          for (let j = 0; j < extra && !errors.length; j++) { if (!gainNormal(true)) errors.push('就寝中の通常曲バクグラを実行できません') }
          sleepEnd = Math.max(adjustedBedAt + sleepEventSeconds, sleepTarget);
        }
      }
    }
    if (day < s.days - 1 && sleepEnd !== null) previousSleepEnd = sleepEnd;
    if (inv < 0 || inv > ITEM_CAP) errors.push('アイテム上限エラー');
    totalPt += points; totalItems += spent; totalTime += used;
    days.push({      
log, points, earned, spent, inv, normalRuns, eventRuns, manualNormal, manualEvent,
      bgNormalSeconds, bgEventSeconds, sleepEventSeconds, sleepEventRuns, manualNormalSeconds, manualEventSeconds,
      confirmed: d.confirmed, errors, awakeAvailable, sleepAvailable, daytimeUsed, dayStart: start, dayEnd: day < s.days - 1 ? sleepEnd : Math.max(end, start + daytimeUsed),
      adjustedBedAt, lossSeconds, idleSeconds: Math.max(0, awakeAvailable - daytimeUsed)    
});
    if (errors.length || (stopAfterDay !== null && day >= stopAfterDay)) break;
  }
  return { days, totalPt, totalItems, totalTime, valid: days.length === s.days && days.every(d => d.errors.length === 0), eventWindow: s.days * 86400 - 54000 };
}
function cachedSimulation() { return simulationCache || (simulationCache = simulate()) }
function renderResult() { if (s.mode === 'fullBackground') return renderFullBgResult(); const r = cachedSimulation(); if (!r.valid) { const current = r.days[s.day] || s.snapshots?.[s.day]; const warnings = r.days.flatMap((d, i) => d.errors.map(msg => `<p class="error">${i + 1}日目（予測エラー）：${msg}</p>`)).join(''); return panel('計測結果・予測状況', `${current ? row('選択日の獲得pt', num(current.points) + ' pt') + row('選択日の残りアイテム', num(current.inv) + ' 個') : ''}<p class="note">未来日の予測にエラーがあるため、イベント全体の合計は未確定です。当日の計測結果は保存されています。</p>${warnings}<button class="primary wide" data-action="back">プレイ画面へ戻る</button>`, '!'); } const d = r.days[s.day], actual = todayIndex(); const list = r.days.map((x, i) => `<tr><td>${i + 1}日目（${jp(dateAt(i))}） <span class="pill ${Boolean(s.snapshots?.[i]) ? 'done' : ''}">${Boolean(s.snapshots?.[i]) ? '確定' : i === todayIndex() ? '未計測' : '予測'}</span></td><td>${num(x.points)} pt</td></tr>`).join(''); const bgNormal = d.bgNormalSeconds, bgEvent = d.bgEventSeconds, manual = d.manualNormalSeconds + d.manualEventSeconds; const sum = bgNormal + bgEvent + manual || 1; return panel('総合結果', `<div class="points">${num(r.totalPt)} pt</div>${row('使用アイテム数', num(r.totalItems) + ' 個')}${row('イベント終了時の残りアイテム数', num(r.days.at(-1).inv) + ' 個')}${row('イベント全体時間', fmt(r.eventWindow))}${row('実プレイ時間（合計）', fmt(r.totalTime))}${row('日中の未使用時間（合計）', fmt(r.days.reduce((v, x) => v + x.idleSeconds, 0)))}`, '▥') + panel('日別獲得ポイント', `<table class="table"><thead><tr><th>日付</th><th>獲得イベントpt</th></tr></thead><tbody>${list}</tbody></table>`, '▣') + panel('時間配分グラフ（選択日）', `<div class="stack"><span style="width:${bgNormal / sum * 100}%;background:#8721e4"></span><span style="width:${bgEvent / sum * 100}%;background:#19b5b8"></span><span style="width:${manual / sum * 100}%;background:#f068b4"></span></div><div class="legend"><span><i style="background:#8721e4"></i>通常バクグラ</span><span><i style="background:#19b5b8"></i>イベントバクグラ</span><span><i style="background:#f068b4"></i>手打ち</span></div>`, '▥') + datebar() + panel('選択日の時間枠', `${row('活動可能時間', fmt(d.awakeAvailable))}${row('ロス時間', fmt(d.lossSeconds || 0))}${row('日中の未使用時間', fmt(d.idleSeconds))}${row('実際の就寝開始', d.adjustedBedAt == null ? '—（最終日は就寝なし）' : fmt(d.adjustedBedAt % 86400))}${row('就寝中バクグラ', s.day === s.days - 1 ? '—（最終日は実施なし）' : fmt(d.sleepEventSeconds))}`, '◷') + panel('選択日のプレイ内訳', `<table class="table"><thead><tr><th>種類</th><th>回数</th><th>時間</th></tr></thead><tbody><tr><td>通常曲（バクグラ）</td><td>${num(d.normalRuns)} 回</td><td>${fmt(d.bgNormalSeconds)}</td></tr><tr><td>通常曲（手打ち）</td><td>${num(d.manualNormal)} 回</td><td>${fmt(d.manualNormalSeconds)}</td></tr><tr><td>イベント曲（バクグラ・日中）</td><td>${num(d.eventRuns - d.sleepEventRuns)} 回</td><td>${fmt(d.bgEventSeconds - d.sleepEventSeconds)}</td></tr><tr><td>イベント曲（バクグラ・就寝中）</td><td>${num(d.sleepEventRuns)} 回</td><td>${fmt(d.sleepEventSeconds)}</td></tr><tr><td>イベント曲（手打ち）</td><td>${num(d.manualEvent)} 回</td><td>${fmt(d.manualEventSeconds)}</td></tr></tbody></table>`, '◷') + (d.errors.length ? panel('計算上の注意', d.errors.map(x => `<p class="error">${x}</p>`).join(''), '!') : '') + panel('アイテム収支', `${row('獲得アイテム数', num(d.earned) + ' 個')}${row('消費アイテム数', num(d.spent) + ' 個')}${row('残りアイテム数', num(d.inv) + ' 個')}`, '▧') + `<button class="primary wide" data-action="back">❮ 戻る</button><p class="small">※数値は設定から算出するシミュレーション値です。日付の経過だけでは実プレイの獲得実績を検証できません。</p>` }
function renderHistory() { if (s.mode === 'fullBackground') return panel('セット履歴', '<p class="note">フルバクグラは225時間一括計算のため、日別セット履歴はありません。</p>'); return panel('セット履歴', `<p class="small">各日の計測確定状況です。</p><table class="table"><thead><tr><th>日付</th><th>状態</th></tr></thead><tbody>${Array.from({ length: s.days }, (_, i) => `<tr><td>${dayLabel(i)}</td><td>${i > todayIndex() ? '予測（編集不可）' : s.snapshots?.[i] ? '計測確定' : '未計測'}</td></tr>`).join('')}</tbody></table>`, '◷') }
function renderHelp() { return panel('使い方', `<p>① 初期設定でイベント日程・プレイ方法・楽曲・特攻値を設定します。</p><p>② 今日のプレイ画面でバクグラの種類・時間と精度を設定します。未来の日付は今日の設定から予測します。</p><p>③ 各項目の「決定」を押した後、「計測する」でその日の設定と結果を確定します。</p><p>④ Resultでは計測済みの日を確定、未計測の日を予測として表示します。</p><p>⑤ イベント終了時は設定画面から「イベント終了」を押します。</p>`, '?') }
let wheelTarget = null;
function wheelOpen(target, index) {
  wheelTarget = { target, index }; const d = dayData(s.day);
  const value = target === 'eventSeconds' ? fmt(s.eventSeconds || 0) : target === 'activity' ? d.activities[index].duration : target === 'wake' ? d.wake : d.bedtime + ':00';
  const a = value.split(':').map(Number);
  const hourMax = (target === 'wake' || target === 'bedtime') ? 23 : 24;
  for (const [id, max, v] of [['wh', hourMax, a[0]], ['wm', 59, a[1]], ['ws', 59, a[2] || 0]]) {
    $(id).innerHTML = Array.from({ length: max + 1 }, (_, i) => `<option value="${i}" ${i === v ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`).join('');
  }
  $('wsWrap').classList.toggle('hidden', target === 'bedtime' || target === 'activity');
  $('wheelTitle').textContent = target === 'activity' ? 'バクグラ実行時間' : target === 'wake' ? '起床時刻' : target === 'bedtime' ? '就寝時刻' : 'イベント曲時間';
  $('wheelModal').hidden = false;
  // iOS/Androidで末尾の時刻が隠れないようネイティブ選択UIを使用。
  $('wh').scrollTop = 0;
}
function wheelSave() {
  const h = +$('wh').value, m = +$('wm').value, ss = +$('ws').value;
  const target = wheelTarget.target, clock = target === 'wake' || target === 'bedtime';
  if ((clock && h === 24) || (h === 24 && (m !== 0 || (!clock && target !== 'activity' && ss !== 0)))) { alert('24時間を選択した場合、分・秒は00にしてください'); return }
  const v = fmt(h * 3600 + m * 60 + (target === 'bedtime' || target === 'activity' ? 0 : ss)), d = dayData(s.day);
  if (target === 'eventSeconds') {
    s.eventSeconds = h * 3600 + m * 60 + ss;
    // 手動で設定した起床時刻は変更しない。
    for (const day of Object.values(s.daysData)) {
      if (day && !day.wakeManual) { day.wake = autoWakeFromBedtime(day.bedtime || '00:00'); resetTab(day, 'sleep'); }
    }
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
document.addEventListener('click', e => {  
const pt = e.target.closest('[data-play-tab]'); if (pt) { playTab = pt.dataset.playTab; render(); return } const wheel = e.target.closest('[data-wheel]'); if (wheel) { if (page === 'play' && !canEditDay()) return; wheelOpen(wheel.dataset.wheel, +wheel.dataset.index || 0); return } const nav = e.target.closest('[data-page]'); if (nav) { if (nav.dataset.page === 'result' && s.mode !== 'fullBackground') { const check = simulate(); if (!check.valid) { const failure = check.days.find(d => d.errors.length); alert('計算が成立しないためResultへ移動できません。\n' + (failure?.errors.join('\n') || 'バクグラ設定を確認してください')); return } } page = nav.dataset.page; render(); return } const b = e.target.closest('[data-action]'); if (!b) return; const act = b.dataset.action;
  if (page === 'play' && !canEditDay() && ['finishAccuracy', 'finishSleep', 'finishBg', 'finishLoss', 'activityMode', 'activityConfirm', 'addActivity', 'removeActivity'].includes(act)) return;
  if (act === 'toggleIndividual') {
    if (s.day === 0 || s.snapshots?.[s.day]) return;
    if (!s.individualDays) s.individualDays = {};
    if (isIndividual(s.day)) { delete s.individualDays[s.day]; delete s.daysData[s.day] }
    else { s.daysData[s.day] = cloneBasicDay(); s.individualDays[s.day] = true }
    save(); render(); return;
  }
  if (act === 'measureFullBg') { const result = simulateFullBackground(); if (!result.valid) { alert(result.error); return } s.fullBgResult = { ...result, settings: { song: s.song, eventSeconds: s.eventSeconds, bonus: s.bonus } }; save(); page = 'result'; render(); return }
  if (act === 'toggleTest') { switchMode(!testMode); return }
  if (act === 'testNextDay' || act === 'testSetDate') {
    if (!testMode) return;
    const old = s.testClock || localDayString(new Date());
    const target = act === 'testNextDay' ? localDayString(new Date(new Date(old + 'T12:00:00').getTime() + 86400000)) : $('testDate')?.value;
    if (!target || target <= old) { alert('現在より後の日付を選択してください'); return }
    const first = dateAt(0), before = new Date(target + 'T12:00:00');
    const lastIndex = Math.round((new Date(before.getFullYear(), before.getMonth(), before.getDate()) - first) / 86400000) - 1;
    freezeThrough(lastIndex); s.testClock = target; s.lastSeenDate = target; s.day = activeIndex(); save(); render(); return;
  }
  if (act === 'resetTest') {
    if (!testMode || !confirm('テスト用データだけを初期化しますか？ 本番データは残ります。')) return;
    const copy = JSON.parse(localStorage.getItem(PROD_KEY) || JSON.stringify(defaults()));
    copy.testClock = localDayString(new Date()); copy.snapshots = {}; copy.lastSeenDate = copy.testClock;
    s = { ...defaults(), ...copy }; save(); page = s.initialized ? 'settings' : 'setup'; render(); return;
  }
  const d = editDayData(), i = +b.dataset.index; if (page === 'play' && !canEditDay() && ['activityMode', 'activityConfirm', 'confirmDay', 'addActivity', 'removeActivity'].includes(act)) return; if (act === 'finishAccuracy') { if (s.mode === 'both' && d.accuracy.reduce((a, v) => a + v, 0) !== 100) { alert('精度の合計を100%にしてください'); return } tabDone(d).accuracy = true; save(); playTab = 'sleep' } else if (act === 'finishSleep') { const err = s.day === s.days - 1 ? null : sleepScheduleError(d); if (err) { alert(err); return } tabDone(d).sleep = true; save(); playTab = 'bg' } else if (act === 'finishBg') { if (!tabDone(d).sleep) { alert('先に起床・就寝時刻を確定してください'); playTab = 'sleep'; render(); return } const err = (s.day === s.days - 1 ? null : sleepScheduleError(d, true)) || allActivityTimeError(d); if (err) { alert('バクグラ設定不可：' + err); return } if (d.activities.some(a => sec(a.duration) > 0 && !a.confirmed)) { alert('バクグラ時間を設定した項目は、それぞれ「決定」を押してください'); return } tabDone(d).bg = true; save(); playTab = 'loss' } else if (act === 'finishLoss') { const available = activityAvailableSeconds(d); const bg = d.activities.reduce((v, a) => v + sec(a.duration), 0); if ((d.lossMinutes || 0) * 60 + bg > available) { alert('ロス時間とバクグラ時間の合計が活動可能時間を超えています'); return } tabDone(d).loss = true; save(); playTab = 'measure' } else if (act === 'measureDay') { if (s.day !== activeIndex()) { page = 'result'; render(); return } if (!Object.values(tabDone(d)).every(Boolean)) { alert('4つの設定タブを決定してください'); return } const oldSnap = s.snapshots && s.snapshots[s.day]; if (oldSnap) delete s.snapshots[s.day]; const check = simulate(s.day); if (!check.days[s.day] || check.days[s.day].errors.length) { if (oldSnap) s.snapshots[s.day] = oldSnap; const failure = check.days[s.day] || check.days.find(x => x.errors.length); alert('計測できません。\n' + (failure?.errors.join('\n') || '設定を見直してください')); return } confirmMeasuredDay(s.day, check); page = 'result' } else if (act === 'mode') { s.mode = b.dataset.value; save() } else if (act === 'network') { s.network = +b.dataset.value; save() } else if (act === 'prev') s.day = Math.max(0, s.day - 1); else if (act === 'next') s.day = Math.min(s.days - 1, s.day + 1); else if (act === 'addActivity') { const names = TYPES.filter(name => !d.activities.some(a => a.name === name)); const name = names[0] || `追加項目${d.activities.length + 1}`; d.activities.push(newActivity(name)); resetTab(d, 'bg'); save() } else if (act === 'removeActivity') { if (i > 0 && i < d.activities.length) { d.activities.splice(i, 1); resetTab(d, 'bg'); save() } } else if (act === 'activityMode') { d.activities[i].mode = b.dataset.value; d.activities[i].confirmed = false; resetTab(d, 'bg'); save() } else if (act === 'activityConfirm') { if (Number.isInteger(i) && i >= 0 && i < d.activities.length) { if (!d.activities[i].name.trim()) { alert('項目名を入力してください'); return } const error = activityTimeError(d, i); if (error) { alert(error); return } d.activities[i].confirmed = true; resetTab(d, 'bg'); save() } } else if (act === 'confirmDay') { if (s.mode === 'both' && d.accuracy.reduce((a, v) => a + v, 0) !== 100) { alert('精度の合計を100%にしてください'); return } if (d.activities.some(a => !a.name.trim())) { alert('バクグラ項目名を入力してください'); return } const timeError = allActivityTimeError(d); if (timeError) { alert(timeError); return } if (d.activities.some(a => sec(a.duration) > 0 && !a.confirmed)) { alert('実行時間を入力した項目は「決定」を押してください'); return } const check = simulate(); if (!check.valid) { const failure = check.days.find(x => x.errors.length); alert('設定したバクグラ時間を実行できないため確定できません。\n' + (failure?.errors.join('\n') || '設定を見直してください')); return } save(); alert('設定を保存しました。計測するを押すと結果が確定します') } else if (act === 'saveSettings') { if (!s.start) { alert('イベント開始日を入力してください'); return } if (!(s.song >= 0 && s.song < SONGS.length)) { alert('通常曲を選択してください'); return } if (!(s.eventSeconds > 0)) { alert('イベント曲時間を入力してください'); return } if (s.bonus === null || s.bonus === '' || !Number.isFinite(Number(s.bonus)) || s.bonus < 0 || s.bonus > 9999) { alert('特攻値は0～9999%で入力してください'); return } s.initialized = true; s.day = activeIndex(); save(); page = 'play' } else if (act === 'end') { $('confirmModal').hidden = false; return } else if (act === 'back') { page = 'play'; playTab = 'measure'; } render()
});
document.addEventListener('change', e => { const f = e.target.dataset.field; if (f) { if (f === 'start') s.start = e.target.value; else s[f] = f === 'bonus' && e.target.value === '' ? null : +e.target.value; save(); render() } const nameIndex = e.target.dataset.activityName; if (nameIndex !== undefined) { if (!todayEditable()) return; const d = dayData(s.day); const name = e.target.value.trim(); if (!name) { alert('項目名を入力してください'); render(); return } if (d.activities.some((a, i) => i !== +nameIndex && a.name === name)) { alert('同じ項目名は使用できません'); render(); return } d.activities[+nameIndex].name = name; d.activities[+nameIndex].confirmed = false; resetTab(d, 'bg'); save(); render(); return } const idx = e.target.dataset.accuracy; if (idx !== undefined) { if (!todayEditable()) return; const d = dayData(s.day); d.accuracy[+idx] = +e.target.value; resetTab(d, 'accuracy'); save(); render() } });
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
    let r = simulate(); if (!r.valid) return null;
    // 計測済みの日は保存時点の結果で実行順が無い場合があるので、今の設定（精度・就寝～起床・バクグラ時間）で計算し直して使う
    let recomputed = false, staleFail = false;
    // 計測済みの日も、いまの設定（精度・就寝～起床・バクグラ時間）で計算し直して再生する
    if (s.snapshots && Object.keys(s.snapshots).length) { const sv = s.snapshots; s.snapshots = {}; let r2 = null; try { r2 = simulate() } catch (err) { } finally { s.snapshots = sv } if (r2 && r2.valid) { r = r2; recomputed = true } else staleFail = (r2 && r2.days.flatMap((y, k) => y.errors.map(m => (k + 1) + '日目：' + m))[0]) || '計算エラー' }
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
      curDay = i; const day = i + 1, log0 = Array.isArray(x.log) ? x.log : fallback(x, inv), log = reorderTail(log0, inv);
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
      const bg = (d.activities || []).filter(a => a.confirmed && sec(a.duration) > 0).map(a => (a.mode === 'event' ? 'イベントバクグラ ' : '通常バクグラ ') + a.duration.slice(0, 5)).join('、') || 'なし';
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
    else if (g.type === 'n') { now.className = 'sim-now'; now.innerHTML = '<i></i>\u901a\u5e38\u66f2BG\u5b9f\u884c\u4e2d\uff08' + num(g.n + 1) + '\u56de\u76ee\uff09\u30a2\u30a4\u30c6\u30e0\u3092\u7372\u5f97' }
    else { now.className = 'sim-now ev'; now.innerHTML = '<i></i>\u30a4\u30d9\u30f3\u30c8\u66f2BG\u5b9f\u884c\u4e2d\uff08\u30bb\u30c3\u30c8' + num(g.sets) + '\u30fb' + num(g.e + 1) + '\u56de\u76ee\uff09' }
    const seek = q('simSeek'); if (document.activeElement !== seek) seek.value = Math.round(Math.max(0, Math.min(1, (T - winS) / (winE - winS))) * 1000);
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
    if (!tl) return;
    tl.ranges = dayRanges();
    if (selDay === null || selDay >= tl.ranges.length) selDay = Math.max(0, Math.min(tl.ranges.length - 1, todayIndex()));
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
    q('simSeek').oninput = e => { T = winS + (+e.target.value) / 1000 * (winE - winS); paint() };
  }
  const SIMHTML = "<section class='panel'><h2>\u30b7\u30df\u30e5\u30ec\u30fc\u30b7\u30e7\u30f3\u518d\u751f</h2><div id='simNow' class='sim-now'><i></i>\u518d\u751f\u3092\u62bc\u3059\u3068\u958b\u59cb\u3057\u307e\u3059</div><div class='sim-clock' id='simClock'>00:00:00</div><div class='sim-sub'>\u7d4c\u904e\u6642\u9593 <span id='simTotal'></span></div><div class='sim-bar'><i id='simBarFill'></i></div><canvas id='simChart' height='150'></canvas><div class='sim-gauge-top'><span>\u6240\u6301\u30a2\u30a4\u30c6\u30e0</span><b id='simInv'>0 \u500b</b></div><div class='sim-bar big'><i id='simInvFill'></i></div><div class='sim-stats'><div><small>\u30a4\u30d9\u30f3\u30c8pt</small><b id='simPt'>0</b></div><div><small>\u901a\u5e38\u66f2BG</small><b id='simN'>0 \u56de</b></div><div><small>\u30a4\u30d9\u30f3\u30c8\u66f2BG</small><b id='simE'>0 \u56de</b></div></div><input id='simSeek' type='range' min='0' max='1000' value='0' aria-label='\u6642\u9593\u3092\u79fb\u52d5'><div class='sim-ctrl'><button class='primary' id='simPlay'>\u25b6 \u518d\u751f</button><button class='ghost' id='simReset'>\u23ee \u6700\u521d\u304b\u3089</button><select id='simDur' aria-label='\u518d\u751f\u306e\u901f\u3055'><option value='15'>15\u79d2\u3067\u4e00\u901a\u308a\uff08\u901f\u3044\uff09</option><option value='30'>30\u79d2\u3067\u4e00\u901a\u308a</option><option value='60'>60\u79d2\u3067\u4e00\u901a\u308a</option><option value='120'>2\u5206\u3067\u4e00\u901a\u308a\uff08\u3086\u3063\u304f\u308a\uff09</option></select></div><p class='small' id='simSpeed'></p></section>";
  const _rr = renderResult;
  renderResult = function () {
    const h = _rr();
    if (s.mode !== 'both' || h.includes('計算エラー')) return h;
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
  render = function () { cancelAnimationFrame(raf); playing = false; _render(); initSim() };
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
var ALGO_VER = 3;
function refreshOldSnapshots() {
  try {
    if (!s.initialized || !s.snapshots) return false;
    const idx = Object.keys(s.snapshots).map(Number).sort((a, b) => a - b).filter(i => (s.snapshots[i].algo || 0) < ALGO_VER);
    if (!idx.length) return false;
    let changed = false;
    for (const i of idx) {
      const saved = s.snapshots[i]; delete s.snapshots[i];
      let rec = null; try { rec = simulate().days[i] } catch (e) { }
      if (rec && !rec.errors.length) { s.snapshots[i] = { ...rec, algo: ALGO_VER, confirmed: true, settings: saved.settings, frozenAt: saved.frozenAt }; changed = true }
      else s.snapshots[i] = saved;
    }
    if (changed) save();
    return changed;
  } catch (e) { return false }
}
if (refreshOldSnapshots()) render();
