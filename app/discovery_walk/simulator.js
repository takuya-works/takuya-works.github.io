/* ==========================================================================
   simulator.js - PCデバッグ用 仮想プレイヤー歩行シミュレーター
   ========================================================================== */

export class MovementSimulator {
  constructor() {
    this.isActive = false;
    this.speedType = 'walk'; // 'walk' | 'run' | 'bike' | 'teleport'
    this.timer = null;
    this.currentLatLng = null;
    this.targetLatLng = null;
    
    // 速度定義 (メートル/秒)
    this.speeds = {
      walk: 1.25,    // 時速 4.5km
      run: 3.33,     // 時速 12km
      bike: 5.55,    // 時速 20km
      teleport: 999999
    };
  }

  // シミュレータのトグル
  setActive(active) {
    this.isActive = active;
    if (!active) {
      this.stop();
    }
  }

  // 速度の設定
  setSpeed(speedType) {
    if (this.speeds[speedType]) {
      this.speedType = speedType;
    }
  }

  // シミュレーション移動の開始
  start(startLatLng, targetLatLng, onStep, onFinish) {
    this.stop();
    
    this.currentLatLng = { ...startLatLng };
    this.targetLatLng = { ...targetLatLng };

    if (this.speedType === 'teleport') {
      onStep(targetLatLng.lat, targetLatLng.lng);
      onFinish();
      return;
    }

    const intervalMs = 1000; // 1秒ごとに更新
    const speedMps = this.speeds[this.speedType]; // m/s
    
    this.timer = setInterval(() => {
      const distKm = this.calculateDistance(
        this.currentLatLng.lat, this.currentLatLng.lng,
        this.targetLatLng.lat, this.targetLatLng.lng
      );
      
      const distM = distKm * 1000;
      const stepDistanceM = speedMps * (intervalMs / 1000); // 1ステップで進む距離

      if (distM <= stepDistanceM) {
        // 目的地に到着
        this.currentLatLng = { ...this.targetLatLng };
        onStep(this.currentLatLng.lat, this.currentLatLng.lng);
        this.stop();
        onFinish();
      } else {
        // 中間地点を補間計算
        const ratio = stepDistanceM / distM;
        this.currentLatLng.lat += (this.targetLatLng.lat - this.currentLatLng.lat) * ratio;
        this.currentLatLng.lng += (this.targetLatLng.lng - this.currentLatLng.lng) * ratio;
        
        onStep(this.currentLatLng.lat, this.currentLatLng.lng);
      }
    }, intervalMs);
  }

  // タイマー停止
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // 2点間の距離計算 (簡易ハヴェルシン)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球の半径 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
