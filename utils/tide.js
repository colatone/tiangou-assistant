// utils/tide.js
// 潮汐数据服务：对接 Open-Meteo Marine API（免 Key、全球覆盖）
// + gcj02→wgs84 坐标转换 + 归一化内部模型 + 极值/相位/推荐算法
// + 请求失败回退 mock 数据。

var apiConfig = require('../config/tide-api')
var stations = require('../config/tide-stations')
var mockData = require('./tide-mock')

// ============================================================
//  兼容性 polyfill（微信基础库部分版本缺 padStart）
// ============================================================
/** 手动补零：'3' → '03', '12' → '12' */
function pad2(n) {
  return (n < 10 ? '0' : '') + n
}

// ============================================================
//  工具函数
// ============================================================

/** 'YYYY-MM-DDTHH:mm+08:00' → 'HH:mm' */
function extractHM(iso) {
  if (!iso) return '--:--'
  var m = String(iso).match(/T(\d{2}):(\d{2})/)
  return m ? m[1] + ':' + m[2] : '--:--'
}

/** 取小时数 (0-23) */
function hourOfDay(iso) {
  var m = String(iso).match(/T(\d{2})/)
  return m ? parseInt(m[2], 10) : 12
}

/** ISO 时间字符串 ± 分钟，返回同格式（毫秒级运算，跨日安全） */
function addMinutes(iso, delta) {
  if (!iso) return iso
  // 兼容两种格式：带 T 的 ISO 和纯日期
  if (iso.indexOf('T') === -1) return iso
  var m = String(iso).match(/(\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}))/)
  if (!m) return iso
  // 以 +08:00 正确解析北京时间
  var base = new Date(m[1] + '+08:00')
  // 用毫秒加减 —— 天然处理跨日/跨月，无 setHours 跨日 bug
  var result = new Date(base.getTime() + delta * 60 * 1000)
  var y = result.getFullYear()
  var mo = pad2(result.getMonth() + 1)
  var d = pad2(result.getDate())
  var hh = pad2(result.getHours())
  var mm = pad2(result.getMinutes())
  return y + '-' + mo + '-' + d + 'T' + hh + ':' + mm + ':00+08:00'
}

/** 获取今天日期字符串 'YYYY-MM-DD' */
function todayStr() {
  var d = new Date()
  return d.getFullYear() + '-' +
    pad2(d.getMonth() + 1) + '-' +
    pad2(d.getDate())
}

/** 获取 N 天后的日期 */
function dateOffsetStr(days) {
  var d = new Date()
  d.setDate(d.getDate() + days)
  return d.getFullYear() + '-' +
    pad2(d.getMonth() + 1) + '-' +
    pad2(d.getDate())
}

// ============================================================
//  站点匹配
// ============================================================

/**
 * 哈弗辛距离（Haversine）计算两点间球面距离（km）
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} 公里数
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371
  var toRad = Math.PI / 180
  var dLat = (lat2 - lat1) * toRad
  var dLng = (lng2 - lng1) * toRad
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 根据用户坐标查找最近的潮汐站
 * @param {number} userLat - 用户纬度（gcj02）
 * @param {number} userLng - 用户经度（gcj02）
 * @returns {{ station: Object, distanceKm: number } | null}
 */
function getNearestStation(userLat, userLng) {
  if (!stations || !stations.length) return null
  var nearest = null
  var minDist = Infinity
  for (var i = 0; i < stations.length; i++) {
    var s = stations[i]
    var dist = haversineKm(userLat, userLng, s.lat, s.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = s
    }
  }
  return nearest ? { station: nearest, distanceKm: Math.round(minDist * 10) / 10 } : null
}

/**
 * 按 id 查找站点
 * @param {string} stationId
 * @returns {Object | undefined}
 */
function getStationById(stationId) {
  for (var i = 0; i < stations.length; i++) {
    if (stations[i].id === stationId) return stations[i]
  }
  return undefined
}

// ============================================================
//  数据请求与归一化
// ============================================================

/**
 * 封装 wx.request，返回 Promise
 */
function request(url) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data)
        } else {
          reject(new Error('HTTP_' + res.statusCode))
        }
      },
      fail: function (err) {
        reject(err)
      }
    })
  })
}

/**
 * 从逐时序列中提取局部极值（高/低潮点）
 * @param {Array<{time:string, height:number}>} series
 * @returns {Array<{type:'high'|'low', time:string, height:number}>}
 */
function findExtrema(series) {
  if (!series || series.length < 3) return []
  var ext = []
  for (var i = 1; i < series.length - 1; i++) {
    var prev = series[i - 1].height
    var cur = series[i].height
    var next = series[i + 1].height
    if ((cur >= prev && cur >= next) || (cur <= prev && cur <= next)) {
      ext.push({
        type: cur >= next ? 'high' : 'low',
        time: series[i].time,
        height: cur
      })
    }
  }
  return ext
}

/**
 * 根据极值构建涨潮(flood)/退潮(ebb)相位段
 */
function buildPhases(tides) {
  if (!tides || tides.length < 2) return []
  var phases = []
  for (var i = 0; i < tides.length - 1; i++) {
    var start = tides[i]
    var end = tides[i + 1]
    phases.push({
      phase: start.type === 'low' ? 'flood' : 'ebb',
      startTime: extractHM(start.time),
      endTime: extractHM(end.time),
      startH: start.height,
      endH: end.height
    })
  }
  return phases
}

/**
 * 计算当日潮差
 */
function tideRange(tides) {
  if (!tides || !tides.length) return 0
  var hs = tides.map(function (t) { return t.height })
  return Math.max.apply(null, hs) - Math.min.apply(null, hs)
}

// ============================================================
//  赶海推荐算法
// ============================================================

/**
 * 根据低潮点计算赶海推荐窗口
 * 策略：每个低潮前 90min ~ 后 120min 为最佳窗口（退水变浅→露出滩涂→开始涨水）
 *
 * @param {Array} tides - 极值数组
 * @returns {Array} 推荐时段列表（按 score 降序，最多 2 条）
 */
function recommendBeachcombing(tides) {
  if (!tides) return []
  var lows = tides.filter(function (t) { return t.type === 'low' })
  if (!lows.length) return []

  var range = tideRange(tides)
  var recs = []
  for (var i = 0; i < lows.length; i++) {
    var low = lows[i]
    var lowHour = hourOfDay(low.time)
    var winStart = addMinutes(low.time, -90)
    var winEnd = addMinutes(low.time, 120)

    // 评分（基准 100 分）
    var score = 100
    // 低潮越低越好（高度越接近 0 越好，>3m 开始扣分）
    score -= Math.max(0, (low.height - 0.5) * 12)
    // 白天加分（6:00-19:00 可见度好）
    if (lowHour >= 6 && lowHour <= 19) score += 8
    // 大潮差加分（露出更多滩涂）
    if (range > 2.5) score += 4
    if (range > 3.0) score += 3
    score = Math.min(100, Math.max(0, Math.round(score)))

    recs.push({
      start: extractHM(winStart),
      end: extractHM(winEnd),
      lowTime: extractHM(low.time),
      lowHeight: low.height,
      score: score,
      level: score >= 85 ? 'excellent' : score >= 70 ? 'good' : 'normal',
      levelText: score >= 85 ? '优' : score >= 70 ? '良' : '一般',
      reason: '低潮前后最佳赶海窗口'
    })
  }

  recs.sort(function (a, b) { return b.score - a.score })
  return recs.slice(0, 2)
}

/**
 * 找出当前时刻之后最近的一个赶海窗口（用于弹窗/摘要）
 * @param {Array} beachcombing - 推荐时段数组
 * @param {string} nowIso - 当前时间（ISO 格式）
 * @returns {Object|null}
 */
function nearestWindowFromNow(beachcombing, nowIso) {
  if (!beachcombing || !beachcombing.length) return null
  var nowMin = isoToMinutes(nowIso)
  for (var i = 0; i < beachcombing.length; i++) {
    var w = beachcombing[i]
    var startMin = hmToMinutes(w.start)
    if (startMin > nowMin) return w
  }
  // 都过了的话返回第一个（明天）
  return beachcombing[0]
}

function isoToMinutes(iso) {
  var m = String(iso).match(/T(\d{2}):(\d{2})/)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0
}

function hmToMinutes(hm) {
  var p = String(hm).split(':')
  return p.length === 2 ? parseInt(p[0], 10) * 60 + parseInt(p[1], 10) : 0
}

// ============================================================
//  Open-Meteo 响应 → 内部模型 归一化
// ============================================================

/**
 * 将 Open-Meteo Marine 响应体归一化为内部潮汐模型
 * @param {Object} body - API 原始响应
 * @param {Object} stationInfo - 站点信息 {id,name,region,lat,lng}
 * @param {string} targetDate - 目标日期 'YYYY-MM-DD'
 * @returns {{ station, date, series, tides, phases, beachcombing, mock }}
 */
function normalizeForecast(body, stationInfo, targetDate) {
  var hourly = body.hourly || {}
  var times = hourly.time || []
  var heights = hourly.sea_level_height_msl || []

  // 构建逐时序列
  var series = []
  for (var i = 0; i < times.length; i++) {
    var t = times[i]
    // 只取目标日期的数据（API 可能返回跨天）
    if (t && t.indexOf(targetDate) === 0) {
      series.push({
        time: formatIsoTime(t),
        height: typeof heights[i] === 'number' ? Math.round(heights[i] * 100) / 100 : 0
      })
    }
  }

  // 如果目标日期无数据（可能时区偏移），取最接近的 24h
  if (!series.length && times.length) {
    var startIdx = 0
    for (var j = 0; j < times.length; j++) {
      if (times[j]) {
        startIdx = j
        break
      }
    }
    for (var k = startIdx; k < Math.min(startIdx + 24, times.length); k++) {
      if (times[k]) {
        series.push({
          time: formatIsoTime(times[k]),
          height: typeof heights[k] === 'number' ? Math.round(heights[k] * 100) / 100 : 0
        })
      }
    }
  }

  var tides = findExtrema(series)
  var phases = buildPhases(tides)
  var beachcombing = recommendBeachcombing(tides)

  return {
    station: stationInfo,
    date: targetDate,
    series: series,
    tides: tides,
    phases: phases,
    beachcombing: beachcombing,
    mock: false
  }
}

/**
 * 'YYYY-MM-DDThh:mm' → 'YYYY-MM-DDThH:mm:ss+08:00'
 */
function formatIsoTime(rawTime) {
  if (!rawTime) return ''
  if (rawTime.indexOf('+') !== -1) return rawTime
  return rawTime + ':00+08:00'
}

// ============================================================
//  对外接口
// ============================================================

/**
 * 获取指定站点的潮汐预报数据
 * @param {Object|string} stationOrId - 站点对象或站点 ID
 * @param {string} [dateStr] - 日期 'YYYY-MM-DD'，默认今天
 * @returns {Promise.<Object>} 归一化潮汐模型
 */
function getTideForecast(stationOrId, dateStr) {
  var station = typeof stationOrId === 'string'
    ? getStationById(stationOrId)
    : stationOrId

  if (!station) {
    // 站点未找到时直接返回 mock 数据（不 reject）
    console.warn('[tide] Station not found:', stationOrId, ', falling back to mock')
    try {
      return mockData.getData(dateStr || todayStr())
    } catch (e) {
      return Promise.reject(new Error('STATION_NOT_FOUND'))
    }
  }

  dateStr = dateStr || todayStr()

  // 坐标转换：gcj02 → wgs84
  var wgs = apiConfig.gcj02ToWgs84(station.lat, station.lng)
  var url = apiConfig.endpoints.forecast(
    wgs.lat.toFixed(4), wgs.lng.toFixed(4),
    dateStr, dateStr
  )

  return request(url)
    .then(function (body) {
      // 检查 API 是否真的返回了有效数据
      if (!body || !body.hourly || !body.hourly.time || !body.hourly.time.length) {
        console.warn('[tide] API returned empty data, using mock')
        return mockData.getData(dateStr, station)
      }
      return normalizeForecast(body, station, dateStr)
    })
    .catch(function (err) {
      // 请求失败或数据异常 → 回退 mock
      console.warn('[tide] API failed (' + (err.message || err) + '), using mock fallback')
      try {
        return mockData.getData(dateStr, station)
      } catch (e2) {
        return Promise.reject(new Error('MOCK_FAILED:' + (e2.message || e2)))
      }
    })
}

/**
 * 获取未来 N 天的潮汐数据（批量）
 * @param {Object|string} stationOrId
 * @param {number} [days=7] - 天数
 * @returns {Promise.<Array>} 每日数据的数组
 */
function getMultiDayForecast(stationOrId, days) {
  days = days || 7
  var promises = []
  for (var i = 0; i < days; i++) {
    promises.push(getTideForecast(stationOrId, dateOffsetStr(i)))
  }
  return Promise.all(promises)
}

module.exports = {
  // 数据获取
  getTideForecast: getTideForecast,
  getMultiDayForecast: getMultiDayForecast,

  // 站点查询
  getNearestStation: getNearestStation,
  getStationById: getStationById,
  getAllStations: function () { return stations },

  // 纯算法（供测试/复用）
  findExtrema: findExtrema,
  buildPhases: buildPhases,
  recommendBeachcombing: recommendBeachcombing,
  nearestWindowFromNow: nearestWindowFromNow,

  // 工具
  haversineKm: haversineKm,
  extractHM: extractHM,
  todayStr: todayStr,
  dateOffsetStr: dateOffsetStr
}
