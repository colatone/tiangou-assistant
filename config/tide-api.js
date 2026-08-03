// config/tide-api.js
// 潮汐数据 API 契约（Open-Meteo Marine Weather —— 免 Key、全球覆盖、含中国沿海）
// 所有地址、参数模板、坐标转换集中在此，换源或上线只需改这里。
//
// 数据署名要求（CC BY 4.0 非商业）：
//   UI 底部须标注「数据来源：Open-Meteo / DWD」

var BASE = 'https://marine-api.open-meteo.com/v1/marine'

module.exports = {
  BASE: BASE,

  // 上线需在微信公众平台 → 开发 → 开发管理 → 服务器域名 → request 合法域名加入：
  // https://marine-api.open-meteo.com
  REQUEST_DOMAIN: 'https://marine-api.open-meteo.com',

  endpoints: {
    // 海洋预报：逐小时海平面高度（含潮汐分量）
    // 参数：latitude, longitude (WGS84), start_date, end_date, timezone
    // 返回：{ hourly: { sea_level_height_msl: [...] }, hourly_time: [...] }
    forecast: function (lat, lng, startDate, endDate) {
      return (
        BASE +
        '?latitude=' + lat +
        '&longitude=' + lng +
        '&hourly=sea_level_height_msl' +
        '&start_date=' + startDate +
        '&end_date=' + endDate +
        '&timezone=Asia/Shanghai'
      )
    }
  },

  // --- gcj02 → WGS84 坐标转换 ---
  // 腾讯地图 / 微信定位使用 GCJ-02（国测局坐标系），
  // Open-Meteo 需要 WGS84，二者在中国区域偏差约数百米（对潮位计算影响可忽略，
  // 但为严谨仍做转换）。

  /**
   * GCJ-02 → WGS84 近似逆转换（经典迭代法，精度 ~3m）
   * @param {number} lat - GCJ-02 纬度
   * @param {number} lng - GCJ-02 经度
   * @returns {{lat: number, lng: number}} WGS84 坐标
   */
  gcj02ToWgs84: function (lat, lng) {
    var a = 6378245.0       // 长半轴
    var ee = 0.00669342162296594323 // 偏心率平方

    function transformLat(x, y) {
      var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
      ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
      ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0
      ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0
      return ret
    }

    function transformLng(x, y) {
      var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
      ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0
      ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0
      ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0
      return ret
    }

    var dLat = transformLat(lng - 105.0, lat - 35.0)
    var dLng = transformLng(lng - 105.0, lat - 35.0)
    var radLat = lat / 180.0 * Math.PI
    var magic = Math.sin(radLat)
    magic = 1 - ee * magic * magic
    var sqrtMagic = Math.sqrt(magic)
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI)
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI)

    return { lat: lat - dLat, lng: lng - dLng }
  }
}
