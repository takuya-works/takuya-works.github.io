/* ==========================================================================
   gameState.js - ゲームステート＆ロジック管理
   ========================================================================== */

// 地球の半径 (km) - 距離計算用
const EARTH_RADIUS_KM = 6371;

// 実績マスターデータ
export const ACHIEVEMENTS = {
  first_step: {
    id: 'first_step',
    name: '最初の一歩',
    desc: 'GPSトラッキングを開始し、最初の座標を記録した。',
    icon: 'fa-shoe-prints'
  },
  explorer_100m: {
    id: 'explorer_100m',
    name: '近所のお散歩',
    desc: '累計で 100m 以上歩いた。',
    icon: 'fa-map-location-dot'
  },
  explorer_1km: {
    id: 'explorer_1km',
    name: '新天地の開拓者',
    desc: '累計で 1km 以上歩いた。',
    icon: 'fa-compass'
  },
  explorer_5km: {
    id: 'explorer_5km',
    name: '伝説の旅人',
    desc: '累計で 5km 以上歩いた。',
    icon: 'fa-route'
  },
  night_walker: {
    id: 'night_walker',
    name: '夜の冒険者',
    desc: '夜間 (20:00〜4:00) に散歩を行った。',
    icon: 'fa-moon'
  },
  spot_finder: {
    id: 'spot_finder',
    name: '地図への名刻',
    desc: '初めてのスポットを冒険日誌に記録した。',
    icon: 'fa-gem'
  },
  level_5: {
    id: 'level_5',
    name: '一流の冒険家',
    desc: 'レベル 5 に到達した。',
    icon: 'fa-crown'
  }
};

export class GameState {
  constructor() {
    this.level = 1;
    this.xp = 0;
    this.totalDistance = 0; // 単位: km
    this.history = []; // [{lat, lng}, ...]
    this.spots = []; // [{name, lat, lng, time}, ...]
    this.unlockedAchievements = []; // ['first_step', ...]
    this.fogRadius = 30; // 霧を晴らす半径 (メートル)
    this.mapStyle = 'dark'; // 'dark' | 'light' | 'osm'
    
    // イベントリスナー用コールバック
    this.onXPChange = null;
    this.onLevelUp = null;
    this.onAchievementUnlock = null;
    this.onLog = null;
  }

  // localStorage からのデータ復元
  load() {
    try {
      const data = localStorage.getItem('discovery_walk_state');
      if (data) {
        const parsed = JSON.parse(data);
        this.level = parsed.level || 1;
        this.xp = parsed.xp || 0;
        this.totalDistance = parsed.totalDistance || 0;
        this.history = parsed.history || [];
        this.spots = parsed.spots || [];
        this.unlockedAchievements = parsed.unlockedAchievements || [];
        this.fogRadius = parsed.fogRadius || 30;
        this.mapStyle = parsed.mapStyle || 'dark';
      }
    } catch (e) {
      console.error('Failed to load game state:', e);
    }
  }

  // localStorage へのデータ保存
  save() {
    try {
      const data = {
        level: this.level,
        xp: this.xp,
        totalDistance: this.totalDistance,
        history: this.history,
        spots: this.spots,
        unlockedAchievements: this.unlockedAchievements,
        fogRadius: this.fogRadius,
        mapStyle: this.mapStyle
      };
      localStorage.setItem('discovery_walk_state', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  // データの全初期化
  reset() {
    this.level = 1;
    this.xp = 0;
    this.totalDistance = 0;
    this.history = [];
    this.spots = [];
    this.unlockedAchievements = [];
    this.save();
    if (this.onLog) this.onLog('すべての冒険データが初期化されました。', 'system');
  }

  // 次のレベルに必要なXP
  getRequiredXPForNextLevel() {
    return this.level * 100;
  }

  // 経験値(XP)の追加
  addXP(amount) {
    if (amount <= 0) return;
    
    this.xp += amount;
    let leveledUp = false;
    
    while (this.xp >= this.getRequiredXPForNextLevel()) {
      this.xp -= this.getRequiredXPForNextLevel();
      this.level++;
      leveledUp = true;
    }
    
    if (this.onXPChange) {
      this.onXPChange(this.xp, this.getRequiredXPForNextLevel());
    }
    
    if (leveledUp) {
      if (this.onLevelUp) this.onLevelUp(this.level);
      this.triggerLog(`レベルアップ！ レベル ${this.level} に到達しました！`, 'level-up');
      this.checkAchievements();
    }
    
    this.save();
  }

  // 新しい移動座標を追加
  addPosition(lat, lng) {
    const newPoint = { lat, lng };
    
    // 初回ポイントの追加
    if (this.history.length === 0) {
      this.history.push(newPoint);
      this.triggerLog('冒険がスタートしました！周囲の霧が晴れました。', 'system');
      
      // 最初の一歩 XP
      this.addXP(10);
      this.checkAchievements();
      this.save();
      return true;
    }

    const lastPoint = this.history[this.history.length - 1];
    
    // 重複チェック（近すぎる場合は無視してバッテリーとメモリを節約）
    const dist = this.calculateDistance(lastPoint.lat, lastPoint.lng, lat, lng);
    if (dist < 0.003) { // 3メートル未満の移動はスキップ
      return false;
    }

    // 履歴に追加
    this.history.push(newPoint);
    
    // 総距離を加算
    this.totalDistance += dist;
    
    // 霧を晴らした（移動した）ことによるXP。
    // 移動距離 10m ごとに約 1 XP (1km = 100 XP)
    const xpGained = Math.round(dist * 100);
    if (xpGained > 0) {
      this.addXP(xpGained);
    }
    
    this.checkAchievements();
    this.save();
    return true;
  }

  // スポットの追加
  addSpot(name, lat, lng) {
    const time = new Date().toLocaleString('ja-JP', { hour12: false });
    this.spots.push({ name, lat, lng, time });
    this.triggerLog(`スポット「${name}」を記録しました！`, 'system');
    
    // スポット記録によるボーナスXP
    this.addXP(30);
    this.checkAchievements();
    this.save();
  }

  // スポットの削除
  removeSpot(index) {
    if (index >= 0 && index < this.spots.length) {
      const removed = this.spots.splice(index, 1);
      this.triggerLog(`スポット「${removed[0].name}」を削除しました。`, 'system');
      this.save();
      return true;
    }
    return false;
  }

  // 実績の条件チェック
  checkAchievements() {
    const listToUnlock = [];

    // 1. 最初の一歩
    if (this.history.length > 0 && !this.unlockedAchievements.includes('first_step')) {
      listToUnlock.push('first_step');
    }
    
    // 2. 近所のお散歩 (100m)
    if (this.totalDistance >= 0.1 && !this.unlockedAchievements.includes('explorer_100m')) {
      listToUnlock.push('explorer_100m');
    }
    
    // 3. 新天地の開拓者 (1km)
    if (this.totalDistance >= 1.0 && !this.unlockedAchievements.includes('explorer_1km')) {
      listToUnlock.push('explorer_1km');
    }
    
    // 4. 伝説の旅人 (5km)
    if (this.totalDistance >= 5.0 && !this.unlockedAchievements.includes('explorer_5km')) {
      listToUnlock.push('explorer_5km');
    }

    // 5. 夜の冒険者 (20:00 〜 04:00 の間)
    if (!this.unlockedAchievements.includes('night_walker') && this.history.length > 0) {
      const hr = new Date().getHours();
      if (hr >= 20 || hr < 4) {
        listToUnlock.push('night_walker');
      }
    }
    
    // 6. 地図への名刻
    if (this.spots.length > 0 && !this.unlockedAchievements.includes('spot_finder')) {
      listToUnlock.push('spot_finder');
    }
    
    // 7. 一流の冒険家 (Level 5)
    if (this.level >= 5 && !this.unlockedAchievements.includes('level_5')) {
      listToUnlock.push('level_5');
    }

    // アンロック処理
    listToUnlock.forEach(id => {
      this.unlockedAchievements.push(id);
      if (this.onAchievementUnlock) {
        this.onAchievementUnlock(ACHIEVEMENTS[id]);
      }
      this.triggerLog(`実績解除: 【${ACHIEVEMENTS[id].name}】`, 'achievement');
      this.addXP(50); // 実績解除ボーナスXP
    });

    if (listToUnlock.length > 0) {
      this.save();
    }
  }

  // ハヴェルシンの公式による2点間の距離計算 (km)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  // ログイベントをトリガー
  triggerLog(text, type = 'system') {
    if (this.onLog) {
      this.onLog(text, type);
    }
  }
}
