/* ==========================================================================
   main.js - 探索マップ、フォグ描画、UIイベント、GPS/シミュレータ連携
   ========================================================================== */

import { GameState, ACHIEVEMENTS } from './gameState.js';
import { MovementSimulator } from './simulator.js';

// ゲームステートとシミュレーターのインスタンス化
const state = new GameState();
const simulator = new MovementSimulator();

// グローバル変数
let map = null;
let playerMarker = null;
let gpsWatchId = null;
let isTracking = true; // GPSトラッキング有効フラグ
let isAutoCentering = true; // カメラ自動追従フラグ
let currentLatLng = { lat: 35.6895, lng: 139.6917 }; // デフォルト：東京（皇居付近）
let spotMarkers = []; // 地図上のスポットマーカー

// 地図タイルのURLテンプレート
const MAP_TILES = {
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

const MAP_ATTRIBUTION = {
  osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
};

let activeTileLayer = null;

// DOM要素の取得
const elLevel = document.getElementById('val-level');
const elXpRatio = document.getElementById('val-xp-ratio');
const elXpBar = document.getElementById('xp-bar-inner');
const elDistance = document.getElementById('val-distance');
const elExploration = document.getElementById('val-exploration');
const elLogs = document.getElementById('game-logs');

const btnGps = document.getElementById('btn-gps');
const btnCenter = document.getElementById('btn-center');
const btnJournal = document.getElementById('btn-journal');
const btnSettings = document.getElementById('btn-settings');

const popupAchievement = document.getElementById('achievement-popup');
const elAchievementDesc = document.getElementById('achievement-desc');

// モーダル
const modalJournal = document.getElementById('journal-modal');
const modalSettings = document.getElementById('settings-modal');
const modalSpot = document.getElementById('spot-modal');

const btnCloseJournal = document.getElementById('btn-close-journal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCloseSpot = document.getElementById('btn-close-spot');

// 設定項目
const rangeFogRadius = document.getElementById('range-fog-radius');
const valFogRadius = document.getElementById('val-fog-radius');
const checkSimActive = document.getElementById('check-sim-active');
const selectSimSpeed = document.getElementById('select-sim-speed');

// アクションボタン
const btnExport = document.getElementById('btn-export');
const btnImportTrigger = document.getElementById('btn-import-trigger');
const fileImport = document.getElementById('file-import');
const btnReset = document.getElementById('btn-reset');

// スポット保存
const inputSpotName = document.getElementById('input-spot-name');
const btnSaveSpot = document.getElementById('btn-save-spot');
const btnCancelSpot = document.getElementById('btn-cancel-spot');
let pendingSpotLatLng = null; // スポット作成保留中の座標

// キャンバス
const canvas = document.getElementById('fog-canvas');

/* ==========================================================================
   地図とキャンバスの初期化
   ========================================================================== */

function initMap() {
  // ステート読み込み
  state.load();
  
  // 保存された最新の位置があればそこを開始地点にする
  if (state.history.length > 0) {
    currentLatLng = state.history[state.history.length - 1];
  }

  // 地図の作成
  map = L.map('map', {
    zoomControl: true,
    doubleClickZoom: false // ダブルクリックでスポットを記録するため無効化
  }).setView([currentLatLng.lat, currentLatLng.lng], 16);

  // タイルの設定
  updateMapStyle(state.mapStyle);

  // プレイヤーマーカー（光のパルス風のカスタムスタイル）
  const pulseIcon = L.divIcon({
    className: 'player-pulse-marker',
    html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  playerMarker = L.marker([currentLatLng.lat, currentLatLng.lng], { icon: pulseIcon }).addTo(map);

  // 保存されているスポットのピンを地図上に復元
  renderSpotMarkers();

  // キャンバスサイズの初期調整
  resizeCanvas();

  // 地図イベントのバインド
  map.on('move', drawFog);
  map.on('zoomend', drawFog);
  map.on('resize', () => {
    resizeCanvas();
    drawFog();
  });

  // マップダブルクリックでスポット登録
  map.on('dblclick', (e) => {
    // 霧が晴れている場所でのみ登録可能にする（ゲーム性のため）
    if (isLatLngCleared(e.latlng)) {
      showSpotPrompt(e.latlng);
    } else {
      addGameLog('霧に包まれた場所にはスポットを記録できません！', 'system');
    }
  });

  // 初期描画
  drawFog();

  // GPSトラッキングの開始
  if (isTracking) {
    startGPSTracking();
  }
}

// キャンバスのサイズをマップコンテナに同期
function resizeCanvas() {
  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
}

// 地図スタイルの更新
function updateMapStyle() {
  if (activeTileLayer) {
    map.removeLayer(activeTileLayer);
  }
  
  activeTileLayer = L.tileLayer(MAP_TILES.osm, {
    maxZoom: 19,
    attribution: MAP_ATTRIBUTION.osm
  }).addTo(map);

  state.mapStyle = 'osm';
  state.save();
}

/* ==========================================================================
   フォグ・オブ・ウォーの描画
   ========================================================================== */

function drawFog() {
  if (!map || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // クリア
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 画面全体を「霧」で覆う (ダークネイビーのゲーム風の霧)
  ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const points = state.history;
  if (points.length === 0) return;

  // ズームレベルに応じた「メートル -> ピクセル」の半径を動的に計算
  const center = map.getCenter();
  const radiusMeters = state.fogRadius;
  const latOffset = radiusMeters / 111320; // 緯度1度 ≒ 111.32km
  const pCenter = map.latLngToContainerPoint(center);
  const pOffset = map.latLngToContainerPoint([center.lat + latOffset, center.lng]);
  const radiusPx = Math.max(15, Math.abs(pCenter.y - pOffset.y)); // 最低15pxを保証

  // 2. 軌跡の周囲の霧を「くり抜く」 (destination-out)
  ctx.globalCompositeOperation = 'destination-out';

  // 連続した歩行ルートを「道」として描画（点と点の間が霧で塞がらないように線で繋ぐ）
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  ctx.lineWidth = radiusPx * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length > 1) {
    ctx.beginPath();
    let p = map.latLngToContainerPoint(points[0]);
    ctx.moveTo(p.x, p.y);
    for (let i = 1; i < points.length; i++) {
      p = map.latLngToContainerPoint(points[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // 各軌跡ポイントの周りを円形でさらにぼかしを入れつつくり抜く
  for (let i = 0; i < points.length; i++) {
    const p = map.latLngToContainerPoint(points[i]);
    
    // 内側が完全に透明、外側にかけて徐々に不透明（＝霧が残る）にするグラデーション
    const grad = ctx.createRadialGradient(p.x, p.y, radiusPx * 0.3, p.x, p.y, radiusPx);
    grad.addColorStop(0, 'rgba(0,0,0,1)');     // 完全にくり抜く
    grad.addColorStop(0.6, 'rgba(0,0,0,0.8)'); // 8割くり抜く
    grad.addColorStop(1, 'rgba(0,0,0,0)');     // くり抜かない（霧のまま）

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radiusPx, 0, Math.PI * 2);
    ctx.fill();
  }

  // 描画モードを通常に戻す
  ctx.globalCompositeOperation = 'source-over';

  // 探索率の計算
  calculateExploration(ctx);
}

// 特定の座標がすでに「霧が晴れた（クリアされた）」領域にあるか判定
function isLatLngCleared(latlng) {
  if (state.history.length === 0) return false;
  
  // 最も近い軌跡ポイントとの距離が、霧を晴らす半径以内かをチェック
  for (let i = 0; i < state.history.length; i++) {
    const pt = state.history[i];
    const dist = state.calculateDistance(latlng.lat, latlng.lng, pt.lat, pt.lng) * 1000; // メートル換算
    if (dist <= state.fogRadius) {
      return true;
    }
  }
  return false;
}

// 画面内の透明ピクセルの割合から探索率を算出する（ゲーム的なアプローチ）
let lastExplorationCalcTime = 0;
function calculateExploration(ctx) {
  const now = Date.now();
  if (now - lastExplorationCalcTime < 1000) return; // 負荷軽減のため1秒に1回に制限
  lastExplorationCalcTime = now;

  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return;

  // 画面全体のピクセルを取得すると非常に重いため、
  // グリッド状にサンプリングして近似値を計算する (10x10ピクセルごと)
  const sampleStep = 15;
  let totalSamples = 0;
  let clearedSamples = 0;

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3]; // A（アルファチャンネル）
        
        totalSamples++;
        // アルファ値が一定以下（＝霧が晴れている）ならクリアとみなす
        if (alpha < 180) {
          clearedSamples++;
        }
      }
    }

    const ratio = totalSamples > 0 ? (clearedSamples / totalSamples) * 100 : 0;
    elExploration.innerText = `${ratio.toFixed(1)} %`;
  } catch (e) {
    console.error('Error calculating exploration ratio:', e);
  }
}

/* ==========================================================================
   GPSトラッキングとプレイヤー更新
   ========================================================================== */

function handlePositionUpdate(lat, lng) {
  currentLatLng = { lat, lng };

  // プレイヤーマーカーの位置更新
  if (playerMarker) {
    playerMarker.setLatLng([lat, lng]);
  }

  // 軌跡の追加とステートの更新
  const added = state.addPosition(lat, lng);

  // マップの中心を合わせる
  if (isAutoCentering && map) {
    map.setView([lat, lng]);
  }

  if (added) {
    drawFog();
    updateUI();
  }
}

function startGPSTracking() {
  if (gpsWatchId) return;

  if ('geolocation' in navigator) {
    const geoOptions = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    };

    gpsWatchId = navigator.geolocation.watchPosition(
      (position) => {
        // シミュレータ起動中はGPSの更新を無視する
        if (simulator.isActive) return;
        
        handlePositionUpdate(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('GPS Error:', error);
        addGameLog('位置情報の取得に失敗しました。GPSをオンにしてください。', 'system');
      },
      geoOptions
    );
    
    addGameLog('GPSトラッキングを開始しました。', 'system');
  } else {
    addGameLog('このブラウザは位置情報サービスをサポートしていません。', 'system');
  }
}

function stopGPSTracking() {
  if (gpsWatchId) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    addGameLog('GPSトラッキングを一時停止しました。', 'system');
  }
}

/* ==========================================================================
   シミュレーターとの連携
   ========================================================================== */

function setupSimulator() {
  // マップクリックでシミュレータの目的地を設定
  map.on('click', (e) => {
    if (!simulator.isActive) return;

    addGameLog(`シミュレーター: 目的地を決定しました。歩行を開始します。`, 'system');

    simulator.start(
      currentLatLng,
      e.latlng,
      // 毎ステップでの処理
      (lat, lng) => {
        handlePositionUpdate(lat, lng);
      },
      // 到着時の処理
      () => {
        addGameLog('目的地に到着しました。', 'system');
      }
    );
  });
}

/* ==========================================================================
   スポット（チェックイン）機能
   ========================================================================== */

function showSpotPrompt(latlng) {
  pendingSpotLatLng = latlng;
  inputSpotName.value = '';
  modalSpot.classList.remove('hidden');
  inputSpotName.focus();
}

function saveSpot() {
  const name = inputSpotName.value.trim();
  if (!name) {
    alert('スポット名を入力してください。');
    return;
  }

  if (pendingSpotLatLng) {
    state.addSpot(name, pendingSpotLatLng.lat, pendingSpotLatLng.lng);
    renderSpotMarkers();
    modalSpot.classList.add('hidden');
    pendingSpotLatLng = null;
    updateUI();
  }
}

function renderSpotMarkers() {
  // 既存のマーカーをすべて削除
  spotMarkers.forEach(m => map.removeLayer(m));
  spotMarkers = [];

  // 保存されているスポットからピンを作成
  state.spots.forEach((spot, index) => {
    // 宝箱アイコン
    const chestIcon = L.divIcon({
      className: 'chest-marker',
      html: '<div class="chest-pin"><i class="fa-solid fa-gift"></i></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });

    const marker = L.marker([spot.lat, spot.lng], { icon: chestIcon })
      .addTo(map)
      .bindPopup(`
        <div class="spot-popup">
          <h4>${spot.name}</h4>
          <p>${spot.time}</p>
        </div>
      `);
      
    spotMarkers.push(marker);
  });
}

/* ==========================================================================
   UIの更新 & イベントバインド
   ========================================================================== */

function updateUI() {
  // レベル・XP
  elLevel.innerText = state.level;
  const reqXp = state.getRequiredXPForNextLevel();
  elXpRatio.innerText = `${state.xp} / ${reqXp}`;
  const pct = (state.xp / reqXp) * 100;
  elXpBar.style.width = `${pct}%`;

  // 距離
  elDistance.innerText = `${state.totalDistance.toFixed(2)} km`;
}

// ログ出力
function addGameLog(text, type = 'system') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerText = text;
  
  elLogs.appendChild(entry);
  
  // 自動スクロール
  elLogs.scrollTop = elLogs.scrollHeight;
  
  // 5つ以上のログは古いものから削除
  while (elLogs.childNodes.length > 5) {
    elLogs.removeChild(elLogs.firstChild);
  }
}

// 実績解除アニメーション
function triggerAchievementPopup(ach) {
  // ポップアップの内容設定
  elAchievementDesc.innerText = ach.name;
  popupAchievement.classList.remove('hidden');

  // 効果音（Web Audio APIによるレトロなファンファーレ合成音）
  playRetroFanfare();

  // 4秒後に閉じる
  setTimeout(() => {
    popupAchievement.classList.add('hidden');
  }, 4000);
}

// レトロゲーム風効果音（Web Audio API）
function playRetroFanfare() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playNote = (freq, duration, startTime) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'square'; // レトロ感のある矩形波
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    // C5, E5, G5, C6 のファンファーレ
    playNote(523.25, 0.15, now);
    playNote(659.25, 0.15, now + 0.15);
    playNote(783.99, 0.15, now + 0.3);
    playNote(1046.50, 0.4, now + 0.45);
  } catch (e) {
    console.warn('AudioContext failed:', e);
  }
}

// レベルアップ効果音
function playLevelUpSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, duration, startTime) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    playNote(523.25, 0.1, now);
    playNote(587.33, 0.1, now + 0.1);
    playNote(659.25, 0.1, now + 0.2);
    playNote(698.46, 0.1, now + 0.3);
    playNote(783.99, 0.15, now + 0.4);
    playNote(880.00, 0.15, now + 0.55);
    playNote(987.77, 0.15, now + 0.7);
    playNote(1046.50, 0.5, now + 0.85);
  } catch (e) {
    console.warn(e);
  }
}

// モーダルやタブ、設定のバインディング
function setupUIEvents() {
  // GPSトラッキングボタン
  btnGps.addEventListener('click', () => {
    isTracking = !isTracking;
    btnGps.classList.toggle('active', isTracking);
    
    if (isTracking) {
      startGPSTracking();
    } else {
      stopGPSTracking();
    }
  });

  // カメラ追従ボタン
  btnCenter.addEventListener('click', () => {
    isAutoCentering = true;
    btnCenter.classList.add('active');
    if (map) {
      map.setView([currentLatLng.lat, currentLatLng.lng], 17);
    }
    addGameLog('カメラをプレイヤー位置に固定しました。', 'system');
  });

  // 地図を手動でドラッグ移動した場合は、自動追従をOFFにする
  map.on('dragstart', () => {
    isAutoCentering = false;
    btnCenter.classList.remove('active');
  });

  // 冒険日誌モーダル
  btnJournal.addEventListener('click', () => {
    renderJournal();
    modalJournal.classList.remove('hidden');
  });
  btnCloseJournal.addEventListener('click', () => {
    modalJournal.classList.add('hidden');
  });

  // 設定モーダル
  btnSettings.addEventListener('click', () => {
    modalSettings.classList.remove('hidden');
  });
  btnCloseSettings.addEventListener('click', () => {
    modalSettings.classList.add('hidden');
  });

  // 設定値変更イベント: 霧の半径
  rangeFogRadius.addEventListener('input', (e) => {
    const meters = parseInt(e.target.value);
    valFogRadius.innerText = `${meters}m`;
    state.fogRadius = meters;
    state.save();
    drawFog();
  });



  // シミュレータ有効化スイッチ
  checkSimActive.addEventListener('change', (e) => {
    const active = e.target.checked;
    simulator.setActive(active);
    if (active) {
      stopGPSTracking();
      btnGps.classList.remove('active');
      isTracking = false;
      addGameLog('シミュレーター起動: 地図をクリックして移動します。', 'system');
    } else {
      addGameLog('シミュレーターを停止しました。', 'system');
    }
  });

  // シミュレータ速度
  selectSimSpeed.addEventListener('change', (e) => {
    simulator.setSpeed(e.target.value);
  });

  // データインポート・エクスポート
  btnExport.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      history: state.history,
      spots: state.spots
    }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `discovery_walk_trail_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  btnImportTrigger.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.history && Array.isArray(parsed.history)) {
          state.history = parsed.history;
          state.spots = parsed.spots || [];
          state.save();
          
          if (state.history.length > 0) {
            currentLatLng = state.history[state.history.length - 1];
            map.setView([currentLatLng.lat, currentLatLng.lng], 16);
            playerMarker.setLatLng([currentLatLng.lat, currentLatLng.lng]);
          }

          renderSpotMarkers();
          drawFog();
          updateUI();
          addGameLog('軌跡データをインポートしました！', 'system');
        } else {
          alert('不正な軌跡ファイル形式です。');
        }
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  });

  // 初期化ボタン
  btnReset.addEventListener('click', () => {
    if (confirm('これまでのレベル、移動軌跡、記録したスポットなどのすべてのデータが消去されます。本当に初期化しますか？')) {
      state.reset();
      simulator.stop();
      currentLatLng = { lat: 35.6895, lng: 139.6917 };
      map.setView([currentLatLng.lat, currentLatLng.lng], 16);
      playerMarker.setLatLng([currentLatLng.lat, currentLatLng.lng]);
      renderSpotMarkers();
      drawFog();
      updateUI();
      modalSettings.classList.add('hidden');
    }
  });

  // スポット登録の決定・キャンセル
  btnSaveSpot.addEventListener('click', saveSpot);
  btnCancelSpot.addEventListener('click', () => {
    modalSpot.classList.add('hidden');
    pendingSpotLatLng = null;
  });
  btnCloseSpot.addEventListener('click', () => {
    modalSpot.classList.add('hidden');
    pendingSpotLatLng = null;
  });

  // 冒険日誌のタブ切替
  const tabBtns = modalJournal.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tabId = btn.getAttribute('data-tab');
      modalJournal.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(tabId).classList.remove('hidden');
    });
  });
}

// 冒険日誌モーダルのレンダリング
function renderJournal() {
  // 1. 実績一覧
  const achList = document.getElementById('achievements-list');
  achList.innerHTML = '';

  Object.values(ACHIEVEMENTS).forEach(ach => {
    const isUnlocked = state.unlockedAchievements.includes(ach.id);
    const card = document.createElement('div');
    card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
    
    card.innerHTML = `
      <div class="ach-icon">
        <i class="fa-solid ${ach.icon}"></i>
      </div>
      <div class="ach-info">
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
      <div class="ach-badge">${isUnlocked ? 'Unlocked' : 'Locked'}</div>
    `;
    achList.appendChild(card);
  });

  // 2. スポット一覧
  const locList = document.getElementById('locations-list');
  locList.innerHTML = '';

  if (state.spots.length === 0) {
    locList.innerHTML = `<p class="empty-msg">まだチェックインしたスポットはありません。地図をダブルクリックするか、現在地でスポットを記録してみましょう！</p>`;
  } else {
    state.spots.forEach((spot, idx) => {
      const card = document.createElement('div');
      card.className = 'location-card';
      card.innerHTML = `
        <div class="loc-details">
          <div class="loc-name">${spot.name}</div>
          <div class="loc-time">${spot.time}</div>
        </div>
        <button class="btn-loc-delete" data-index="${idx}" title="削除">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      locList.appendChild(card);
    });

    // 削除ボタンのバインド
    locList.querySelectorAll('.btn-loc-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'));
        if (confirm(`スポット「${state.spots[idx].name}」を削除しますか？`)) {
          state.removeSpot(idx);
          renderSpotMarkers();
          renderJournal();
        }
      });
    });
  }
}

// コールバックとステートの接続
function bindStateCallbacks() {
  state.onXPChange = (xp, nextXp) => {
    elXpRatio.innerText = `${xp} / ${nextXp}`;
    const pct = (xp / nextXp) * 100;
    elXpBar.style.width = `${pct}%`;
  };
  
  state.onLevelUp = () => {
    playLevelUpSound();
    // レベルアップダイアログや特別なビジュアルエフェクトを追加しても良い
  };

  state.onAchievementUnlock = (ach) => {
    triggerAchievementPopup(ach);
  };

  state.onLog = (text, type) => {
    addGameLog(text, type);
  };
}

/* ==========================================================================
   アプリケーション起動
   ========================================================================== */

window.addEventListener('DOMContentLoaded', () => {
  // ステートコールバック登録
  bindStateCallbacks();
  
  // マップとUIの初期化
  initMap();
  setupUIEvents();
  setupSimulator();
  
  // 初期設定値をUIに反映
  rangeFogRadius.value = state.fogRadius;
  valFogRadius.innerText = `${state.fogRadius}m`;

  updateUI();
});
