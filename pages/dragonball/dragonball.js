// pages/dragonball/dragonball.js
// 七龙珠（龙珠召唤）主页：玩法切换 / 现世大卡 / 实时轮询 / 神龙指引 / 龙珠阵

var api = require('../../config/dragonball-api')
var db = require('../../utils/dragonball')
var guide = require('../../utils/dragonball-guide')
var storage = require('../../utils/storage')

function pad2(n) { return (n < 10 ? '0' : '') + String(n) }

// 收藏项的开奖对照状态文案与样式类
function followStatus(r) {
  if (!r.checked) return { text: '待现世', cls: 'pending' }
  var e = r.echo || { hitMain: 0, hitSub: 0, ratio: 0 }
  var hit = (e.hitMain || 0) + (e.hitSub || 0)
  if (hit === 0) return { text: '未呼应', cls: 'miss' }
  return { text: '中 ' + hit + ' 个', cls: 'part' }
}

function isInGatherWindow(cfg) {
  var now = new Date()
  var wd = now.getDay()            // 0=周日
  if (cfg.gatherWeekdays.indexOf(wd) === -1) return false
  var hm = now.getHours() * 60 + now.getMinutes()
  var s = cfg.gatherWindow.start.split(':')
  var e = cfg.gatherWindow.end.split(':')
  var sh = (+s[0]) * 60 + (+s[1])
  var eh = (+e[0]) * 60 + (+e[1])
  return hm >= sh && hm <= eh
}

function metaOf(kind) {
  var cfg = api.CONFIG[kind] || api.CONFIG.redblue
  return {
    label: cfg.label,
    mainCount: cfg.mainCount,
    subCount: cfg.subCount,
    mainMax: cfg.mainMax,
    subMax: cfg.subMax
  }
}

Page({
  data: {
    kind: 'star',
    meta: metaOf('star'),
    latest: null,
    history: [],
    guides: [],
    showGuides: false,
    guideStore: { redblue: { seq: '', guides: [] }, star: { seq: '', guides: [] } },
    hotCold: null,
    followList: [],
    followGroups: [],
    error: '',
    loading: false,
    tracking: false,
    lastSync: '',
    currentSeq: '',
    guideSeq: '',
    collectedThisSeq: false,
    shareTempPath: '',
    attribution: api.ATTRIBUTION
  },

  onLoad: function (options) {
    var kind = (options && options.kind) || 'star'
    if (!api.CONFIG[kind]) kind = 'star'
    this.setData({ kind: kind, meta: metaOf(kind) })
    this.refreshFollow()
    this.loadData()
    this.startPolling()
  },

  onShow: function () {
    this.loadData()
    this.startPolling()
  },

  onHide: function () { this.stopPolling() },
  onUnload: function () { this.stopPolling() },

  onPullDownRefresh: function () {
    this.loadData(true)
    wx.stopPullDownRefresh()
  },

  startPolling: function () {
    var that = this
    this.stopPolling()
    this._timer = setInterval(function () { that.checkNew() }, 30000)
  },

  stopPolling: function () {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },

  // 轻量轮询：仅集结窗口内真正拉取，比较期号
  checkNew: function () {
    var that = this
    var kind = this.data.kind
    if (!isInGatherWindow(api.CONFIG[kind])) {
      this.setData({ lastSync: this.fmtTime() })
      return
    }
    db.fetchLatest(kind).then(function (item) {
      if (item && item.seq !== that.data.currentSeq) {
        that.applyLatest(item, false, kind)
        wx.showToast({ title: '新一期现世！', icon: 'none' })
      }
      that.setData({ lastSync: that.fmtTime(), tracking: true })
    }).catch(function (err) {
      var msg = (err && err.errMsg && err.errMsg.indexOf('domain') !== -1)
        ? '数据源域名未授权，请在后台添加合法域名'
        : '数据源暂歇，点此重试'
      that.setData({ error: msg })
    })
  },

  switchKind: function (e) {
    var kind = e.currentTarget.dataset.kind
    if (kind === this.data.kind) return
    var store = this.data.guideStore[kind]
    var guides = (store && store.guides) ? store.guides : []
    this.setData({
      kind: kind,
      meta: metaOf(kind),
      guides: guides,
      showGuides: !!(guides && guides.length),
      error: '',
      followList: [],
      followGroups: []
    })
    this.refreshFollow()
    this.refreshCollectState(kind, (store && store.seq) || '')
    this.loadData()
  },

  loadData: function (silent) {
    var that = this
    var kind = this.data.kind
    // 1. 缓存秒显
    var cachedLatest = db.getCachedLatest(kind)
    var cachedHistory = db.getCachedHistory(kind)
    if (cachedLatest) this.applyLatest(cachedLatest, true, kind)
    if (cachedHistory.length) {
      this.setData({ history: cachedHistory })
      this.genHotCold(cachedHistory)
    }
    // 2. 网络刷新
    if (!silent) this.setData({ loading: true })
    Promise.all([db.fetchLatest(kind), db.fetchHistory(kind, 30)])
      .then(function (resArr) {
        var latest = resArr[0]
        var history = resArr[1]
        that.applyLatest(latest, silent, kind)
        if (kind === that.data.kind) {
          that.setData({ history: history, loading: false })
          that.genHotCold(history)
          that.recheckFollow(latest)
        }
      })
      .catch(function (err) {
        if (kind !== that.data.kind) return
        var msg = (err && err.errMsg && err.errMsg.indexOf('domain') !== -1)
          ? '数据源域名未授权，请在后台添加合法域名'
          : '数据源暂歇，点此重试'
        that.setData({ loading: false, error: msg })
      })
  },

  applyLatest: function (item, silent, kind) {
    if (!item) return
    kind = kind || this.data.kind
    var errTip = ''
    if (item.mock) {
      var reason = db.getDegradeReason(kind)
      errTip = (reason === 'rateLimit')
        ? '数据源繁忙，已为你展示示例龙珠（稍后将自动恢复）'
        : '数据源暂歇，已为你展示示例龙珠（请检查网络或合法域名）'
    }
    // 神龙指引指向「下一期」：期号 = 最新现世期 +1
    var guideSeq = nextSeq(kind, item.seq)
    if (kind === this.data.kind) {
      this.setData({
        latest: item,
        currentSeq: item.seq,
        guideSeq: guideSeq,
        tracking: true,
        error: errTip,
        lastSync: this.fmtTime()
      })
    } else {
      this.setData({ guideSeq: guideSeq, lastSync: this.fmtTime() })
    }
    // 非静默、或首次加载（内存尚未有指引）时触发；genGuide 内部按持久化缓存复用，同期限不重算
    if (!silent || !(this.data.guideStore[kind] && this.data.guideStore[kind].guides.length)) {
      var gs = this.data.guideStore[kind]
      if (!gs || gs.seq !== guideSeq) this.genGuide(5, kind, guideSeq)
      else if (kind === this.data.kind) {
        this.setData({ guides: gs.guides, showGuides: true })
        this.drawShare(gs.guides)
      }
    }
    if (kind === this.data.kind) this.refreshCollectState(kind, guideSeq)
  },

  genHotCold: function (history) {
    this.setData({ hotCold: guide.hotCold(this.data.kind, history) })
  },

  // 生成/复用指引：每板块每期固定 5 组（按 kind+seq 持久化，跨打开不变）
  genGuide: function (groups, kind, seq) {
    groups = groups || 5
    kind = kind || this.data.kind
    var targetSeq = (seq != null ? seq : this.data.guideSeq)
    var history = (kind === this.data.kind && this.data.history.length)
      ? this.data.history
      : db.getCachedHistory(kind)

    // 同玩法同期限已生成过 → 直接复用持久化结果（一期固定，不重算、跨打开不变）
    var c = storage.getDBCache(kind) || {}
    var cached = c.guides
    var guides
    if (cached && cached.seq === targetSeq && cached.guides && cached.guides.length) {
      guides = cached.guides
    } else {
      guides = guide.guideNext(kind, history, groups)
      var nextCache = Object.assign({}, c, { guides: { seq: targetSeq, guides: guides } })
      storage.setDBCache(kind, nextCache)
    }

    var store = Object.assign({}, this.data.guideStore)
    store[kind] = { seq: targetSeq, guides: guides }
    var patch = { guideStore: store }
    if (kind === this.data.kind) {
      patch.guides = guides
      patch.showGuides = true
    }
    this.setData(patch)
    if (kind === this.data.kind) {
      var that = this
      wx.nextTick(function () { that.drawShare(guides) })
    }
  },

  collectAllGuides: function () {
    var guides = this.data.guides
    if (!guides.length) { this.genGuide(5, this.data.kind, this.data.guideSeq); return }
    var that = this
    // 一期只能收藏一次：同玩法 + 同一指引期（下一期）已存在则拦截
    var dup = storage.getFollowRecords().some(function (r) {
      return r.kind === that.data.kind && r.atSeq === that.data.guideSeq
    })
    if (dup) {
      wx.showToast({ title: '本期已收藏', icon: 'none' })
      return
    }
    var n = 0
    guides.forEach(function (g) {
      var rec = {
        id: 'db_' + Date.now() + '_' + n,
        kind: that.data.kind,
        main: g.main,
        sub: g.sub,
        atSeq: that.data.guideSeq,
        createdAt: Date.now(),
        source: 'guide',
        checked: false,
        status: 'pending'
      }
      storage.addFollowRecord(rec)
      n++
    })
    this.refreshFollow()
    this.setData({ collectedThisSeq: true })
    wx.showToast({ title: '已收藏 ' + n + ' 组', icon: 'success' })
  },

  refreshCollectState: function (kind, seq) {
    if (kind !== this.data.kind) return
    var dup = storage.getFollowRecords().some(function (r) {
      return r.kind === kind && r.atSeq === seq
    })
    this.setData({ collectedThisSeq: dup })
  },

  refreshFollow: function () {
    var that = this
    var recs = storage.getFollowRecords()
      .filter(function (r) { return r.kind === that.data.kind })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
      .slice(0, 30)

    // 按所属期号(atSeq)分组成「期」，不同期天然区分，同期归为一组
    var groups = []
    var map = {}
    recs.forEach(function (r) {
      var key = r.atSeq || 'unknown'
      if (!map[key]) {
        map[key] = { seq: key, items: [] }
        groups.push(map[key])
      }
      var s = followStatus(r)
      map[key].items.push({
        id: r.id, kind: r.kind, main: r.main, sub: r.sub,
        checked: r.checked, echo: r.echo, createdAt: r.createdAt,
        statusText: s.text, statusClass: s.cls
      })
    })
    // 每组的收藏日期取组内最新一条
    groups.forEach(function (g) {
      g.dateLabel = g.items.length ? that.fmtDate(g.items[0].createdAt || Date.now()) : ''
    })

    this.setData({ followList: recs, followGroups: groups })
  },

  // 最新现世出现后，自动对照待现世的收藏组
  // 规则：只有 atSeq === latest.seq（这一期真的开奖了）才做对照
  recheckFollow: function (latest) {
    if (!latest) return
    var that = this
    var list = storage.getFollowRecords()
    var changed = false

    // 先清理上一轮 bug 造成的脏数据：非当前开奖期却被错误 check 的记录，重置为待现世
    list.forEach(function (r) {
      if (r.kind === that.data.kind && r.checked && r.atSeq && r.atSeq !== latest.seq) {
        storage.updateFollowRecord(r.id, { checked: false, status: 'pending', echo: null })
        changed = true
      }
    })

    // 再对真正到期的收藏做开奖对照
    list = storage.getFollowRecords()
    list.forEach(function (r) {
      if (r.kind === that.data.kind && !r.checked && r.atSeq === latest.seq) {
        var echo = guide.checkEcho({ main: r.main, sub: r.sub }, latest)
        storage.updateFollowRecord(r.id, { checked: true, status: 'done', echo: echo })
        changed = true
      }
    })
    if (changed) this.refreshFollow()
  },

  onRetry: function () { this.loadData() },

  fmtTime: function () {
    var d = new Date()
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  },

  fmtDate: function (ts) {
    var d = new Date(ts || Date.now())
    return (d.getMonth() + 1) + '-' + pad2(d.getDate())
  },

  // ============ 分享卡（内联 Canvas） ============
  // 分享图：素雅苹果风，白色圆角卡片承载每组，柔和双色珠
  drawShare: function (guides) {
    if (!guides || !guides.length) return
    var that = this
    var query = wx.createSelectorQuery()
    query.select('#shareCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res[0] || !res[0].node) return
      var canvas = res[0].node
      var ctx = canvas.getContext('2d')
      var dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio
      var W = res[0].width, H = res[0].height
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)

      // 素雅背景：极淡冷灰渐变
      var bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#F8F9FB')
      bg.addColorStop(1, '#ECEFF3')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // 标题（深色克制）
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#1C1C1E'
      ctx.font = 'bold ' + (W * 0.072) + 'px sans-serif'
      ctx.fillText('神龙指引 · ' + that.data.meta.label, W / 2, H * 0.058)

      // 期号 + 组数（次级灰）
      ctx.fillStyle = '#8E8E93'
      ctx.font = (W * 0.03) + 'px sans-serif'
      ctx.fillText('第 ' + that.data.guideSeq + ' 期 · 共 ' + guides.length + ' 组', W / 2, H * 0.10)

      // 分组卡片
      var n = guides.length
      var top = H * 0.135
      var bottom = H * 0.83
      var bandH = (bottom - top) / n
      for (var i = 0; i < n; i++) {
        var cardX = W * 0.055
        var cardW = W * 0.89
        var cardY = top + bandH * i + bandH * 0.08
        var cardH = bandH * 0.84
        var r = Math.min(cardH * 0.22, 18)
        // 卡片：白底 + 柔和投影
        ctx.save()
        ctx.shadowColor = 'rgba(31,41,55,0.10)'
        ctx.shadowBlur = W * 0.03
        ctx.shadowOffsetY = bandH * 0.06
        ctx.fillStyle = '#FFFFFF'
        roundRect(ctx, cardX, cardY, cardW, cardH, r)
        ctx.fill()
        ctx.restore()
        // 组序号（次级灰，左上）
        ctx.fillStyle = '#8E8E93'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.font = (W * 0.03) + 'px sans-serif'
        ctx.fillText('第 ' + (i + 1) + ' 组', cardX + cardW * 0.06, cardY + cardH * 0.28)
        ctx.textBaseline = 'alphabetic'
        // 该组珠子（居中偏下，柔和双色）
        drawGuideRow(ctx, guides[i], cardX + cardW / 2, cardY + cardH * 0.66, cardW * 0.86, '#F26C6C', '#5AA9E6')
      }

      // 免责（浅灰）
      ctx.textAlign = 'center'
      ctx.fillStyle = '#A0A0A5'
      ctx.font = (W * 0.028) + 'px sans-serif'
      ctx.fillText('娱乐参考 · 与任何现实博彩无关', W / 2, H * 0.875)

      // 小程序码（底部居中，圆角白底托）
      var q = W * 0.13
      var qx = W / 2 - q / 2
      var qy = H * 0.90
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, qx - W * 0.02, qy - W * 0.02, q + W * 0.04, q + W * 0.04, 10)
      ctx.fill()
      var img = canvas.createImage()
      img.onload = function () {
        ctx.drawImage(img, qx, qy, q, q)
        that._exportShare(canvas)
      }
      img.onerror = function () { that._exportShare(canvas) }
      img.src = '/images/qrcode.jpg'
    })
  },

  _exportShare: function (canvas) {
    var that = this
    wx.canvasToTempFilePath({
      canvas: canvas,
      success: function (r) { that.setData({ shareTempPath: r.tempFilePath }) }
    })
  },

  onSaveShare: function () {
    var that = this
    if (!this.data.shareTempPath) {
      wx.showToast({ title: '正在生成图片', icon: 'none' })
      return
    }
    wx.saveImageToPhotosAlbum({
      filePath: this.data.shareTempPath,
      success: function () { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
      fail: function (err) {
        if (err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
          wx.showModal({
            title: '需要授权',
            content: '请允许保存图片到相册',
            success: function (m) { if (m.confirm) wx.openSetting() }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage: function () {
    var guides = this.data.guides
    var title = this.data.meta.label + '指引 · 共 ' + guides.length + ' 组'
    var g = guides[0]
    if (g) title += '｜' + g.main.map(pad2).join(' ') + ' + ' + g.sub.map(pad2).join(' ')
    title += '｜舔狗助手'
    return {
      title: title,
      path: '/pages/dragonball/dragonball?kind=' + this.data.kind,
      imageUrl: this.data.shareTempPath || ''
    }
  },

  onShareTimeline: function () {
    var guides = this.data.guides
    var t = this.data.meta.label + '指引 · 共 ' + guides.length + ' 组'
    var g = guides[0]
    if (g) t += '｜' + g.main.map(pad2).join(' ') + ' + ' + g.sub.map(pad2).join(' ')
    return { title: t + '｜舔狗助手', query: 'kind=' + this.data.kind }
  }
})

// 单颗龙珠（圆 + 数字）
function drawOne(ctx, x, y, r, color, num) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold ' + (r * 0.82) + 'px sans-serif'
  ctx.fillText(pad2(num), x, y)
  ctx.textBaseline = 'alphabetic'
}

// 圆角矩形路径
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 计算下一期号：双色球 YYYYNNN / 大乐透 YYNNN，尾数 +1（跨年进位）
function nextSeq(kind, seq) {
  if (!seq || !/^\d+$/.test(seq)) return seq
  var tail = seq.slice(-3)
  var prefix = seq.slice(0, seq.length - 3)
  var n = parseInt(tail, 10) + 1
  if (n > 999) { n = 1; prefix = String(parseInt(prefix, 10) + 1) }
  return prefix + ('000' + n).slice(-3)
}

// 一组指引：主珠 + 副珠 单行两端分布，中间间距略大于同色间距
function drawGuideRow(ctx, g, cx, cy, totalW, mainColor, subColor) {
  var main = g.main || []
  var sub = g.sub || []
  var d = totalW * 0.1
  var gapSame = d * 0.16
  var gapMid = d * 1.5
  var mainW = main.length * d + (main.length - 1) * gapSame
  var subW = sub.length * d + (sub.length - 1) * gapSame
  var total = mainW + gapMid + subW
  var startX = cx - total / 2 + d / 2
  for (var i = 0; i < main.length; i++) {
    drawOne(ctx, startX + i * (d + gapSame), cy, d / 2, mainColor, main[i])
  }
  var subStart = cx - total / 2 + mainW + gapMid + d / 2
  for (var j = 0; j < sub.length; j++) {
    drawOne(ctx, subStart + j * (d + gapSame), cy, d / 2, subColor, sub[j])
  }
}
