// pages/tomato/tomato.js — 烂番茄专注计时器（番茄工作法）
var S = require('../../utils/storage')
var WAV = require('../../utils/wav')

/* ═══ 常量（顶部分段，ES5）═══ */
var PHASE = { IDLE: 'idle', FOCUS: 'focusing', LONG: 'long_break' }
var FOCUS_OPTIONS = [5, 15, 40]
var FOCUS_DEFAULT = 45
var BREAK_OPTIONS = [5, 10, 15]
var BREAK_DEFAULT = 15
var LONG_EVERY = 4
var PHASE_LABEL = { idle: '准备开始', focusing: '专注中', long_break: '休息' }
var PHASE_COLOR = { focusing: '#FF8C69', long_break: '#6ECBF5' }
var ABANDON_MS = 2 * 3600 * 1000

function mmss(sec) {
  var m = Math.floor(sec / 60)
  var s = sec % 60
  return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s)
}
function hhmmss(sec) {
  function p(n) { return (n < 10 ? '0' + n : '' + n) }
  var h = Math.floor(sec / 3600)
  var m = Math.floor((sec % 3600) / 60)
  var s = sec % 60
  return p(h) + p(m) + p(s)
}
function dateStrOf(ts) {
  var d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Page({
  data: {
    phaseKey: 'idle',
    phaseLabel: '准备开始',
    phaseColor: '#FF8C69',
    running: false,
    timeText: '40:00',
    roundDots: [{ done: false }, { done: false }, { done: false }, { done: false }],
    todayCount: 0,
    todayMinutes: 0,
    streakDays: 0,
    showSetting: false,
    hideRing: false,
    floatList: [],
    // 设置面板：时长
    focusOptions: FOCUS_OPTIONS,
    focusValue: 40,
    focusLabel: '40 分',
    showDurationInline: false,
    showCustomInput: false,
    showSwitchInline: false,
    // 设置面板：开关
    soundOn: true,
    vibrateOn: true,
    keepOn: true,
    // 设置面板：休息时长
    longBreakOptions: [5, 10, 15],
    longBreak: 15,
    breakValue: 15,
    breakLabel: '15 分',
    showBreakInline: false,
    showBreakCustomInput: false,
    // 横屏全屏翻页时钟
    isLandscape: false,
    flip: ['0', '0', '0', '0', '0', '0'],
    // 自定义导航栏（navigationStyle: custom）
    statusBarHeight: 0,
    navHeight: 44,
    headerHeight: 44
  },

  // ═══ 实例字段（高频状态不入 data）═══
  _cfg: null,
  _phase: 'idle',
  _running: false,
  _endAt: 0,
  _durationMs: 0,
  _remainMs: 0,
  _lastSec: -1,
  _tickTimer: null,
  _ringTimer: null,
  _ringCvs: null,
  _ringCtx: null,
  _cvsW: 0,
  _cvsH: 0,
  _completedInCycle: 0,
  _audioCtx: null,
  _innerAudio: null,
  _fid: 0,
  _customDraft: 0,
  _breakCustomDraft: 0,
  _forcedPortrait: false,

  /* ═══ 生命周期 ═══ */
  onLoad: function () {
    this._cfg = S.getTomatoSettings() || {}
    var f = Number(this._cfg.focusCustom) > 0 ? 'custom' : (Number(this._cfg.focus) || FOCUS_DEFAULT)
    this.setData({
      focusValue: f,
      focusLabel: f === 'custom' ? ('自定义 ' + this._cfg.focusCustom + ' 分') : (f + ' 分')
    })
    this._initAudio()
    this._loadSession()
    this._syncToggles()
    this._initCustomNav()
  },

  _initCustomNav: function () {
    var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    var statusBarHeight = info.statusBarHeight || 0
    var navHeight = 44
    try {
      var menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
      if (menu && menu.height) {
        navHeight = (menu.top - statusBarHeight) * 2 + menu.height
      }
    } catch (e) {}
    this.setData({
      statusBarHeight: statusBarHeight,
      navHeight: navHeight,
      headerHeight: statusBarHeight + navHeight
    })
  },

  onShow: function () {
    this._cfg = S.getTomatoSettings()
    this._refreshToday()
    this._syncToggles()
    var self = this
    // 恢复计时（onLoad 已 restore 字段，这里 resume tick + ring）
    if (this._running && this._endAt) {
      var left = this._endAt - Date.now()
      if (left <= 0) {
        this._onPhaseEnd(this._phase === PHASE.FOCUS, true)
      } else {
        this._scheduleTick()
        this._startRing()
        wx.setKeepScreenOn({ keepScreenOn: (this._cfg ? this._cfg.keepScreenOn !== false : true) })
      }
    }
    setTimeout(function () { self._initRingCanvas() }, 300)
    if (self._forcedPortrait) {
      self._forcedPortrait = false
      if (wx.setPageOrientation) { try { wx.setPageOrientation({ orientation: 'auto', complete: function () {} }) } catch (e) {} }
    }
    this._detectOrientation()
    this._syncChrome()
  },

  // 初始/进入页面时检测当前方向
  _detectOrientation: function () {
    var w, h
    try {
      var wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      w = wi.windowWidth; h = wi.windowHeight
    } catch (e) { return }
    if (!w || !h) return
    var landscape = w > h
    if (landscape !== this.data.isLandscape) this.setData({ isLandscape: landscape })
    if (!landscape && this._forcedPortrait) {
      this._forcedPortrait = false
      if (wx.setPageOrientation) { try { wx.setPageOrientation({ orientation: 'auto', complete: function () {} }) } catch (e) {} }
    }
  },

  // 横屏/竖屏切换
  onResize: function (res) {
    var size = (res && res.size) || {}
    var w = size.windowWidth, h = size.windowHeight
    if (!w || !h) {
      try {
        var wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        w = wi.windowWidth; h = wi.windowHeight
      } catch (e) {}
    }
    if (!w || !h) return
    var landscape = w > h
    if (landscape !== this.data.isLandscape) {
      this.setData({ isLandscape: landscape })
    }
    if (!landscape && this._forcedPortrait) {
      this._forcedPortrait = false
      if (wx.setPageOrientation) { try { wx.setPageOrientation({ orientation: 'auto', complete: function () {} }) } catch (e) {} }
    }
    this._syncChrome()
  },

  // 横屏 + 运行中 → 隐藏 tabBar，并移除 ring canvas（原生组件会盖在普通 view 之上）
  _syncChrome: function () {
    var full = this._running && this.data.isLandscape
    try {
      if (full) wx.hideTabBar({ animation: true })
      else wx.showTabBar({ animation: true })
    } catch (e) {}
    // ring canvas 是原生组件，必须用 wx:if 移除才能避免盖住翻页时钟
    var shouldHideRing = full || this.data.showSetting
    if (this.data.hideRing !== shouldHideRing) {
      this.setData({ hideRing: shouldHideRing })
      if (!shouldHideRing) {
        var self = this
        setTimeout(function () { self._initRingCanvas() }, 300)
      }
    }
  },

  onHide: function () {
    this._clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
    this._saveSession()
    this.setData({ floatList: [] })
    try { wx.showTabBar({ animation: true }) } catch (e) {}
  },

  onUnload: function () {
    this._clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
    if (this._audioCtx) { try { this._audioCtx.close() } catch (e) {}; this._audioCtx = null }
    this.setData({ floatList: [] })
    try { wx.showTabBar({ animation: true }) } catch (e) {}
  },

  onShareAppMessage: function () {
    var c = this.data.todayCount
    var title = c > 0 ? ('今天已烂番茄专注 ' + c + ' 个，你呢？') : '烂番茄专注 · 摆烂也能撑住一个番茄'
    return { title: title, path: '/pages/tomato/tomato' }
  },
  onShareTimeline: function () {
    var c = this.data.todayCount
    return { title: c > 0 ? ('今天已烂番茄专注 ' + c + ' 个') : '烂番茄专注', query: '' }
  },

  /* ═══ 时长计算 ═══ */
  _durationOf: function (phase) {
    var cfg = this._cfg || {}
    if (phase === PHASE.FOCUS) {
      var f = Number(cfg.focusCustom) > 0 ? Number(cfg.focusCustom) : (Number(cfg.focus) || FOCUS_DEFAULT)
      return f * 60000
    }
    if (phase === PHASE.LONG) {
      var b = Number(cfg.longCustom) > 0 ? Number(cfg.longCustom) : (Number(cfg.long) || BREAK_DEFAULT)
      return b * 60000
    }
    return (Number(cfg.focus) || FOCUS_DEFAULT) * 60000
  },

  _dotsData: function () {
    var arr = []
    for (var i = 0; i < LONG_EVERY; i++) arr.push({ done: i < this._completedInCycle })
    return arr
  },

  /* ═══ 会话恢复（抗进程回收）═══ */
  _loadSession: function () {
    var sess = S.getTomatoSession()
    if (!sess || !sess.phase || sess.phase === PHASE.IDLE) { this._resetIdle(false); return }
    var now = Date.now()
    if (sess.running && sess.endAt) {
      var left = sess.endAt - now
      if (left <= 0) {
        this._applySession(sess)
        this._onPhaseEnd(sess.phase === PHASE.FOCUS, true)
        return
      }
      this._applySession(sess)
    } else if (!sess.running) {
      if (sess.ts && now - sess.ts > ABANDON_MS) { this._resetIdle(false); return }
      this._applySession(sess)
    } else {
      this._resetIdle(false); return
    }
    this._renderPhase()
    this._renderTime(true)
    this._drawRing()
  },

  _applySession: function (sess) {
    this._phase = sess.phase
    this._running = !!sess.running
    this._endAt = sess.endAt || 0
    this._durationMs = sess.durationMs || this._durationOf(sess.phase)
    this._remainMs = sess.remainMs || 0
    this._completedInCycle = sess.completedInCycle || 0
  },

  _resetIdle: function (render) {
    this._phase = PHASE.IDLE
    this._running = false
    this._endAt = 0
    this._durationMs = this._durationOf(PHASE.FOCUS)
    this._remainMs = this._durationMs
    this._completedInCycle = 0
    if (render !== false) {
      this._renderPhase()
      this._renderTime(true)
      this._drawRing()
    }
  },

  /* ═══ 阶段起停 ═══ */
  _startPhase: function (phase, autoRun) {
    this._phase = phase
    this._durationMs = this._durationOf(phase)
    if (autoRun) {
      this._endAt = Date.now() + this._durationMs
      this._remainMs = 0
      this._running = true
    } else {
      this._endAt = 0
      this._remainMs = this._durationMs
      this._running = false
    }
    this._renderPhase()
    this._renderTime(true)
    if (this._running) {
      this._scheduleTick()
      this._startRing()
      wx.setKeepScreenOn({ keepScreenOn: (this._cfg ? this._cfg.keepScreenOn !== false : true) })
    } else {
      this._clearTimers()
      this._drawRing()
      wx.setKeepScreenOn({ keepScreenOn: false })
    }
    this._saveSession()
    this._syncChrome()
  },

  // 自然结束：落下一 phase 并停"待开始"
  _onPhaseEnd: function (isFocus, fromBackground) {
    this._clearTimers()
    if (isFocus) {
      var startTs = this._endAt - this._durationMs
      var dateKey = dateStrOf(startTs)
      var minutes = Math.round(this._durationMs / 60000)
      S.addTomatoRecord(dateKey, minutes)
      this._refreshToday()
      this._spawnFloat()
      if (this._cfg && this._cfg.vibrate) { try { wx.vibrateLong() } catch (e) {} }
      if (this._cfg && this._cfg.sound) { this._playDing() }
      this._completedInCycle += 1
    }

    var nextPhase
    if (isFocus) {
      nextPhase = PHASE.LONG
    } else {
      nextPhase = PHASE.FOCUS
      if (this._completedInCycle >= LONG_EVERY) this._completedInCycle = 0
    }

    this._phase = nextPhase
    this._running = false
    this._durationMs = this._durationOf(nextPhase)
    this._remainMs = this._durationMs
    this._endAt = 0
    this._renderPhase()
    this._renderTime(true)
    this._drawRing()
    this._saveSession()
    wx.setKeepScreenOn({ keepScreenOn: false })
    this._syncChrome()

    if (fromBackground) {
      wx.showModal({
        title: '你离开时',
        content: isFocus ? '这个番茄已经完成了 🍅' : '休息时段已经结束',
        showCancel: false
      })
    } else if (isFocus) {
      wx.showModal({
        title: '完成 1 个番茄 🍅',
        content: '点「开始」进入休息',
        showCancel: false
      })
    }
  },

  /* ═══ 计时核心 ═══ */
  _scheduleTick: function () {
    this._clearTick()
    var self = this
    var left = this._endAt - Date.now()
    if (left <= 0) {
      this._onPhaseEnd(this._phase === PHASE.FOCUS, false)
      return
    }
    this._renderTime()
    var delay = left % 1000
    if (delay < 30) delay += 1000
    this._tickTimer = setTimeout(function () { self._scheduleTick() }, delay)
  },

  _renderTime: function (force) {
    var left = this._running ? Math.max(0, this._endAt - Date.now()) : this._remainMs
    var sec = Math.ceil(left / 1000)
    if (sec === this._lastSec && !force) return
    this._lastSec = sec
    var dur = this._durationMs || 1
    var pct = Math.round((1 - left / dur) * 100)
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    this.setData({
      timeText: mmss(sec),
      phaseLabel: PHASE_LABEL[this._phase],
      phaseColor: PHASE_COLOR[this._phase] || '#FF8C69',
      flip: hhmmss(sec).split('')
    })
  },

  _renderPhase: function () {
    this.setData({
      phaseKey: this._phase,
      phaseLabel: PHASE_LABEL[this._phase],
      phaseColor: PHASE_COLOR[this._phase] || '#FF8C69',
      running: this._running,
      roundDots: this._dotsData()
    })
  },

  /* ═══ 主按钮：开始 / 暂停 / 继续 ═══ */
  onTapMain: function () {
    this._resumeAudio()
    if (this._phase === PHASE.IDLE) {
      this._startPhase(PHASE.FOCUS, true)
      return
    }
    if (this._running) this.tapPause()
    else this.tapResume()
  },

  tapPause: function () {
    if (!this._running) return
    this._remainMs = Math.max(0, this._endAt - Date.now())
    this._running = false
    this._endAt = 0
    this._clearTimers()
    wx.setKeepScreenOn({ keepScreenOn: false })
    this._renderPhase()
    this._renderTime(true)
    this._drawRing()
    this._saveSession()
    this._syncChrome()
  },

  tapResume: function () {
    if (this._running) return
    if (this._remainMs > 0) {
      this._endAt = Date.now() + this._remainMs
      this._running = true
      this._renderPhase()
      this._renderTime(true)
      this._scheduleTick()
      this._startRing()
      wx.setKeepScreenOn({ keepScreenOn: (this._cfg ? this._cfg.keepScreenOn !== false : true) })
      this._saveSession()
    } else {
      this._startPhase(this._phase, true)
    }
    this._syncChrome()
  },

  // 轻量出口：结束本次专注（当前番茄不计入）
  tapEnd: function () {
    var self = this
    wx.showModal({
      title: '结束本次专注',
      content: '当前进行中的番茄不计入，本次计时将清空。',
      confirmText: '结束',
      cancelText: '取消',
      success: function (r) {
        if (!r.confirm) return
        self._clearTimers()
        self._phase = PHASE.IDLE
        self._running = false
        self._endAt = 0
        self._remainMs = 0
        self._completedInCycle = 0
        S.setTomatoSession(null)
        wx.setKeepScreenOn({ keepScreenOn: false })
        self._resetIdle(true)
        self._syncChrome()
      }
    })
  },

  // 休息阶段：结束休息，回到专注准备（保留已完成的番茄计数）
  tapEndBreak: function () {
    var self = this
    wx.showModal({
      title: '结束休息',
      content: '当前休息将结束，回到专注准备状态。',
      confirmText: '结束',
      cancelText: '取消',
      success: function (r) {
        if (!r.confirm) return
        self._clearTimers()
        self._phase = PHASE.IDLE
        self._running = false
        self._endAt = 0
        self._durationMs = self._durationOf(PHASE.FOCUS)
        self._remainMs = self._durationMs
        // 保留 _completedInCycle（点阵反映已完成的专注）
        S.setTomatoSession(null)
        wx.setKeepScreenOn({ keepScreenOn: false })
        self._renderPhase()
        self._renderTime(true)
        self._drawRing()
        self._syncChrome()
      }
    })
  },

  // 横屏旋转图标：强制回到竖屏（传感器旋转也会触发 onResize 自动回到竖屏）
  tapRotate: function () {
    if (wx.setPageOrientation) {
      try {
        this._forcedPortrait = true
        wx.setPageOrientation({ orientation: 'portrait', complete: function () {} })
      } catch (e) {
        wx.showToast({ title: '请旋转手机至竖屏', icon: 'none' })
      }
    } else {
      wx.showToast({ title: '请旋转手机至竖屏', icon: 'none' })
    }
  },

  /* ═══ 环形 canvas ═══ */
  _initRingCanvas: function () {
    if (this.data.hideRing) return
    var self = this
    wx.createSelectorQuery().select('#ringCVS').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return
      var cvs = res[0].node
      var ctx = cvs.getContext('2d')
      var dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      self._cvsW = res[0].width * dpr
      self._cvsH = res[0].height * dpr
      cvs.width = self._cvsW
      cvs.height = self._cvsH
      ctx.scale(dpr, dpr)
      self._ringCvs = cvs
      self._ringCtx = ctx
      self._drawRing()
      if (self._running && self._endAt) self._startRing()
    })
  },

  _drawRing: function () {
    if (!this._ringCtx) return
    var ctx = this._ringCtx
    var dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
    var W = this._cvsW / dpr
    var H = this._cvsH / dpr
    ctx.clearRect(0, 0, W, H)
    var cx = W / 2, cy = H / 2
    var r = Math.min(W, H) / 2 - 16
    // 底圈
    ctx.lineWidth = 12
    ctx.strokeStyle = '#F1EAE3'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    // 进度
    var total = this._durationMs || 1
    var left = this._running ? Math.max(0, this._endAt - Date.now()) : this._remainMs
    var elapsed = total - left
    var pct = elapsed / total
    if (pct < 0) pct = 0
    if (pct > 1) pct = 1
    if (pct > 0) {
      ctx.strokeStyle = (PHASE_COLOR[this._phase] || '#FF8C69')
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2)
      ctx.stroke()
    }
  },

  _startRing: function () {
    this._clearRing()
    var self = this
    var tick = function () {
      self._drawRing()
      self._ringTimer = setTimeout(tick, 16)
    }
    this._ringTimer = setTimeout(tick, 16)
  },

  /* ═══ 定时器清理 ═══ */
  _clearTick: function () {
    if (this._tickTimer) { clearTimeout(this._tickTimer); this._tickTimer = null }
  },
  _clearRing: function () {
    if (this._ringTimer) { clearTimeout(this._ringTimer); this._ringTimer = null }
  },
  _clearTimers: function () {
    this._clearTick()
    this._clearRing()
  },

  /* ═══ 数据刷新 ═══ */
  _refreshToday: function () {
    var td = S.getTomatoToday()
    var streak = S.getTomatoStreak()
    this.setData({ todayCount: td.count, todayMinutes: td.minutes, streakDays: streak })
  },

  /* ═══ +1 飘字 ═══ */
  _spawnFloat: function () {
    var id = ++this._fid
    var item = { id: id, endY: -150 - (id % 3) * 12, duration: 1100 + (id % 3) * 80 }
    var list = this.data.floatList.slice()
    list.push(item)
    if (list.length > 10) list = list.slice(-10)
    this.setData({ floatList: list })
    var self = this
    setTimeout(function () {
      self.setData({ floatList: self.data.floatList.filter(function (f) { return f.id !== id }) })
    }, item.duration + 60)
  },

  /* ═══ 音效 ═══ */
  _initAudio: function () {
    try {
      if (!this._audioCtx && wx.createWebAudioContext) this._audioCtx = wx.createWebAudioContext()
    } catch (e) {}
  },
  _resumeAudio: function () {
    try { if (this._audioCtx && this._audioCtx.state === 'suspended') this._audioCtx.resume() } catch (e) {}
  },
  _playDing: function () {
    if (this._audioCtx) {
      try {
        var ctx = this._audioCtx, now = ctx.currentTime
        var o1 = ctx.createOscillator(), g1 = ctx.createGain()
        o1.type = 'sine'; o1.frequency.setValueAtTime(880, now)
        o1.frequency.exponentialRampToValueAtTime(440, now + 0.18)
        g1.gain.setValueAtTime(0.4, now); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
        o1.connect(g1); g1.connect(ctx.destination)
        o1.start(now); o1.stop(now + 0.24)
        var o2 = ctx.createOscillator(), g2 = ctx.createGain()
        o2.type = 'sine'; o2.frequency.setValueAtTime(1320, now)
        g2.gain.setValueAtTime(0.12, now); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
        o2.connect(g2); g2.connect(ctx.destination)
        o2.start(now); o2.stop(now + 0.12)
        return
      } catch (e) {}
    }
    try {
      var b64 = this._genWavB64()
      if (!this._innerAudio && wx.createInnerAudioContext) {
        var ia = wx.createInnerAudioContext(); ia.obeyMuteSwitch = false; this._innerAudio = ia
      }
      if (this._innerAudio) {
        this._innerAudio.stop()
        this._innerAudio.src = 'data:audio/wav;base64,' + b64
        this._innerAudio.play()
      }
    } catch (e) {}
  },

  _genWavB64: function () {
    return WAV.genWavB64({
      sr: 8000, dur: 0.25,
      sample: function (t) {
        var env = Math.exp(-t * 12)
        var s = (Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1320 * t) * 0.2) * env
        return Math.max(0, Math.min(255, Math.floor(128 + s * 110)))
      }
    })
  },

  /* ═══ 设置面板 ═══ */
  openSettings: function () {
    this.setData({ showSetting: true, hideRing: true, showDurationInline: false, showSwitchInline: false, showBreakInline: false, showBreakCustomInput: false, showCustomInput: false })
  },
  closeSetting: function () {
    this.setData({ showSetting: false, showDurationInline: false, showSwitchInline: false, showBreakInline: false, showBreakCustomInput: false, showCustomInput: false })
    this._clearRing()
    this._syncChrome()
  },
  onPanelTap: function () {},

  _syncToggles: function () {
    var c = this._cfg || {}
    var bVal = Number(c.longCustom) > 0 ? 'custom' : (Number(c.long) || BREAK_DEFAULT)
    this.setData({
      soundOn: c.sound !== false,
      vibrateOn: c.vibrate !== false,
      keepOn: c.keepScreenOn !== false,
      longBreak: Number(c.long) || BREAK_DEFAULT,
      breakValue: bVal,
      breakLabel: bVal === 'custom' ? ('自定义 ' + c.longCustom + ' 分') : (bVal + ' 分')
    })
  },
  onToggleSound: function () {
    this._setToggle('sound', !this.data.soundOn)
  },
  onToggleVibrate: function () {
    this._setToggle('vibrate', !this.data.vibrateOn)
  },
  onToggleKeep: function () {
    this._setToggle('keepScreenOn', !this.data.keepOn)
  },
  _setToggle: function (key, val) {
    var c = S.getTomatoSettings()
    c[key] = val
    S.setTomatoSettings(c)
    this._cfg = c
    var d = {}
    if (key === 'sound') d.soundOn = val
    if (key === 'vibrate') d.vibrateOn = val
    if (key === 'keepScreenOn') d.keepOn = val
    this.setData(d)
    // 专注进行中切换“屏幕常亮”立即生效
    if (key === 'keepScreenOn' && this._running) {
      wx.setKeepScreenOn({ keepScreenOn: val })
    }
  },

  onToggleDurationInline: function () {
    this.setData({ showDurationInline: !this.data.showDurationInline })
  },
  onToggleSwitchInline: function () {
    this.setData({ showSwitchInline: !this.data.showSwitchInline })
  },

  onToggleBreakInline: function () {
    this.setData({ showBreakInline: !this.data.showBreakInline })
  },
  onPickBreak: function (e) {
    this._setBreak('long', Number(e.currentTarget.dataset.min), 0)
  },
  onOpenBreakCustom: function () {
    this.setData({ showBreakCustomInput: true })
  },
  onBreakInput: function (e) {
    this._breakCustomDraft = Number(e.detail.value)
  },
  onSaveBreakCustom: function () {
    var v = this._breakCustomDraft
    if (!v || v < 1) { wx.showToast({ title: '请输入有效分钟', icon: 'none' }); return }
    if (v > 180) v = 180
    this._setBreak('long', 0, v)
  },
  _setBreak: function (key, val, custom) {
    var c = S.getTomatoSettings()
    c[key] = val
    c[key + 'Custom'] = custom || 0
    S.setTomatoSettings(c)
    this._cfg = c
    var bv = custom > 0 ? 'custom' : val
    this.setData({
      longBreak: val,
      breakValue: bv,
      breakLabel: custom > 0 ? ('自定义 ' + custom + ' 分') : (val + ' 分')
    })
    var inBreak = (this._phase === PHASE.LONG)
    if (inBreak && !this._running) {
      this._durationMs = this._durationOf(this._phase)
      this._remainMs = this._durationMs
      this._lastSec = -1
      this._renderTime(true)
      this._drawRing()
    } else {
      wx.showToast({ title: '下个时段生效', icon: 'none' })
    }
    this.setData({ showBreakCustomInput: false })
  },

  onPickFocus: function (e) {
    var v = Number(e.currentTarget.dataset.min)
    this._setFocus(v, 0)
  },
  onOpenCustom: function () {
    this.setData({ showCustomInput: true })
  },
  onCustomInput: function (e) {
    this._customDraft = Number(e.detail.value)
  },
  onSaveCustom: function () {
    var v = this._customDraft
    if (!v || v < 1) { wx.showToast({ title: '请输入有效分钟', icon: 'none' }); return }
    if (v > 180) v = 180
    this._setFocus(0, v)
  },

  _setFocus: function (focus, custom) {
    var c = S.getTomatoSettings()
    c.focus = focus
    c.focusCustom = custom || 0
    S.setTomatoSettings(c)
    this._cfg = c
    var fv = custom > 0 ? 'custom' : focus
    this.setData({
      focusValue: fv,
      focusLabel: custom > 0 ? ('自定义 ' + custom + ' 分') : (focus + ' 分')
    })
    if (this._phase === PHASE.IDLE) {
      this._durationMs = this._durationOf(PHASE.FOCUS)
      this._remainMs = this._durationMs
      this._lastSec = -1
      this._renderTime(true)
      this._drawRing()
    } else {
      wx.showToast({ title: '下个时段生效', icon: 'none' })
    }
    this.setData({ showCustomInput: false })
  },

  onOpenTimeCalc: function () {
    this.setData({ showSetting: false, hideRing: false })
    wx.navigateTo({ url: '/pages/index/index' })
  },
  onOpenHistory: function () {
    this.setData({ showSetting: false, hideRing: false })
    wx.navigateTo({ url: '/pages/tomato/history' })
  },

  /* ═══ 会话持久化 ═══ */
  _saveSession: function () {
    var sess = {
      phase: this._phase,
      running: this._running,
      endAt: this._endAt,
      remainMs: this._remainMs,
      durationMs: this._durationMs,
      completedInCycle: this._completedInCycle,
      ts: Date.now()
    }
    S.setTomatoSession(sess)
  }
})
