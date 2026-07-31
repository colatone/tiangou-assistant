// utils/typhoon.js
// 台风数据服务：对接中央气象台台风网 nmc.cn（JSONP、位置数组）+ 归一化为内部模型 + 失败回退 mock。

const api = require('../config/typhoon-api')
const mock = require('./typhoon-mock')

// 强度等级映射（TD→1 ... SUPERTY→6），供 level 计算
const TYPE_LEVEL = {
  TD: 1,
  TS: 2,
  STS: 3,
  TY: 4,
  STY: 5,
  SUPERTY: 6
}

// 去掉 JSONP 包裹：name(({...})) → {...}。无包裹则原样返回。
function stripJsonp(text) {
  const s = String(text == null ? '' : text).trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return s
  return s.slice(start, end + 1)
}

// nmc 时间串 'YYYYMMDDHHmm' → 'YYYY-MM-DDTHH:mm:ss+08:00'（组件 formatTime 依赖该格式）
function parseTime(str) {
  if (!str || String(str).length < 12) return ''
  const s = String(str)
  const y = s.slice(0, 4)
  const mo = s.slice(4, 6)
  const d = s.slice(6, 8)
  const h = s.slice(8, 10)
  const mi = s.slice(10, 12)
  return `${y}-${mo}-${d}T${h}:${mi}:00+08:00`
}

function normType(code) {
  if (!code) return ''
  return api.TYPE_MAP[code] || code
}

function levelOf(code) {
  return TYPE_LEVEL[normType(code)] || 0
}

// 7 级风圈半径：point[10] = [['30KTS', R_NE, R_SE, R_SW, R_NW, id], ...] → 取首组四象限均值
function radius7Of(p) {
  const r = p[10]
  if (Array.isArray(r) && r.length && Array.isArray(r[0])) {
    const quad = r[0].slice(1, 5).map(Number).filter(function (v) { return !isNaN(v) })
    if (quad.length) return Math.round(quad.reduce(function (a, b) { return a + b }, 0) / quad.length)
  }
  return 0
}

/**
 * 将 nmc 单个台风详情（顶层 'typhoon' 数组）归一化为内部模型。
 * 实况取自 t[8]；预报取自最后一个实况点的 extra.BABJ（中央气象台）分支。
 */
function normalizeTrack(typhoon) {
  const pts = Array.isArray(typhoon) && typhoon.length > 8 ? typhoon[8] : []
  if (!Array.isArray(pts)) return []

  const observed = pts
    .map(function (p) {
      return {
        time: parseTime(p[1]),
        lng: Number(p[4]),
        lat: Number(p[5]),
        type: normType(p[3]),
        level: levelOf(p[3]),
        pressure: Number(p[6]) || 0,
        windSpeed: Number(p[7]) || 0,
        moveDir: p[8] || '',
        moveSpeed: Number(p[9]) || 0,
        radius7: radius7Of(p),
        isForecast: 0
      }
    })
    .filter(function (p) { return p.time && p.lng && p.lat })

  const forecast = []
  const last = pts[pts.length - 1]
  if (last && last[11] && typeof last[11] === 'object') {
    const agency = Object.keys(last[11])[0]
    const fc = last[11][agency]
    if (Array.isArray(fc)) {
      fc.forEach(function (f) {
        forecast.push({
          time: parseTime(f[1]),
          lng: Number(f[2]),
          lat: Number(f[3]),
          type: normType(f[7]),
          level: levelOf(f[7]),
          pressure: Number(f[4]) || 0,
          windSpeed: Number(f[5]) || 0,
          moveDir: '',
          moveSpeed: 0,
          radius7: 0,
          isForecast: 1
        })
      })
    }
  }

  return observed.concat(forecast).sort(function (a, b) {
    return new Date(a.time) - new Date(b.time)
  })
}

/**
 * 将 nmc 列表（'typhoonList' 位置数组）归一化为内部模型。
 * 每项：[id, enName, cnName, numberStr, numberStr, numberInt, null, status]
 */
function normalizeList(typhoonList) {
  if (!Array.isArray(typhoonList)) return []
  return typhoonList.map(function (s) {
    const id = String(s[0])
    const enName = s[1]
    const cnName = s[2]
    const number = s[3] || String(s[5] != null ? s[5] : '')
    const year = String(number).slice(0, 4)
    const status = s[7]
    let name = cnName
    if (!name || name === '热带低压') {
      name = (enName && enName !== 'nameless') ? enName : (cnName || '未命名')
    }
    return { id: id, name: name, number: number, year: year, status: status, startTime: '' }
  })
}

// 解析 wx.request 返回体（JSONP 文本或已解析对象）
function parseBody(res) {
  let body = res.data
  if (typeof body === 'string') {
    const json = stripJsonp(body)
    if (!json) return null
    try { body = JSON.parse(json) } catch (e) { return null }
  }
  return body
}

/**
 * 封装 wx.request，返回 Promise。请求异常或解析失败则 reject。
 */
function request(url) {
  // 追加时间戳，避免 WeChat / CDN 对相同 URL 的 GET 缓存，
  // 否则刷新仍会返回上一次的（陈旧）台风位置。
  var sep = url.indexOf('?') === -1 ? '?' : '&'
  url = url + sep + '_t=' + Date.now()
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200) {
          const body = parseBody(res)
          if (body) resolve(body)
          else reject(new Error('API_ERROR'))
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
 * 获取当年风暴列表（活跃优先排序）。失败回退 mock。
 */
function getStormList() {
  return request(api.endpoints.stormList())
    .then(function (data) {
      const list = data && data.typhoonList ? data.typhoonList : []
      const storms = normalizeList(list)
      storms.sort(function (a, b) {
        const aw = a.status === 'start' ? 0 : 1
        const bw = b.status === 'start' ? 0 : 1
        if (aw !== bw) return aw - bw
        return Number(b.id) - Number(a.id)
      })
      return storms
    })
    .catch(function () {
      return mock.stormList
    })
}

/**
 * 获取单个风暴的路径（实况+预报）。失败回退 mock，并返回 mock 标记。
 */
function getStormTrack(stormId) {
  return request(api.endpoints.stormTrack(stormId))
    .then(function (data) {
      const typhoon = data && data.typhoon ? data.typhoon : null
      return { points: normalizeTrack(typhoon), mock: false }
    })
    .catch(function () {
      const fallback = mock.tracks[stormId] || mock.tracks['2026-03']
      return { points: fallback, mock: true }
    })
}

module.exports = {
  getStormList: getStormList,
  getStormTrack: getStormTrack,
  // 导出以便测试/复用
  normalizeTrack: normalizeTrack,
  normalizeList: normalizeList
}
