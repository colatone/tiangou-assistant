// pages/wooden-fish/wooden-fish.js — V18 造型对齐木鱼.png + DOM飘字 + 真实小程序码
var S = require('../../utils/storage')
var Q = require('../../utils/quote')   // 复用每日一签
var Canvas = require('../../utils/canvas')
var roundRect = Canvas.roundRect, wrapText = Canvas.wrapText
var WAV = require('../../utils/wav')

/* ═══ 3 档位映射（V27：音量/速度改为滑动档位）═══ */
var VOL_LEVELS = [0.12, 0.38, 0.70]        // 音量3档：小 / 中 / 大
var VOL_LABELS = ['小', '中', '大']
var SPEED_LEVELS = [900, 500, 250]         // 速度3档（ms）：慢 / 中 / 快
var SPEED_LABELS = ['慢', '中', '快']

/* ═══ 工具函数（roundRect / wrapText）已抽到 utils/canvas，WAV 编码抽到 utils/wav ═══ */

Page({
  data: {
    merit: 0, todayCount: 0, streakDays: 0,
    hitting: false, showStick: true, autoRunning: false,
    /* —— DOM +1 飘字列表（替代 canvas 内绘制，可跨元素飞到运势横幅下方）—— */
    floatList: [],

    // —— 每日一签 ——
    fortuneQuote: '', fortuneN: 30, fortuneUnlocked: false, fortuneRemain: 30,
    // —— 白噪音（V27：3档·音量最小声为默认）——
    noiseState: 'off', noiseVolLevel: 0, noiseVolText: '小', showNoiseVol: false,
    // —— 自动速度（V27：3档·最慢为默认）——
    autoSpeedLevel: 0, autoSpeedText: '慢', showAutoSpeedSlider: false,
  },

  _autoTimer: null,
  _cfg: null,
  _fid: 0,
  _audioCtx: null,
  _fishCvs: null,
  _fishCtx: null,
  _cvsW: 0,
  _cvsH: 0,

  // —— 木棒敲击补间（setTimeout 驱动，兼容所有基础库）——
  _knockRot: 0, _knockRAF: null, _knockStart: 0,
  // —— 波纹 ——
  _ripples: [], _rippleRAF: null,
  // —— 白噪音 ——
  _bgSrc: null, _bgGain: null, _bgType: null, _bgLfo: null, _noiseBuf: null,
  _volTimer: null,
  // —— 每日一签翻转标记 ——
  _fortuneWasUnlocked: false,

  onLoad: function () {
    this._cfg = S.getWoodFishSettings() || {}
  },

  onShow: function () {
    var self = this
    this._cfg = S.getWoodFishSettings()
    this.setData({ showStick: this._cfg.showStick !== false })
    // 恢复速度档位（兼容旧版数字毫秒值）
    var lvl = this._cfg.autoSpeedLevel
    if (typeof lvl !== 'number') {
      var oldMs = this._cfg.autoSpeed
      if (typeof oldMs === 'number') lvl = oldMs >= 700 ? 0 : (oldMs >= 375 ? 1 : 2)
      else lvl = 0
    }
    if (lvl < 0) lvl = 0
    if (lvl > 2) lvl = 2
    this.setData({ autoSpeedLevel: lvl, autoSpeedText: SPEED_LABELS[lvl] })
    this._refresh()
    this._initAudio()
    setTimeout(function () { self._initFishCanvas() }, 300)
    self._recordDaily()
  },

  onHide: function () {
    this._stopAuto()
    if (this._rippleRAF) { clearTimeout(this._rippleRAF); this._rippleRAF = null }
    this._ripples = []
    this.setData({ floatList: [] })
  },
  onUnload: function () {
    this._stopAuto()
    if (this._knockRAF) { clearTimeout(this._knockRAF); this._knockRAF = null }
    if (this._rippleRAF) { clearTimeout(this._rippleRAF); this._rippleRAF = null }
    this._ripples = []
    this.setData({ floatList: [] })
    this._stopNoise(true)
    if (this._audioCtx) { try { this._audioCtx.close() } catch (e) {}; this._audioCtx = null }
  },

  onShareAppMessage: function () {
    return { title: '快来增加你的运势！我已攒了' + this.data.merit + '点财运 💰', path: '/pages/wooden-fish/wooden-fish' }
  },
  onShareTimeline: function () {
    return { title: '快来增加你的运势！我已攒了' + this.data.merit + '点财运 💰', query: '' }
  },

  /* ═══ 初始化木鱼canvas ═══ */
  _initFishCanvas: function () {
    var self = this
    wx.createSelectorQuery().select('#fishCVS').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return
      var cvs = res[0].node
      var ctx = cvs.getContext('2d')
      var dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      self._cvsW = res[0].width * dpr
      self._cvsH = res[0].height * dpr
      cvs.width = self._cvsW
      cvs.height = self._cvsH
      ctx.scale(dpr, dpr)
      self._fishCvs = cvs
      self._fishCtx = ctx
      self._drawFish()
    })
  },

  /* ═══ 绘制木鱼（V18：严格对齐木鱼.png · 不对称水滴形+粗斜缝）═══ */
  _drawFish: function () {
    if (!this._fishCtx) return
    var ctx = this._fishCtx
    var dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
    var W = this._cvsW / dpr
    var H = this._cvsH / dpr
    var _now = Date.now()

    ctx.clearRect(0, 0, W, H)

    var cx = W / 2
    var cy = H / 2
    /* 缩放：让木鱼占画布的78% */
    var sc = Math.min(W, H) * 0.78 / 220

    ctx.save()
    ctx.translate(cx, cy + 18)
    ctx.scale(sc, sc)

    // ── 阴影底托 ──
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    ctx.beginPath()
    ctx.ellipse(0, 80, 100, 20, 0, 0, Math.PI * 2)
    ctx.fill()

    // ══ 敲击波纹 ═══
    for (var _ri = 0; _ri < this._ripples.length; _ri++) {
      var _rrp = (_now - this._ripples[_ri].born) / 900
      if (_rrp < 0 || _rrp >= 1) continue
      for (var _rs = 0; _rs < 3; _rs++) {
        var _rp2 = _rrp - _rs * 0.15
        if (_rp2 <= 0 || _rp2 >= 1) continue
        var _rad = 90 + _rp2 * 110
        ctx.save()
        ctx.globalAlpha = (1 - _rp2) * 0.45
        ctx.strokeStyle = '#BEB9B0'
        ctx.lineWidth = 2.0 / sc
        ctx.beginPath()
        ctx.ellipse(0, 60, _rad, _rad * 0.40, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }

    // ══ ① 元宝身（V26·金元宝/银锭形状）══
    // ★ 参考图特征：
    //   · 横卧元宝/银锭造型（不是叶子形！）
    //   · 两端上翘（左翼 + 右翼如船头）
    //   · 中间略凹（元宝腰部）
    //   · 底部平缓圆弧
    //   · 宽高比 ≈ 1.8:1
    ctx.beginPath()
    ctx.moveTo(-120, -8)                               // 左翼尖端起始
    ctx.bezierCurveTo(-105, -38, -60, -48, 0, -46)     // 左翼上翘弧→顶部中心
    ctx.bezierCurveTo(60, -48, 105, -38, 120, -8)      // 右翼上翘弧→右翼尖端
    ctx.bezierCurveTo(130, 12, 125, 32, 110, 50)        // 右翼下收
    ctx.bezierCurveTo(70, 68, -70, 68, -110, 50)       // 底部大圆弧（连接两翼）
    ctx.bezierCurveTo(-125, 32, -130, 12, -120, -8)    // 左翼下收回起点
    ctx.closePath()

    /* 纯白填充（参考图为纯白色调）*/
    var bodyGrad = ctx.createLinearGradient(0, -68, 0, 80)
    bodyGrad.addColorStop(0, '#FAFAFA')
    bodyGrad.addColorStop(0.5, '#F5F3EF')
    bodyGrad.addColorStop(1, '#EDEAE4')
    ctx.fillStyle = bodyGrad
    ctx.fill()

    /* 外轮廓描边（浅灰细线）*/
    ctx.strokeStyle = '#BEBAB4'
    ctx.lineWidth = 1.8 / sc
    ctx.stroke()

    // ══ ② 元宝中缝（粗·斜·左上→右下·居中偏上）══
    ctx.strokeStyle = '#2A2622'
    ctx.lineWidth = 8 / sc
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-36, -6)                              // 起点：中上部偏左
    ctx.quadraticCurveTo(0, 10, 44, 18)             // 弧向右下
    ctx.stroke()

    // ══ ③ 木鱼棒（以握把为支点：30°倾斜·举高→猛砸→回弹）══
    if (this.data.showStick) {
      ctx.save()
      var rot = this._knockRot || 0
      var L = 156
      ctx.translate(163, -152)
      ctx.rotate(-0.52 + rot)

      var stickGrad = ctx.createLinearGradient(-L, -12, 0, 12)
      stickGrad.addColorStop(0, '#EDE9E3')
      stickGrad.addColorStop(0.5, '#EDE9E3')
      stickGrad.addColorStop(1, '#D0CCC6')
      ctx.fillStyle = stickGrad
      roundRect(ctx, -L, -12, L, 24, 12)
      ctx.fill()
      ctx.strokeStyle = '#AAA69E'
      ctx.lineWidth = 1.4 / sc
      ctx.stroke()

      ctx.fillStyle = '#EDE9E3'
      ctx.strokeStyle = '#9A9690'
      ctx.lineWidth = 2.4 / sc
      ctx.beginPath()
      ctx.arc(-L, 0, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.beginPath()
      ctx.arc(-L - 9, -9, 10, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }

    // ══ 整体铅笔阴影（适配 V26 元宝形）══
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'
    ctx.lineWidth = 8 / sc
    ctx.beginPath()
    ctx.moveTo(-105, 28)
    ctx.quadraticCurveTo(-60, 58, 0, 62)
    ctx.quadraticCurveTo(60, 58, 105, 28)
    ctx.stroke()

    ctx.restore()
    /* 注意：+1飘字已改为 DOM 方式绘制，不再在 canvas 内绘制 */
  },

  /* ═══ 木棒旋转补间（setTimeout 驱动，约 320ms：举高→猛砸→回弹）═══ */
  _animateStick: function () {
    var self = this
    if (!this._fishCtx) return
    if (this._knockRAF) { clearTimeout(this._knockRAF); this._knockRAF = null }
    this._knockStart = Date.now()
    var dur = 320
    var easeOut = function (p) { return 1 - Math.pow(1 - p, 2) }
    var step = function () {
      var el = Date.now() - self._knockStart
      var t = Math.min(el / dur, 1)
      var rot
      if (t < 0.22) {
        rot = 0.55 * easeOut(t / 0.22)
      } else if (t < 0.45) {
        var p2 = (t - 0.22) / 0.23
        rot = 0.55 * (1 - p2) + (-0.12) * p2
      } else {
        rot = (-0.12) * (1 - easeOut((t - 0.45) / 0.55))
      }
      self._knockRot = rot
      self._drawFish()
      if (t < 1) self._knockRAF = setTimeout(step, 16)
      else { self._knockRAF = null; self._knockRot = 0; self._drawFish() }
    }
    this._knockRAF = setTimeout(step, 16)
  },

  /* 音频 resume（首次手势后调用，确保 WebAudio 可出声）*/
  _resumeAudio: function () {
    try { if (this._audioCtx && this._audioCtx.state === 'suspended') this._audioCtx.resume() } catch (e) {}
  },

  /* ═══ 数据刷新 ═══ */
  _refresh: function () {
    var m = S.getWoodFishMerit()
    var td = S.getWoodFishToday()
    var ds = S.getWoodFishDates()
    this.setData({ merit: m, todayCount: td.count, streakDays: this._calcStreak(ds) })
    this._evalFortune(false)
  },

  /* ═══ 每日一签状态计算 ═══ */
  _evalFortune: function (toast) {
    var N = (this._cfg && this._cfg.fortuneN) || 30
    var tc = this.data.todayCount
    var unlocked = tc >= N
    var patch = { fortuneN: N, fortuneUnlocked: unlocked, fortuneRemain: Math.max(0, N - tc) }
    if (unlocked) patch.fortuneQuote = Q.getDailyQuote()
    if (toast && unlocked && !this._fortuneWasUnlocked) {
      wx.showToast({ title: '今日运势已解锁 ✨', icon: 'none' })
    }
    this._fortuneWasUnlocked = unlocked
    this.setData(patch)
  },

  _calcStreak: function (d) {
    if (!d || !d.length) return 0
    var s = 1, c = 1
    for (var i = d.length - 1; i > 0; i--) {
      if (this._dayDiff(d[i - 1], d[i]) === 1) { c++; s = Math.max(s, c) }
      else break
    }
    return s
  },
  _dayDiff: function (a, b) {
    return Math.round(
      (new Date(b.replace(/\-/g, '/')) - new Date(a.replace(/\-/g, '/'))) / 86400000
    )
  },
  _todayStr: function () {
    var d = new Date()
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
  },

  /* ═══ 敲击核心 ═══ */
  onTapFish: function () { this._resumeAudio(); this._hit() },

  _hit: function () {
    var self = this
    var nm = S.addWoodFishMerit(1)
    var tc = S.incWoodFishToday()
    this.setData({ merit: nm, todayCount: tc })

    this._animateStick()
    this._spawnRipple()
    this._spawnFloatDOM()          // ★ DOM 飞字（替代 canvas 内绘制）
    this._playKnock()
    this._evalFortune(true)
    this._recordDaily()            // 记录每日战绩
  },

  /* ═══ 音效（WebAudioContext 三振荡器合成）═══ */
  _initAudio: function () {
    try {
      if (!this._audioCtx && wx.createWebAudioContext) {
        this._audioCtx = wx.createWebAudioContext()
      }
    } catch (e) {}
  },

  _playKnock: function () {
    if (this._audioCtx) {
      try {
        var ctx = this._audioCtx, now = ctx.currentTime

        var o1 = ctx.createOscillator(), g1 = ctx.createGain()
        o1.type = 'sine'; o1.frequency.setValueAtTime(380, now)
        o1.frequency.exponentialRampToValueAtTime(180, now + 0.12)
        g1.gain.setValueAtTime(0.5, now); g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        o1.connect(g1); g1.connect(ctx.destination)
        o1.start(now); o1.stop(now + 0.16)

        var o2 = ctx.createOscillator(), g2 = ctx.createGain()
        o2.type = 'sine'; o2.frequency.setValueAtTime(920, now)
        g2.gain.setValueAtTime(0.18, now); g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
        o2.connect(g2); g2.connect(ctx.destination)
        o2.start(now); o2.stop(now + 0.09)

        var o3 = ctx.createOscillator(), g3 = ctx.createGain()
        o3.type = 'sine'; o3.frequency.setValueAtTime(160, now)
        g3.gain.setValueAtTime(0.25, now); g3.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
        o3.connect(g3); g3.connect(ctx.destination)
        o3.start(now); o3.stop(now + 0.19)
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
      sr: 8000, dur: 0.13,
      sample: function (t) {
        var env = Math.exp(-t * 30)
        var s = (Math.sin(2 * Math.PI * 380 * t) * 0.7
          + Math.sin(2 * Math.PI * 920 * t) * 0.22
          + Math.sin(2 * Math.PI * 160 * t) * 0.15) * env
        s = s > 0 ? Math.pow(s, 0.88) : -Math.pow(-s, 0.88)
        return Math.max(0, Math.min(255, Math.floor(128 + s * 118)))
      }
    })
  },

  /* ═══ 白噪音伴侣（WebAudio 合成雨/风，循环背景音）═══ */
  _initNoise: function () {
    if (this._noiseBuf || !this._audioCtx) return
    try {
      var ctx = this._audioCtx
      var len = Math.floor(ctx.sampleRate * 2)
      var buf = ctx.createBuffer(1, len, ctx.sampleRate)
      var d = buf.getChannelData(0)
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this._noiseBuf = buf
    } catch (e) { this._noiseBuf = null }
  },

  _startNoise: function (type) {
    if (!this._audioCtx) { wx.showToast({ title: '当前环境不支持背景音', icon: 'none' }); return }
    this._resumeAudio(); this._initNoise()
    if (!this._noiseBuf) return
    try {
      var ctx = this._audioCtx
      this._stopNoise(true)
      var src = ctx.createBufferSource()
      src.buffer = this._noiseBuf; src.loop = true
      var gain = ctx.createGain(); gain.gain.value = VOL_LEVELS[this.data.noiseVolLevel || 0]
      var filter = ctx.createBiquadFilter()
      if (type === 'rain') {
        filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.6
      } else {
        filter.type = 'lowpass'; filter.frequency.value = 500
        var lfo = ctx.createOscillator(); var lfoGain = ctx.createGain()
        lfo.frequency.value = 0.15; lfoGain.gain.value = 250
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start()
        this._bgLfo = lfo
      }
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      src.start()
      this._bgSrc = src; this._bgGain = gain; this._bgType = type
    } catch (e) {}
  },

  _stopNoise: function (silent) {
    try { if (this._bgSrc) { this._bgSrc.stop(); this._bgSrc.disconnect(); this._bgSrc = null } } catch (e) {}
    try { if (this._bgLfo) { this._bgLfo.stop(); this._bgLfo.disconnect(); this._bgLfo = null } } catch (e) {}
    this._bgGain = null; this._bgType = null
    if (!silent) this.setData({ noiseState: 'off' })
  },

  toggleNoise: function () {
    var order = ['off', 'rain', 'wind']
    var cur = this.data.noiseState || 'off'
    var next = order[(order.indexOf(cur) + 1) % 3]
    if (next === 'off') { this._stopNoise(); this.setData({ noiseState: 'off', showNoiseVol: false }) }
    else { this._startNoise(next); this.setData({ noiseState: next, showNoiseVol: true }); this._autoHideVol() }
  },

  _autoHideVol: function () {
    this._clearVolTimer()
    var self = this
    self._volTimer = setTimeout(function () {
      self.setData({ showNoiseVol: false })
      self._volTimer = null
    }, 1500)
  },
  _clearVolTimer: function () {
    if (this._volTimer) { clearTimeout(this._volTimer); this._volTimer = null }
  },

  onNoiseVol: function (e) {
    var lv = Math.round(Number(e.detail.value))
    if (lv < 0) lv = 0
    if (lv > 2) lv = 2
    var v = VOL_LEVELS[lv]
    this.setData({ noiseVolLevel: lv, noiseVolText: VOL_LABELS[lv], showNoiseVol: true })
    if (this._bgGain) { try { this._bgGain.gain.value = v } catch (err) {} }
    this._clearVolTimer()
    var self = this
    self._volTimer = setTimeout(function () {
      self.setData({ showNoiseVol: false })
      self._volTimer = null
    }, 1500)
  },

  /* ═══ +1 飘字（V19：DOM 放射扇形·飞到运势横幅区域停住淡出）═══ */
  _spawnFloatDOM: function () {
    var id = ++this._fid
    // ★ 放射扇形：每个+1 沿不同角度向上方扇形飘出（屏幕坐标系 Y 轴向下，故用负角度）
    var _PI = Math.PI
    var angBase = -_PI * 0.55   // ~-100°（偏左上方起始角，负值=往上）
    var angRange = _PI * 0.50   // ~90° 扇形范围 → 覆盖到 ~-10°（上半平面全覆盖）
    var ang = angBase + (id * 0.618034 % 1) * angRange

    // 飞行距离（终点落在运势横幅区域），各有差异让扇形更自然
    var dist = 220 + (id % 5) * 16     // 220~284rpx
    var endX = Math.round(Math.cos(ang) * dist)   // 横向偏移
    var endY = Math.round(Math.sin(ang) * dist)   // 向上偏移

    var duration = 1200 + (id % 4) * 100         // 1200~1500ms

    var item = { id: id, endX: endX, endY: endY, duration: duration }

    var list = this.data.floatList.slice()
    list.push(item)
    if (list.length > 12) list = list.slice(-12)
    this.setData({ floatList: list })

    var self = this
    setTimeout(function () {
      var current = self.data.floatList.filter(function (f) { return f.id !== id })
      self.setData({ floatList: current })
    }, duration + 50)
  },

  /* ═══ 敲击波纹（canvas 内绘制：从木鱼底部中心向四周扩散）═══ */
  _spawnRipple: function () {
    this._ripples.push({ born: Date.now() })
    if (this._ripples.length > 6) this._ripples = this._ripples.slice(-6)
    this._ensureRippleTicker()
  },

  _ensureRippleTicker: function () {
    if (this._rippleRAF) return
    var self = this
    var tick = function () {
      var now = Date.now()
      self._ripples = self._ripples.filter(function (r) { return now - r.born < 760 })
      self._drawFish()
      if (self._ripples.length > 0) self._rippleRAF = setTimeout(tick, 16)
      else self._rippleRAF = null
    }
    this._rippleRAF = setTimeout(tick, 16)
  },

  /* ═══ 自动模式 ═══ */
  toggleAuto: function () {
    if (this.data.autoRunning) { this._stopAuto() }
    else { this._startAuto() }
  },
  _startAuto: function () {
    var lv = (this._cfg && typeof this._cfg.autoSpeedLevel === 'number') ? this._cfg.autoSpeedLevel : (this.data.autoSpeedLevel || 0)
    var sp = SPEED_LEVELS[lv]
    this.setData({ autoRunning: true, autoSpeedLevel: lv, autoSpeedText: SPEED_LABELS[lv], showAutoSpeedSlider: true })
    this._resumeAudio()
    var self = this
    this._autoTimer = setInterval(function () { self._hit() }, sp)
    // ★ 启动后 3 秒自动收起速度滑杆（用户不操作也自动隐藏）
    this._clearVolTimer()
    self._volTimer = setTimeout(function () {
      if (!self.data || !self.data.autoRunning) return
      self.setData({ showAutoSpeedSlider: false })
      self._volTimer = null
    }, 3000)
  },
  _stopAuto: function () {
    if (this._autoTimer) { clearInterval(this._autoTimer); this._autoTimer = null }
    if (this.data.autoRunning) this.setData({ autoRunning: false, showAutoSpeedSlider: false })
  },

  /* ═══ 自动速度调节 ═══ */
  onAutoSpeed: function (e) {
    var lv = Math.round(Number(e.detail.value))
    if (lv < 0) lv = 0
    if (lv > 2) lv = 2
    var v = SPEED_LEVELS[lv]
    this.setData({ autoSpeedLevel: lv, autoSpeedText: SPEED_LABELS[lv] })
    var c = S.getWoodFishSettings(); c.autoSpeedLevel = lv; S.setWoodFishSettings(c); this._cfg = c
    if (this.data.autoRunning && this._autoTimer) {
      clearInterval(this._autoTimer)
      var self = this
      this._autoTimer = setInterval(function () { self._hit() }, v)
    }
    this._clearVolTimer()
    var self = this
    self._volTimer = setTimeout(function () {
      if (!self.data.autoRunning) return
      self.setData({ showAutoSpeedSlider: false })
      self._volTimer = null
    }, 3000)
  },

  /* ═══ 木鱼棒显隐 ═══ */
  toggleStick: function () {
    var ns = !this.data.showStick
    this.setData({ showStick: ns })
    var c = S.getWoodFishSettings(); c.showStick = ns; S.setWoodFishSettings(c); this._cfg = c
    this._drawFish()
  },

  /* ═══ 更多菜单 ═══ */
  onMore: function () {
    var self = this
    wx.showActionSheet({
      itemList: ['我的战绩', '历史战绩'],
      success: function (r) {
        if (r.tapIndex === 0) self._shareCard()
        else if (r.tapIndex === 1) wx.navigateTo({ url: '/pages/wooden-fish/history' })
      }
    })
  },

  /* ═══ 分享卡片（朋友圈规格 + 真实小程序码图片）═══ */
  _shareCard: function () {
    var self = this
    wx.showLoading({ title: '生成中…', mask: true })
    setTimeout(function () { self._loadQRAndDraw() }, 200)
  },

  /* 加载小程序码图片（与 share-card 同模式：createImage 加载静态资源）*/
  _loadQRAndDraw: function () {
    var self = this
    wx.createSelectorQuery().select('#shareCVS').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        wx.hideLoading(); wx.showToast({ title: '画布失败', icon: 'none' }); return
      }
      var cvs = res[0].node

      // ★ 与 share-card 一致的方式加载真实小程序码图片
      var img = cvs.createImage()
      img.onload = function () {
        self._qrImage = img
        self._doDrawShare(cvs)
      }
      img.onerror = function () {
        console.warn('加载小程序码失败，继续绘制（无码）')
        self._qrImage = null
        self._doDrawShare(cvs)
      }
      img.src = '/images/qrcode.jpg'
    })
  },

  _doDrawShare: function (cvs) {
    var self = this
    var ctx = cvs.getContext('2d')
    var dpr = wx.getSystemInfoSync().pixelRatio || 2

    // 获取实际尺寸
    wx.createSelectorQuery().select('#shareCVS').fields({ size: true }).exec(function (res2) {
      if (!res2 || !res2[0]) { wx.hideLoading(); return }
      var W = res2[0].width
      var H = res2[0].height
      cvs.width = W * dpr
      cvs.height = H * dpr
      ctx.scale(dpr, dpr)

      // ═══ V26 素雅风格分享卡 ═══

      // ── 1. 背景（素雅暖杏色渐变·代替艳橙红）──
      var bgGrad = ctx.createLinearGradient(0, 0, W, H)
      bgGrad.addColorStop(0, '#F2E6D9')
      bgGrad.addColorStop(1, '#E2D4C4')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, W, H)

      // ── 2. 装饰光晕（素雅低透明度）──
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath(); ctx.arc(W * 0.85, H * 0.12, W * 0.16, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(W * 0.12, H * 0.82, W * 0.12, 0, Math.PI * 2); ctx.fill()

      // ── 3. 白色内容卡片（圆角加大·更柔和）──
      var contentTop = H * 0.08
      var contentH = H * 0.78
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      roundRect(ctx, W * 0.05, contentTop, W * 0.90, contentH, W * 0.05)
      ctx.fill()

      // ── 4. 图标+名称（素雅金棕色）──
      ctx.font = 'bold ' + Math.round(W * 0.052) + 'px sans-serif'
      ctx.fillStyle = '#B08D6E'; ctx.textAlign = 'center'
      ctx.fillText('💰 赛博木鱼', W / 2, H * 0.17)

      // ── 5. 钩子标语（深灰·不刺眼）──
      ctx.font = 'bold ' + Math.round(W * 0.06) + 'px sans-serif'
      ctx.fillStyle = '#4A4A4A'
      wrapText(ctx, '快来增加你的运势！', W / 2, H * 0.26, W * 0.78, W * 0.065)

      // ── 6. 财运数字（素雅金棕渐变）──
      var numGrad = ctx.createLinearGradient(W * 0.25, H * 0.32, W * 0.75, H * 0.46)
      numGrad.addColorStop(0, '#C49A6C'); numGrad.addColorStop(1, '#A67B4B')
      ctx.font = 'bold ' + Math.round(W * 0.26) + 'px sans-serif'
      ctx.fillStyle = numGrad; ctx.textAlign = 'center'
      ctx.fillText(String(self.data.merit), W / 2, H * 0.42)
      ctx.font = '' + Math.round(W * 0.05) + 'px sans-serif'
      ctx.fillStyle = '#999999'
      ctx.fillText('点财运', W / 2, H * 0.485)

      // ── 7. 统计信息 ──
      ctx.font = Math.round(W * 0.038) + 'px sans-serif'
      ctx.fillStyle = '#AAAAAA'; ctx.textAlign = 'center'
      ctx.fillText('今日敲击 ' + self.data.todayCount + ' 次 · 连续 ' + self.data.streakDays + ' 天', W / 2, H * 0.55)

      // 分隔线
      ctx.strokeStyle = '#EEE8E0'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(W * 0.18, H * 0.60); ctx.lineTo(W * 0.82, H * 0.60); ctx.stroke()

      // ── 8. 每日签语文案 ──
      var dailyQuote = ''
      try { dailyQuote = Q.getDailyQuote() || '' } catch (e) { dailyQuote = '' }
      if (!dailyQuote) {
        var fbQ = ['每一次敲击，财运滚滚来','一念清净，当下即是道场','念念不忘，必有回响','日拱一卒，功不唐捐']
        dailyQuote = fbQ[self.data.merit % fbQ.length]
      }
      ctx.font = Math.round(W * 0.04) + 'px sans-serif'
      ctx.fillStyle = '#888888'; ctx.textAlign = 'center'
      wrapText(ctx, '"' + dailyQuote + '"', W / 2, H * 0.67, W * 0.72, Math.round(W * 0.052))

      // ── 9. 小程序码（★ 卡片外部·背景区底部居中 · 绝对不遮挡任何文案）──
      if (self._qrImage) {
        var qrSize = W * 0.18
        var qrX = (W - qrSize) / 2                        // 水平居中
        var qrY = contentTop + contentH + W * 0.04         // ★ 卡片下方（背景区），不进卡片
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        roundRect(ctx, qrX - W * 0.02, qrY - W * 0.02, qrSize + W * 0.04, qrSize + W * 0.04, W * 0.03)
        ctx.fill()
        ctx.drawImage(self._qrImage, qrX, qrY, qrSize, qrSize)
        ctx.font = Math.round(W * 0.024) + 'px sans-serif'
        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
        ctx.fillText('扫码体验', W / 2, qrY + qrSize + W * 0.04)
      }

      // ── 10. 底部品牌 ──
      ctx.font = Math.round(W * 0.03) + 'px sans-serif'
      ctx.fillStyle = '#CCCCCC'; ctx.textAlign = 'center'
      ctx.fillText('— 舔狗助手 —', W / 2, H * 0.94)

      // ── 输出图片：直接保存到相册（带权限处理）──
      setTimeout(function () {
        wx.canvasToTempFilePath({
          canvas: cvs,
          fileType: 'png', quality: 1,
          success: function (r2) {
            wx.hideLoading()
            self._saveToAlbum(r2.tempFilePath)
          },
          fail: function () { wx.hideLoading(); wx.showToast({ title: '生成失败', icon: 'none' }) }
        })
      }, 200)
    })
  },

  /* ── 保存到相册（V29.5·直接保存+权限处理）── */
  _saveToAlbum: function (path) {
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: function () {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: function (err) {
        if (err && /auth|deny|scope/i.test(err.errMsg || '')) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存图片需要您授权访问相册，是否前往设置开启？',
            confirmText: '去设置',
            success: function (m) {
              if (m.confirm) wx.openSetting()
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  /* ═══ 每日战绩记录（供历史战绩页读取）═══ */
  _recordDaily: function () {
    // 每次敲击更新当日记录到日志
    try {
      var today = this._todayStr()
      var log = wx.getStorageSync('wf_daily_log') || {}
      log[today] = this.data.todayCount || 1
      wx.setStorageSync('wf_daily_log', log)
    } catch (e) {}
  },
})
