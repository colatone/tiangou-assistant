// utils/dragonball-guide.js
// 七龙珠「神龙指引」算法（纯函数，按 CONFIG 参数化）
// 输入历史 → 多维统计 → 加权随机生成推荐珠组（非纯随机，带均衡约束）
// 对外输出：推荐珠组 + 热门/冷门榜；并提供呼应对照函数。

var api = require('../config/dragonball-api')

function pad2(n) { return (n < 10 ? '0' : '') + n }

// 统计各珠号出现次数
function analyze(history, kind) {
  var cfg = api.CONFIG[kind]
  var mainCount = {}, subCount = {}
  var i
  for (i = cfg.mainMin; i <= cfg.mainMax; i++) mainCount[i] = 0
  for (i = cfg.subMin; i <= cfg.subMax; i++) subCount[i] = 0
  ;(history || []).forEach(function (rec) {
    ;(rec.main || []).forEach(function (n) { if (mainCount[n] != null) mainCount[n]++ })
    ;(rec.sub || []).forEach(function (n) { if (subCount[n] != null) subCount[n]++ })
  })
  return { mainCount: mainCount, subCount: subCount, total: (history || []).length }
}

// 加权随机抽 k 个不重复
function weightedSample(pool, k) {
  var copy = pool.slice()
  var out = []
  for (var i = 0; i < k && copy.length; i++) {
    var total = 0
    for (var j = 0; j < copy.length; j++) total += copy[j].w
    var r = Math.random() * total
    var acc = 0, idx = 0
    for (var m = 0; m < copy.length; m++) {
      acc += copy[m].w
      if (r <= acc) { idx = m; break }
    }
    out.push(copy[idx].n)
    copy.splice(idx, 1)
  }
  return out
}

// 选主珠（带奇偶 / 区间均衡约束）
function pickMain(cfg, stats, exclude) {
  exclude = exclude || {}
  var pool = []
  for (var n = cfg.mainMin; n <= cfg.mainMax; n++) {
    if (exclude[n]) continue
    var w = (stats.mainCount[n] || 0) + 1   // 保底权重，冷号也有机会
    pool.push({ n: n, w: w })
  }
  var chosen = weightedSample(pool, cfg.mainCount)
  chosen = balanceMain(cfg, chosen)
  return chosen.sort(function (a, b) { return a - b })
}

// 均衡修正：奇偶比尽量接近一半；区间（3 等分）每区至少 1 个
function balanceMain(cfg, chosen) {
  var odds = chosen.filter(function (n) { return n % 2 === 1 }).length
  var evens = chosen.length - odds
  if (odds === 0 || evens === 0) {
    var from = chosen[0]
    var target = from % 2 === 1 ? pickOpposite(cfg, chosen, 'even') : pickOpposite(cfg, chosen, 'odd')
    if (target != null) chosen[0] = target
  }
  if (chosen.length >= 3) {
    var seg = cfg.mainMax / 3
    var zones = [0, 0, 0]
    chosen.forEach(function (n) {
      var z = Math.min(2, Math.floor((n - 1) / seg))
      zones[z]++
    })
    for (var z = 0; z < 3; z++) {
      if (zones[z] === 0) {
        var rep = pickFromZone(cfg, chosen, z, seg)
        if (rep != null) { chosen[chosen.length - 1] = rep; break }
      }
    }
  }
  return chosen
}

function pickOpposite(cfg, chosen, parity) {
  for (var n = cfg.mainMin; n <= cfg.mainMax; n++) {
    if (chosen.indexOf(n) !== -1) continue
    if (parity === 'odd' && n % 2 === 1) return n
    if (parity === 'even' && n % 2 === 0) return n
  }
  return null
}

function pickFromZone(cfg, chosen, zone, seg) {
  var lo = zone * seg + 1
  var hi = (zone + 1) * seg
  for (var n = Math.ceil(lo); n <= Math.floor(hi); n++) {
    if (chosen.indexOf(n) === -1) return n
  }
  return null
}

function pickSub(cfg, stats, exclude) {
  exclude = exclude || {}
  var pool = []
  for (var n = cfg.subMin; n <= cfg.subMax; n++) {
    if (exclude[n]) continue
    var w = (stats.subCount[n] || 0) + 1
    pool.push({ n: n, w: w })
  }
  return weightedSample(pool, cfg.subCount).sort(function (a, b) { return a - b })
}

// 生成 groups 组推荐
function guideNext(kind, history, groups) {
  groups = groups || 1
  var cfg = api.CONFIG[kind]
  var stats = analyze(history, kind)
  var out = []
  for (var g = 0; g < groups; g++) {
    out.push({
      main: pickMain(cfg, stats),
      sub: pickSub(cfg, stats)
    })
  }
  return out
}

// 热门 / 冷门榜（供 UI 展示）
function hotCold(kind, history) {
  var cfg = api.CONFIG[kind]
  var stats = analyze(history, kind)
  var mainArr = [], subArr = []
  for (var n = cfg.mainMin; n <= cfg.mainMax; n++) mainArr.push({ n: n, c: stats.mainCount[n] || 0 })
  for (var m = cfg.subMin; m <= cfg.subMax; m++) subArr.push({ n: m, c: stats.subCount[m] || 0 })
  mainArr.sort(function (a, b) { return b.c - a.c })
  subArr.sort(function (a, b) { return b.c - a.c })
  return {
    hotMain: mainArr.slice(0, 5).map(function (x) { return x.n }),
    coldMain: mainArr.slice(-5).reverse().map(function (x) { return x.n }),
    hotSub: subArr.slice(0, 3).map(function (x) { return x.n }),
    coldSub: subArr.slice(-3).reverse().map(function (x) { return x.n })
  }
}

// 呼应对照：推荐组 vs 实际现世
function checkEcho(guide, actual) {
  var hitMain = (guide.main || []).filter(function (n) { return (actual.main || []).indexOf(n) !== -1 }).length
  var hitSub = (guide.sub || []).filter(function (n) { return (actual.sub || []).indexOf(n) !== -1 }).length
  var mainTotal = (guide.main || []).length || 1
  var subTotal = (guide.sub || []).length || 1
  var ratio = (hitMain / mainTotal) * 0.8 + (hitSub / subTotal) * 0.2
  return { hitMain: hitMain, hitSub: hitSub, ratio: Math.round(ratio * 100) }
}

module.exports = {
  guideNext: guideNext,
  hotCold: hotCold,
  checkEcho: checkEcho,
  analyze: analyze
}
