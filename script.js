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

// ===================================
// 状態管理
// ===================================

const wheelState = {
  normalBg: {
    minutes: 0,
    hour: 0,
    minute: 0
  },
  eventBg: {
    minutes: 0,
    hour: 0,
    minute: 0
  }
};

let isFullBackground = false;
let lastValidValues = {};
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
  return wheelState[key]?.minutes || 0;
}

function getSelectedPlayMode() {
  return document.querySelector('input[name="playMode"]:checked').value;
}

function getNetworkTime() {
  return Number(
    document.querySelector('input[name="networkSpeed"]:checked').value
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
// タブ切り替え
// ===================================

function switchTab(name) {
  document.querySelectorAll(".tab-button").forEach(button => {
    const active = button.dataset.tab === name;

    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.remove("active");
  });

  $(`${name}Tab`).classList.add("active");
}

document.querySelectorAll(".tab-button").forEach(button => {
  button.addEventListener("click", () => {
    switchTab(button.dataset.tab);
  });
});

$("backToPlay").addEventListener("click", () => {
  switchTab("play");
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

    // 精度を変更したらBG時間を初期化
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
    `${calculateEventPoint(bonus).toLocaleString()} PT`;
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
  // 手打ちの場合
  const loadTime = isManual
    ? networkTime + (isEvent ? 1 : 0)
    : 0;

  // BGの場合は待機時間15秒
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

  // 最後の1回分の待機時間は不要
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

  // ボタンの選択状態
  manualModeButton.classList.toggle("active", !isFullBackground);
  backgroundModeButton.classList.toggle("active", isFullBackground);

  // 選択状態をアクセシビリティにも反映
  manualModeButton.setAttribute(
    "aria-pressed",
    String(!isFullBackground)
  );

  backgroundModeButton.setAttribute(
    "aria-pressed",
    String(isFullBackground)
  );

  // BGでは精度入力を非表示
  $("accuracyArea").hidden = isFullBackground;

  resetResult();
}

// フル手打ち
manualModeButton.addEventListener("click", () => {
  setFullMode(false);
});

// フルバックグラウンド
backgroundModeButton.addEventListener("click", () => {
  setFullMode(true);
});

// ===================================
// BG時間取得
// ===================================

function getBgTimes() {
  return {
    normalBg: getWheelMinutes("normalBg") * 60,
    eventBg: getWheelMinutes("eventBg") * 60
  };
}

function updateDailyTimeTotal() {
  const times = getBgTimes();

  const totalMinutes =
    times.normalBg / 60 +
    times.eventBg / 60;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  $("dailyTimeTotal").textContent =
    `BG合計：${hours}時間 ${minutes}分 / 24時間`;

  $("dailyTimeTotal").style.color =
    totalMinutes > 1440
      ? "#d00000"
      : "#7926b9";
}

// ===================================
// 混合モードシミュレーション
// ===================================

function simulateMixed(
  song,
  eventTime,
  bonus,
  networkTime,
  itemMap,
  capacities,
  averageManual,
  startingItems = 0
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

    // イベント曲をプレイできるなら優先
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

    // プレイできる曲がない場合は終了
    if (selected === null) {
      break;
    }

    const lane = lanes[selected];

    lane.runs++;

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
    } else {
      currentItems -= itemsPerEventSong;
      usedItems += itemsPerEventSong;
    }

    if (
      currentItems > requiredItems &&
      currentItems <= requiredItems + epsilon
    ) {
      currentItems = requiredItems;
    }
  }

  const errors = [];

  const pendingNormal = [
    "normalManual",
    "normalBg"
  ].some(name => {
    return lanes[name].runs < lanes[name].capacity;
  });

  const canAnyNormalFit = [
    "normalManual",
    "normalBg"
  ].some(name => {
    const lane = lanes[name];

    return lane.runs < lane.capacity &&
      currentItems + lane.itemsPerRun <=
      requiredItems + epsilon;
  });

  if (pendingNormal && !canAnyNormalFit) {
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

  const manualEventPoint = calculateEventPoint(
    bonus + manualBonusAddition
  );

  const bgEventPoint = calculateEventPoint(bonus);

  const manualDailyPoint =
    manualEventRuns * manualEventPoint;

  const bgDailyPoint =
    bgEventRuns * bgEventPoint;

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
  bonus,
  networkTime,
  itemMap,
  showAlert = true,
  periodSeconds = 86400,
  startingItems = 0
) {
  const bgTimes = getBgTimes();

  // 24時間未満の場合はBG時間を比例調整
  const ratio = periodSeconds / 86400;

  const normalBgTime =
    bgTimes.normalBg * ratio;

  const eventBgTime = eventTime > 0
    ? bgTimes.eventBg * ratio
    : 0;

  const bgTotal =
    normalBgTime + eventBgTime;

  if (bgTotal > periodSeconds) {
    if (showAlert) {
      alert("BG時間の合計が計算時間を超えています。");
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

  const remaining = periodSeconds - bgTotal;

  // イベント時間が未入力の場合
  if (eventTime <= 0) {
    const manualNormalCapacity = capacityFor(
      remaining,
      normalManualCycle
    );

    const result = simulateMixed(
      song,
      0,
      bonus,
      networkTime,
      itemMap,
      {
        normalManual: manualNormalCapacity,
        normalBg: bgNormalCapacity,
        eventManual: 0,
        eventBg: 0
      },
      averageManual,
      startingItems
    );

    result.optimizedManualNormalRuns =
      result.normalManualRuns;

    result.optimizedManualEventRuns = 0;

    return result;
  }

  const maxNormalManual = capacityFor(
    remaining,
    normalManualCycle
  );

  let best = null;

  // 通常曲の手打ち回数を変えて最適な組み合わせを探す
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
      bonus,
      networkTime,
      itemMap,
      {
        normalManual: normalRuns,
        normalBg: bgNormalCapacity,
        eventManual: eventManualCapacity,
        eventBg: bgEventCapacity
      },
      averageManual,
      startingItems
    );

    // アイテム上限を超える候補は採用しない
    if (candidate.errors.includes("limit")) {
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

  // 有効な候補がなかった場合
  if (!best) {
    best = simulateMixed(
      song,
      eventTime,
      bonus,
      networkTime,
      itemMap,
      {
        normalManual: 0,
        normalBg: bgNormalCapacity,
        eventManual: 0,
        eventBg: bgEventCapacity
      },
      averageManual,
      startingItems
    );
  }

  best.optimizedManualNormalRuns =
    best.normalManualRuns;

  best.optimizedManualEventRuns =
    best.manualEventRuns;

  return best;
}

// ===================================
// 225時間シミュレーション
// 24時間ごとにアイテムを引き継ぐ
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
    // 通常は24時間、最後は残り時間
    const periodSeconds = Math.min(
      86400,
      totalSeconds - elapsed
    );

    const result = simulateDay(
      periodSeconds,
      currentItems
    );

    if (!result) {
      break;
    }

    // アイテムを翌日に引き継ぐ
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
    elapsedSeconds: elapsed
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
  bonus,
  networkTime,
  itemMap,
  startingItems = 0
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

  const adjustedBonus = isManual
    ? bonus + manualBonusAddition
    : bonus;

  const eventPoint = calculateEventPoint(
    adjustedBonus
  );

  // 最初のBG曲だけ待機時間を差し引く
  let firstRun = true;

  function getNextCost(cycleInfo) {
    return cycleInfo.cycle -
      (firstRun ? cycleInfo.standby : 0);
  }

  let guard = 0;

  while (guard++ < 10000) {
    let selected = null;

    // イベント曲をプレイできる場合
    if (currentItems >= itemsPerEventSong) {
      const cost = getNextCost(eventCycle);

      if (elapsed + cost <= periodSeconds + 1e-9) {
        selected = "event";
      }
    }

    // イベント曲をプレイできない場合は通常曲
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

    dailyPoint: eventRuns * eventPoint,

    manualDailyPoint: isManual
      ? eventRuns * eventPoint
      : 0,

    bgDailyPoint: isManual
      ? 0
      : eventRuns * eventPoint
  };
}

// ===================================
// フル手打ち・フルBG計算
// ===================================

function calculateSingleMode(
  isManual,
  song,
  eventTime,
  bonus,
  networkTime,
  itemMap
) {
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

  // 99999個を集めるための理論上の時間
  const normalFullTime =
    (requiredItems / averageItem) *
    normalCycle.cycle -
    normalCycle.standby;

  // イベント曲114回分の時間
  const eventFullTime = usedTime(
    eventFullCount,
    eventCycle
  );

  // 1日分のシミュレーション
  const daily = simulateSinglePeriod(
    86400,
    isManual,
    song,
    eventTime,
    bonus,
    networkTime,
    itemMap,
    0
  );

  // 225時間分のシミュレーション
  const projection = simulate225Hours(
    (periodSeconds, startingItems) => {
      return simulateSinglePeriod(
        periodSeconds,
        isManual,
        song,
        eventTime,
        bonus,
        networkTime,
        itemMap,
        startingItems
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
// アイテム表示
// ===================================

function updateItemDisplay(result) {
  const items = Math.floor(result.currentItems);

  $("itemInventory").textContent =
    `${items.toLocaleString()} 個`;

  $("itemInventory").style.color =
    items < 0 || items >= requiredItems
      ? "#d00000"
      : "#7926b9";
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
    getBonus(),
    getNetworkTime(),
    getItemMap(),
    false
  );

  if (!result) {
    return;
  }

  latestMixedResult = result;

  updateItemDisplay(result);
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

  const bonusText = $("bonus").value;
  const bonus = Number(bonusText);

  if (
    bonusText === "" ||
    !Number.isInteger(bonus) ||
    bonus < 0 ||
    bonus > 9999
  ) {
    alert("特攻値は0～9999%で入力してください。");
    return false;
  }

  return true;
}

function validateBgTimes() {
  const totalMinutes =
    getWheelMinutes("normalBg") +
    getWheelMinutes("eventBg");

  if (totalMinutes > 1440) {
    alert("BG時間の合計は24時間以内にしてください。");
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
      : "フルバックグラウンド",
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
  const bonus = getBonus();
  const networkTime = getNetworkTime();
  const itemMap = getItemMap();

  if (mode === "both") {
    // 24時間分の計算
    const result = calculateMixedMode(
      song,
      eventTime,
      bonus,
      networkTime,
      itemMap
    );

    if (!result) {
      return;
    }

    // 225時間分の計算
    const projection = simulate225Hours(
      (periodSeconds, startingItems) => {
        return calculateMixedMode(
          song,
          eventTime,
          bonus,
          networkTime,
          itemMap,
          false,
          periodSeconds,
          startingItems
        );
      }
    );

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
      bonus,
      networkTime,
      itemMap
    );

    if (!result) {
      return;
    }

    showSingleResult(song, isManual, result);
  }

  switchTab("result");
}

$("calc").addEventListener("click", runCalculation);

// ===================================
// ホイール設定
// ===================================

const WHEEL_ROW_HEIGHT = 40;

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

function getWheelMaxMinutes(key) {
  const song = normalSongs[$("normalSong").selectedIndex];
  const itemMap = getItemMap();
  const networkTime = getNetworkTime();

  let laneMax;

  if (key === "normalBg") {
    const cycle = getCycleTime(
      song.time,
      false,
      false,
      networkTime
    );

    const maxRuns = Math.floor(
      requiredItems / itemMap.Dコン
    );

    laneMax = Math.floor(
      usedTime(maxRuns, cycle) / 60
    );

  } else {
    const eventTime = getEventInputTime();

    if (eventTime <= 0) {
      return 0;
    }

    const cycle = getCycleTime(
      eventTime,
      false,
      true,
      networkTime
    );

    laneMax = Math.floor(
      usedTime(eventFullCount, cycle) / 60
    );
  }

  const otherKey =
    key === "normalBg"
      ? "eventBg"
      : "normalBg";

  const otherMinutes =
    wheelState[otherKey]?.minutes || 0;

  return Math.max(
    0,
    Math.min(
      laneMax,
      1440 - otherMinutes
    )
  );
}

// ===================================
// ホイール値設定
// ===================================

function setWheelValue(key, totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  wheelState[key] = {
    minutes: totalMinutes,
    hour,
    minute
  };

  renderWheel(
    key,
    "Hour",
    Math.floor(getWheelMaxMinutes(key) / 60),
    hour
  );

  const maxMinutes = getWheelMaxMinutes(key);

  const maxMinute =
    hour === Math.floor(maxMinutes / 60)
      ? maxMinutes % 60
      : 59;

  renderWheel(
    key,
    "Min",
    maxMinute,
    Math.min(minute, maxMinute)
  );

  wheelState[key].minutes =
    hour * 60 + Math.min(minute, maxMinute);

  wheelState[key].minute =
    Math.min(minute, maxMinute);

  updateDailyTimeTotal();
}

// ===================================
// ホイール上限更新
// ===================================

function refreshWheelLimits(changedKey = null) {
  ["normalBg", "eventBg"].forEach(key => {
    const current =
      wheelState[key]?.minutes || 0;

    const max = getWheelMaxMinutes(key);

    if (current > max) {
      wheelState[key].minutes = max;
    }

    const minutes =
      wheelState[key].minutes || 0;

    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    wheelState[key] = {
      minutes,
      hour,
      minute
    };

    renderWheel(
      key,
      "Hour",
      Math.floor(getWheelMaxMinutes(key) / 60),
      hour
    );

    const maxMinutes = getWheelMaxMinutes(key);

    const maxMinute =
      hour === Math.floor(maxMinutes / 60)
        ? maxMinutes % 60
        : 59;

    renderWheel(
      key,
      "Min",
      maxMinute,
      Math.min(minute, maxMinute)
    );

    wheelState[key].minute =
      Math.min(minute, maxMinute);

    wheelState[key].minutes =
      hour * 60 + wheelState[key].minute;
  });

  updateDailyTimeTotal();
}

// ===================================
// ホイールイベント
// ===================================

["normalBg", "eventBg"].forEach(key => {
  wheelState[key] = {
    minutes: 0,
    hour: 0,
    minute: 0
  };

  ["Hour", "Min"].forEach(unit => {
    const wheel = $(`${key}${unit}Wheel`);

    let scrollTimer;

    wheel.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);

      scrollTimer = setTimeout(() => {
        const value = updateWheelHighlight(wheel);

        const current = wheelState[key];

        let minutes = unit === "Hour"
          ? value * 60 + current.minute
          : current.hour * 60 + value;

        const max = getWheelMaxMinutes(key);

        const otherKey =
          key === "normalBg"
            ? "eventBg"
            : "normalBg";

        minutes = Math.min(
          minutes,
          max,
          1440 - wheelState[otherKey].minutes
        );

        wheelState[key] = {
          minutes,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60
        };

        refreshWheelLimits(key);

        if (
          getEventInputTime() <= 0 &&
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
  refreshWheelLimits();
}

initializeWheels();

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

document.querySelectorAll('input[name="networkSpeed"]').forEach(input => {
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

updatePlayMode();
updateDailyTimeTotal();
