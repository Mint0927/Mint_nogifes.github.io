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
    (day - 1) * 86400 +
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

    if (seconds >= eventDurationHours * 3600) {
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
// BG時間ダイヤルの上限更新
// ===================================

function refreshWheelLimits() {
  const maxSeconds = MAX_DAILY_SECONDS;

  ["normalBg", "eventBg"].forEach(key => {
    const state = wheelState[key];

    if (state.seconds > maxSeconds) {
      setWheelValue(key, maxSeconds);
    }
  });

  updateDailyTimeTotal();
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

  const epsilon = 1e-7;

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

  const pendingNormal = [
    "normalManual",
    "normalBg"
  ].some(name => {
    return lanes[name].runs < lanes[name].capacity;
  });

  const pendingEvent = [
    "eventManual",
    "eventBg"
  ].some(name => {
    return lanes[name].runs < lanes[name].capacity;
  });

  if (pendingNormal) {
    errors.push("limit");
  }

  if (pendingEvent) {
    errors.push("depletion");
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

  if (!bonusSchedule) {
    return null;
  }

  const bgTimes = getBgTimes();

  const ratio = periodSeconds / MAX_DAILY_SECONDS;

  const normalBgTime =
    bgTimes.normalBg * ratio;

  const eventBgTime = eventTime > 0
    ? bgTimes.eventBg * ratio
    : 0;

  const bgTotal =
    normalBgTime + eventBgTime;

  if (bgTotal > periodSeconds + 1e-9) {
    if (showAlert) {
      alert("バクグラ時間の合計が計算時間を超えています。");
    }

    return null;
  }

  const averageManual = calculateManualAverage(
    itemMap,
    showAlert
  );

  if (averageManual === null) {
    return null;
  }

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

  const bgNormalCapacity = capacityFor(
    normalBgTime,
    normalBgCycle
  );

  const bgEventCapacity = eventTime > 0
    ? capacityFor(eventBgTime, eventBgCycle)
    : 0;

  const remaining = Math.max(
    0,
    periodSeconds - bgTotal
  );

  // イベント曲時間が未入力の場合
  if (eventTime <= 0) {
    const manualNormalCapacity = capacityFor(
      remaining,
      normalManualCycle
    );

    const result = simulateMixed(
      song,
      0,
      networkTime,
      itemMap,
      {
        normalManual: manualNormalCapacity,
        normalBg: bgNormalCapacity,
        eventManual: 0,
        eventBg: 0
      },
      averageManual,
      bonusSchedule,
      startingItems,
      elapsedStartSeconds
    );

    if (result.errors.length > 0) {
      if (showAlert) {
        showMixedCalculationError(result.errors);
      }

      return null;
    }

    result.optimizedManualNormalRuns =
      result.normalManualRuns;

    result.optimizedManualEventRuns = 0;

    return result;
  }

  // 手打ち時間の配分を最適化
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

    const eventManualCapacity = capacityFor(
      timeLeft,
      eventManualCycle
    );

    const candidate = simulateMixed(
      song,
      eventTime,
      networkTime,
      itemMap,
      {
        normalManual: normalRuns,
        normalBg: bgNormalCapacity,
        eventManual: eventManualCapacity,
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
      !best ||
      candidate.dailyPoint > best.dailyPoint ||
      (
        candidate.dailyPoint === best.dailyPoint &&
        candidate.currentItems > best.currentItems
      )
    ) {
      best = candidate;
    }
  }

  if (!best) {
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

  $("result225Set").textContent =
    result.projectedEventRuns.toLocaleString();

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

  $("result225Set").textContent =
    result.projectedEventRuns.toLocaleString();

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

function runCalculation() {
  const mode = getSelectedPlayMode();

  if (!validateCommonInputs(mode)) {
    return;
  }

  if (mode === "both" && !validateBgTimes()) {
    return;
  }

  const song = normalSongs[$("normalSong").selectedIndex];
  const eventTime = getEventInputTime();
  const networkTime = getNetworkTime();
  const itemMap = getItemMap();

  if (mode === "both") {
    const result = calculateMixedMode(
      song,
      eventTime,
      networkTime,
      itemMap
    );

    if (!result) {
      return;
    }

    const projection = simulate225Hours(
      (periodSeconds, startingItems, elapsedSeconds) => {
        return calculateMixedMode(
          song,
          eventTime,
          networkTime,
          itemMap,
          false,
          periodSeconds,
          startingItems,
          elapsedSeconds
        );
      }
    );

    if (!projection.completed) {
      alert(
        "アイテム上限またはアイテム不足の問題が発生しました。\n\nバクグラ時間や精度設定を調整してください。"
      );

      return;
    }

    result.projectedEventRuns =
      projection.eventRuns;

    result.projectedPoint =
      projection.eventPoints;

    result.projection = projection;

    showMixedResult(song, result);

  } else {
    const isManual = !isFullBackground;

    const result = calculateSingleMode(
      isManual,
      song,
      eventTime,
      networkTime,
      itemMap
    );

    if (!result) {
      return;
    }

    showSingleResult(song, isManual, result);
  }

  showScreen("result");
}

$("calc").addEventListener("click", runCalculation);

// ===================================
// ホイール設定
// ===================================

function renderWheel(key, unit, maxValue, selectedValue) {
  const wheel = $(`${key}${unit}Wheel`);

  if (!wheel) {
    return;
  }

  const rowHeight =
    wheel.clientHeight <= 155
      ? 36
      : WHEEL_ROW_HEIGHT;

  wheel.innerHTML =
    '<div class="wheel-spacer"></div>';

  for (let value = 0; value <= maxValue; value++) {
    const option = document.createElement("div");

    option.className = "wheel-option";
    option.dataset.value = String(value);
    option.textContent = String(value);

    wheel.appendChild(option);
  }

  wheel.insertAdjacentHTML(
    "beforeend",
    '<div class="wheel-spacer"></div>'
  );

  wheel.dataset.rowHeight = String(rowHeight);

  wheel.scrollTop = selectedValue * rowHeight;

  updateWheelHighlight(wheel);
}

function updateWheelHighlight(wheel) {
  const rowHeight = Number(
    wheel.dataset.rowHeight || WHEEL_ROW_HEIGHT
  );

  const value = Math.max(
    0,
    Math.round(wheel.scrollTop / rowHeight)
  );

  wheel.querySelectorAll(".wheel-option").forEach(option => {
    option.classList.toggle(
      "selected",
      Number(option.dataset.value) === value
    );
  });

  return value;
}

// ===================================
// BG時間の上限
// ===================================

function getWheelMaxSeconds(key) {
  const otherKey =
    key === "normalBg"
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
// ダイヤルの最大値を取得
// ===================================

function getWheelUnitMax(key, unit) {
  const maxSeconds = getWheelMaxSeconds(key);
  const current = wheelState[key];

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
// ホイール値設定
// ===================================

function setWheelValue(key, totalSeconds) {
  totalSeconds = Math.max(
    0,
    Math.floor(totalSeconds || 0)
  );

  const maxSeconds = getWheelMaxSeconds(key);

  totalSeconds = Math.min(
    totalSeconds,
    maxSeconds
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

  renderWheel(
    key,
    "Hour",
    getWheelUnitMax(key, "Hour"),
    hour
  );

  renderWheel(
    key,
    "Min",
    getWheelUnitMax(key, "Min"),
    minute
  );

  renderWheel(
    key,
    "Sec",
    getWheelUnitMax(key, "Sec"),
    second
  );

  updateDailyTimeTotal();
}

// ===================================
// ホイール上限更新
// ===================================

function refreshWheelLimits() {
  ["normalBg", "eventBg"].forEach(key => {
    let seconds =
      wheelState[key]?.seconds || 0;

    const maxSeconds = getWheelMaxSeconds(key);

    seconds = Math.min(
      seconds,
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

    renderWheel(
      key,
      "Hour",
      getWheelUnitMax(key, "Hour"),
      hour
    );

    renderWheel(
      key,
      "Min",
      getWheelUnitMax(key, "Min"),
      minute
    );

    renderWheel(
      key,
      "Sec",
      getWheelUnitMax(key, "Sec"),
      second
    );
  });

  updateDailyTimeTotal();
}

// ===================================
// ホイールの値を更新
// ===================================

function updateWheelValueFromScroll(key, unit, value) {
  const current = wheelState[key];

  let hour = current.hour;
  let minute = current.minute;
  let second = current.second;

  if (unit === "Hour") {
    hour = value;
  } else if (unit === "Min") {
    minute = value;
  } else if (unit === "Sec") {
    second = value;
  }

  let totalSeconds =
    hour * 3600 +
    minute * 60 +
    second;

  const maxSeconds = getWheelMaxSeconds(key);

  totalSeconds = Math.min(
    totalSeconds,
    maxSeconds
  );

  setWheelValue(key, totalSeconds);

  refreshWheelLimits();
}

// ===================================
// ホイールイベント
// ===================================

["normalBg", "eventBg"].forEach(key => {
  ["Hour", "Min", "Sec"].forEach(unit => {
    const wheel = $(`${key}${unit}Wheel`);

    if (!wheel) {
      return;
    }

    let scrollTimer;

    wheel.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);

      scrollTimer = setTimeout(() => {
        const value = updateWheelHighlight(wheel);

        updateWheelValueFromScroll(
          key,
          unit,
          value
        );

        if (
          getEventInputTime() <= 0 &&
          getSelectedPlayMode() === "both" &&
          !eventTimeAlertActive
        ) {
          eventTimeAlertActive = true;

          alert(
            "イベント曲の時間が未入力です。イベント曲の時間を入力してください。"
          );
        }

        resetResult();
        updateMixedPreview();

      }, 80);
    });
  });
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
