// pages/lottery/lottery.js — 2阶段抽签（开始抽签 → 抽取幸运儿）
const storage = require('../../utils/storage')

Page({
  data: {
    people: [],
    prizes: [],
    currentPrizeId: '',
    wheelW: 600,
    wheelH: 480,
    drawPhase: 'idle',   // idle | forming | spinning | stopping | result
    drawText: '开始抽签',
    resultWinners: [],
    showResult: false,
    recordList: [],
    recordHasMore: false,
    recordTotal: 0,
    prizeChips: []
  },

  onLoad() {
    try {
      var info = wx.getSystemInfoSync()
      var sw = info.windowWidth || 375
      this.setData({
        wheelW: Math.round(sw * 0.92),
        wheelH: Math.round(sw * 0.78)
      })
    } catch (e) {}
    this._page = 1
    this._all = []
  },

  onShow() { this._loadConfig() },

  _loadConfig() {
    var config = storage.getLotteryConfig()
    var prizes = config.prizes || []
    var people = storage.getLotteryPeople() || []
    var records = storage.getLotteryRecords() || []

    // 统计已抽数量
    var drawnMap = {}
    records.forEach(function (r) { drawnMap[r.prizeId] = (drawnMap[r.prizeId] || 0) + 1 })

    var viewPrizes = prizes.map(function (p, i) {
      return {
        id: p.id, name: p.name, icon: p.icon, color: p.color,
        weight: Number(p.weight || 1),
        _idx: i,
        quantity: p.quantity || 1,
        drawCount: p.drawCount || 1,
        remaining: Math.max(Number(p.quantity || 1) - (drawnMap[p.id] || 0), 0),
        disabled: Number(p.quantity || 1) <= (drawnMap[p.id] || 0)
      }
    })

    // 按优先级权重升序排序（权重低的先抽）；权重相同的按原始添加先后（稳定）
    viewPrizes.sort(function (a, b) {
      if (a.weight !== b.weight) return a.weight - b.weight
      return a._idx - b._idx
    })

    // 始终按权重升序选「第一个未抽完的奖项」——保证优先级严格生效：
    // 当前奖项若是最低权重且未抽完，自然就是第一个；一旦抽完，自动跳到下一个奖项。
    // （不沿用旧 currentPrizeId，避免改权重后残留奖项导致顺序错乱）
    var firstAvail = viewPrizes.find(function (p) { return !p.disabled })
    var cur = firstAvail ? firstAvail.id : (viewPrizes[0] ? viewPrizes[0].id : '')

    this.setData({
      people: people,
      prizes: viewPrizes,
      currentPrizeId: cur,
      prizeChips: viewPrizes,
      drawText: this._getBtnText(this.data.drawPhase)
    })
    this._applyRecords(records)
  },

  /* ===== 按钮文字 ===== */
  _getBtnText: function (phase) {
    if (phase === 'spinning' || phase === 'stopping') return '抽取幸运儿'
    if (phase === 'result') return '再抽一次'
    return '开始抽签'
  },

  /* ===== 抽签：3阶段（idle→forming→spinning→stopping→result） ===== */
  onDraw() {
    var phase = this.data.drawPhase
    // 过渡中（forming / stopping）忽略点击
    if (phase === 'forming' || phase === 'stopping') return

    // === 阶段1：idle / result → 选人 + 开始形变（按钮保持「开始抽签」）===
    if (phase === 'idle' || phase === 'result') {
      var people = this.data.people || []
      if (!people.length) {
        wx.showModal({
          title: '还没有人员', content: '请先到「设置 → 人员列表」添加参与人员', confirmText: '去添加',
          success: function (m) { if (m.confirm) wx.navigateTo({ url: '/pages/lottery-edit/lottery-edit?tab=people' }) }
        })
        return
      }

      var prize = this.data.prizes.find(function (p) { return p.id === this.data.currentPrizeId }, this)
      if (!prize) { wx.showToast({ title: '请选择奖项', icon: 'none' }); return }
      if (prize.disabled) { wx.showToast({ title: prize.name + ' 已抽完', icon: 'none' }); return }

      var drawCount = prize.drawCount || 1

      // 选人：优先未中过奖的人
      var records = storage.getLotteryRecords() || []
      var wonIds = {}
      records.forEach(function (r) { wonIds[r.personId] = true })
      var pool = people.filter(function (p) { return !wonIds[p.id] })
      if (!pool.length) pool = people

      var actualCount = Math.min(drawCount, pool.length)
      var winners = []
      var poolCopy = pool.slice()
      for (var i = 0; i < actualCount; i++) {
        var idx = Math.floor(Math.random() * poolCopy.length)
        winners.push(poolCopy[idx])
        poolCopy.splice(idx, 1)
      }

      this._pending = { prize: prize, winners: winners }
      this.setData({ drawPhase: 'forming', drawText: '开始抽签' })

      var wheel = this.selectComponent('#wheel')
      if (!wheel) { this.setData({ drawPhase: 'idle', drawText: '开始抽签' }); return }

      var winnerIds = winners.map(function (w) { return w.id })
      wheel.startDraw(winnerIds, {
        prizeName: prize.name, prizeIcon: prize.icon, prizeColor: prize.color
      })
      return
    }

    // === 阶段2：spinning → 触发揭晓（减速停稳 → 撒花） ===
    if (phase === 'spinning') {
      var wheel = this.selectComponent('#wheel')
      if (wheel) wheel.triggerReveal()
      this.setData({ drawPhase: 'stopping', drawText: '抽取幸运儿' })
      return
    }
  },

  /* ===== 组件事件 ===== */
  _onStateChange(e) {
    var s = e.detail.state
    // 形变完成、球体开始高速旋转 → 按钮变为「抽取幸运儿」
    if (s === 'spinning' && this.data.drawPhase === 'forming') {
      this.setData({ drawPhase: 'spinning', drawText: '抽取幸运儿' })
    }
  },

  _onDrawEnd() {
    var pending = this._pending
    if (!pending) return
    var prize = pending.prize, winners = pending.winners
    var now = new Date()

    var recs = []
    for (var i = 0; i < winners.length; i++) {
      var w = winners[i]
      var rec = {
        id: 'lr_' + now.getTime() + '_' + i,
        personId: w.id,
        personName: w.name,
        personColor: w.color || '#FF8C69',
        prizeId: prize.id,
        prizeName: prize.name,
        prizeIcon: prize.icon,
        prizeColor: prize.color,
        time: this._fmt(now)
      }
      storage.addLotteryRecord(rec)
      recs.push({
        personName: w.name,
        personColor: w.color || '#FF8C69',
        prizeName: prize.name,
        prizeIcon: prize.icon,
        prizeColor: prize.color
      })
    }

    this._pending = null

    this.setData({
      drawPhase: 'result',
      drawText: '再抽一次',
      resultWinners: recs,
      showResult: true
    })
    this._loadConfig()
  },

  onDrawAgain() {
    this.setData({ showResult: false })
    var wheel = this.selectComponent('#wheel')
    if (wheel) wheel.reset()

    var available = this.data.prizes.find(function (p) { return !p.disabled })
    if (!available) {
      this.setData({ drawPhase: 'idle', drawText: '本轮已抽完' })
      wx.showToast({ title: '本轮奖项已全部抽完', icon: 'none' })
      return
    }

    this.setData({ drawPhase: 'idle', drawText: '开始抽签' })
  },

  onCloseResult() {
    this.setData({ showResult: false })
    var wheel = this.selectComponent('#wheel')
    if (wheel) wheel.reset()

    var available = this.data.prizes.find(function (p) { return !p.disabled })
    if (available) {
      this.setData({ drawPhase: 'idle', drawText: '开始抽签' })
    } else {
      this.setData({ drawPhase: 'idle', drawText: '本轮已抽完' })
    }
  },
  noop() {},

  /* ===== 记录 ===== */
  _applyRecords(arr) {
    this._all = arr || []; this._page = 1; this._renderRecords()
  },
  _renderRecords() {
    var sz = 20, list = (this._all || []).slice(0, this._page * sz)
    this.setData({
      recordList: list,
      recordHasMore: (this._all || []).length > this._page * sz,
      recordTotal: (this._all || []).length
    })
  },
  onLoadMore() { this._page++; this._renderRecords() },

  /* ===== 分享图（时光模板风格） ===== */
  onExportImage() {
    var arr = this._all || []
    if (!arr.length) { wx.showToast({ title: '暂无记录', icon: 'none' }); return }
    var that = this
    wx.showLoading({ title: '生成中…', mask: true })
    setTimeout(function () {
      wx.createSelectorQuery().in(that).select('#exportCanvas').fields({ node: true, size: true }).exec(function (res) {
        if (!res || !res[0] || !res[0].node) { wx.hideLoading(); wx.showToast({ title: '导出失败', icon: 'none' }); return }
        that._drawShareImg(res[0].node, arr)
      })
    }, 300)
  },

  _drawShareImg(canvas, arr) {
    var dpr = wx.getSystemInfoSync().pixelRatio || 2
    var W = 640, H = 1000

    canvas.width = W * dpr
    canvas.height = H * dpr
    var ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    /* ── 1. 渐变背景 ── */
    var bgGrad = ctx.createLinearGradient(0, 0, W, H)
    bgGrad.addColorStop(0, '#FF8C69')
    bgGrad.addColorStop(1, '#FF6B4B')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    /* ── 2. 装饰圆点 ── */
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath(); ctx.arc(W * 0.88, H * 0.08, W * 0.18, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(W * 0.1, H * 0.85, W * 0.12, 0, Math.PI * 2); ctx.fill()

    /* ── 3. 圆角白色内容卡 ── */
    var ctTop = H * 0.055
    var ctH = H * 0.84
    this._rr(ctx, W * 0.04, ctTop, W * 0.92, ctH, W * 0.038)
    ctx.fillStyle = 'rgba(255,255,255,0.97)'
    ctx.fill()

    /* ── 4. 标题 ── */
    ctx.font = 'bold ' + Math.round(W * 0.052) + 'px sans-serif'
    ctx.fillStyle = '#FF8C69'
    ctx.textAlign = 'center'
    ctx.fillText('🎯 幸运抽签 · 结果记录', W / 2, H * 0.13)

    // 分隔线
    ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.165); ctx.lineTo(W * 0.88, H * 0.165); ctx.stroke()

    /* ── 5. 按奖项分组统计概览 ── */
    var prizeMap = {}
    for (var i = 0; i < arr.length; i++) {
      var pid = arr[i].prizeId || arr[i].prizeName || '?'
      if (!prizeMap[pid]) prizeMap[pid] = { name: arr[i].prizeName || '', icon: arr[i].prizeIcon || '🎁', color: arr[i].prizeColor || '#FF8C69', list: [] }
      prizeMap[pid].list.push(arr[i])
    }
    var pKeys = Object.keys(prizeMap)
    var summaryY = H * 0.205
    for (var k = 0; k < pKeys.length && k < 5; k++) {
      var pk = prizeMap[pKeys[k]]
      ctx.font = Math.round(W * 0.032) + 'px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = pk.color || '#FF8C69'
      ctx.fillText(pk.icon + ' ' + pk.name + ' ×' + pk.list.length, W * 0.1, summaryY)
      summaryY += Math.round(W * 0.043)
    }

    // 分隔线
    ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(W * 0.12, summaryY + 8); ctx.lineTo(W * 0.88, summaryY + 8); ctx.stroke()

    /* ── 6. 记录列表（最近15条）── */
    var list = arr.slice(-15)
    var itemH = Math.round(W * 0.09)
    var startY = summaryY + 28

    for (var j = 0; j < list.length; j++) {
      var r = list[j]
      var y = startY + j * itemH
      if (j % 2 === 0) {
        ctx.fillStyle = 'rgba(255,140,105,0.03)'
        this._rr(ctx, W * 0.07, y - itemH / 2 + 3, W * 0.86, itemH - 6, 8); ctx.fill()
      }
      ctx.font = Math.round(W * 0.034) + 'px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(r.prizeIcon || '🎁', W * 0.09, y + 4)
      ctx.font = 'bold ' + Math.round(W * 0.032) + 'px sans-serif'
      ctx.fillStyle = '#333333'
      ctx.fillText(r.prizeName || '', W * 0.14, y + 4)
      ctx.font = Math.round(W * 0.034) + 'px sans-serif'
      ctx.fillStyle = r.prizeColor || '#FF8C69'
      ctx.textAlign = 'right'
      ctx.fillText(r.personName || '-', W * 0.91, y - 8)
      ctx.font = Math.round(W * 0.024) + 'px sans-serif'
      ctx.fillStyle = '#BBBBBB'
      ctx.fillText(r.time || '', W * 0.91, y + 14)
      ctx.textAlign = 'left'
    }

    if (arr.length > 15) {
      ctx.font = Math.round(W * 0.026) + 'px sans-serif'
      ctx.fillStyle = '#AAAAAA'
      ctx.textAlign = 'center'
      ctx.fillText('... 还有 ' + (arr.length - 15) + ' 条记录 ...', W / 2, startY + 15 * itemH + 16)
    }

    /* ── 7. 底部品牌 ── */
    ctx.font = Math.round(W * 0.028) + 'px sans-serif'
    ctx.fillStyle = '#DDDDDD'
    ctx.textAlign = 'center'
    ctx.fillText('— 舔狗助手 · 幸运抽签 —', W / 2, H * 0.925)

    /* ── 输出 ── */
    var that = this
    setTimeout(function () {
      wx.canvasToTempFilePath({
        canvas: canvas,
        fileType: 'png', quality: 1,
        success: function (tmp) {
          wx.hideLoading()
          wx.saveImageToPhotosAlbum({
            filePath: tmp.tempFilePath,
            success: function () { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
            fail: function (err) {
              if (err && err.errMsg && err.errMsg.indexOf('auth deny') >= 0) {
                wx.showModal({ title: '需要授权', content: '请允许保存图片到相册', success: function (mr) { if (mr.confirm) wx.openSetting() } })
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' })
              }
            }
          })
        },
        fail: function () { wx.hideLoading(); wx.showToast({ title: '生成图片失败', icon: 'none' }) }
      })
    }, 200)
  },

  _rr: function (ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  },

  /* ===== 重置（清空记录 + 恢复数量） ===== */
  onReset() {
    var that = this
    wx.showModal({
      title: '重置抽签', content: '清空所有抽签记录，并恢复所有奖项数量？\n这将彻底重新开始一轮。',
      confirmColor: '#FF6B4B',
      success: function (m) {
        if (!m.confirm) return
        // 1. 清空记录
        storage.setLotteryRecords([])
        // 2. 恢复数量（从当前配置的 _origQuantity 快照）
        var config = storage.getLotteryConfig()
        var prizes = config.prizes || []
        for (var i = 0; i < prizes.length; i++) {
          var origQ = prizes[i]._origQuantity
          if (origQ != null && origQ !== undefined) {
            prizes[i].quantity = origQ
          }
        }
        config.updatedAt = Date.now()
        storage.setLotteryConfig(config)
        // 3. 刷新页面
        that._all = []
        that.setData({ showResult: false, drawPhase: 'idle' })
        that._loadConfig()
        wx.showToast({ title: '已重置', icon: 'success' })
      }
    })
  },

  onManage() { wx.navigateTo({ url: '/pages/lottery-edit/lottery-edit' }) },

  _fmt(d) {
    function p(n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  },

  onShareAppMessage() { return { title: '舔狗助手 · 幸运抽签', path: '/pages/lottery/lottery' } },
  onShareTimeline() { return { title: '舔狗助手 · 幸运抽签' } }
})
