// components/lottery-wheel/lottery-wheel.js — 抽签动画
//   idle    = 纯静态马赛克（有间隙，不动）     → 按钮「开始抽签」
//   forming = 马赛克→球体形变（~700ms）
//   spinning= 高速旋转球体（卡片有间隙）        → 按钮「抽取幸运儿」
//   stopping= 减速停稳 → 撒花 → drawEnd
//   paused  = 暂停渲染（结果弹窗时隐藏canvas）

Component({
  properties: {
    people: { type: Array, value: [] },
    width: { type: Number, value: 600 },
    height: { type: Number, value: 500 },
    paused: { type: Boolean, value: false }
  },

  data: {
    state: 'idle'
  },

  lifetimes: {
    ready: function () {
      this._ctx = null
      this._canvas = null
      this._w = 600
      this._h = 500
      this._running = false
      this._gen = 0

      this._tiles = []
      this._cards = []
      this._stars = []
      this._confetti = []

      this._phase = 'idle'
      this._phaseT0 = 0
      this._breathPhase = 0
      this._rotY = 0
      this._rotX = 0.28
      this._spinSpeed = 0
      this._formProg = 0

      this._initCanvas()
    },

    detached: function () {
      this._running = false
      this._gen++
    }
  },

  observers: {
    'people, width, height': function () {
      if (this._ctx) {
        this._buildTiles()
        this._buildCards()
        this._buildStars()
        this._render()
      }
    }
  },

  pageLifetimes: {
    show: function () { if (this._canvas) this._startLoop() },
    hide: function () { this._running = false; this._gen++ }
  },

  methods: {
    /* ===== Canvas 初始化 ===== */
    _initCanvas: function () {
      var that = this
      var q = this.createSelectorQuery()
      q.select('#wheelCanvas').fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) return
        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var dpr = 2
        try { dpr = wx.getSystemInfoSync().pixelRatio || 2 } catch (e) {}
        var w = that.properties.width
        var h = that.properties.height
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        that._canvas = canvas
        that._ctx = ctx
        that._w = w
        that._h = h
        that._cx = w / 2
        that._cy = h / 2 + 10
        that._buildTiles()
        that._buildCards()
        that._buildStars()
        that._render()
        that._startLoop()
      })
    },

    _startLoop: function () {
      if (!this._canvas) return
      this._gen = (this._gen || 0) + 1
      var myGen = this._gen
      this._running = true
      var that = this
      var loop = function () {
        if (!that._running || myGen !== that._gen) return
        that._update()
        that._render()
        that._canvas.requestAnimationFrame(loop)
      }
      this._canvas.requestAnimationFrame(loop)
    },

    /* ===== 构建平面马赛克格子（有间隙的圆形排列） ===== */
    _buildTiles: function () {
      var people = this.properties.people || []
      var palette = ['#FF6B9D', '#A78BFA', '#5B8DEF', '#FFB347', '#6ECBF5', '#F472B6', '#34D399', '#FBBF24',
                     '#E879F9', '#FB923C', '#22D3EE', '#A3E635']
      var w = this._w, h = this._h
      var cx = this._cx || (w / 2)
      var cy = this._cy || (h / 2 + 10)
      var R = Math.min(w, h) * 0.36
      // 更大间隙：格子小一点，间距大一点
      var cellSize = 30, gap = 8
      var cols = Math.ceil(w / (cellSize + gap))
      var rows = Math.ceil(h / (cellSize + gap))
      var tiles = []

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var tx = c * (cellSize + gap) + cellSize / 2
          var ty = r * (cellSize + gap) + cellSize / 2
          var dx = tx - cx, dy = ty - cy
          var dist = Math.sqrt(dx * dx + dy * dy)
          if (dist > R + cellSize * 0.2) continue

          var angle = Math.atan2(dy, dx)
          var band = Math.floor(dist / (R / 4))
          var sector = Math.floor((angle + Math.PI) / (Math.PI / 2))
          var pIdx = (band * 4 + sector) % Math.max(people.length, 1)
          var person = people[pIdx]
          var color = person ? person.color : palette[Math.abs(band * 7 + sector) % palette.length]

          var alpha = dist > R * 0.88 ? Math.max(0.08, 1 - (dist - R * 0.88) / (cellSize * 0.30)) : 1
          var rot = ((r * 7 + c * 13) % 7 - 3) * 4

          var phi = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (dist / R))))
          var theta = angle
          var sr = R * 0.82

          tiles.push({
            x: tx, y: ty,
            size: cellSize,
            color: color,
            alpha: alpha,
            rot: rot,
            sx: sr * Math.sin(phi) * Math.cos(theta),
            sy: sr * Math.cos(phi),
            sz: sr * Math.sin(phi) * Math.sin(theta),
            breathOff: (r * 3 + c * 7) * 0.4
          })
        }
      }
      this._tiles = tiles
    },

    /* ===== 构建3D球卡片 ===== */
    _buildCards: function () {
      var people = this.properties.people || []
      var cards = []
      var n = Math.max(people.length * 12, 60)
      var R = Math.min(this._w, this._h) * 0.30
      var golden = (1 + Math.sqrt(5)) / 2
      var palette = ['#FF6B9D', '#A78BFA', '#5B8DEF', '#FFB347', '#6ECBF5', '#F472B6', '#34D399', '#FBBF24']

      for (var i = 0; i < n; i++) {
        var y = 1 - (i / (n - 1)) * 2
        var radiusAtY = Math.sqrt(Math.max(0.1, 1 - y * y))
        var theta = 2 * Math.PI * i / golden
        var pi = people[i % people.length]
        cards.push({
          color: pi ? pi.color : palette[i % palette.length],
          x: Math.cos(theta) * radiusAtY * R,
          y: y * R,
          z: Math.sin(theta) * radiusAtY * R,
          breathOff: i * 0.37
        })
      }

      // 把球面坐标同步到 tiles 的 sx/sy/sz
      if (this._tiles.length && cards.length) {
        for (var ti = 0; ti < this._tiles.length; ti++) {
          var card = cards[ti % cards.length]
          this._tiles[ti].cardColor = card.color
          this._tiles[ti].sx = card.x
          this._tiles[ti].sy = card.y
          this._tiles[ti].sz = card.z
        }
      }

      this._cards = cards
    },

    _buildStars: function () {
      var stars = []
      var cx = this._cx || (this._w / 2)
      var cy = this._cy || (this._h / 2 + 10)
      var R = Math.min(this._w, this._h) * 0.42
      for (var i = 0; i < 50; i++) {
        var ang = Math.random() * Math.PI * 2
        var rr = R * 0.45 + Math.random() * R * 0.55
        stars.push({
          x: cx + Math.cos(ang) * rr,
          y: cy + Math.sin(ang) * rr,
          size: 1.2 + Math.random() * 2.2,
          alpha: 0.12 + Math.random() * 0.30,
          twinkle: Math.random() * Math.PI * 2,
          color: ['#FFD166', '#FF6B9D', '#6ECBF5', '#A78BFA'][Math.floor(Math.random() * 4)]
        })
      }
      this._stars = stars
    },

    /* ===== 公开 API ===== */

    /** 开始抽签：马赛克→球体形变 → 高速旋转 */
    startDraw: function (winnerIds, revealInfo) {
      if (this._phase === 'spinning' || this._phase === 'stopping' || this._phase === 'forming') return
      this._winnerIds = winnerIds || []
      this._revealInfo = revealInfo || {}
      this._phase = 'forming'
      this._phaseT0 = Date.now()
      this._formProg = 0
      this._spinSpeed = 0.22  // spinning 起始高速
      this.triggerEvent('drawStart')
      this._setState('forming')
    },

    /** 触发揭晓：减速 → 停稳 → 撒花 */
    triggerReveal: function () {
      if (this._phase !== 'spinning' && this._phase !== 'forming') return
      this._phase = 'stopping'
      this._formProg = 1
      this._phaseT0 = Date.now()
      this._setState('stopping')
    },

    reset: function () {
      this._phase = 'idle'
      this._formProg = 0
      this._spinSpeed = 0
      this._rotY = 0
      this._confetti = []
      this._winnerIds = []
      this._revealInfo = {}
      this._setState('idle')
    },

    _setState: function (s) {
      this._phase = s
      this.setData({ state: s })
      this.triggerEvent('stateChange', { state: s })
    },

    /* ===== 每帧更新 ===== */
    _update: function () {
      var phase = this._phase

      // === idle：完全静止，纯马赛克（不呼吸、不旋转、不过渡）===
      if (phase === 'idle') {
        return
      }

      var now = Date.now()
      this._breathPhase += 0.04

      // 星点闪烁
      for (var si = 0; si < this._stars.length; si++) {
        this._stars[si].twinkle += 0.025
      }

      var t = now - this._phaseT0

      // === forming：马赛克→球体（700ms）===
      if (phase === 'forming') {
        var prog = t / 700
        if (prog >= 1) {
          this._formProg = 1
          this._phase = 'spinning'
          this._phaseT0 = Date.now()
          // ★ 关键修复：通知主页进入spinning阶段（否则主页drawPhase永远停在forming）
          this._setState('spinning')
        } else {
          var ease = prog < 0.5 ? 4 * prog * prog * prog : 1 - Math.pow(-2 * prog + 2, 3) / 2
          this._formProg = ease
        }
        // 形变过程中就开始转
        this._rotY += 0.06
        return
      }

      // === spinning：高速旋转 ===
      if (phase === 'spinning') {
        // 保持高速（起始就是0.25，微调波动）
        var wave = Math.sin(t * 0.003) * 0.08
        this._spinSpeed = 0.22 + wave
        this._rotY += this._spinSpeed
        this._rotX = 0.28 + Math.sin(t * 0.0015) * 0.10
        return
      }

      // === stopping：指数衰减减速 ===
      if (phase === 'stopping') {
        this._spinSpeed *= 0.958
        this._rotY += this._spinSpeed
        if (t >= 1800 || this._spinSpeed < 0.003) {
          this._phase = 'confetti'
          this._phaseT0 = Date.now()
          this._setState('confetti')
          this._burstConfetti()
        }
        return
      }

      // === confetti：撒花展示（先撒花 ~1.2s，再通知主页弹结果）===
      if (phase === 'confetti') {
        this._spinSpeed *= 0.90
        this._rotY += this._spinSpeed
        var ct = now - this._phaseT0
        // 撒花物理
        if (this._confetti.length) {
          var alive2 = false
          for (var c2 = 0; c2 < this._confetti.length; c2++) {
            var pc = this._confetti[c2]
            pc.x += pc.vx; pc.y += pc.vy; pc.vy += 0.09; pc.rot += pc.rv; pc.life -= 0.0055
            if (pc.life > 0) alive2 = true
          }
          if (!alive2) this._confetti = []
        }
        if (ct >= 1200) {
          this._phase = 'done'
          this._setState('done')
          this.triggerEvent('drawEnd')
        }
        return
      }

      // === done：撒花物理（兜底更新）===
      if (this._confetti.length) {
        var alive = false
        for (var j = 0; j < this._confetti.length; j++) {
          var p = this._confetti[j]
          p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.rot += p.rv; p.life -= 0.0055
          if (p.life > 0) alive = true
        }
        if (!alive) this._confetti = []
      }
    },

    /* ===== 渲染主函数 ===== */
    _render: function () {
      var ctx = this._ctx
      if (!ctx) return
      // paused（结果弹窗）：清空画布，避免原生 canvas（忽略 z-index）覆盖弹窗
      if (this.properties.paused) {
        ctx.clearRect(0, 0, this._w, this._h)
        return
      }
      var w = this._w, h = this._h
      var cx = this._cx || (w / 2)
      var cy = this._cy || (h / 2 + 10)

      // 背景
      ctx.fillStyle = '#FFF8F0'
      ctx.fillRect(0, 0, w, h)

      // 装饰圆环
      var bgR = Math.min(w, h) * 0.36
      ctx.strokeStyle = 'rgba(255,140,105,0.05)'
      ctx.lineWidth = 1
      for (var ri = 1; ri <= 3; ri++) {
        ctx.beginPath()
        ctx.arc(cx, cy, bgR * (0.26 * ri + 0.48), 0, Math.PI * 2)
        ctx.stroke()
      }

      // 星点
      this._drawStars(ctx)

      var formProg = this._formProg || 0

      // 混合渲染
      if (formProg < 0.98) {
        this._drawMosaic(ctx, formProg)
      }
      if (formProg > 0.02) {
        this._drawSphere(ctx, formProg >= 0.98 ? 1 : formProg)
      }

      // 撒花
      if (this._confetti.length) this._drawConfetti(ctx)
    },

    /* ===== 绘制马赛克 ===== */
    _drawMosaic: function (ctx, formProg) {
      var tiles = this._tiles
      if (!tiles.length) return
      var breathVal = Math.sin(this._breathPhase) * 0.05
      var cx = this._cx || (this._w / 2)
      var cy = this._cy || (this._h / 2 + 10)

      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i]
        if (t.alpha < 0.03) continue

        var px, py, sc
        if (formProg > 0.001) {
          var fov = 450
          var cosY = Math.cos(this._rotY * formProg * 0.5), sinY = Math.sin(this._rotY * formProg * 0.5)
          var nx = t.sx * cosY - t.sz * sinY
          var nz = t.sx * sinY + t.sz * cosY
          var cosX_val = Math.cos(this._rotX), sinX_val = Math.sin(this._rotX)
          var ny = t.sy * cosX_val - nz * sinX_val
          var nz2 = t.sy * sinX_val + nz * cosX_val
          var persp = fov / (fov + nz2 * formProg)
          px = t.x + ((cx + nx * persp) - t.x) * formProg
          py = t.y + ((cy + ny * persp) - t.y) * formProg
          sc = 1 + (0.60 + persp * 0.45 - 1) * formProg
        } else {
          px = t.x; py = t.y; sc = 1
        }

        var breath = 1 + breathVal * Math.cos(this._breathPhase + (t.breathOff || 0))
        var finalAlpha = t.alpha * breath * (1 - formProg * 0.75)
        if (finalAlpha < 0.03) continue

        ctx.save()
        ctx.globalAlpha = Math.min(1, finalAlpha)
        ctx.translate(px, py)
        ctx.rotate(((t.rot || 0) + (formProg > 0.5 ? this._rotY * 0.3 : 0)) * Math.PI / 180)
        var s = t.size * sc * breath
        ctx.fillStyle = t.color
        this._roundRect(ctx, -s / 2, -s / 2, s, s, 6 * sc)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.40)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }
    },

    /* ===== 绘制3D球体（有间隙——scale缩小到0.50） ===== */
    _drawSphere: function (ctx, alphaFactor) {
      if (typeof alphaFactor === 'undefined') alphaFactor = 1
      var cards = this._cards
      if (!cards.length) return

      var cx = this._cx || (this._w / 2)
      var cy = this._cy || (this._h / 2 + 10)
      var fov = 480
      var cosY = Math.cos(this._rotY), sinY = Math.sin(this._rotY)
      var cosX = Math.cos(this._rotX), sinX = Math.sin(this._rotX)
      var breath = 1 + Math.sin(this._breathPhase) * 0.04

      var projected = []
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i]
        var rx = card.x * breath, ry = card.y * breath, rz = card.z * breath
        var nx = rx * cosY - rz * sinY
        var nz = rx * sinY + rz * cosY
        var ny = ry * cosX - nz * sinX
        var nz2 = ry * sinX + nz * cosX
        var persp = fov / (fov + nz2)
        projected.push({
          color: card.color,
          px: cx + nx * persp,
          py: cy + ny * persp,
          z: nz2,
          scale: persp * 0.50,   // 缩小到0.50制造明显间隙（参考截图3粉色球）
          breathOff: card.breathOff
        })
      }

      projected.sort(function (a, b) { return b.z - a.z })

      for (var j = 0; j < projected.length; j++) {
        var pj = projected[j]
        var s = 52 * pj.scale   // 基础尺寸也缩小
        var a = alphaFactor * Math.min(1, 0.38 + pj.scale * 0.70)
        if (a < 0.04) continue

        var cb = 1 + Math.sin(this._breathPhase + (pj.breathOff || 0)) * 0.05
        s *= cb

        ctx.save()
        ctx.globalAlpha = Math.min(1, a)
        ctx.translate(pj.px, pj.py)

        if (pj.z > 0) {
          ctx.shadowColor = 'rgba(0,0,0,0.08)'
          ctx.shadowBlur = 5 * pj.scale
          ctx.shadowOffsetY = 2.5 * pj.scale
        }

        ctx.fillStyle = pj.color || '#FF8C69'
        this._roundRect(ctx, -s / 2, -s / 2, s, s, 10 * pj.scale)
        ctx.fill()

        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 1.2
        ctx.stroke()

        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.restore()
      }
    },

    _drawStars: function (ctx) {
      for (var i = 0; i < this._stars.length; i++) {
        var s = this._stars[i]
        var a = s.alpha * (0.5 + 0.5 * Math.sin(s.twinkle))
        if (a < 0.02) continue
        ctx.globalAlpha = a
        ctx.fillStyle = s.color || '#FFD166'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    },

    _burstConfetti: function () {
      var pieces = []
      var colors = ['#FF6B9D', '#FFD166', '#6ECBF5', '#A78BFA', '#52C41A', '#FF8C69', '#F472B6']
      var cx = this._cx || (this._w / 2)
      var cy = this._cy || (this._h / 2)
      for (var i = 0; i < 70; i++) {
        var ang = Math.random() * Math.PI * 2
        var spd = 2.5 + Math.random() * 5
        pieces.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 4 + Math.random() * 6,
          rot: Math.random() * Math.PI * 2,
          rv: (Math.random() - 0.5) * 0.3,
          life: 1
        })
      }
      this._confetti = pieces
    },

    _drawConfetti: function (ctx) {
      for (var i = 0; i < this._confetti.length; i++) {
        var p = this._confetti[i]
        if (p.life <= 0) continue
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66)
        ctx.restore()
      }
      ctx.globalAlpha = 1
    },

    _roundRect: function (ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2
      if (h < 2 * r) r = h / 2
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    }
  }
})
