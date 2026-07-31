// utils/tide-mock.js
// 潮汐数据回退样例 —— 当 API 请求失败时使用。
// 字段结构与 utils/tide.js 归一化模型完全一致，UI 无需感知数据来源。

var now = new Date()
var y = now.getFullYear()
var m = ('0' + (now.getMonth() + 1)).slice(-2)
var d = ('0' + now.getDate()).slice(-2)
var TODAY = y + '-' + m + '-' + d

// 生成模拟的逐小时潮高序列（近似正弦曲线，模拟半日潮）
function mockSeries(baseDate) {
  var series = []
  // 用固定种子让同一天的结果稳定
  var seed = 0
  for (var i = 0; i < baseDate.length; i++) {
    seed = (seed * 31 + baseDate.charCodeAt(i)) | 0
  }
  var rand = function () { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }

  for (var h = 0; h < 24; h++) {
    var t = baseDate + 'T' + ('0' + h).slice(-2) + ':00:00+08:00'
    // 半日潮：~12.42h 周期，叠加小随机扰动
    var phase = ((h * Math.PI * 2) / 12.42) + rand() * 0.2 - 0.1
    var height = 1.8 + 1.5 * Math.sin(phase) + (rand() - 0.5) * 0.3
    series.push({ time: t, height: Math.round(height * 100) / 100 })
  }
  return series
}

module.exports = {
  // 默认站：厦门（南海代表站，典型半日潮）
  defaultStationId: 'xiamen',
  defaultStationName: '厦门',
  defaultStationRegion: '福建',

  /**
   * 获取指定日期的 mock 潮汐数据（与 getTideForecast 返回结构一致）
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @param {Object} [stationInfo] - 可选，传入则用此站信息替代默认厦门
   * @returns {{ station, date, series, tides, phases, beachcombing, mock }}
   */
  getData: function (dateStr, stationInfo) {
    dateStr = dateStr || TODAY
    var series = mockSeries(dateStr)
    var tides = findExtrema(series)
    var phases = buildPhases(tides, series)
    var beachcombing = recommendBeachcombing(tides, phases)

    // 使用传入的站点信息，或回退默认
    var stInfo = stationInfo || {
      id: this.defaultStationId,
      name: this.defaultStationName,
      region: this.defaultStationRegion
    }

    return {
      station: { id: stInfo.id, name: stInfo.name, region: stInfo.region || '' },
      date: dateStr,
      series: series,
      tides: tides,
      phases: phases,
      beachcombing: beachcombing,
      mock: true
    }
  }
}

// --- 以下为纯函数（与 utils/tide.js 共享逻辑） ---

/**
 * 从逐时序列中找局部极值（高/低潮点）
 */
function findExtrema(series) {
  if (!series || series.length < 3) return []
  var ext = []
  for (var i = 1; i < series.length - 1; i++) {
    var prev = series[i - 1].height
    var cur = series[i].height
    var next = series[i + 1].height
    if ((cur >= prev && cur >= next) || (cur <= prev && cur <= next)) {
      // 局部极值（含平台情况）
      if (cur !== prev || cur !== next || (i > 1 && series[i - 2].height !== cur)) {
        ext.push({
          type: cur >= next ? 'high' : 'low',
          time: series[i].time,
          height: cur
        })
      }
    }
  }
  return ext
}

/**
 * 根据极值构建涨/退潮相位段
 */
function buildPhases(tides, series) {
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

/** 'YYYY-MM-DDTHH:mm+08:00' → 'HH:mm' */
function extractHM(iso) {
  if (!iso) return '--:--'
  var m = String(iso).match(/T(\d{2}):(\d{2})/)
  return m ? m[1] + ':' + m[2] : '--:--'
}

/**
 * 计算赶海推荐窗口
 */
function recommendBeachcombing(tides, phases) {
  if (!tides) return []
  var lows = tides.filter(function (t) { return t.type === 'low' })
  if (!lows.length) return []

  var range = tideRange(tides)
  var recs = []
  for (var i = 0; i < lows.length; i++) {
    var low = lows[i]
    var lowHour = hourOfDay(low.time)
    // 窗口：低潮前 90min → 低潮后 120min（退水变浅至开始涨水）
    var winStart = addMinutes(low.time, -90)
    var winEnd = addMinutes(low.time, 120)

    // 评分
    var score = 100
    // 低潮越低越好
    score -= Math.max(0, (low.height - 0.3) * 15)
    // 白天加分
    if (lowHour >= 6 && lowHour <= 19) score += 10
    // 大潮差加分
    if (range > 2.5) score += 5
    score = Math.min(100, Math.max(0, Math.round(score)))

    recs.push({
      start: extractHM(winStart),
      end: extractHM(winEnd),
      lowTime: extractHM(low.time),
      lowHeight: low.height,
      score: score,
      level: score >= 85 ? 'excellent' : score >= 70 ? 'good' : 'normal',
      levelText: score >= 85 ? '优' : score >= 70 ? '良' : '一般',
      reason: low.type === 'low' ? '低潮前后最佳赶海窗口' : ''
    })
  }

  // 按 score 降序
  recs.sort(function (a, b) { return b.score - a.score })
  return recs.slice(0, 2)
}

/** 取小时数 0-23 */
function hourOfDay(iso) {
  var m = String(iso).match(/T(\d{2})/)
  return m ? parseInt(m[1], 10) : 12
}

/** ISO 时间 ± 分钟（毫秒级运算，跨日安全，与 tide.js 保持一致） */
function addMinutes(iso, delta) {
  if (!iso) return iso
  var m = String(iso).match(/(\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}))/)
  if (!m) return iso
  // 以 +08:00 正确解析北京时间（不能用 'Z'，否则会偏移 8 小时！）
  var base = new Date(m[1] + '+08:00')
  var result = new Date(base.getTime() + delta * 60 * 1000)
  var y = result.getFullYear()
  var mo = ('0' + (result.getMonth() + 1)).slice(-2)
  var d = ('0' + result.getDate()).slice(-2)
  var hh = ('0' + result.getHours()).slice(-2)
  var mm = ('0' + result.getMinutes()).slice(-2)
  return y + '-' + mo + '-' + d + 'T' + hh + ':' + mm + ':00+08:00'
}

/** 当日潮差 */
function tideRange(tides) {
  if (!tides || !tides.length) return 0
  var hs = tides.map(function (t) { return t.height })
  return Math.max.apply(null, hs) - Math.min.apply(null, hs)
}
