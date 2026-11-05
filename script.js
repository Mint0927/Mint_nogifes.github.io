
"use strict";

// ===================================
// DOM取得
// ===================================

const $ = id => document.getElementById(id);

const normalSong = $("normalSong");
const normalMin = $("normalMin");
const normalSec = $("normalSec");

const accuracyArea = $("accuracyArea");
const networkArea = $("networkArea");
const mixedTimeArea = $("mixedTimeArea");

const bonusInput = $("bonus");
const eventMin = $("eventMin");
const eventSec = $("eventSec");
const eventPointOutput = $("eventPoint");

const dailyTimeTotal = $("dailyTimeTotal");

const accuracyIds = [
  "フルエク",
  "フルコン",
  "Aコン",
  "Bコン",
  "Cコン",
  "Dコン"
];

// ===================================
// 基本設定
// ===================================

const normalSongs = [
  { name: "最後のTightHug", time: 212, lp: 81 },
  { name: "サヨナラの意味 向井葉月セレモニー", time: 213, lp: 81 },
  { name: "あと7曲", time: 213, lp: 81 },
  { name: "三番目の風", time: 214, lp: 81 },
  { name: "渋谷ブルース", time: 200, lp: 75 }
];

const standbyBackground = 15;
const standbyManual = 0;

const eventFullCount = 114;
const requiredItems = 99999;
const itemsPerEventSong = requiredItems / eventFullCount;

const manualBonusAddition = 144;
const eventDurationHours = 225;

// ===================================
// アイテム数
// ===================================

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
// 混合モード時間入力ID
// ===================================

const mixedTimeIds = [
  ["normalManualHour", "normalManualMin", "normalManualSec"],
  ["normalBgHour", "normalBgMin", "normalBgSec"],
  ["eventManualHour", "eventManualMin", "eventManualSec"],
  ["eventBgHour", "eventBgMin", "eventBgSec"]
];

const mixedInputIds = mixedTimeIds.flat();

// ===================================
// 時間変換
// ===================================

function secToTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h}時間 ${m}分 ${s}秒`;
}

function getInputTime(hourId, minId, secId) {
  return (
    Number($(hourId).value || 0) * 3600 +
    Number($(minId).value || 0) * 60 +
    Number($(secId).value || 0)
  );
}

// ===================================
// プレイ用途
// ===================================

function getSelectedPlayMode() {
  return document.querySelector(
    'input[name="playMode"]:checked'
  ).value;
}

function getNetworkTime() {
  return Number(
    document.querySelector(
      'input[name="networkSpeed"]:checked'
    ).value
  );
}

// ===================================
// Result初期化
// ===================================

function resetResult() {
  $("results").style.display = "none";
  $("mixedBreakdown").style.display = "none";
}

// ===================================
// 通常曲選択
// ===================================

normalSongs.forEach((song, index) => {
  const option = document.createElement("option");

  option.value = index;
  option.textContent = song.name;

  normalSong.appendChild(option);
});

function updateNormalSongTime() {
  const song = normalSongs[normalSong.selectedIndex];

  normalMin.value = Math.floor(song.time / 60);
  normalSec.value = song.time % 60;

  resetResult();
  updateMixedPreview();
}

normalSong.addEventListener("change", updateNormalSongTime);

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

  // 精度変更時は1日あたりのプレイ時間を初期化
  mixedInputIds.forEach(id => {
    $(id).value = "0";
    lastValidValues[id] = "0";
  });

  // アラート状態もリセット
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
      .filter(otherId => otherId !== id)
      .reduce((total, otherId) => {
        return total + Number($(otherId).value || 0);
      }, 0);

    Array.from(select.options).forEach(option => {
      const value = Number(option.value);

      option.disabled = otherTotal + value > 100;
      option.hidden = otherTotal + value > 100;
    });
  });
}

updateAccuracyLimit();

// ===================================
// 平均アイテム数
// ===================================

function getItemMap() {
  const song = normalSongs[normalSong.selectedIndex];

  return song.lp === 75
    ? itemMapLP75
    : itemMapLP81;
}

function calculateManualAverage(itemMap, showAlert = true) {
  let average = 0;
  let totalPercent = 0;

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
// イベントpt
// ===================================

function calculateEventPoint(bonus) {
  return Math.floor(
    1150 * (1 + bonus / 100) + 288
  );
}

function updateEventPoint() {
  const bonus = Number(bonusInput.value);

  if (
    bonusInput.value === "" ||
    !Number.isFinite(bonus) ||
    bonus < 0 ||
    bonus > 9999
  ) {
    eventPointOutput.textContent = "pt";
    return;
  }

  eventPointOutput.textContent =
    `${calculateEventPoint(bonus).toLocaleString()} PT`;
}

bonusInput.addEventListener("input", () => {
  updateEventPoint();
  resetResult();
  updateMixedPreview();
});

updateEventPoint();

// ===================================
// プレイ用途切り替え
// ===================================

function updatePlayMode() {
  const mode = getSelectedPlayMode();

  const needsManual =
    mode === "fullManual" || mode === "both";

  accuracyArea.style.display =
    needsManual ? "block" : "none";

  networkArea.style.display =
    needsManual ? "block" : "none";

  mixedTimeArea.style.display =
    mode === "both" ? "block" : "none";

  document.querySelectorAll(
    'input[name="networkSpeed"]'
  ).forEach(radio => {
    radio.disabled = !needsManual;
  });

  resetResult();

  // モード変更時はアラート判定をリセット
  eventTimeAlertActive = false;
  depletionAlertActive = false;

  if (mode === "both") {
    updateMixedPreview();
  }
}

document.querySelectorAll('input[name="playMode"]')
  .forEach(radio => {
    radio.addEventListener("change", updatePlayMode);
  });

document.querySelectorAll('input[name="networkSpeed"]')
  .forEach(radio => {
    radio.addEventListener("change", () => {
      resetResult();
      updateMixedPreview();
    });
  });

// ===================================
// 混合モード時間入力の取得
// ===================================

function getMixedRequestedTimes() {
  return {
    normalManual: getInputTime(
      "normalManualHour",
      "normalManualMin",
      "normalManualSec"
    ),

    normalBg: getInputTime(
      "normalBgHour",
      "normalBgMin",
      "normalBgSec"
    ),

    eventManual: getInputTime(
      "eventManualHour",
      "eventManualMin",
      "eventManualSec"
    ),

    eventBg: getInputTime(
      "eventBgHour",
      "eventBgMin",
      "eventBgSec"
    )
  };
}

// ===================================
// 混合モードの合計時間表示
// ===================================

function updateDailyTimeTotal() {
  const times = getMixedRequestedTimes();

  const total =
    times.normalManual +
    times.normalBg +
    times.eventManual +
    times.eventBg;

  dailyTimeTotal.textContent =
    `合計：${secToTime(total)} / 24時間`;

  dailyTimeTotal.style.color =
    total > 86400 ? "#d00000" : "#7926b9";
}

// ===================================
// 1回あたりのプレイ時間
// ===================================

function getCycleTime(songTime, isManual, isEvent, networkTime) {
  const loadTime = isManual
    ? networkTime + (isEvent ? 1 : 0)
    : 0;

  const standbyTime = isManual
    ? standbyManual
    : standbyBackground;

  return {
    cycle: songTime + loadTime + standbyTime,
    standby: standbyTime
  };
}

function getPlayCount(availableTime, cycle, standby) {
  if (availableTime <= 0 || cycle <= 0) {
    return 0;
  }

  return (availableTime + standby) / cycle;
}

// ===================================
// 混合モード計算
// ===================================

function calculateMixedMode(
  song,
  eventInputTime,
  bonus,
  networkTime,
  itemMap,
  showAccuracyAlert = true
) {
  const requestedTimes = getMixedRequestedTimes();

  // 手打ち通常曲を使う場合だけ精度を確認
  const averageManual = requestedTimes.normalManual > 0
    ? calculateManualAverage(itemMap, showAccuracyAlert)
    : 0;

  if (averageManual === null) {
    return null;
  }

  const averageBg = itemMap.Dコン;

  // 各曲のプレイ時間
  const normalManualCycle = getCycleTime(
    song.time,
    true,
    false,
    networkTime
  );

  const normalBgCycle = getCycleTime(
    song.time,
    false,
    false,
    networkTime
  );

  const eventManualCycle = getCycleTime(
    eventInputTime,
    true,
    true,
    networkTime
  );

  const eventBgCycle = getCycleTime(
    eventInputTime,
    false,
    true,
    networkTime
  );

  // 各時間内でプレイできる曲数
  function createLane(time, cycleInfo, itemsPerRun = 0) {
    return {
      capacity: Math.max(
        0,
        Math.floor(
          getPlayCount(
            time,
            cycleInfo.cycle,
            cycleInfo.standby
          ) + 1e-9
        )
      ),
      runs: 0,
      cycle: cycleInfo.cycle,
      standby: cycleInfo.standby,
      itemsPerRun
    };
  }

  const lanes = {
    normalManual: createLane(
      requestedTimes.normalManual,
      normalManualCycle,
      averageManual
    ),

    normalBg: createLane(
      requestedTimes.normalBg,
      normalBgCycle,
      averageBg
    ),

    eventManual: createLane(
      requestedTimes.eventManual,
      eventManualCycle
    ),

    eventBg: createLane(
      requestedTimes.eventBg,
      eventBgCycle
    )
  };

  // イベント曲の時間が未入力ならプレイ不可
  if (eventInputTime <= 0) {
    lanes.eventManual.capacity = 0;
    lanes.eventBg.capacity = 0;
  }

  // アイテム収支
  let currentItems = 0;
  let totalEarnedItems = 0;
  let manualItems = 0;
  let bgItems = 0;
  let usedItems = 0;

  const itemCost = itemsPerEventSong;
  const epsilon = 1e-7;

  // 進捗率が低いレーンを優先
  function pickLane(names) {
    const available = names
      .map(name => ({
        name,
        lane: lanes[name]
      }))
      .filter(({ lane }) => lane.runs < lane.capacity);

    if (available.length === 0) {
      return null;
    }

    available.sort((a, b) => {
      const aProgress = a.lane.runs / a.lane.capacity;
      const bProgress = b.lane.runs / b.lane.capacity;

      return aProgress - bProgress;
    });

    return available[0].name;
  }

  // 曲を順番に実行
  while (true) {
    let selectedLane = null;

    // アイテムが足りている場合はイベント曲を優先
    if (currentItems + epsilon >= itemCost) {
      selectedLane = pickLane([
        "eventManual",
        "eventBg"
      ]);
    }

    // イベント曲のアイテムが足りない場合は通常曲
    if (selectedLane === null) {
      const normalCandidates = [
        "normalManual",
        "normalBg"
      ].filter(name => {
        const lane = lanes[name];

        return (
          lane.runs < lane.capacity &&
          currentItems + lane.itemsPerRun <=
            requiredItems + epsilon
        );
      });

      selectedLane = pickLane(normalCandidates);
    }

    // 通常曲もプレイできない場合はイベント曲を実行
    // イベント曲の時間が入力済みの場合だけ実行する
    if (selectedLane === null) {
      selectedLane = pickLane([
        "eventManual",
        "eventBg"
      ]);
    }

    if (selectedLane === null) {
      break;
    }

    const lane = lanes[selectedLane];

    lane.runs += 1;

    if (selectedLane === "normalManual") {
      currentItems += lane.itemsPerRun;
      totalEarnedItems += lane.itemsPerRun;
      manualItems += lane.itemsPerRun;
    }

    else if (selectedLane === "normalBg") {
      currentItems += lane.itemsPerRun;
      totalEarnedItems += lane.itemsPerRun;
      bgItems += lane.itemsPerRun;
    }

    else {
      currentItems -= itemCost;
      usedItems += itemCost;
    }

    // マイナスの場合は0に戻さない
    // 上限付近の微小誤差だけ補正
    if (
      currentItems > requiredItems &&
      currentItems <= requiredItems + epsilon
    ) {
      currentItems = requiredItems;
    }
  }

  // =================================
  // アイテム枯渇・上限超過チェック
  // =================================

  const pendingNormalManual =
    lanes.normalManual.runs < lanes.normalManual.capacity;

  const pendingNormalBg =
    lanes.normalBg.runs < lanes.normalBg.capacity;

  const errors = [];

  // 所持数がマイナスならアイテム枯渇
  if (currentItems < -epsilon) {
    errors.push("depletion");
  }

  // 次の通常曲で上限を超えるか確認
  const manualWouldExceed =
    pendingNormalManual &&
    currentItems + lanes.normalManual.itemsPerRun >
      requiredItems + epsilon;

  const bgWouldExceed =
    pendingNormalBg &&
    currentItems + lanes.normalBg.itemsPerRun >
      requiredItems + epsilon;

  if (manualWouldExceed || bgWouldExceed) {
    errors.push("limit");
  }

  // =================================
  // 実際のプレイ回数
  // =================================

  const normalManualRuns = lanes.normalManual.runs;
  const normalBgRuns = lanes.normalBg.runs;

  const manualEventRuns = lanes.eventManual.runs;
  const bgEventRuns = lanes.eventBg.runs;

  const actualEventRuns =
    manualEventRuns + bgEventRuns;

  function getUsedTime(lane) {
    return lane.runs > 0
      ? lane.runs * lane.cycle - lane.standby
      : 0;
  }

  const normalFullTime =
    getUsedTime(lanes.normalManual) +
    getUsedTime(lanes.normalBg);

  const eventFullTime =
    getUsedTime(lanes.eventManual) +
    getUsedTime(lanes.eventBg);

  // =================================
  // イベントpt
  // =================================

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

  const averageItem =
    totalNormalRuns > 0
      ? totalEarnedItems / totalNormalRuns
      : 0;

  const projection = eventDurationHours / 24;

  return {
    errors,

    averageItem,

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

    projectedEventRuns:
      actualEventRuns * projection,

    projectedPoint:
      dailyPoint * projection
  };
}

// ===================================
// リアルタイムアイテム表示
// ===================================

function updateItemDisplay(result) {
  const display = $("itemInventory");

  if (!display) {
    return;
  }

  const items = Math.floor(result.currentItems);

  display.textContent =
    `${items.toLocaleString()} 個`;

  if (items < 0) {
    display.style.color = "#d00000";
  }

  else if (items >= requiredItems) {
    display.style.color = "#d00000";
  }

  else {
    display.style.color = "#7926b9";
  }
}

// ===================================
// アイテム不足アラーム管理
// ===================================

let depletionAlertActive = false;

function checkDepletionAlert(result) {
  const isDepleted =
    result.errors.includes("depletion");

  if (isDepleted && !depletionAlertActive) {
    alert(
      "アイテムが不足しています。\n" +
      "所持アイテム数がマイナスになります。"
    );
  }

  depletionAlertActive = isDepleted;
}

// ===================================
// イベント曲時間の未入力アラーム
// ===================================

let eventTimeAlertActive = false;

function checkEventTimeInputAlert() {
  const eventTime =
    Number(eventMin.value || 0) * 60 +
    Number(eventSec.value || 0);

  if (eventTime <= 0) {
    if (!eventTimeAlertActive) {
      alert(
        "イベント曲の時間が未入力です。\n" +
        "イベント曲の時間を入力してください。"
      );
    }

    eventTimeAlertActive = true;
  } else {
    eventTimeAlertActive = false;
  }
}

// ===================================
// 混合モードのプレビュー計算
// ===================================

function updateMixedPreview() {
  updateDailyTimeTotal();

  const mode = getSelectedPlayMode();

  if (mode !== "both") {
    return;
  }

  const song = normalSongs[normalSong.selectedIndex];

  const eventInputTime =
    Number(eventMin.value || 0) * 60 +
    Number(eventSec.value || 0);

  const bonus = Number(bonusInput.value || 0);

  const result = calculateMixedMode(
    song,
    eventInputTime,
    bonus,
    getNetworkTime(),
    getItemMap(),
    false
  );

  if (result === null) {
    const display = $("itemInventory");

    if (display) {
      display.textContent = "精度を100%に設定してください";
      display.style.color = "#666";
    }

    return;
  }

  updateItemDisplay(result);

  if (!result.errors.includes("depletion")) {
    depletionAlertActive = false;
  }
}

// ===================================
// 時間入力の変更前の値を保存
// ===================================

const lastValidValues = {};

mixedInputIds.forEach(id => {
  lastValidValues[id] = $(id).value;
});

// ===================================
// 混合モード時間入力チェック
// ===================================

function validateMixedInput(id) {
  const input = $(id);
  const value = input.value;

  if (
    value !== "" &&
    (!Number.isInteger(Number(value)) || Number(value) < 0)
  ) {
    alert("時間は0以上の整数で入力してください。");

    input.value = lastValidValues[id];

    updateMixedPreview();
    return false;
  }

  return true;
}

// ===================================
// 混合モード時間入力イベント
// ===================================

mixedInputIds.forEach(id => {
  const input = $(id);

  input.addEventListener("input", () => {
    if (!validateMixedInput(id)) {
      return;
    }

    // イベント曲の時間が未入力なら入力を促す
    checkEventTimeInputAlert();

    resetResult();
    updateDailyTimeTotal();

    const mode = getSelectedPlayMode();

    if (mode !== "both") {
      lastValidValues[id] = input.value;
      return;
    }

    const song = normalSongs[normalSong.selectedIndex];

    const eventInputTime =
      Number(eventMin.value || 0) * 60 +
      Number(eventSec.value || 0);

    const bonus = Number(bonusInput.value || 0);

    const result = calculateMixedMode(
      song,
      eventInputTime,
      bonus,
      getNetworkTime(),
      getItemMap(),
      false
    );

    if (result === null) {
      updateMixedPreview();
      return;
    }

    // 上限超過の場合は入力を元に戻す
    if (result.errors.includes("limit")) {
      alert(
        "アイテム所持数が99,999個の上限を超えます。\n" +
        "通常曲の時間を短くするか、イベント曲の時間を増やしてください。"
      );

      input.value = lastValidValues[id];

      updateMixedPreview();
      return;
    }

    // アイテム不足なら入力を維持してマイナス表示
    updateItemDisplay(result);

    checkDepletionAlert(result);

    // 不足状態でも入力値を保存する
    lastValidValues[id] = input.value;
  });
});

// ===================================
// イベント曲・通常曲などの入力変更
// ===================================

[
  normalMin,
  normalSec,
  eventMin,
  eventSec,
  bonusInput
].forEach(input => {
  input.addEventListener("input", () => {
    // イベント曲の時間が入力されたらアラート状態を解除
    const eventTime =
      Number(eventMin.value || 0) * 60 +
      Number(eventSec.value || 0);

    if (eventTime > 0) {
      eventTimeAlertActive = false;
    }

    resetResult();
    updateMixedPreview();
  });
});

// ===================================
// 入力チェック
// ===================================

function validateCommonInputs(mode) {
  const minValue = eventMin.value;
  const secValue = eventSec.value;

  const min = Number(minValue || 0);
  const sec = Number(secValue || 0);

  const eventTime = min * 60 + sec;

  // 混合モードではイベント曲の時間未入力を許可
  if (mode !== "both" || eventTime > 0) {
    if (
      minValue === "" ||
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

  // 特攻値チェック
  const bonus = Number(bonusInput.value);

  if (
    bonusInput.value === "" ||
    !Number.isInteger(bonus) ||
    bonus < 0 ||
    bonus > 9999
  ) {
    alert("特攻値は0～9999%で入力してください。");
    return false;
  }

  return true;
}

function validateMixedTime() {
  let total = 0;

  for (const [hourId, minId, secId] of mixedTimeIds) {
    const hourValue = $(hourId).value;
    const minValue = $(minId).value;
    const secValue = $(secId).value;

    if (hourValue === "" || minValue === "") {
      alert("混合モードの時間と分はすべて入力してください。");
      return false;
    }

    const hour = Number(hourValue);
    const min = Number(minValue);
    const sec = Number(secValue || 0);

    if (
      !Number.isInteger(hour) || hour < 0 ||
      !Number.isInteger(min) || min < 0 || min > 59 ||
      !Number.isInteger(sec) || sec < 0 || sec > 59
    ) {
      alert("時間・分・秒の入力を確認してください。");
      return false;
    }

    total += hour * 3600 + min * 60 + sec;
  }

  if (total > 86400) {
    alert("1日あたりの合計時間は24時間以内にしてください。");
    return false;
  }

  return true;
}

// ===================================
// 単独モード計算
// ===================================

function calculateSingleMode(
  mode,
  song,
  eventInputTime,
  bonus,
  networkTime,
  itemMap
) {
  const isManual = mode === "manual";

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
    eventInputTime,
    isManual,
    true,
    networkTime
  );

  const normalFullTime =
    (requiredItems / averageItem) *
    normalCycle.cycle -
    normalCycle.standby;

  const eventFullTime =
    eventFullCount *
    eventCycle.cycle -
    eventCycle.standby;

  const adjustedBonus = isManual
    ? bonus + manualBonusAddition
    : bonus;

  const eventPoint = calculateEventPoint(adjustedBonus);
  const eventFullPoint = eventPoint * eventFullCount;

  const totalTime = normalFullTime + eventFullTime;

  const daySet = totalTime > 0
    ? 86400 / totalTime
    : 0;

  const set225 = totalTime > 0
    ? eventDurationHours * 3600 / totalTime
    : 0;

  return {
    averageItem,
    normalFullTime,
    eventFullTime,
    eventFullPoint,
    daySet,
    dayPoint: daySet * eventFullPoint,
    set225,
    point225: set225 * eventFullPoint
  };
}

// ===================================
// Result表示
// ===================================

function showCommonResult(song, mode, result) {
  $("results").style.display = "block";

  $("resultSong").textContent = song.name;
  $("resultMode").textContent = mode;

  $("resultAverage").textContent =
    `${result.averageItem.toFixed(2)} 個`;

  $("resultNormalTime").textContent =
    secToTime(result.normalFullTime);

  $("resultEventTime").textContent =
    secToTime(result.eventFullTime);
}

function showSingleResult(song, mode, result) {
  $("mixedBreakdown").style.display = "none";

  showCommonResult(
    song,
    mode === "manual"
      ? "フル手打ち"
      : "フルバックグラウンド",
    result
  );

  $("resultDailyItems").textContent =
    result.averageItem.toFixed(2);

  $("resultDailyEventRuns").textContent =
    (result.daySet * eventFullCount).toFixed(2);

  $("resultDayPoint").textContent =
    Math.floor(result.dayPoint).toLocaleString();

  $("result225Set").textContent =
    result.set225.toFixed(2);

  $("result225Point").textContent =
    Math.floor(result.point225).toLocaleString();
}

function showMixedResult(song, result) {
  showCommonResult(
    song,
    "手打ち＆バックグラウンド",
    result
  );

  $("mixedBreakdown").style.display = "grid";

  $("resultDailyItems").textContent =
    Math.floor(result.totalItems).toLocaleString();

  $("resultDailyEventRuns").textContent =
    result.actualEventRuns.toFixed(2);

  $("resultDayPoint").textContent =
    Math.floor(result.dailyPoint).toLocaleString();

  $("result225Set").textContent =
    result.projectedEventRuns.toFixed(2);

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
}

// ===================================
// 計算ボタン
// ===================================

$("calc").addEventListener("click", () => {
  const mode = getSelectedPlayMode();

  if (!validateCommonInputs(mode)) {
    return;
  }

  if (mode === "both" && !validateMixedTime()) {
    return;
  }

  const song = normalSongs[normalSong.selectedIndex];

  const eventInputTime =
    Number(eventMin.value || 0) * 60 +
    Number(eventSec.value || 0);

  const bonus = Number(bonusInput.value);
  const networkTime = getNetworkTime();
  const itemMap = getItemMap();

  // フル手打ち
  if (mode === "fullManual") {
    const result = calculateSingleMode(
      "manual",
      song,
      eventInputTime,
      bonus,
      networkTime,
      itemMap
    );

    if (result === null) return;

    showSingleResult(song, "manual", result);
  }

  // フルバックグラウンド
  else if (mode === "fullBackground") {
    const result = calculateSingleMode(
      "background",
      song,
      eventInputTime,
      bonus,
      networkTime,
      itemMap
    );

    if (result === null) return;

    showSingleResult(song, "background", result);
  }

  // 手打ち＆バックグラウンド
  else if (mode === "both") {
    const result = calculateMixedMode(
      song,
      eventInputTime,
      bonus,
      networkTime,
      itemMap
    );

    if (result === null) return;

    // アイテム不足でも計算結果を表示する
    if (result.errors.includes("limit")) {
      alert(
        "アイテム所持数が99,999個の上限を超えています。\n" +
        "時間入力を確認してください。"
      );
      return;
    }

    if (result.errors.includes("depletion")) {
      alert(
        "アイテムが不足しています。\n" +
        "所持数がマイナスの状態で計算結果を表示します。"
      );
    }

    showMixedResult(song, result);
  }

  $("results").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// ===================================
// 初期表示
// ===================================

updatePlayMode();
