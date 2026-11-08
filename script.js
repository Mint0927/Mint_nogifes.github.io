"use strict";

// ===================================
// DOM取得
// ===================================

const $ = id => document.getElementById(id);

// ===================================
// 曲・アイテム設定
// ===================================

const normalSongs = [
  { name: "最後のTightHug", time: 212, lp: 81 },
  { name: "サヨナラの意味 向井葉月セレモニー", time: 213, lp: 81 },
  { name: "あと7曲", time: 213, lp: 81 },
  { name: "三番目の風", time: 214, lp: 81 },
  { name: "渋谷ブルース", time: 197, lp: 75 }
];

const accuracyIds = [
  "フルエク",
  "フルコン",
  "Aコン",
  "Bコン",
  "Cコン",
  "Dコン"
];

const itemMapLP81 = {
  フルエク: 930,
  フルコン: 898,
  Aコン: 868,
  Bコン: 836,
  Cコン: 806,
  Dコン: 774
};

const itemMapLP75 = {
  フルエク: 858,
  フルコン: 828,
  Aコン: 800,
  Bコン: 772,
  Cコン: 744,
  Dコン: 714
};

// ===================================
// 定数
// ===================================
const EVENT_START_HOUR = 15;
const EVENT_DAY_SECONDS = 24 * 60 * 60;
const EVENT_FIRST_DAY_SECONDS = 9 * 60 * 60;
const standbyBackground = 15;
const requiredItems = 99999;
const eventFullCount = 114;
const itemsPerEventSong = 875;
const manualBonusAddition = 144;
const eventDurationHours = 225;

const MAX_DAILY_SECONDS = 86400;
const WHEEL_ROW_HEIGHT = 40;

// ===================================
// 状態管理
// ===================================

const wheelState = {
  normalBg: {
    seconds: 0,
    hour: 0,
    minute: 0,
    second: 0
  },
  eventBg: {
    seconds: 0,
    hour: 0,
    minute: 0,
    second: 0
  }
};

let isFullBackground = false;
let depletionAlertActive = false;
let eventTimeAlertActive = false;
let latestMixedResult = null;

// ===================================
// 共通関数
// ===================================

function secToTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));

  return `${Math.floor(seconds / 3600)}時間 ${Math.floor((seconds % 3600) / 60)}分 ${seconds % 60}秒`;
}

function getInputTime(h, m, s) {
  return Number($(h).value || 0) * 3600 +
    Number($(m).value || 0) * 60 +
    Number($(s).value || 0);
}

function getWheelMinutes(key) {
  return Math.floor((wheelState[key]?.seconds || 0) / 60);
}

function getWheelSeconds(key) {
  return wheelState[key]?.seconds || 0;
}

function getSelectedPlayMode() {
  return document.querySelector(
    'input[name="playMode"]:checked'
  ).value;
}

function getNetworkTime() {
  return Number(
    document.querySelector(
      'input[name="network"]:checked'
    ).value
  );
}

function getItemMap() {
  return normalSongs[$("normalSong").selectedIndex].lp === 75
    ? itemMapLP75
    : itemMapLP81;
}

function getEventInputTime() {
  return Number($("eventMin").value || 0) * 60 +
    Number($("eventSec").value || 0);
}

function getBonus() {
  return Number($("bonus").value || 0);
}

function resetResult() {
  $("results").classList.remove("has-result");
  $("mixedBreakdown").hidden = true;
}

// ===================================
// 特攻値の変更設定
// ===================================

// 変更時刻をイベント開始からの経過秒数に変換
function getBonusChangeSeconds(day, hour, minute) {
  return (
    (day - 1) * EVENT_DAY_SECONDS +
    hour * 3600 +
    minute * 60
  );
}

// ===================================
// 特攻値変更欄の追加
// ===================================

// ===================================
// 特攻値変更欄の追加
// ===================================

function addBonusChangeRow() {
  const row = document.createElement("div");

  row.className = "bonus-change-row";

  row.innerHTML = `
    <div class="bonus-change-time">
      <label>適用時間</label>

      <div class="bonus-time-inputs">
        <div class="bonus-time-unit">
          <input type="number"
            data-field="day"
            min="1"
            max="10"
            value="1"
            inputmode="numeric">
          <span>日目</span>
        </div>

        <div class="bonus-time-unit">
          <input type="number"
            data-field="hour"
            min="0"
            max="23"
            value="0"
            inputmode="numeric">
          <span>時間</span>
        </div>

        <div class="bonus-time-unit">
          <input type="number"
            data-field="minute"
            min="0"
            max="59"
            value="0"
            inputmode="numeric">
          <span>分</span>
        </div>
      </div>
    </div>

    <div class="bonus-change-value">
      <label>変更特攻値</label>

      <div class="bonus-change-controls">
        <div class="bonus-input-unit">
          <input type="number"
            data-field="bonus"
            min="0"
            max="9999"
            value="0"
            inputmode="numeric">
          <span>%</span>
        </div>

        <div class="bonus-change-point">
          <span>イベントPT</span>
          <output data-field="point">1,438 pt</output>
        </div>

        <button type="button"
          class="delete-bonus-button"
          aria-label="この変更を削除">
          削除
        </button>
      </div>
    </div>
  `;

  $("bonusChanges").appendChild(row);

  updateBonusChangePoints();
  resetResult();
  updateMixedPreview();
}

// ===================================
// 特攻値変更欄の削除
// ===================================

$("addBonusChange").addEventListener("click", () => {
  addBonusChangeRow();
});

$("bonusChanges").addEventListener("click", event => {
  const button = event.target.closest(
    ".delete-bonus-button"
  );

  if (!button) {
    return;
  }

  button.closest(".bonus-change-row").remove();

  updateBonusChangePoints();
  resetResult();
  updateMixedPreview();
});

// ===================================
// 特攻値変更欄のポイント表示
// ===================================

function updateBonusChangePoints() {
  document.querySelectorAll(
    ".bonus-change-row"
  ).forEach(row => {
    const input = row.querySelector(
      '[data-field="bonus"]'
    );

    const output = row.querySelector(
      '[data-field="point"]'
    );

    const bonus = Number(input.value);

    if (
      input.value === "" ||
      !Number.isInteger(bonus) ||
      bonus < 0 ||
      bonus > 9999
    ) {
      output.textContent = "pt";
      return;
    }

    output.textContent =
      `${calculateEventPoint(bonus).toLocaleString()} pt`;
  });
}

// ===================================
// 特攻値変更欄の入力イベント
// ===================================

$("bonusChanges").addEventListener("input", () => {
  updateBonusChangePoints();
  resetResult();
  updateMixedPreview();
});

// ===================================
// 特攻値スケジュール取得
// ===================================

function getBonusSchedule(showAlert = true) {
  const baseInput = $("bonus");
  const baseBonus = Number(baseInput.value);

  if (
    baseInput.value === "" ||
    !Number.isInteger(baseBonus) ||
    baseBonus < 0 ||
    baseBonus > 9999
  ) {
    if (showAlert) {
      alert("初期特攻値は0～9999%で入力してください。");
    }

    return null;
  }

  const schedule = [
    {
      seconds: 0,
      bonus: baseBonus
    }
  ];

  const rows = Array.from(
    document.querySelectorAll(".bonus-change-row")
  );

  for (const row of rows) {
    const dayInput = row.querySelector('[data-field="day"]');
    const hourInput = row.querySelector('[data-field="hour"]');
    const minuteInput = row.querySelector('[data-field="minute"]');
    const bonusInput = row.querySelector('[data-field="bonus"]');

    const day = Number(dayInput.value);
    const hour = Number(hourInput.value);
    const minute = Number(minuteInput.value);
    const bonus = Number(bonusInput.value);

    if (
      dayInput.value === "" ||
      hourInput.value === "" ||
      minuteInput.value === "" ||
      bonusInput.value === "" ||
      !Number.isInteger(day) ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      !Number.isInteger(bonus) ||
      day < 1 ||
      day > 10 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      bonus < 0 ||
      bonus > 9999
    ) {
      if (showAlert) {
        alert(
          "追加した特攻値の適用時間・特攻値を正しく入力してください。"
        );
      }

      return null;
    }

    const seconds = getBonusChangeSeconds(
      day,
      hour,
      minute
    );

    if (seconds < 0 || seconds >= getEventTotalSeconds()) {
      if (showAlert) {
        alert(
          "特攻値の変更時刻はイベント終了前に設定してください。"
        );
      }

      return null;
    }

    schedule.push({
      seconds,
      bonus
    });
  }

  // 適用時間順に並べる
  schedule.sort((a, b) => a.seconds - b.seconds);

  // 同じ時刻の重複を確認
  for (let i = 1; i < schedule.length; i++) {
    if (schedule[i].seconds === schedule[i - 1].seconds) {
      if (showAlert) {
        alert(
          "特攻値の変更時刻が重複しています。別の時間を設定してください。"
        );
      }

      return null;
    }
  }

  return schedule;
}

// ===================================
// 経過時間に応じた特攻値を取得
// ===================================

function getBonusAtElapsed(elapsedSeconds, schedule) {
  let currentBonus = schedule[0].bonus;

  for (const item of schedule) {
    if (elapsedSeconds >= item.seconds) {
      currentBonus = item.bonus;
    } else {
      break;
    }
  }

  return currentBonus;
}

// ===================================
// エラー表示
// ===================================

function showMixedCalculationError(errors) {
  const messages = [];

  if (errors.includes("limit")) {
    messages.push(
      "通常曲で獲得するアイテムが99,999個を超えてしまいます。"
    );
  }

  if (errors.includes("depletion")) {
    messages.push(
      "イベント曲を設定時間分プレイするためのアイテムが不足します。"
    );
  }

  if (messages.length === 0) {
    messages.push(
      "設定した時間でプレイできる組み合わせが見つかりませんでした。"
    );
  }

  alert(
    "設定したバクグラ時間では計算できません。\n\n" +
    messages.join("\n") +
    "\n\nバクグラ時間を調整してください。"
  );
}

// ===================================
// 画面切り替え
// ===================================

function showScreen(name) {
  $("settingsScreen").hidden = name !== "settings";
  $("playScreen").hidden = name !== "play";
  $("resultScreen").hidden = name !== "result";
}

$("openSettings").addEventListener("click", () => {
  showScreen("settings");
});


$("saveSettings").addEventListener("click", () => {
  // 現在の日別設定を保存
  saveCurrentDayInputs();

  // イベント日程を作成
  if (!createEventDateList()) {
    return;
  }

  // 1日目を表示
  selectedEventDayIndex = 0;
  applyDayInputs(0);
  renderEventDateTabs();

  // ローカル保存
  saveLocalData();

  showScreen("play");
  updatePlayMode();
  refreshWheelLimits();
});


$("backToPlay").addEventListener("click", () => {
  showScreen("play");
});

// ===================================
// 通常曲選択
// ===================================

normalSongs.forEach((song, index) => {
  const option = document.createElement("option");

  option.value = index;
  option.textContent = song.name;

  $("normalSong").appendChild(option);
});

function updateNormalSongTime() {
  const song = normalSongs[$("normalSong").selectedIndex];

  $("normalMin").value = Math.floor(song.time / 60);
  $("normalSec").value = song.time % 60;

  resetResult();
  updateMixedPreview();
}

$("normalSong").addEventListener("change", updateNormalSongTime);

updateNormalSongTime();

// ===================================
// 精度設定
// ===================================

accuracyIds.forEach(id => {
  const select = $(id);

  for (let i = 0; i <= 100; i += 10) {
    const option = document.createElement("option");

    option.value = i;
    option.textContent = `${i}%`;

    select.appendChild(option);
  }

  select.value = "0";

  select.addEventListener("change", () => {
    updateAccuracyLimit();

    ["normalBg", "eventBg"].forEach(key => {
      setWheelValue(key, 0);
    });

    depletionAlertActive = false;
    eventTimeAlertActive = false;

    resetResult();
    updateMixedPreview();
  });
});

function updateAccuracyLimit() {
  accuracyIds.forEach(id => {
    const select = $(id);

    const otherTotal = accuracyIds
      .filter(other => other !== id)
      .reduce((sum, other) => {
        return sum + Number($(other).value || 0);
      }, 0);

    Array.from(select.options).forEach(option => {
      const disabled =
        otherTotal + Number(option.value) > 100;

      option.disabled = disabled;
      option.hidden = disabled;
    });
  });
}

updateAccuracyLimit();

// ===================================
// 手打ち平均アイテム数
// ===================================

function calculateManualAverage(itemMap, showAlert = true) {
  let totalPercent = 0;
  let average = 0;

  accuracyIds.forEach(id => {
    const percent = Number($(id).value || 0);

    totalPercent += percent;
    average += itemMap[id] * percent / 100;
  });

  if (totalPercent !== 100) {
    if (showAlert) {
      alert("通常曲の精度の合計を100%にしてください。");
    }

    return null;
  }

  return average;
}

// ===================================
// イベントポイント
// ===================================

function calculateEventPoint(bonus) {
  return Math.floor(
    1150 * (1 + bonus / 100) + 288
  );
}

function updateEventPoint() {
  const input = $("bonus");
  const bonus = Number(input.value);

  if (
    input.value === "" ||
    !Number.isInteger(bonus) ||
    bonus < 0 ||
    bonus > 9999
  ) {
    $("eventPoint").textContent = "pt";
    return;
  }

  $("eventPoint").textContent =
    `${calculateEventPoint(bonus).toLocaleString()} pt`;
}

$("bonus").addEventListener("input", () => {
  updateEventPoint();
  resetResult();
  updateMixedPreview();
});

updateEventPoint();

// ===================================
// 1曲あたりの所要時間
// ===================================

function getCycleTime(songTime, isManual, isEvent, networkTime) {
  const loadTime = isManual
    ? networkTime + (isEvent ? 1 : 0)
    : 0;

  const standby = isManual
    ? 0
    : standbyBackground;

  return {
    cycle: songTime + loadTime + standby,
    standby
  };
}

// ===================================
// 指定時間内にプレイできる回数
// ===================================

function capacityFor(time, cycleInfo) {
  if (time <= 0 || cycleInfo.cycle <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (time + cycleInfo.standby) /
      cycleInfo.cycle +
      1e-9
    )
  );
}

// ===================================
// 実際に消費する合計時間
// ===================================

function usedTime(runs, cycleInfo) {
  if (runs <= 0) {
    return 0;
  }

  return runs * cycleInfo.cycle - cycleInfo.standby;
}

// ===================================
// プレイモード切り替え
// ===================================

function updatePlayMode() {
  const mixed = getSelectedPlayMode() === "both";

  $("networkArea").querySelectorAll("input").forEach(input => {
    input.disabled = false;
  });

  $("fullModeArea").hidden = mixed;
  $("accuracyArea").hidden = isFullBackground;
  $("mixedTimeArea").hidden = !mixed;

  $("networkArea").style.opacity = "1";

  if (mixed) {
    $("accuracyArea").hidden = false;
  }

  resetResult();
  updateMixedPreview();
}

document.querySelectorAll('input[name="playMode"]').forEach(radio => {
  radio.addEventListener("change", updatePlayMode);
});

// ===================================
// フル手打ち・フルBG切り替え
// ===================================

const manualModeButton = $("manualModeButton");
const backgroundModeButton = $("backgroundModeButton");

function setFullMode(isBackground) {
  isFullBackground = isBackground;

  manualModeButton.classList.toggle("active", !isFullBackground);
  backgroundModeButton.classList.toggle("active", isFullBackground);

  manualModeButton.setAttribute(
    "aria-pressed",
    String(!isFullBackground)
  );

  backgroundModeButton.setAttribute(
    "aria-pressed",
    String(isFullBackground)
  );

  $("accuracyArea").hidden = isFullBackground;

  resetResult();
}

manualModeButton.addEventListener("click", () => {
  setFullMode(false);
});

backgroundModeButton.addEventListener("click", () => {
  setFullMode(true);
});

// ===================================
// BG時間取得
// ===================================

function getBgTimes() {
  return {
    normalBg: wheelState.normalBg.seconds,
    eventBg: wheelState.eventBg.seconds
  };
}

// ===================================
// 1日のBG合計時間表示
// ===================================

function updateDailyTimeTotal() {
  const times = getBgTimes();

  const totalSeconds =
    times.normalBg + times.eventBg;

  $("dailyTimeTotal").textContent =
    `合計：${secToTime(totalSeconds)} / 24時間`;

  $("dailyTimeTotal").style.color =
    totalSeconds > MAX_DAILY_SECONDS
      ? "#d00000"
      : "#7926b9";
}

// ===================================
// 混合モードシミュレーション
// ===================================

function simulateMixed(
  song,
  eventTime,
  networkTime,
  itemMap,
  capacities,
  averageManual,
  bonusSchedule,
  startingItems = 0,
  elapsedStartSeconds = 0
) {
  const epsilon = 1e-7;
  const normalManualCycle = getCycleTime(
    song.time, true, false, networkTime
  );

  const normalBgCycle = getCycleTime(
    song.time, false, false, networkTime
  );

  const eventManualCycle = getCycleTime(
    eventTime, true, true, networkTime
  );

  const eventBgCycle = getCycleTime(
    eventTime, false, true, networkTime
  );

  const lanes = {
    normalManual: {
      capacity: capacities.normalManual,
      runs: 0,
      cycleInfo: normalManualCycle,
      itemsPerRun: averageManual
    },

    normalBg: {
      capacity: capacities.normalBg,
      runs: 0,
      cycleInfo: normalBgCycle,
      itemsPerRun: itemMap.Dコン
    },

    eventManual: {
      capacity: capacities.eventManual,
      runs: 0,
      cycleInfo: eventManualCycle,
      itemsPerRun: 0
    },

    eventBg: {
      capacity: capacities.eventBg,
      runs: 0,
      cycleInfo: eventBgCycle,
      itemsPerRun: 0
    }
  };

  let currentItems = startingItems;
  let totalEarnedItems = 0;
  let manualItems = 0;
  let bgItems = 0;
  let usedItems = 0;

  let elapsedSeconds = 0;

  let manualDailyPoint = 0;
  let bgDailyPoint = 0;

  //const epsilon = 1e-7;

  function pickLane(names) {
    const available = names
      .map(name => ({
        name,
        lane: lanes[name]
      }))
      .filter(({ lane }) => {
        return lane.runs < lane.capacity;
      });

    if (!available.length) {
      return null;
    }

    available.sort((a, b) => {
      return (
        a.lane.runs / a.lane.capacity
      ) - (
        b.lane.runs / b.lane.capacity
      );
    });

    return available[0].name;
  }

  let guard = 0;

  while (guard++ < 2000) {
    let selected = null;

    // イベント曲を優先
    if (currentItems + epsilon >= itemsPerEventSong) {
      selected = pickLane([
        "eventManual",
        "eventBg"
      ]);
    }

    // イベント曲をプレイできない場合は通常曲
    if (selected === null) {
      const normalCandidates = [
        "normalManual",
        "normalBg"
      ].filter(name => {
        const lane = lanes[name];

        return lane.runs < lane.capacity &&
          currentItems + lane.itemsPerRun <=
          requiredItems + epsilon;
      });

      selected = pickLane(normalCandidates);
    }

    if (selected === null) {
      break;
    }

    const lane = lanes[selected];

    // プレイ開始時点の経過時間
    const absoluteStartTime =
      elapsedStartSeconds + elapsedSeconds;

    const cost = lane.cycleInfo.cycle -
      (lane.runs === 0
        ? lane.cycleInfo.standby
        : 0);

    lane.runs++;
    elapsedSeconds += cost;

    // 通常曲：アイテム獲得
    if (
      selected === "normalManual" ||
      selected === "normalBg"
    ) {
      currentItems += lane.itemsPerRun;
      totalEarnedItems += lane.itemsPerRun;

      if (selected === "normalManual") {
        manualItems += lane.itemsPerRun;
      } else {
        bgItems += lane.itemsPerRun;
      }

    // イベント曲：アイテム消費
    } else {
      currentItems -= itemsPerEventSong;
      usedItems += itemsPerEventSong;

      const currentBonus = getBonusAtElapsed(
        absoluteStartTime,
        bonusSchedule
      );

      if (selected === "eventManual") {
        manualDailyPoint += calculateEventPoint(
          currentBonus + manualBonusAddition
        );
      } else {
        bgDailyPoint += calculateEventPoint(
          currentBonus
        );
      }
    }

    // 誤差による上限超過を補正
    if (
      currentItems > requiredItems &&
      currentItems <= requiredItems + epsilon
    ) {
      currentItems = requiredItems;
    }
  }

  // 全レーンの実行状況
  const errors = [];


//const epsilon = 1e-7;

// BGは設定時間を厳守する
const pendingNormalBg =
  lanes.normalBg.runs < lanes.normalBg.capacity;

const pendingEventBg =
  lanes.eventBg.runs < lanes.eventBg.capacity;

// 手打ちは残り時間の範囲で最適化するため、
// 最大回数までプレイできなくてもエラーにしない
if (pendingNormalBg) {
  errors.push("limit");
}

if (pendingEventBg) {
  errors.push("depletion");
}

// 所持アイテムの範囲も確認
if (currentItems < -epsilon) {
  errors.push("depletion");
}

if (currentItems > requiredItems + epsilon) {
  errors.push("limit");
}


  const normalManualRuns = lanes.normalManual.runs;
  const normalBgRuns = lanes.normalBg.runs;

  const manualEventRuns = lanes.eventManual.runs;
  const bgEventRuns = lanes.eventBg.runs;

  const actualEventRuns =
    manualEventRuns + bgEventRuns;

  const normalFullTime =
    usedTime(normalManualRuns, normalManualCycle) +
    usedTime(normalBgRuns, normalBgCycle);

  const eventFullTime =
    usedTime(manualEventRuns, eventManualCycle) +
    usedTime(bgEventRuns, eventBgCycle);

  const dailyPoint =
    manualDailyPoint + bgDailyPoint;

  const totalNormalRuns =
    normalManualRuns + normalBgRuns;

  return {
    errors,

    averageItem: totalNormalRuns
      ? totalEarnedItems / totalNormalRuns
      : 0,

    totalItems: totalEarnedItems,
    manualItems,
    bgItems,
    currentItems,
    usedItems,

    normalManualRuns,
    normalBgRuns,

    manualEventRuns,
    bgEventRuns,

    actualEventRuns,

    dailyPoint,
    manualDailyPoint,
    bgDailyPoint,

    normalFullTime,
    eventFullTime,

    normalManualTime: usedTime(
      normalManualRuns,
      normalManualCycle
    ),

    eventManualTime: usedTime(
      manualEventRuns,
      eventManualCycle
    )
  };
}


 // ===================================
 // 混合モード計算
 // ===================================

function calculateMixedMode(
  song,
  eventTime,
  networkTime,
  itemMap,
  showAlert = true,
  periodSeconds = MAX_DAILY_SECONDS,
  startingItems = 0,
  elapsedStartSeconds = 0
) {
  const bonusSchedule = getBonusSchedule(showAlert);
  if (!bonusSchedule) return null;

  const bgTimes = getBgTimes();

  const normalBgTime = bgTimes.normalBg;
  const eventBgTime = eventTime > 0
    ? bgTimes.eventBg
    : 0;

  const remaining =
    periodSeconds - normalBgTime - eventBgTime;

  if (remaining < -1e-7) {
    if (showAlert) {
      alert("BG時間がプレイ可能時間を超えています。");
    }
    return null;
  }

  const averageManual = calculateManualAverage(
    itemMap,
    showAlert
  );

  if (averageManual === null) return null;

  // 1曲あたりの時間
  const normalManualCycle = getCycleTime(
    song.time, true, false, networkTime
  );

  const normalBgCycle = getCycleTime(
    song.time, false, false, networkTime
  );

  const eventManualCycle = getCycleTime(
    eventTime, true, true, networkTime
  );

  const eventBgCycle = getCycleTime(
    eventTime, false, true, networkTime
  );

  // BGのプレイ可能回数
  const bgNormalCapacity = capacityFor(
    normalBgTime,
    normalBgCycle
  );

  const bgEventCapacity = eventTime > 0
    ? capacityFor(eventBgTime, eventBgCycle)
    : 0;

  // 手打ち通常曲の最大回数
  const maxNormalManual = capacityFor(
    remaining,
    normalManualCycle
  );

  let best = null;
  const failureErrors = new Set();

  for (
    let normalRuns = 0;
    normalRuns <= maxNormalManual;
    normalRuns++
  ) {
    const normalTime = usedTime(
      normalRuns,
      normalManualCycle
    );

    const timeLeft = Math.max(
      0,
      remaining - normalTime
    );

    const maxEventByTime = eventTime > 0
      ? capacityFor(timeLeft, eventManualCycle)
      : 0;

    // その日に集められるアイテム
    const availableItems =
      startingItems +
      normalRuns * averageManual +
      bgNormalCapacity * itemMap.Dコン;

    // BGイベント曲の必要アイテム
    const requiredBgItems =
      bgEventCapacity * itemsPerEventSong;

    const remainingItems =
      availableItems - requiredBgItems;

    if (remainingItems < -1e-7) {
      failureErrors.add("depletion");
      continue;
    }

    const maxEventByItems = Math.floor(
      (remainingItems + 1e-7) / itemsPerEventSong
    );

    const maxEventManual = Math.max(
      0,
      Math.min(maxEventByTime, maxEventByItems)
    );

    // イベント曲手打ち回数も調整
    for (
      let eventRuns = maxEventManual;
      eventRuns >= 0;
      eventRuns--
    ) {
      const candidate = simulateMixed(
        song,
        eventTime,
        networkTime,
        itemMap,
        {
          normalManual: normalRuns,
          normalBg: bgNormalCapacity,
          eventManual: eventRuns,
          eventBg: bgEventCapacity
        },
        averageManual,
        bonusSchedule,
        startingItems,
        elapsedStartSeconds
      );

      if (candidate.errors.length > 0) {
        candidate.errors.forEach(error => {
          failureErrors.add(error);
        });
        continue;
      }

      if (
        best === null ||
        candidate.dailyPoint > best.dailyPoint ||
        (
          candidate.dailyPoint === best.dailyPoint &&
          candidate.currentItems > best.currentItems
        )
      ) {
        best = candidate;
      }

      break;
    }
  }

  if (best === null) {
    console.log("混合モード計算失敗", {
      failureErrors: Array.from(failureErrors),
      startingItems,
      periodSeconds,
      normalBgTime,
      eventBgTime,
      remaining,
      maxNormalManual,
      bgNormalCapacity,
      bgEventCapacity,
      averageManual
    });

    if (showAlert) {
      showMixedCalculationError(
        Array.from(failureErrors)
      );
    }

    return null;
  }

  best.optimizedManualNormalRuns =
    best.normalManualRuns;

  best.optimizedManualEventRuns =
    best.manualEventRuns;

  return best;
}




function getEventDaySeconds(index) {
  const isLastDay = index === eventDateList.length - 1;

  return isLastDay
    ? 9 * 60 * 60
    : 24 * 60 * 60;
}

function getEventTotalSeconds() {
  return eventDateList.reduce(
    (total, item, index) =>
      total + getEventDaySeconds(index),
    0
  );
}

function getEffectiveDaySetting(index) {
  const own = dailySettings[index];

  if (!own) return null;

  if (index === 0 || own.useOwnSettings) {
    return own;
  }

  return dailySettings[0];
}


function simulateEventByDays(
  mode,
  song,
  eventTime,
  networkTime,
  itemMap
) {
  const bonusSchedule = getBonusSchedule(false);

  if (!bonusSchedule) return null;

  const results = [];

  let currentItems = 0;
  let elapsedSeconds = 0;

  let totalPoints = 0;
  let totalEventRuns = 0;

  const originalDayIndex = selectedEventDayIndex;

  for (let index = 0; index < eventDateList.length; index++) {
    const setting = getEffectiveDaySetting(index);

    if (!setting) return null;

    const periodSeconds = getEventDaySeconds(index);

    // この日の設定を画面上の計算入力へ反映
    // 先にBG時間をリセットして、前日の上限の影響を防ぐ
    setWheelValue("normalBg", 0);
    setWheelValue("eventBg", 0);

    accuracyIds.forEach(id => {
      $(id).value = String(setting.accuracy[id] ?? 0);
    });

    updateAccuracyLimit();

    setWheelValue("normalBg", setting.normalBg);
    setWheelValue("eventBg", setting.eventBg);

    let result;

    if (mode === "both") {
      const bgTotal =
        setting.normalBg +
        (eventTime > 0 ? setting.eventBg : 0);

      if (bgTotal > periodSeconds) {
        alert(
          `${index + 1}日目のBG時間が、` +
          `プレイ可能時間を超えています。`
        );
        return null;
      }

      result = calculateMixedMode(
        song,
        eventTime,
        networkTime,
        itemMap,
        false,
        periodSeconds,
        currentItems,
        elapsedSeconds
      );

    } else {
      const isManual = !isFullBackground;

      result = simulateSinglePeriod(
        periodSeconds,
        isManual,
        song,
        eventTime,
        networkTime,
        itemMap,
        bonusSchedule,
        currentItems,
        elapsedSeconds
      );
    }

    console.log("日別計算の確認", {
  day: index + 1,
  periodSeconds,
  startingItems: currentItems,
  result,
  setting: getEffectiveDaySetting(index)
});
    if (!result || result.errors?.length) {
      alert(
        `${index + 1}日目の計算に失敗しました。\n` +
        "精度・BG時間・アイテム数を確認してください。"
      );
      return null;
    }

    currentItems = result.currentItems;
    totalPoints += result.dailyPoint;
    totalEventRuns += result.actualEventRuns;

    results.push({
      date: eventDateList[index].date,
      day: index + 1,
      periodSeconds,
      ...result
    });

    elapsedSeconds += periodSeconds;
  }

  return {
    days: results,
    totalPoints,
    totalEventRuns,
    finalItems: currentItems,
    totalSeconds: elapsedSeconds
  };
}


// ===================================
// 225時間シミュレーション
// ===================================

function simulate225Hours(simulateDay) {
  const totalSeconds =
    eventDurationHours * 3600;

  let elapsed = 0;
  let currentItems = 0;

  const total = {
    eventRuns: 0,
    eventPoints: 0,

    manualEventRuns: 0,
    bgEventRuns: 0,

    normalManualRuns: 0,
    normalBgRuns: 0,

    earnedItems: 0
  };

  while (elapsed < totalSeconds) {
    const periodSeconds = Math.min(
      MAX_DAILY_SECONDS,
      totalSeconds - elapsed
    );

    const result = simulateDay(
      periodSeconds,
      currentItems,
      elapsed
    );

    if (!result) {
      break;
    }

    currentItems = result.currentItems;

    total.eventRuns += result.actualEventRuns;
    total.eventPoints += result.dailyPoint;

    total.manualEventRuns +=
      result.manualEventRuns || 0;

    total.bgEventRuns +=
      result.bgEventRuns || 0;

    total.normalManualRuns +=
      result.normalManualRuns || 0;

    total.normalBgRuns +=
      result.normalBgRuns || 0;

    total.earnedItems +=
      result.totalItems || 0;

    elapsed += periodSeconds;
  }

  return {
    ...total,
    currentItems,
    elapsedSeconds: elapsed,
    completed: elapsed >= totalSeconds
  };
}

// ===================================
// フル手打ち・フルBGの時間内シミュレーション
// ===================================

function simulateSinglePeriod(
  periodSeconds,
  isManual,
  song,
  eventTime,
  networkTime,
  itemMap,
  bonusSchedule,
  startingItems = 0,
  elapsedStartSeconds = 0
) {
  const averageItem = isManual
    ? calculateManualAverage(itemMap, false)
    : itemMap.Dコン;

  if (averageItem === null) {
    return null;
  }

  const normalCycle = getCycleTime(
    song.time,
    isManual,
    false,
    networkTime
  );

  const eventCycle = getCycleTime(
    eventTime,
    isManual,
    true,
    networkTime
  );

  let currentItems = startingItems;
  let earnedItems = 0;
  let usedItems = 0;

  let normalRuns = 0;
  let eventRuns = 0;

  let normalTime = 0;
  let eventTimeUsed = 0;

  let elapsed = 0;

  let dailyPoint = 0;

  let firstRun = true;

  function getNextCost(cycleInfo) {
    return cycleInfo.cycle -
      (firstRun ? cycleInfo.standby : 0);
  }

  let guard = 0;

  while (guard++ < 10000) {
    let selected = null;

    if (currentItems >= itemsPerEventSong) {
      const cost = getNextCost(eventCycle);

      if (elapsed + cost <= periodSeconds + 1e-9) {
        selected = "event";
      }
    }

    if (selected === null) {
      const cost = getNextCost(normalCycle);

      const canEarn =
        currentItems + averageItem <=
        requiredItems + 1e-7;

      if (
        canEarn &&
        elapsed + cost <= periodSeconds + 1e-9
      ) {
        selected = "normal";
      }
    }

    if (selected === null) {
      break;
    }

    if (selected === "normal") {
      const cost = getNextCost(normalCycle);

      elapsed += cost;
      normalTime += cost;

      normalRuns++;

      currentItems += averageItem;
      earnedItems += averageItem;

    } else {
      const cost = getNextCost(eventCycle);

      // プレイ開始時点の特攻値を取得
      const currentBonus = getBonusAtElapsed(
        elapsedStartSeconds + elapsed,
        bonusSchedule
      );

      const adjustedBonus = isManual
        ? currentBonus + manualBonusAddition
        : currentBonus;

      dailyPoint += calculateEventPoint(
        adjustedBonus
      );

      elapsed += cost;
      eventTimeUsed += cost;

      eventRuns++;

      currentItems -= itemsPerEventSong;
      usedItems += itemsPerEventSong;
    }

    firstRun = false;
  }

  return {
    averageItem,

    currentItems,
    totalItems: earnedItems,
    usedItems,

    normalManualRuns: isManual
      ? normalRuns
      : 0,

    normalBgRuns: isManual
      ? 0
      : normalRuns,

    manualEventRuns: isManual
      ? eventRuns
      : 0,

    bgEventRuns: isManual
      ? 0
      : eventRuns,

    actualEventRuns: eventRuns,

    normalFullTime: normalTime,
    eventFullTime: eventTimeUsed,

    dailyPoint,

    manualDailyPoint: isManual
      ? dailyPoint
      : 0,

    bgDailyPoint: isManual
      ? 0
      : dailyPoint
  };
}

// ===================================
// フル手打ち・フルBG計算
// ===================================

function calculateSingleMode(
  isManual,
  song,
  eventTime,
  networkTime,
  itemMap
) {
  const bonusSchedule = getBonusSchedule(true);

  if (!bonusSchedule) {
    return null;
  }

  const averageItem = isManual
    ? calculateManualAverage(itemMap)
    : itemMap.Dコン;

  if (averageItem === null) {
    return null;
  }

  const normalCycle = getCycleTime(
    song.time,
    isManual,
    false,
    networkTime
  );

  const eventCycle = getCycleTime(
    eventTime,
    isManual,
    true,
    networkTime
  );

  const normalFullTime =
    (requiredItems / averageItem) *
    normalCycle.cycle -
    normalCycle.standby;

  const eventFullTime = usedTime(
    eventFullCount,
    eventCycle
  );

  const daily = simulateSinglePeriod(
    MAX_DAILY_SECONDS,
    isManual,
    song,
    eventTime,
    networkTime,
    itemMap,
    bonusSchedule,
    0,
    0
  );

  const projection = simulate225Hours(
    (periodSeconds, startingItems, elapsedSeconds) => {
      return simulateSinglePeriod(
        periodSeconds,
        isManual,
        song,
        eventTime,
        networkTime,
        itemMap,
        bonusSchedule,
        startingItems,
        elapsedSeconds
      );
    }
  );

  return {
    averageItem,

    normalFullTime,
    eventFullTime,

    daySet: daily.actualEventRuns / eventFullCount,
    dayPoint: daily.dailyPoint,

    dailyEventRuns: daily.actualEventRuns,

    set225: projection.eventRuns / eventFullCount,
    point225: projection.eventPoints,

    projectedEventRuns: projection.eventRuns,
    projectedPoint: projection.eventPoints,

    daily,
    projection
  };
}

// ===================================
// 混合モードのプレビュー
// ===================================

function updateMixedPreview() {
  updateDailyTimeTotal();

  if (getSelectedPlayMode() !== "both") {
    return;
  }

  const result = calculateMixedMode(
    normalSongs[$("normalSong").selectedIndex],
    getEventInputTime(),
    getNetworkTime(),
    getItemMap(),
    false
  );

  latestMixedResult = result;
}

// ===================================
// 入力チェック
// ===================================

function validateCommonInputs(mode) {
  const minText = $("eventMin").value;
  const secText = $("eventSec").value;

  const min = Number(minText || 0);
  const sec = Number(secText || 0);

  const eventTime = min * 60 + sec;

  if (mode !== "both" || eventTime > 0) {
    if (
      minText === "" ||
      !Number.isInteger(min) ||
      min < 0 ||
      !Number.isInteger(sec) ||
      sec < 0 ||
      sec > 59 ||
      eventTime <= 0
    ) {
      alert("イベント曲の時間を正しく入力してください。");
      return false;
    }
  }

  if (!getBonusSchedule(true)) {
    return false;
  }

  return true;
}

function validateBgTimes() {
  const totalSeconds =
    getWheelSeconds("normalBg") +
    getWheelSeconds("eventBg");

  if (totalSeconds > MAX_DAILY_SECONDS) {
    alert("バクグラ時間の合計は24時間以内にしてください。");
    return false;
  }

  return true;
}

// ===================================
// 共通結果表示
// ===================================

function showCommonResult(song, mode, result) {
  $("resultSong").textContent = song.name;
  $("resultMode").textContent = mode;

  $("resultAverage").textContent =
    `${result.averageItem.toFixed(2)} 個`;

  $("resultNormalTime").textContent =
    secToTime(result.normalFullTime);

  $("resultEventTime").textContent =
    secToTime(result.eventFullTime);
}

// ===================================
// フル手打ち・フルBG結果表示
// ===================================

function showSingleResult(song, isManual, result) {
  $("mixedBreakdown").hidden = true;

  showCommonResult(
    song,
    isManual
      ? "フル手打ち"
      : "フルバクグラ",
    result
  );

  $("resultDailyItems").textContent =
    result.averageItem.toFixed(2);

  $("resultDailyEventRuns").textContent =
    result.dailyEventRuns.toLocaleString();

  $("resultDayPoint").textContent =
    Math.floor(result.dayPoint).toLocaleString();


  $("result225Point").textContent =
    Math.floor(result.projectedPoint).toLocaleString();
}

// ===================================
// 手打ち＆BG結果表示
// ===================================

function showMixedResult(song, result) {
  showCommonResult(
    song,
    "手打ち＆バックグラウンド（手打ち時間自動最適化）",
    result
  );

  $("mixedBreakdown").hidden = false;

  $("resultDailyItems").textContent =
    Math.floor(result.totalItems).toLocaleString();

  $("resultDailyEventRuns").textContent =
    result.actualEventRuns.toLocaleString();

  $("resultDayPoint").textContent =
    Math.floor(result.dailyPoint).toLocaleString();



  $("result225Point").textContent =
    Math.floor(result.projectedPoint).toLocaleString();

  $("resultManualNormalRuns").textContent =
    result.normalManualRuns.toLocaleString();

  $("resultBgNormalRuns").textContent =
    result.normalBgRuns.toLocaleString();

  $("resultManualItems").textContent =
    Math.floor(result.manualItems).toLocaleString();

  $("resultBgItems").textContent =
    Math.floor(result.bgItems).toLocaleString();

  $("resultManualEventRuns").textContent =
    result.manualEventRuns.toLocaleString();

  $("resultBgEventRuns").textContent =
    result.bgEventRuns.toLocaleString();

  $("resultManualEventPoints").textContent =
    Math.floor(result.manualDailyPoint).toLocaleString();

  $("resultBgEventPoints").textContent =
    Math.floor(result.bgDailyPoint).toLocaleString();

  $("resultManualNormalTime").textContent =
    secToTime(result.normalManualTime);

  $("resultManualEventTime").textContent =
    secToTime(result.eventManualTime);
}

// ===================================
// 計算実行
// ===================================






function renderDailyPointChart(days) {
  const container = document.getElementById("dailyPointChart");
  if (!container) return;

  container.replaceChildren();

  if (!Array.isArray(days) || days.length === 0) return;

  const values = days.map(day =>
    Math.max(0, Number(day.dailyPoint) || 0)
  );

  const maximum = Math.max(...values, 1);

  // 縦軸を見やすい数値に丸める
  const rawStep = maximum / 5;
  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(rawStep))
  );
  const step = Math.ceil(rawStep / magnitude) * magnitude;
  const axisMax = step * 5;

  // グラフ全体
  const chart = document.createElement("div");
  chart.className = "point-chart-layout";

  // 左側：縦軸
  const axis = document.createElement("div");
  axis.className = "point-chart-axis";

  for (let i = 5; i >= 0; i--) {
    const label = document.createElement("span");
    label.textContent = (step * i).toLocaleString();
    axis.appendChild(label);
  }

  // 右側：棒グラフ
  const plot = document.createElement("div");
  plot.className = "point-chart-plot";
  plot.style.setProperty("--chart-days", days.length);

  // 補助線
  const grid = document.createElement("div");
  grid.className = "point-chart-grid";

  for (let i = 0; i <= 5; i++) {
    const line = document.createElement("div");
    line.className = "point-chart-grid-line";
    grid.appendChild(line);
  }

  plot.appendChild(grid);

  // 棒グラフ
  days.forEach((day, index) => {
    const point = values[index];
    const percent = (point / axisMax) * 100;

    const column = document.createElement("div");
    column.className = "point-chart-column";

    const valueLabel = document.createElement("div");
    valueLabel.className = "point-chart-value";
    valueLabel.textContent = point.toLocaleString();

const bar = document.createElement("div");
bar.className = "point-chart-bar";

// グラフの高さ220pxを基準に計算
const barHeight = (point / axisMax) * 220;

bar.style.height = `${barHeight}px`;
    bar.title = `${index + 1}日目：${point.toLocaleString()} pt`;

    const dayLabel = document.createElement("div");
    dayLabel.className = "point-chart-day";
    dayLabel.textContent = `${index + 1}日目`;

valueLabel.style.bottom = `${barHeight + 5}px`;
valueLabel.style.top = "auto";

column.append(valueLabel, bar, dayLabel);
    plot.appendChild(column);
  });

  chart.append(axis, plot);
  container.appendChild(chart);
}





function switchResultView(isMixedMode) {
  const eventSummary = $("eventSummaryResult");
  const normalResult = $("results");

  const commonSummary = document.querySelector(".result-summary");
  const resultContent = normalResult?.querySelector(".result-content");

  if (!eventSummary || !normalResult || !commonSummary || !resultContent) {
    return;
  }

  // 共通5項目をモードに応じた場所へ移動
  if (isMixedMode) {
    // 混合モード：日別詳細の下
    eventSummary.appendChild(commonSummary);
  } else {
    // フル手打ち・フルBG：従来のResult内
    resultContent.prepend(commonSummary);
  }

  // 表示切り替え
  eventSummary.hidden = !isMixedMode;
  normalResult.hidden = isMixedMode;
}


function renderDailyResultDetails(days) {
  const tabs = document.getElementById("resultDayTabs");

  if (!tabs || !Array.isArray(days) || days.length === 0) {
    return;
  }

  tabs.replaceChildren();

  function showDay(index) {
    const day = days[index];
    if (!day) return;

    const setting = getEffectiveDaySetting(index);

    document.getElementById("resultSelectedDay").textContent =
      `${index + 1}日目`;

    document.getElementById("resultNormalBgTime").textContent =
      secToTime(setting?.normalBg ?? 0);

    document.getElementById("resultEventBgTime").textContent =
      secToTime(setting?.eventBg ?? 0);

    document.getElementById("resultEarnedItems").textContent =
      Math.floor(day.totalItems ?? 0).toLocaleString();

    document.getElementById("resultDailyPoints").textContent =
      Math.floor(day.dailyPoint ?? 0).toLocaleString();

    tabs.querySelectorAll(".result-day-tab").forEach(
      (button, buttonIndex) => {
        button.classList.toggle(
          "active",
          buttonIndex === index
        );
      }
    );
  }

  days.forEach((day, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "event-date-tab result-day-tab";
    button.textContent = `${index + 1}日目`;

    button.addEventListener("click", () => {
      showDay(index);
    });

    tabs.appendChild(button);
  });

  // 初期表示は1日目
  showDay(0);
}



function showEventSummaryResult(projection) {
  if (!projection || !Array.isArray(projection.days)) {
    return;
  }

  const days = projection.days;

  // 総合獲得ポイント
  const totalPoints = days.reduce(
    (total, day) =>
      total + (Number(day.dailyPoint) || 0),
    0
  );

  $("eventTotalPoints").textContent =
    Math.floor(totalPoints).toLocaleString();

  $("eventTotalDays").textContent =
    `イベント全${days.length}日間の合計`;

  // 日別グラフ
  renderDailyPointChart(days);

  // 日別詳細
  renderDailyResultDetails(days);

  // 新Result画面を表示
  $("eventSummaryResult").hidden = false;
}




function runCalculation() {
  const mode = getSelectedPlayMode();

  if (!validateCommonInputs(mode)) return;

  if (!eventDateList.length) {
    alert("イベント日程を設定してください。");
    return;
  }

  saveCurrentDayInputs();

  const song = normalSongs[$("normalSong").selectedIndex];
  const eventTime = getEventInputTime();
  const networkTime = getNetworkTime();
  const itemMap = getItemMap();

  const originalIndex = selectedEventDayIndex;

  let projection;

  try {
    projection = simulateEventByDays(
      mode,
      song,
      eventTime,
      networkTime,
      itemMap
    );
  } finally {
    // 計算前に選択していた日付へ戻す
    setWheelValue("normalBg", 0);
    setWheelValue("eventBg", 0);
    applyDayInputs(originalIndex);
    renderEventDateTabs();
  }

  if (!projection) return;

  const firstDay = projection.days[0];

  if (mode === "both") {
    const result = {
      ...firstDay,
      projectedEventRuns: projection.totalEventRuns,
      projectedPoint: projection.totalPoints,
      projection
    };

    showMixedResult(song, result);

  } else {
    const isManual = !isFullBackground;

    const averageItem = isManual
      ? calculateManualAverage(itemMap, false)
      : itemMap.Dコン;

    const normalCycle = getCycleTime(
      song.time, isManual, false, networkTime
    );

    const eventCycle = getCycleTime(
      eventTime, isManual, true, networkTime
    );

    const result = {
      averageItem,
      normalFullTime:
        (requiredItems / averageItem) *
        normalCycle.cycle - normalCycle.standby,
      eventFullTime: usedTime(eventFullCount, eventCycle),
      dailyEventRuns: firstDay.actualEventRuns,
      dayPoint: firstDay.dailyPoint,
      projectedPoint: projection.totalPoints
    };

    showSingleResult(song, isManual, result);
  }

// プレイモードによってResult画面を切り替える
if (mode === "both") {
  // 混合モード：新しいResult画面
  showEventSummaryResult(projection);
  switchResultView(true);
} else {
  // フル手打ち・フルバックグラウンド：従来のResult画面
  switchResultView(false);
}

// 保存
saveLocalData();

// Result画面へ移動
showScreen("result");
}


$("calc").addEventListener("click", runCalculation);

// ===================================
// 共通ホイール設定
// ===================================

// ダイアログで使用するホイールID
const dialogWheelIds = {
  Hour: "dialogHourWheel",
  Min: "dialogMinWheel",
  Sec: "dialogSecWheel"
};

// 現在編集している時間の種類
let activeWheelKey = null;

// ダイアログ内の仮設定時間
let dialogWheelDraft = null;

// ダイアログを開く前のスクロール状態
let previousBodyOverflow = "";


// ===================================
// 時間表示更新
// ===================================

function updateWheelTimeDisplay(key) {

  const textId = key === "normalBg"
    ? "normalBgTimeText"
    : "eventBgTimeText";

  $(textId).textContent =
    secToTime(wheelState[key].seconds);
}


// ===================================
// ホイール描画
// 上下の余白と数字の高さを固定
// ===================================

function renderWheel(key, unit, maxValue, selectedValue) {

  const wheel = $(dialogWheelIds[unit]);

  if (!wheel) return;

  const rowHeight = WHEEL_ROW_HEIGHT;

  // ホイールの表示領域の高さ
  const wheelHeight = wheel.clientHeight;

  // 数字を中央に配置するための上下余白
  const spacerHeight = Math.max(
    0,
    (wheelHeight - rowHeight) / 2
  );

  wheel.innerHTML = "";

  // 上側の余白
  const topSpacer = document.createElement("div");

  topSpacer.className = "wheel-spacer";

  topSpacer.style.height = `${spacerHeight}px`;
  topSpacer.style.minHeight = `${spacerHeight}px`;
  topSpacer.style.flex = `0 0 ${spacerHeight}px`;

  wheel.appendChild(topSpacer);

  // 数字を作成
  for (let value = 0; value <= maxValue; value++) {

    const option = document.createElement("div");

    option.className = "wheel-option";
    option.dataset.value = String(value);
    option.textContent = String(value);

    // 数字の高さを40pxに固定
    option.style.height = `${rowHeight}px`;
    option.style.minHeight = `${rowHeight}px`;
    option.style.maxHeight = `${rowHeight}px`;
    option.style.flex = `0 0 ${rowHeight}px`;
    option.style.boxSizing = "border-box";
    option.style.margin = "0";

    wheel.appendChild(option);
  }

  // 下側の余白
  const bottomSpacer = document.createElement("div");

  bottomSpacer.className = "wheel-spacer";

  bottomSpacer.style.height = `${spacerHeight}px`;
  bottomSpacer.style.minHeight = `${spacerHeight}px`;
  bottomSpacer.style.flex = `0 0 ${spacerHeight}px`;

  wheel.appendChild(bottomSpacer);

  wheel.dataset.rowHeight = String(rowHeight);

  // 選択数字を中央に配置
  wheel.scrollTop = selectedValue * rowHeight;

  updateWheelHighlight(wheel);
}


// ===================================
// ホイール選択位置更新
// 実際に中央にある数字を取得
// ===================================

function updateWheelHighlight(wheel) {

  const options = [
    ...wheel.querySelectorAll(".wheel-option")
  ];

  if (options.length === 0) return 0;

  const wheelRect = wheel.getBoundingClientRect();

  const centerY =
    wheelRect.top + wheelRect.height / 2;

  let selectedOption = options[0];
  let minDistance = Infinity;

  options.forEach(option => {

    const rect = option.getBoundingClientRect();

    const optionCenter =
      rect.top + rect.height / 2;

    const distance = Math.abs(
      centerY - optionCenter
    );

    if (distance < minDistance) {
      minDistance = distance;
      selectedOption = option;
    }

  });

  options.forEach(option => {

    option.classList.toggle(
      "selected",
      option === selectedOption
    );

  });

  return Number(selectedOption.dataset.value);
}


// ===================================
// BG時間の上限
// ===================================

function getWheelMaxSeconds(key) {

  const otherKey = key === "normalBg"
    ? "eventBg"
    : "normalBg";

  const otherSeconds =
    wheelState[otherKey]?.seconds || 0;

  if (
    key === "eventBg" &&
    getEventInputTime() <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    MAX_DAILY_SECONDS - otherSeconds
  );
}


// ===================================
// ホイールの各項目の最大値
// ===================================

function getWheelUnitMax(
  key,
  unit,
  current = wheelState[key]
) {

  const maxSeconds = getWheelMaxSeconds(key);

  if (unit === "Hour") {

    return Math.floor(maxSeconds / 3600);

  }

  if (unit === "Min") {

    if (current.hour * 3600 > maxSeconds) {
      return 0;
    }

    const remaining =
      maxSeconds - current.hour * 3600;

    return Math.min(
      59,
      Math.floor(remaining / 60)
    );

  }

  if (unit === "Sec") {

    const used =
      current.hour * 3600 +
      current.minute * 60;

    if (used > maxSeconds) {
      return 0;
    }

    return Math.min(
      59,
      maxSeconds - used
    );

  }

  return 0;
}


// ===================================
// ダイアログ内ホイール描画
// ===================================

function renderDialogWheels() {

  if (!activeWheelKey || !dialogWheelDraft) {
    return;
  }

  const key = activeWheelKey;
  const current = dialogWheelDraft;

  ["Hour", "Min", "Sec"].forEach(unit => {

    const stateValue =
      unit === "Hour"
        ? current.hour
        : unit === "Min"
          ? current.minute
          : current.second;

    renderWheel(
      key,
      unit,
      getWheelUnitMax(key, unit, current),
      stateValue
    );

  });

}


// ===================================
// 確定済みホイールの値を設定
// ===================================

function setWheelValue(key, totalSeconds) {

  totalSeconds = Math.max(
    0,
    Math.floor(totalSeconds || 0)
  );

  totalSeconds = Math.min(
    totalSeconds,
    getWheelMaxSeconds(key)
  );

  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;

  wheelState[key] = {
    seconds: totalSeconds,
    hour,
    minute,
    second
  };

  updateWheelTimeDisplay(key);

  updateDailyTimeTotal();

  if (activeWheelKey === key) {
    dialogWheelDraft = { ...wheelState[key] };
    renderDialogWheels();
  }

}


// ===================================
// ホイール上限更新
// ===================================

function refreshWheelLimits() {

  ["normalBg", "eventBg"].forEach(key => {

    const maxSeconds = getWheelMaxSeconds(key);

    const seconds = Math.min(
      wheelState[key].seconds,
      maxSeconds
    );

    const hour = Math.floor(seconds / 3600);
    const minute = Math.floor((seconds % 3600) / 60);
    const second = seconds % 60;

    wheelState[key] = {
      seconds,
      hour,
      minute,
      second
    };

    updateWheelTimeDisplay(key);

  });

  updateDailyTimeTotal();

  if (activeWheelKey) {
    dialogWheelDraft = { ...wheelState[activeWheelKey] };
    renderDialogWheels();
  }

}


// ===================================
// ダイアログ内の仮時間を更新
// ===================================

function updateWheelValueFromScroll(unit, value) {

  if (!activeWheelKey || !dialogWheelDraft) {
    return;
  }

  const key = activeWheelKey;
  const current = { ...dialogWheelDraft };

  if (unit === "Hour") {
    current.hour = value;
  }

  if (unit === "Min") {
    current.minute = value;
  }

  if (unit === "Sec") {
    current.second = value;
  }

  const maxSeconds = getWheelMaxSeconds(key);

  let totalSeconds =
    current.hour * 3600 +
    current.minute * 60 +
    current.second;

  totalSeconds = Math.max(
    0,
    Math.min(totalSeconds, maxSeconds)
  );

  dialogWheelDraft = {
    seconds: totalSeconds,
    hour: Math.floor(totalSeconds / 3600),
    minute: Math.floor((totalSeconds % 3600) / 60),
    second: totalSeconds % 60
  };

  // 時間変更後は分・秒の選択可能範囲を更新
  if (unit === "Hour") {
    renderWheel(
      key,
      "Min",
      getWheelUnitMax(key, "Min", dialogWheelDraft),
      dialogWheelDraft.minute
    );

    renderWheel(
      key,
      "Sec",
      getWheelUnitMax(key, "Sec", dialogWheelDraft),
      dialogWheelDraft.second
    );
  }

  // 分変更後は秒の選択可能範囲を更新
  if (unit === "Min") {
    renderWheel(
      key,
      "Sec",
      getWheelUnitMax(key, "Sec", dialogWheelDraft),
      dialogWheelDraft.second
    );
  }
}


// ===================================
// ダイアログを開く
// ===================================

function openTimeDialog(key) {
  hideDailyCheckStatus();

  activeWheelKey = key;

  dialogWheelDraft = {
    ...wheelState[key]
  };

  $("timeDialogTitle").textContent =
    key === "normalBg"
      ? "通常曲BG時間設定"
      : "イベント曲BG時間設定";

  // ダイアログを表示
$("timeDialogOverlay").hidden = false;

// 表示後にホイールを描画
requestAnimationFrame(() => {
  renderDialogWheels();
});

  previousBodyOverflow =
    document.body.style.overflow;

  document.body.style.overflow = "hidden";

  $("timeDialogOverlay").hidden = false;

  $("confirmTimeDialog").focus();

}


// ===================================
// 日別設定のリアルタイム判定
// ===================================

let dailyCheckTimer = null;

function showDailyCheckStatus(type, title, message) {
  const area = $("dailyCheckStatus");
  if (!area) return;

  area.hidden = false;
  area.className = `daily-check-status ${type}`;

  area.replaceChildren();

  const titleElement = document.createElement("div");
  titleElement.className = "daily-check-title";
  titleElement.textContent = title;

  const messageElement = document.createElement("div");
  messageElement.className = "daily-check-message";
  messageElement.textContent = message;

  area.append(titleElement, messageElement);
}

function hideDailyCheckStatus() {
  const area = $("dailyCheckStatus");
  if (area) area.hidden = true;
}

// 各日の入力を使って、成立するかを確認
function checkDailySettings() {
  clearTimeout(dailyCheckTimer);

  saveCurrentDayInputs();

  const mode = getSelectedPlayMode();

  if (mode !== "both") {
    hideDailyCheckStatus();
    return;
  }

  const song = normalSongs[$("normalSong").selectedIndex];
  const eventTime = getEventInputTime();
  const networkTime = getNetworkTime();
  const itemMap = getItemMap();

  if (!eventDateList.length || eventTime <= 0) {
    showDailyCheckStatus(
      "pending",
      "未判定",
      "イベント日程とイベント曲時間を設定してください。"
    );
    return;
  }

  const savedIndex = selectedEventDayIndex;
  const selectedDay = savedIndex + 1;

  showDailyCheckStatus(
    "pending",
    "判定中",
    `${selectedDay}日目の設定を確認しています。`
  );

  // 確定後、画面の描画を優先してから計算
  dailyCheckTimer = setTimeout(() => {
    let currentItems = 0;
    let elapsedSeconds = 0;
    let failure = null;

    try {
      for (let i = 0; i < eventDateList.length; i++) {
        const setting = getEffectiveDaySetting(i);
        const periodSeconds = getEventDaySeconds(i);

        if (!setting) {
          failure = {
            day: i + 1,
            message: "日別設定が見つかりません。"
          };
          break;
        }

        const normalBg = Number(setting.normalBg) || 0;
        const eventBg = Number(setting.eventBg) || 0;

        if (normalBg + eventBg > periodSeconds) {
          failure = {
            day: i + 1,
            message:
              `BG時間が${secToTime(
                normalBg + eventBg - periodSeconds
              )}超過しています。`
          };
          break;
        }

        // その日の設定を計算用の入力に反映
        setWheelValue("normalBg", 0);
        setWheelValue("eventBg", 0);

        accuracyIds.forEach(id => {
          $(id).value = String(setting.accuracy[id] ?? 0);
        });

        setWheelValue("normalBg", normalBg);
        setWheelValue("eventBg", eventBg);

        const averageManual = calculateManualAverage(
          itemMap,
          false
        );

        if (averageManual === null) {
          failure = {
            day: i + 1,
            message: "精度の合計を100%にしてください。"
          };
          break;
        }

        const normalManualCycle = getCycleTime(
          song.time, true, false, networkTime
        );

        const normalBgCycle = getCycleTime(
          song.time, false, false, networkTime
        );

        const eventBgCycle = getCycleTime(
          eventTime, false, true, networkTime
        );

        const remaining =
          periodSeconds - normalBg - eventBg;

        const maxManualRuns = capacityFor(
          remaining, normalManualCycle
        );

        const bgNormalRuns = capacityFor(
          normalBg, normalBgCycle
        );

        const bgEventRuns = capacityFor(
          eventBg, eventBgCycle
        );

        const maxAvailableItems =
          currentItems +
          maxManualRuns * averageManual +
          bgNormalRuns * itemMap.Dコン;

        const requiredBgItems =
          bgEventRuns * itemsPerEventSong;

        // アイテム不足が数学的に確定する場合
        if (maxAvailableItems + 1e-7 < requiredBgItems) {
          const shortage = Math.ceil(
            requiredBgItems - maxAvailableItems - 1e-7
          );

          failure = {
            day: i + 1,
            message:
              `${shortage.toLocaleString()}個のアイテムが不足しています。`
          };
          break;
        }

        const result = calculateMixedMode(
          song,
          eventTime,
          networkTime,
          itemMap,
          false,
          periodSeconds,
          currentItems,
          elapsedSeconds
        );


if (!result || result.errors?.length) {
  const errors = result?.errors || [];

  let title = "計算エラー";
  let message =
    "設定したBG時間で成立するプレイ順序を確認できませんでした。";

  if (errors.includes("depletion")) {
    title = "アイテム不足";
    message =
      "イベント曲に必要なアイテムが不足しています。\n" +
      "通常曲BG時間を増やすか、イベント曲BG時間を減らしてください。";
  } else if (errors.includes("limit")) {
    title = "アイテム上限";
    message =
      "アイテム所持上限99,999個を守れません。\n" +
      "通常曲BG時間を減らすか、イベント曲BG時間を増やしてください。";
  }

  failure = {
    day: i + 1,
    title,
    message
  };

  break;
}


        currentItems = result.currentItems;
        elapsedSeconds += periodSeconds;
      }
    } catch (error) {
      console.error("日別設定判定エラー", error);
      failure = {
        day: selectedDay,
        message: "計算中にエラーが発生しました。"
      };
    } finally {
      // 元の選択日に戻す
      setWheelValue("normalBg", 0);
      setWheelValue("eventBg", 0);
      applyDayInputs(savedIndex);
    }

    if (failure) {
  showDailyCheckStatus(
    "error",
    `${failure.day}日目：${failure.title || "設定エラー"}`,
    failure.message
  );
} else {
      showDailyCheckStatus(
        "ok",
        "✓ 正常",
        "イベント全日程の設定で計算できました。"
      );
    }
  }, 0);
}



// ===================================
// ダイアログを閉じて時間を確定
// ===================================

function confirmTimeDialog() {

  if (!activeWheelKey || !dialogWheelDraft) {
    return;
  }

  // 決定時点のホイール位置を直接読み取る
  const hour = updateWheelHighlight(
    $("dialogHourWheel")
  );

  const minute = updateWheelHighlight(
    $("dialogMinWheel")
  );

  const second = updateWheelHighlight(
    $("dialogSecWheel")
  );

  // 読み取った値から合計秒数を計算
  const totalSeconds =
    hour * 3600 +
    minute * 60 +
    second;

  const key = activeWheelKey;

  // 時間を確定
  setWheelValue(
    key,
    Math.min(
      totalSeconds,
      getWheelMaxSeconds(key)
    )
  );

  activeWheelKey = null;
  dialogWheelDraft = null;

  $("timeDialogOverlay").hidden = true;

  document.body.style.overflow =
    previousBodyOverflow;

resetResult();
updateMixedPreview();

// 確定後に日別設定を判定
checkDailySettings();

// 確定したBG時間を保存
saveCurrentAppSettings();
}


// ===================================
// ダイアログ操作イベント
// ===================================

// 通常曲BGを開く
$("openNormalBgTime").addEventListener("click", () => {
  openTimeDialog("normalBg");
});

// イベント曲BGを開く
$("openEventBgTime").addEventListener("click", () => {
  openTimeDialog("eventBg");
});

// 決定
$("confirmTimeDialog").addEventListener(
  "click",
  confirmTimeDialog
);


// ===================================
// 共通ホイールイベント
// ===================================

["Hour", "Min", "Sec"].forEach(unit => {

  const wheel = $(dialogWheelIds[unit]);

  let scrollTimer;

  wheel.addEventListener("scroll", () => {

    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {

      if (!activeWheelKey) {
        return;
      }

      const value = updateWheelHighlight(wheel);

      updateWheelValueFromScroll(
        unit,
        value
      );

    }, 80);

  });

});


// ===================================
// 背景操作のロック
// ===================================

const timeDialogOverlay = $("timeDialogOverlay");

// 背景をタップしても閉じない
timeDialogOverlay.addEventListener("click", event => {

  if (event.target === timeDialogOverlay) {
    event.preventDefault();
  }

});

// 背景部分のスクロールを禁止
timeDialogOverlay.addEventListener(
  "wheel",
  event => {

    if (!event.target.closest(".time-dialog")) {
      event.preventDefault();
    }

  },
  { passive: false }
);

timeDialogOverlay.addEventListener(
  "touchmove",
  event => {

    if (!event.target.closest(".time-dialog")) {
      event.preventDefault();
    }

  },
  { passive: false }
);


// ===================================
// ダイアログ内のキーボード操作制限
// ===================================

timeDialogOverlay.addEventListener("keydown", event => {

  if (event.key === "Escape") {
    event.preventDefault();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const controls = [
    $("dialogHourWheel"),
    $("dialogMinWheel"),
    $("dialogSecWheel"),
    $("confirmTimeDialog")
  ];

  const first = controls[0];
  const last = controls[controls.length - 1];

  if (
    event.shiftKey &&
    document.activeElement === first
  ) {

    event.preventDefault();
    last.focus();

  } else if (
    !event.shiftKey &&
    document.activeElement === last
  ) {

    event.preventDefault();
    first.focus();

  }

});


// ===================================
// ホイール初期化
// ===================================

function initializeWheels() {

  setWheelValue("normalBg", 0);
  setWheelValue("eventBg", 0);

  refreshWheelLimits();

}

initializeWheels();

function showScreen(name) {
  $("settingsScreen").hidden = name !== "settings";
  $("playScreen").hidden = name !== "play";
  $("resultScreen").hidden = name !== "result";

  // 設定画面では設定ボタンを非表示
  $("openSettings").hidden = name === "settings";
}

// ===================================
// イベント曲時間変更
// ===================================

["eventMin", "eventSec"].forEach(id => {
  $(id).addEventListener("input", () => {
    const time = getEventInputTime();

    if (time > 0) {
      eventTimeAlertActive = false;

    } else if (
      !eventTimeAlertActive &&
      getSelectedPlayMode() === "both"
    ) {
      eventTimeAlertActive = true;

      alert(
        "イベント曲の時間が未入力です。イベント曲の時間を入力してください。"
      );
      showScreen("settings");
    }

    refreshWheelLimits();

    resetResult();
    updateMixedPreview();
  });
});

// ===================================
// 通常曲変更
// ===================================

$("normalSong").addEventListener("change", () => {
  refreshWheelLimits();
  resetResult();
  updateMixedPreview();
});

// ===================================
// 通信速度変更
// ===================================

document.querySelectorAll('input[name="network"]').forEach(input => {
  input.addEventListener("change", () => {
    refreshWheelLimits();
    resetResult();
    updateMixedPreview();
  });
});

// ===================================
// プレイモード変更
// ===================================

document.querySelectorAll('input[name="playMode"]').forEach(input => {
  input.addEventListener("change", () => {
    eventTimeAlertActive = false;
    depletionAlertActive = false;
  });
});

$("eventMin").addEventListener("change", () => {
  if (getEventInputTime() > 0) {
    eventTimeAlertActive = false;
  }
});

// ===================================
// 初期表示
// ===================================

showScreen("settings");

updatePlayMode();
updateDailyTimeTotal();
updateBonusChangePoints();

// ===================================
// イベント日程管理
// ===================================



/* ==========================================
   イベント日程・ローカル保存
========================================== */

const STORAGE_KEY = "nogifesCalculatorData";

const eventStartDateInput = $("eventStartDate");
const eventDaysInput = $("eventDays");

let eventDateList = [];

// 設定を保存
function saveLocalData() {
  try {
    const bonusChanges = Array.from(
      document.querySelectorAll(".bonus-change-row")
    ).map(row => ({
      day: row.querySelector('[data-field="day"]').value,
      hour: row.querySelector('[data-field="hour"]').value,
      minute: row.querySelector('[data-field="minute"]').value,
      bonus: row.querySelector('[data-field="bonus"]').value
    }));


const data = {
  startDate: eventStartDateInput.value,
  days: eventDaysInput.value,

  // プレイ方法
  playMode: document.querySelector(
    'input[name="playMode"]:checked'
  )?.value ?? "both",

  // フル手打ち・フルバクグラ
  fullBackground: isFullBackground,

  // 回線速度
  network: document.querySelector(
    'input[name="network"]:checked'
  )?.value ?? "26",

  normalSong: $("normalSong").value,
  eventMin: $("eventMin").value,
  eventSec: $("eventSec").value,
  bonus: $("bonus").value,

  bonusChanges,
  dailySettings
};


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    console.error("設定の保存に失敗しました", error);
  }
}

// 設定を復元
function loadLocalData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const data = JSON.parse(saved);

    if (!data || typeof data !== "object") return;


    
// ===================================
// プレイ方法の復元
// ===================================

if (data.playMode !== undefined) {
  const playModeRadio = Array.from(
    document.querySelectorAll('input[name="playMode"]')
  ).find(radio => radio.value === data.playMode);

  if (playModeRadio) {
    playModeRadio.checked = true;
  }
}

// ===================================
// フル手打ち・フルバクグラの復元
// ===================================

if (typeof data.fullBackground === "boolean") {
  setFullMode(data.fullBackground);
}

// ===================================
// 回線速度の復元
// ===================================

if (data.network !== undefined) {
  const networkRadio = Array.from(
    document.querySelectorAll('input[name="network"]')
  ).find(radio => radio.value === String(data.network));

  if (networkRadio) {
    networkRadio.checked = true;
  }
}

// ===================================
// プレイ方法に合わせて表示更新
// ===================================

updatePlayMode();
updateMixedDaySettingsVisibility();


    if (data.startDate) {
      eventStartDateInput.value = data.startDate;
    }

    if (data.days) {
      eventDaysInput.value = data.days;
    }

    // 通常曲
    if (data.normalSong !== undefined) {
      const optionExists = Array.from(
        $("normalSong").options
      ).some(option => option.value === String(data.normalSong));

      if (optionExists) {
        $("normalSong").value = String(data.normalSong);
      }
    }

    updateNormalSongTime();

    // イベント曲時間・初期特攻値
    ["eventMin", "eventSec", "bonus"].forEach(id => {
      if (data[id] !== undefined) {
        $(id).value = String(data[id]);
      }
    });

    updateEventPoint();

    // 特攻値の変更予定
    $("bonusChanges").replaceChildren();

    if (Array.isArray(data.bonusChanges)) {
      data.bonusChanges.forEach(savedRow => {
        addBonusChangeRow();

        const rows = document.querySelectorAll(
          ".bonus-change-row"
        );

        const row = rows[rows.length - 1];

        ["day", "hour", "minute", "bonus"].forEach(field => {
          if (savedRow[field] !== undefined) {
            row.querySelector(
              `[data-field="${field}"]`
            ).value = String(savedRow[field]);
          }
        });
      });
    }

    updateBonusChangePoints();

    // 日付別設定を復元
    if (data.startDate && createEventDateList()) {
      dailySettings = eventDateList.map((item, index) => {
        const savedDay = data.dailySettings?.find(
          day => day.date === item.date
        );

        return normalizeDailySetting(
          item.date,
          index,
          savedDay
        );
      });

      selectedEventDayIndex = 0;

      // 古いホイール上限の影響を避ける
      setWheelValue("normalBg", 0);
      setWheelValue("eventBg", 0);

      applyDayInputs(0);
      renderEventDateTabs();
    }

    refreshWheelLimits();
    updateDailyTimeTotal();

  } catch (error) {
    console.error("設定の復元に失敗しました", error);
  }
}


// ===================================
// イベント日付一覧を作成
// ===================================

function createEventDateList() {

  // 入力値を取得
  const startDateValue = eventStartDateInput.value;
  const eventDays = Number(eventDaysInput.value);

  // 入力チェック
  if (!startDateValue) {
    alert("イベント開始日を入力してください。");
    return false;
  }

  if (!eventDays || eventDays < 1 || eventDays > 10) {
    alert("イベント日数は1〜10日の範囲で選択してください。");
    return false;
  }

  // 開始日を取得
  const [year, month, day] = startDateValue.split("-").map(Number);

  // 日付一覧を初期化
  eventDateList = [];

  // 日数分の日付を作成
  for (let i = 0; i < eventDays; i++) {

    const date = new Date(year, month - 1, day + i);

    // 日付を YYYY-MM-DD 形式に変換
    const formattedDate =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    eventDateList.push({
      day: i + 1,
      date: formattedDate
    });
  }


const previousSettings = dailySettings;

dailySettings = eventDateList.map((item, index) => {
  const saved = previousSettings.find(
    setting => setting.date === item.date
  );

  return normalizeDailySetting(
    item.date,
    index,
    saved
  );
});

return true;

}




let dailySettings = [];


function normalizeDailySetting(date, index, saved) {
  const accuracy = {};

  accuracyIds.forEach(id => {
    accuracy[id] = Number(saved?.accuracy?.[id] ?? 0);
  });

  return {
    date,
    useOwnSettings: index === 0
  ? true
  : typeof saved?.useOwnSettings === "boolean"
    ? saved.useOwnSettings
    : index === eventDateList.length - 1,
    accuracy,
    normalBg: Number(saved?.normalBg ?? 0),
    eventBg: Number(saved?.eventBg ?? 0)
  };
}

function saveCurrentDayInputs() {
  const setting = dailySettings[selectedEventDayIndex];

  if (!setting) return;
  if (selectedEventDayIndex > 0 && !setting.useOwnSettings) return;

  setting.accuracy = Object.fromEntries(
    accuracyIds.map(id => [id, Number($(id).value || 0)])
  );

  setting.normalBg = wheelState.normalBg.seconds;
  setting.eventBg = wheelState.eventBg.seconds;
}

function applyDayInputs(index) {
  const own = dailySettings[index];
  const setting = index > 0 && !own?.useOwnSettings
    ? dailySettings[0]
    : own;

  if (!setting) return;

  accuracyIds.forEach(id => {
    $(id).value = String(setting.accuracy[id] ?? 0);
  });

  updateAccuracyLimit();

  setWheelValue("normalBg", setting.normalBg);
  setWheelValue("eventBg", setting.eventBg);

  const inherited = index > 0 && !own.useOwnSettings;

  accuracyIds.forEach(id => {
    $(id).disabled = inherited;
  });

  $("openNormalBgTime").disabled = inherited;
  $("openEventBgTime").disabled = inherited;
}

// ===================================
// イベント日付タブ
// ===================================

let selectedEventDayIndex = 0;

function renderEventDateTabs() {

  const tabsArea = $("eventDateTabs");
  const settingsArea = $("eventDaySettings");

  tabsArea.innerHTML = "";
  settingsArea.innerHTML = "";

  // 日付タブを作成
  eventDateList.forEach((item, index) => {

    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-date-tab";

    if (index === selectedEventDayIndex) {
      button.classList.add("active");
    }

    const [, month, day] = item.date.split("-");

    button.textContent = `${Number(month)}/${Number(day)}`;

button.addEventListener("click", () => {
  saveCurrentAppSettings();

  selectedEventDayIndex = index;

  applyDayInputs(index);
  renderEventDateTabs();
  checkDailySettings();
});

    tabsArea.appendChild(button);
  });

  // 選択中の日付の設定
  const setting = dailySettings[selectedEventDayIndex];

  if (!setting) return;

  const label = document.createElement("label");
  label.className = "daily-setting-checkbox";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = setting.useOwnSettings;

  // 1日目は変更不可
  checkbox.disabled = selectedEventDayIndex === 0;


checkbox.addEventListener("change", () => {

  // 個別設定の状態を変更
  setting.useOwnSettings = checkbox.checked;

  // チェックを入れた場合は、現在表示中の設定を
  // この日専用の設定として保存
  if (checkbox.checked) {
    setting.accuracy = Object.fromEntries(
      accuracyIds.map(id => [
        id,
        Number($(id).value || 0)
      ])
    );

    setting.normalBg = wheelState.normalBg.seconds;
    setting.eventBg = wheelState.eventBg.seconds;
  }

  // チェック状態に応じて即座に入力欄へ反映
  applyDayInputs(selectedEventDayIndex);

  // 日付タブ・チェックボックスを更新
  renderEventDateTabs();

  // 計算結果とプレビューを更新
  resetResult();
  updateMixedPreview();

  // 保存
  saveLocalData();

});


  const text = document.createElement("span");

  text.textContent =
    selectedEventDayIndex === 0
      ? "1日目の設定を使用"
      : "この日の設定を個別にする";

  label.appendChild(checkbox);
  label.appendChild(text);

  settingsArea.appendChild(label);
}


/* ==========================================
   入力変更時の自動保存
========================================== */

function saveCurrentAppSettings() {
  saveCurrentDayInputs();
  saveLocalData();
}

// 通常曲・イベント曲・特攻値
[
  "normalSong",
  "eventMin",
  "eventSec",
  "bonus"
].forEach(id => {
  const element = $(id);
  if (!element) return;

  element.addEventListener("input", saveCurrentAppSettings);
  element.addEventListener("change", saveCurrentAppSettings);
});

// 精度
accuracyIds.forEach(id => {
  $(id).addEventListener("change", saveCurrentAppSettings);
});

// 特攻値変更欄（動的生成される入力欄も対象）
$("bonusChanges").addEventListener(
  "input",
  saveCurrentAppSettings
);

$("bonusChanges").addEventListener(
  "change",
  saveCurrentAppSettings
);

// 特攻値変更欄の追加・削除
$("addBonusChange").addEventListener(
  "click",
  () => saveLocalData()
);

$("bonusChanges").addEventListener("click", event => {
  if (event.target.closest(".delete-bonus-button")) {
    // 既存の削除処理が終わった後に保存
    queueMicrotask(saveLocalData);
  }
});


/* ==========================================
   回線速度・プレイ方法の自動保存
========================================== */

// プレイ方法を変更したとき
document.querySelectorAll(
  'input[name="playMode"]'
).forEach(radio => {
  radio.addEventListener("change", saveLocalData);
});

// 回線速度を変更したとき
document.querySelectorAll(
  'input[name="network"]'
).forEach(radio => {
  radio.addEventListener("change", saveLocalData);
});

// フル手打ちを選択したとき
manualModeButton.addEventListener(
  "click",
  saveLocalData
);

// フルバクグラを選択したとき
backgroundModeButton.addEventListener(
  "click",
  saveLocalData
);




  // ===================================
// 保存データの読み込み
// ===================================

loadLocalData();


/* ==========================================
   混合モード専用の日付設定表示
========================================== */

function updateMixedDaySettingsVisibility() {
  const area = document.getElementById("mixedDaySettings");

  if (!area) return;

  const selectedMode = document.querySelector(
    'input[name="playMode"]:checked'
  );

  if (!selectedMode) return;

  area.hidden = selectedMode.value !== "both";
}

document.querySelectorAll('input[name="playMode"]').forEach(radio => {
  radio.addEventListener("change", updateMixedDaySettingsVisibility);
});

updateMixedDaySettingsVisibility();
