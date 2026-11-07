<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>乃木フェス計算ツール</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js" defer></script>
</head>
<body>
<main class="container">
  <header class="title-banner"><h1>乃木フェス計算ツール</h1></header>

  <nav class="tabs" aria-label="メインタブ">
    <button class="tab-button active" type="button" data-tab="settings">設定</button>
    <button class="tab-button" type="button" data-tab="play">プレイ</button>
    <button class="tab-button" type="button" data-tab="result">Result</button>
  </nav>

  <section id="settingsTab" class="tab-panel active">
    <section class="panel settings-mode">
      <h2 class="panel-title">プレイ用途</h2>
      <div class="panel-content mode-options">
        <label><input type="radio" name="playMode" value="fullManual" checked> フル手打ち／フルBG</label>
        <label><input type="radio" name="playMode" value="both"> 手打ち＆バックグラウンド</label>
      </div>
    </section>

    <section id="networkArea" class="network-area">
      <h3>ネット速度</h3>
      <div class="network-options">
        <label><input type="radio" name="networkSpeed" value="24" checked> 速い（24秒）</label>
        <label><input type="radio" name="networkSpeed" value="26"> 普通（26秒）</label>
        <label><input type="radio" name="networkSpeed" value="28"> 遅い（28秒）</label>
      </div>
    </section>

    <div class="song-grid">
      <section class="panel">
        <h2 class="panel-title">通常曲</h2>
        <div class="panel-content">
          <label class="field-label" for="normalSong">曲選択</label>
          <select id="normalSong"></select>
          <div class="song-time">曲時間：<input type="number" id="normalMin" readonly> 分 <input type="number" id="normalSec" readonly> 秒</div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">イベント曲</h2>
        <div class="panel-content">
          <label class="field-label">曲時間</label>
          <div class="time-inputs event-time">
            <input type="number" id="eventMin" min="0" max="999" placeholder="分" inputmode="numeric"><span>分</span>
            <input type="number" id="eventSec" min="0" max="59" placeholder="秒" inputmode="numeric"><span>秒</span>
          </div>
          <div class="bonus-row">
            <div class="bonus-input">
              <label for="bonus">特攻値</label>
              <div><input type="number" id="bonus" min="0" max="9999" value="0" inputmode="numeric"><span>%</span></div>
            </div>
            <span class="arrow">→</span>
            <div class="event-point"><label>イベントpt</label><output id="eventPoint">pt</output></div>
          </div>
        </div>
      </section>
    </div>
  </section>

  <section id="playTab" class="tab-panel">
<section id="fullModeArea" class="panel">
  <h2 class="panel-title">プレイ方法</h2>

  <div class="panel-content toggle-row">
    <button
      id="manualModeButton"
      class="toggle-button active"
      type="button"
      aria-pressed="true"
    >
      フル手打ち
    </button>

    <button
      id="backgroundModeButton"
      class="toggle-button"
      type="button"
      aria-pressed="false"
    >
      フルバックグラウンド
    </button>
  </div>
</section>

    <section id="accuracyArea" class="panel accuracy-panel">
      <h2 class="panel-title">精度</h2>
      <div class="accuracy-grid">
        <div class="accuracy-item"><label for="フルエク">フルエク</label><select id="フルエク"></select></div>
        <div class="accuracy-item"><label for="フルコン">フルコン</label><select id="フルコン"></select></div>
        <div class="accuracy-item"><label for="Aコン">Aコン</label><select id="Aコン"></select></div>
        <div class="accuracy-item"><label for="Bコン">Bコン</label><select id="Bコン"></select></div>
        <div class="accuracy-item"><label for="Cコン">Cコン</label><select id="Cコン"></select></div>
        <div class="accuracy-item"><label for="Dコン">Dコン</label><select id="Dコン"></select></div>
      </div>
    </section>

    <section id="mixedTimeArea" class="panel mixed-panel" hidden>
      <h2 class="panel-title">1日あたりのバックグラウンド時間</h2>
      <div class="mixed-grid">
        <div class="mixed-time-card">
          <h3>通常曲・バックグラウンド</h3>
          <div class="dial-time" data-wheel="normalBg">
            <div class="wheel-column"><span class="wheel-label">時間</span><div class="wheel" id="normalBgHourWheel" aria-label="通常曲BG時間"></div></div>
            <span class="wheel-unit">時間</span>
            <div class="wheel-column"><span class="wheel-label">分</span><div class="wheel" id="normalBgMinWheel" aria-label="通常曲BG分"></div></div>
            <span class="wheel-unit">分</span>
          </div>
        </div>
        <div class="mixed-time-card">
          <h3>イベント曲・バックグラウンド</h3>
          <div class="dial-time" data-wheel="eventBg">
            <div class="wheel-column"><span class="wheel-label">時間</span><div class="wheel" id="eventBgHourWheel" aria-label="イベント曲BG時間"></div></div>
            <span class="wheel-unit">時間</span>
            <div class="wheel-column"><span class="wheel-label">分</span><div class="wheel" id="eventBgMinWheel" aria-label="イベント曲BG分"></div></div>
            <span class="wheel-unit">分</span>
          </div>
        </div>
      </div>
      <p id="dailyTimeTotal" class="daily-total">BG合計：0時間 0分 / 24時間</p>
      <p class="time-note">残り時間は手打ちに自動配分し、イベントptが最大になる組み合わせを探します。</p>
    </section>

    <div class="item-inventory">
      <p>現在のアイテム所持数（計算プレビュー）</p>
      <strong id="itemInventory">0 個</strong>
      <small>最大所持数：99,999個</small>
    </div>

    <button id="calc" class="calc-button" type="button">計算する</button>
  </section>

  <section id="resultTab" class="tab-panel">
    <section id="results" class="panel result-panel">
      <h2 class="panel-title">Result</h2>
      <div class="result-content">
        <div class="result-summary">
          <div class="summary-item"><span>選択曲</span><strong id="resultSong">-</strong></div>
          <div class="summary-item"><span>プレイ方法</span><strong id="resultMode">-</strong></div>
          <div class="summary-item"><span>平均アイテム数</span><strong id="resultAverage">0.00 個</strong></div>
          <div class="summary-item"><span>通常曲の計算時間</span><strong id="resultNormalTime">0時間 0分 0秒</strong></div>
          <div class="summary-item"><span>イベント曲の計算時間</span><strong id="resultEventTime">0時間 0分 0秒</strong></div>
        </div>

        <div class="result-bottom">
          <div class="result-card">
            <h3>1日換算</h3>
            <p>通常曲で獲得したアイテム：<strong id="resultDailyItems">0</strong> 個</p>
            <p>イベント曲プレイ可能数：<strong id="resultDailyEventRuns">0.00</strong> 回</p>
            <p>イベント獲得pt：<strong id="resultDayPoint">0</strong> pt</p>
          </div>
          <div class="result-card">
            <h3>イベント全体（225時間）</h3>
            <p>イベント曲プレイ数：<strong id="result225Set">0.00</strong> 回</p>
            <p>推定イベント全体pt：<strong id="result225Point">0</strong> pt</p>
          </div>
        </div>

        <div id="mixedBreakdown" class="result-bottom" hidden>
          <div class="result-card">
            <h3>通常曲の内訳（1日）</h3>
            <p>手打ち：<strong id="resultManualNormalRuns">0</strong> 回</p>
            <p>BG：<strong id="resultBgNormalRuns">0</strong> 回</p>
            <p>手打ち獲得アイテム：<strong id="resultManualItems">0</strong> 個</p>
            <p>BG獲得アイテム：<strong id="resultBgItems">0</strong> 個</p>
            <p>通常曲・手打ち時間：<strong id="resultManualNormalTime">0</strong></p>
          </div>
          <div class="result-card">
            <h3>イベント曲の内訳（1日）</h3>
            <p>手打ち：<strong id="resultManualEventRuns">0</strong> 回</p>
            <p>BG：<strong id="resultBgEventRuns">0</strong> 回</p>
            <p>手打ち獲得pt：<strong id="resultManualEventPoints">0</strong> pt</p>
            <p>BG獲得pt：<strong id="resultBgEventPoints">0</strong> pt</p>
            <p>イベント曲・手打ち時間：<strong id="resultManualEventTime">0</strong></p>
          </div>
        </div>
      </div>
    </section>
    <button id="backToPlay" class="secondary-button" type="button">プレイ画面に戻る</button>
  </section>
</main>
</body>
</html>
