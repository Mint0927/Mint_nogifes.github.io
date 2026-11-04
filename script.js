
"use strict";

// ===================================
// DOM取得
// ===================================

const normalSong = document.getElementById("normalSong");
const normalHour = document.getElementById("normalHour");
const normalMin = document.getElementById("normalMin");
const normalSec = document.getElementById("normalSec");

const accuracyArea = document.getElementById("accuracyArea");

const eventMin = document.getElementById("eventMin");
const eventSec = document.getElementById("eventSec");

const bonusInput = document.getElementById("bonus");
const eventPointOutput = document.getElementById("eventPoint");

const accuracyIds = [
  "フルエク",
  "フルコン",
  "Aコン",
  "Bコン",
  "Cコン",
  "Dコン"
];

// ===================================
// 通常曲データ（秒）
// ===================================

const normalSongs = [
  { name: "最後のTightHug", time: 236, lp: 81 },
  { name: "サヨナラの意味 向井葉月セレモニー", time: 237, lp: 81 },
  { name: "あと7曲", time: 237, lp: 81 },
  { name: "三番目の風", time: 238, lp: 81 },
  { name: "渋谷ブルース", time: 224, lp: 75 }
];

// ===================================
// アイテム数
// ===================================

const itemMap_LP81 = {
  フルエク: 930,
  フルコン: 898,
  Aコン: 868,
  Bコン: 836,
  Cコン: 806,
  Dコン: 774
};

const itemMap_LP75 = {
  フルエク: 858,
  フルコン: 828,
  Aコン: 800,
  Bコン: 772,
  Cコン: 744,
  Dコン: 714
};

// ===================================
// 時間変換
// ===================================

function secToTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    seconds = 0;
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${h}時間 ${m}分 ${s}秒`;
}

// ===================================
// プレイ用途取得
// ===================================

function getSelectedPlayMode() {
  return document.querySelector(
    'input[name="playMode"]:checked'
  ).value;
}

// ===================================
// アイテム数取得
// ===================================

function getItemMap() {
  const song = normalSongs[normalSong.selectedIndex];

  return song.lp === 75
    ? itemMap_LP75
    : itemMap_LP81;
}

// ===================================
// 通常曲選択肢
// ===================================

normalSongs.forEach((song, index) => {
  const option = document.createElement("option");

  option.value = index;
  option.textContent = song.name;

  normalSong.appendChild(option);
});

// ===================================
// 通常曲時間表示
// ===================================

function updateNormalSongTime() {
  const song = normalSongs[normalSong.selectedIndex];

  normalHour.value = Math.floor(song.time / 3600);
  normalMin.value = Math.floor((song.time % 3600) / 60);
  normalSec.value = song.time % 60;
}

normalSong.addEventListener("change", updateNormalSongTime);

updateNormalSongTime();

// ===================================
// 精度選択肢作成
// ===================================

accuracyIds.forEach(id => {
  const select = document.getElementById(id);

  for (let i = 0; i <= 100; i += 10) {
    const option = document.createElement("option");

    option.value = i;
    option.textContent = `${i}%`;

    select.appendChild(option);
  }

  select.value = "0";
  select.addEventListener("change", updateAccuracyLimit);
});

// ===================================
// 精度合計100%制限
// ===================================

function updateAccuracyLimit() {
  accuracyIds.forEach(id => {
    const select = document.getElementById(id);

    const otherTotal = accuracyIds
      .filter(otherId => otherId !== id)
      .reduce((total, otherId) => {
        return total + Number(
          document.getElementById(otherId).value || 0
        );
      }, 0);

    Array.from(select.options).forEach(option => {
      const value = Number(option.value);

      option.hidden = otherTotal + value > 100;
      option.disabled = otherTotal + value > 100;
    });
  });
}

updateAccuracyLimit();

// ===================================
// プレイ用途切り替え
// ===================================

function updatePlayMode() {
  const isBackground =
    getSelectedPlayMode() === "background";

  accuracyArea.style.display =
    isBackground ? "none" : "block";
}

document.querySelectorAll('input[name="playMode"]')
  .forEach(radio => {
    radio.addEventListener("change", updatePlayMode);
  });

updatePlayMode();

// ===================================
// 特攻PT計算
// ===================================

function updateEventPoint() {
  const bonus = Number(bonusInput.value || 0);

  if (
    bonusInput.value === "" ||
    !Number.isFinite(bonus) ||
    bonus < 0
  ) {
    eventPointOutput.textContent = "pt";
    return;
  }

  const point = Math.floor(
    1150 * (1 + bonus / 100) + 288
  );

  eventPointOutput.textContent =
    `${point.toLocaleString()} PT`;
}

bonusInput.addEventListener("input", updateEventPoint);

updateEventPoint();

// ===================================
// 計算
// ===================================

document.getElementById("calc").addEventListener("click", () => {

  const mode = getSelectedPlayMode();
  const song = normalSongs[normalSong.selectedIndex];

  // バックグラウンドは14秒短縮
  const adjustment = mode === "background" ? 14 : 0;

  const normalSongTime = song.time - adjustment;

  const eventInputTime =
    Number(eventMin.value || 0) * 60 +
    Number(eventSec.value || 0);

  const eventSongTime = eventInputTime - adjustment;

  const eventPoint = Math.floor(
    1150 * (1 + Number(bonusInput.value || 0) / 100) + 288
  );

  // 入力チェック
  if (normalSongTime <= 0) {
    alert("通常曲の時間が不正です。");
    return;
  }

  if (eventInputTime <= 0 || eventSongTime <= 0) {
    alert("イベント曲の時間を正しく入力してください。");
    return;
  }

  const bonus = Number(bonusInput.value);

  if (
    bonusInput.value === "" ||
    !Number.isFinite(bonus) ||
    bonus < 0 ||
    bonus > 9999
  ) {
    alert("特攻値は0～9999%で入力してください。");
    return;
  }

  // ===================================
  // 平均アイテム数
  // ===================================

  const itemMap = getItemMap();

  let averageItem = 0;

if (mode === "background") {

  // バックグラウンドはDコン固定
  averageItem = itemMap["Dコン"];

} else {

  let totalPercent = 0;

  accuracyIds.forEach(id => {
    const percent = Number(
      document.getElementById(id).value || 0
    );

    totalPercent += percent;

    averageItem += itemMap[id] * percent / 100;
  });

  // 精度が未入力の場合
  if (totalPercent === 0) {
    alert("通常曲の精度を入力してください。");
    return;
  }

  // 精度合計チェック
  if (totalPercent !== 100) {
    alert("通常曲の精度の合計を100%にしてください。");
    return;
  }
}

  // ===================================
  // 時間計算
  // ===================================

  const normalFullTime =
    averageItem > 0
      ? (99999 / averageItem) * normalSongTime
      : 0;

  const eventFullTime = eventSongTime * 114;

  const eventFullPoint = eventPoint * 114;

  const totalTime = normalFullTime + eventFullTime;

  // 1日換算
  const daySet =
    totalTime > 0 ? 86400 / totalTime : 0;

  const dayPoint =
    daySet * eventFullPoint;

  // 225時間換算
  const set225 =
    totalTime > 0 ? (225 * 3600) / totalTime : 0;

  const point225 =
    set225 * eventFullPoint;

  // ===================================
  // Result表示
  // ===================================

  document.getElementById("resultMode").textContent =
    mode === "manual" ? "手打ち" : "バックグラウンド";

  document.getElementById("resultSong").textContent =
    song.name;

  document.getElementById("resultAverage").textContent =
    `${averageItem.toFixed(2)} 個`;

  document.getElementById("resultNormalTime").textContent =
    secToTime(normalFullTime);

  document.getElementById("resultEventTime").textContent =
    secToTime(eventFullTime);

  document.getElementById("resultDaySet").textContent =
    daySet.toFixed(2);

  document.getElementById("resultDayPoint").textContent =
    Math.floor(dayPoint).toLocaleString();

  document.getElementById("result225Set").textContent =
    set225.toFixed(2);

  document.getElementById("result225Point").textContent =
    Math.floor(point225).toLocaleString();

  document.getElementById("results").style.display = "block";
});
