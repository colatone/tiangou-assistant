// utils/dragonball.js
// 七龙珠（龙珠召唤）数据服务
// 主源 huiniao（免 key，已实测）→ 备源 istero（token）→ 内置种子兜底
// 主源一次请求同时返回最新+历史（降低并发限流概率）；明确识别限流(401)且不重试。

var api = require('../config/dragonball-api')
var storage = require('./storage')

// 按 kind 记录最近一次降级原因，供 UI 区分提示文案：'rateLimit'(限流) | 'down'(暂歇/失败) | null(正常)
var _degrade = {}

// 请求封装（带 timeout）
function request(url, timeout) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: 'GET',
      timeout: timeout || 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) resolve(res.data)
        else reject(new Error('HTTP_' + res.statusCode))
      },
      fail: function (err) { reject(err) }
    })
  })
}

function rateLimitErr() {
  var e = new Error('RATE_LIMIT')
  e.rateLimit = true
  return e
}

// 单源重试（指数退避；限流错误不重试，直接抛出）
function requestWithRetry(url, retries) {
  retries = retries || 2
  return new Promise(function (resolve, reject) {
    attempt(0)
    function attempt(n) {
      request(url)
        .then(function (d) { resolve(d) })
        .catch(function (err) {
          if (err && err.rateLimit) return reject(err)
          if (n < retries - 1) setTimeout(function () { attempt(n + 1) }, Math.pow(2, n) * 1000)
          else reject(err)
        })
    }
  })
}

// ===== 主源 huiniao 解析 =====
// 单个记录 { code, day, one..seven } → 内部模型 { kind, seq, date, main, sub, mock }
function normalizeHuinao(raw, kind) {
  if (!raw || !raw.code) return null
  var cfg = api.CONFIG[kind] || api.CONFIG.redblue
  var nums = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'].map(function (k) {
    var n = parseInt(raw[k], 10)
    return isNaN(n) ? null : n
  })
  if (nums.indexOf(null) !== -1) return null
  var main = nums.slice(0, cfg.mainCount)
  var sub = nums.slice(cfg.mainCount, cfg.mainCount + cfg.subCount)
  return {
    kind: kind,
    seq: String(raw.code),
    date: String(raw.day || '').slice(0, 10),
    main: main,
    sub: sub,
    sales: 0,
    pool: 0,
    mock: false
  }
}

// 主源整体响应 → { latest, history }
function parseHuinao(res, kind) {
  if (!res || res.code !== 1 || !res.data) return null
  var last = normalizeHuinao(res.data.last, kind)
  var rawList = (res.data.data && res.data.data.list) || []
  var history = rawList.map(function (it) { return normalizeHuinao(it, kind) }).filter(Boolean)
  if (!last && !history.length) return null
  return { latest: last, history: history }
}

// ===== 备源 istero 解析（兼容 openCode 形式，未实测）=====
function normalizeBackup(raw, kind) {
  if (!raw) return null
  var item = raw
  if (Array.isArray(raw) && raw[0]) item = raw[0]
  else if (raw.data && (raw.data.expect || raw.data.openCode || raw.data.code)) item = raw.data
  else if (Array.isArray(raw.result) && raw.result[0]) item = raw.result[0]
  else if (Array.isArray(raw.data) && raw.data[0]) item = raw.data[0]
  var seq = item.expect || item.issue || item.code || item.qihao || item.id || ''
  var date = item.time || item.date || item.openTime || item.datetime || ''
  if (typeof date === 'string' && date.indexOf(' ') !== -1) date = date.split(' ')[0]
  var openCode = item.openCode || item.code || item.number || item.opencode || ''
  if (!openCode) return null
  var parts = String(openCode).split(/\s*\+\s*/)
  var frontNums = parts[0]
    ? parts[0].split(/[\s,，]+/).filter(Boolean).map(function (s) { return parseInt(s, 10) }).filter(function (n) { return !isNaN(n) })
    : []
  var backNums = parts[1]
    ? parts[1].split(/[\s,，]+/).filter(Boolean).map(function (s) { return parseInt(s, 10) }).filter(function (n) { return !isNaN(n) })
    : []
  if (!frontNums.length) return null
  return {
    kind: kind,
    seq: String(seq),
    date: String(date),
    main: frontNums,
    sub: backNums,
    sales: 0,
    pool: 0,
    mock: false
  }
}

function parseBackup(res, kind) {
  var item = normalizeBackup(res, kind)
  var rawList = Array.isArray(res) ? res
    : (res && Array.isArray(res.data)) ? res.data
    : (res && res.data && Array.isArray(res.data.list)) ? res.data.list
    : (res && Array.isArray(res.result)) ? res.result
    : (res && res.data && typeof res.data === 'object') ? [res.data]
    : [res]
  var list = rawList.map(function (it) { return normalizeBackup(it, kind) }).filter(Boolean)
  return { latest: item || (list[0] || null), history: list }
}

// ===== 内置种子（结构正确，非实时真实数据），全源失败兜底 =====
function getSeed(kind) {
  if (kind === 'redblue') {
    return [
      { kind: 'redblue', seq: '2026084', date: '2026-07-23', main: [1, 5, 6, 10, 12, 16], sub: [5], sales: 0, pool: 0, mock: true },
      { kind: 'redblue', seq: '2026083', date: '2026-07-21', main: [3, 8, 15, 22, 27, 31], sub: [9], sales: 0, pool: 0, mock: true },
      { kind: 'redblue', seq: '2026082', date: '2026-07-17', main: [5, 11, 14, 20, 25, 30], sub: [2], sales: 0, pool: 0, mock: true },
      { kind: 'redblue', seq: '2026081', date: '2026-07-14', main: [1, 7, 12, 18, 24, 29], sub: [11], sales: 0, pool: 0, mock: true },
      { kind: 'redblue', seq: '2026080', date: '2026-07-10', main: [2, 9, 16, 21, 26, 33], sub: [5], sales: 0, pool: 0, mock: true }
    ]
  }
  return [
    { kind: 'star', seq: '26082', date: '2026-07-22', main: [16, 26, 27, 28, 34], sub: [2, 6], sales: 0, pool: 0, mock: true },
    { kind: 'star', seq: '26081', date: '2026-07-19', main: [3, 9, 14, 22, 30], sub: [2, 8], sales: 0, pool: 0, mock: true },
    { kind: 'star', seq: '26080', date: '2026-07-16', main: [6, 11, 17, 25, 31], sub: [4, 10], sales: 0, pool: 0, mock: true },
    { kind: 'star', seq: '26079', date: '2026-07-13', main: [1, 8, 15, 20, 29], sub: [1, 7], sales: 0, pool: 0, mock: true },
    { kind: 'star', seq: '26078', date: '2026-07-10', main: [5, 12, 18, 24, 33], sub: [3, 11], sales: 0, pool: 0, mock: true }
  ]
}

// ===== 统一抓取：主源→备源→(null 交给上层用种子) =====
// 主源一次请求同时返回 latest+history；限流(401)不重试、直接降级
function fetchWithFallback(kind, token) {
  return requestWithRetry(api.endpoints.main(kind), 2)
    .then(function (res) {
      if (res && res.code === 401) throw rateLimitErr()
      var parsed = parseHuinao(res, kind)
      if (!parsed) throw new Error('EMPTY')
      _degrade[kind] = null                         // 数据正常，清除降级标记
      return parsed
    })
    .catch(function (err) {
      if (err && err.rateLimit) { _degrade[kind] = 'rateLimit'; throw err }   // 限流：不试备源，直接种子
      return requestWithRetry(api.endpoints.backup(kind, token), 1)
        .then(function (res) {
          if (res && res.code === 401) throw rateLimitErr()
          var parsed = parseBackup(res, kind)
          if (!parsed || (!parsed.latest && !parsed.history.length)) throw new Error('EMPTY')
          _degrade[kind] = null
          return parsed
        })
        .catch(function (e) {
          _degrade[kind] = (e && e.rateLimit) ? 'rateLimit' : 'down'
          console.warn('[dragonball] ' + ((e && e.rateLimit) ? '数据源限流' : '数据源暂歇') + '，使用种子兜底')
          return null
        })
    })
}

// 共享同一次请求结果（避免 loadData 同时拉 latest+history 触发并发限流）
var _allCache = {}
function fetchAll(kind, token) {
  if (_allCache[kind]) return _allCache[kind]
  _allCache[kind] = fetchWithFallback(kind, token)
    .then(function (r) { _allCache[kind] = null; return r })
    .catch(function (e) { _allCache[kind] = null; throw e })
  return _allCache[kind]
}

function cacheItem(kind, item, which, list) {
  var cache = storage.getDBCache(kind) || {}
  if (which === 'latest') cache.latest = item
  if (which === 'history') cache.history = list
  cache.fetchTime = Date.now()
  storage.setDBCache(kind, cache)
}

function fetchLatest(kind, token) {
  return fetchAll(kind, token)
    .then(function (all) {
      var item = (all && all.latest) ? all.latest : (getSeed(kind)[0] || null)
      cacheItem(kind, item, 'latest')
      return item
    })
    .catch(function () {
      return getSeed(kind)[0] || null
    })
}

function fetchHistory(kind, limit, token) {
  limit = limit || 30
  return fetchAll(kind, token)
    .then(function (all) {
      var list = (all && all.history && all.history.length) ? all.history : getSeed(kind)
      list = list.slice(0, limit)
      cacheItem(kind, null, 'history', list)
      return list
    })
    .catch(function () {
      return getSeed(kind).slice(0, limit)
    })
}

function getCachedLatest(kind) {
  var cache = storage.getDBCache(kind)
  return cache && cache.latest ? cache.latest : null
}

function getCachedHistory(kind) {
  var cache = storage.getDBCache(kind)
  return cache && cache.history ? cache.history : []
}

module.exports = {
  fetchLatest: fetchLatest,
  fetchHistory: fetchHistory,
  getCachedLatest: getCachedLatest,
  getCachedHistory: getCachedHistory,
  getSeed: getSeed,
  normalize: normalizeHuinao,
  normalizeBackup: normalizeBackup,
  getDegradeReason: function (kind) { return _degrade[kind] || null }
}
