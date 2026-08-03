// pages/lottery-edit/lottery-edit.js — 设置页（浅色主题）
const storage = require('../../utils/storage')

const EMOJI_OPTIONS = ['🍽️','🧹','🗑️','🧺','🚗','☕','🍰','🎁','💰','⭐','🔥','🎯','🥇','🏆','❤️','🍀']

Page({
  data: {
    currentTab: 'people',
    editPeople: [],
    editPrizes: [],
    emojiOpts: EMOJI_OPTIONS,
    emojiFor: -1,
    recordList: [],
    recordTotal: 0,
    batchCount: '',
    showBatchInput: false
  },

  onLoad(options) {
    if (options && options.tab) this.setData({ currentTab: options.tab })
    this._loadPeople()
    this._loadPrizes()
  },

  onShow() { if (this.data.currentTab === 'records') this._loadRecords() },

  onSwitchTab(e) {
    var t = e.currentTarget.dataset.tab
    this.setData({ currentTab: t })
    if (t === 'records') this._loadRecords()
  },

  /* ===== 人员 CRUD ===== */
  _loadPeople() {
    var p = JSON.parse(JSON.stringify(storage.getLotteryPeople() || []))
    this.setData({ editPeople: p })
  },
  onPersonNameInput(e) {
    var i = e.currentTarget.dataset.index, arr = this.data.editPeople.slice()
    arr[i] = Object.assign({}, arr[i], { name: e.detail.value })
    this.setData({ editPeople: arr })
  },
  onDeletePerson(e) {
    var idx = e.currentTarget.dataset.index, that = this
    wx.showModal({
      title: '删除人员', content: '确定删除「' + (that.data.editPeople[idx].name || '') + '」？',
      confirmColor: '#FF6B6B',
      success: function(m) {
        if (m.confirm) { var a = that.data.editPeople.slice(); a.splice(idx, 1); that.setData({ editPeople: a }) }
      }
    })
  },
  onAddPerson() {
    var a = this.data.editPeople.slice()
    var palette = ['#FF6B9D','#A78BFA','#5B8DEF','#FFB347','#6ECBF5','#34D399','#FBBF24','#F472B6']
    a.push({ id: 'u' + Date.now(), name: '', color: palette[a.length % palette.length] })
    this.setData({ editPeople: a })
  },
  toggleBatchInput() { this.setData({ showBatchInput: !this.data.showBatchInput }) },
  onBatchCountInput(e) { this.setData({ batchCount: e.detail.value }) },
  onBatchAdd() {
    var n = parseInt(this.data.batchCount, 10)
    if (!(n > 0 && n <= 200)) { wx.showToast({ title: '请输入1-200之间的数字', icon: 'none' }); return }
    var palette = ['#FF6B9D','#A78BFA','#5B8DEF','#FFB347','#6ECBF5','#34D399','#FBBF24','#F472B6']
    var list = []
    for (var i = 1; i <= n; i++) {
      list.push({ id: 'u_batch_' + i, name: i + '号', color: palette[(i - 1) % palette.length] })
    }
    this.setData({ editPeople: list, batchCount: '', showBatchInput: false })
    wx.showToast({ title: '已生成 ' + n + ' 人', icon: 'success' })
  },
  onSavePeople() {
    var src = this.data.editPeople.slice(), clean = []
    for (var i = 0; i < src.length; i++) {
      var n = (src[i].name || '').trim()
      if (!n) { wx.showToast({ title: '第' + (i + 1) + '位姓名不能为空', icon: 'none' }); return }
      clean.push({ id: src[i].id || ('u' + Date.now() + '_' + i), name: n, color: src[i].color || '#FF8C69' })
    }
    if (!clean.length) { wx.showToast({ title: '至少保留一位人员', icon: 'none' }); return }
    storage.setLotteryPeople(clean)
    this.setData({ editPeople: clean })
    wx.showToast({ title: '已保存', icon: 'success' })
  },
  onResetPeople() {
    var that = this
    wx.showModal({
      title: '重置人员', content: '恢复默认4人（大帅哥/美女/关中王他哥/关中王）？当前人员将丢失。',
      confirmColor: '#FF6B6B',
      success: function(m) {
        if (!m.confirm) return
        storage.setLotteryPeople(JSON.parse(JSON.stringify(storage.DEFAULT_LOTTERY_PEOPLE)))
        that._loadPeople()
        wx.showToast({ title: '已重置', icon: 'success' })
      }
    })
  },

  /* ===== 奖项 CRUD（无无限、有drawCount） ===== */
  _loadPrizes() {
    var c = storage.getLotteryConfig()
    var p = JSON.parse(JSON.stringify(c.prizes || []))
    this.setData({ editPrizes: p })
  },
  _upd(i, patch) {
    var p = this.data.editPrizes
    p[i] = Object.assign({}, p[i], patch)
    this.setData({ editPrizes: p })
  },
  onPickEmoji(e) {
    var i = this.data.emojiFor
    if (i < 0) return
    this._upd(i, { icon: e.currentTarget.dataset.emoji })
    this.setData({ emojiFor: -1 })
  },
  onOpenEmoji(e) { this.setData({ emojiFor: e.currentTarget.dataset.index }) },
  onCloseEmoji() { this.setData({ emojiFor: -1 }) },
  onNameInput(e) { this._upd(e.currentTarget.dataset.index, { name: e.detail.value }) },
  onQtyInput(e) {
    // 直接存原始字符串，不做转换，允许用户清空到空
    var raw = e.detail.value
    // 如果不是空也不是有效数字，保持原值不变（阻止非法字符）
    if (raw !== '' && !/^\d*$/.test(raw)) return
    this._upd(e.currentTarget.dataset.index, { quantity: raw === '' ? '' : Number(raw) })
  },
  onDrawCountInput(e) {
    var raw = e.detail.value
    if (raw !== '' && !/^\d*$/.test(raw)) return
    this._upd(e.currentTarget.dataset.index, { drawCount: raw === '' ? '' : Number(raw) })
  },
  onWeightInput(e) {
    var raw = e.detail.value
    if (raw !== '' && !/^\d*$/.test(raw)) return
    this._upd(e.currentTarget.dataset.index, { weight: raw === '' ? '' : Number(raw) })
  },
  onDelete(e) {
    var idx = e.currentTarget.dataset.index, that = this
    wx.showModal({
      title: '删除奖项', content: '确定删除「' + that.data.editPrizes[idx].name + '」？',
      confirmColor: '#FF6B6B',
      success: function(m) {
        if (m.confirm) { var p = that.data.editPrizes.slice(); p.splice(idx, 1); that.setData({ editPrizes: p }) }
      }
    })
  },
  onAddPrize() {
    var p = this.data.editPrizes.slice()
    p.push({ id: 'p' + Date.now(), name: '新奖项', icon: '🎁', color: '#FF8C69', weight: 1, quantity: 1, drawCount: 1 })
    this.setData({ editPrizes: p })
  },
  // 按模板批量添加奖项（4个预设模板，清空现有列表）
  onTemplateAdd() {
    var that = this
    wx.showModal({
      title: '按模板添加奖项',
      content: '将清空当前所有奖项，替换为以下4个预设模板：\n\n🥇 特等奖\n🥈 一等奖\n🥉 二等奖\n🏅 三等奖\n\n是否继续？',
      confirmColor: '#FF8C69',
      success: function(m) {
        if (!m.confirm) return
        var templates = [
          { id: 'p_tpl_' + Date.now() + '_0', name: '特等奖', icon: '🥇', color: '#FFD700', weight: 4, quantity: 1, drawCount: 1 },
          { id: 'p_tpl_' + Date.now() + '_1', name: '一等奖', icon: '🥈', color: '#C0C0C0', weight: 3, quantity: 2, drawCount: 1 },
          { id: 'p_tpl_' + Date.now() + '_2', name: '二等奖', icon: '🥉', color: '#CD7F32', weight: 2, quantity: 3, drawCount: 1 },
          { id: 'p_tpl_' + Date.now() + '_3', name: '三等奖', icon: '🏅', color: '#FF8C69', weight: 1, quantity: 5, drawCount: 1 }
        ]
        that.setData({ editPrizes: templates })
        wx.showToast({ title: '已添加4个奖项模板', icon: 'success' })
      }
    })
  },
  // 保存奖项——快照 _origQuantity 用于"恢复数量"
  onSavePrizes() {
    var p = this.data.editPrizes
    if (!p.length) { wx.showToast({ title: '至少保留一个奖项', icon: 'none' }); return }
    for (var i = 0; i < p.length; i++) {
      if (!p[i].name || !p[i].name.trim()) { wx.showToast({ title: '第' + (i + 1) + '项名称不能为空', icon: 'none' }); return }
      // 空数量默认1
      if (p[i].quantity == null || p[i].quantity === '' || p[i].quantity < 1) p[i].quantity = 1
      if (p[i].drawCount == null || p[i].drawCount === '' || p[i].drawCount < 1) p[i].drawCount = 1
      // 快照当前 quantity 作为"原始数量"
      p[i]._origQuantity = p[i].quantity != null ? p[i].quantity : 1
    }
    storage.setLotteryConfig({ prizes: p, updatedAt: Date.now() })
    wx.showToast({ title: '已保存', icon: 'success' })
  },
  onResetPrizes() {
    var that = this
    wx.showModal({
      title: '重置奖项', content: '恢复默认2项奖（洗碗/扫地）？当前奖项将丢失。',
      confirmColor: '#FF6B6B',
      success: function(m) {
        if (!m.confirm) return
        var def = JSON.parse(JSON.stringify(storage.DEFAULT_LOTTERY_CONFIG))
        // 默认也快照 _origQuantity
        def.prizes.forEach(function(prize) {
          prize._origQuantity = prize.quantity != null ? prize.quantity : 1
        })
        storage.setLotteryConfig(def)
        that._loadPrizes()
        wx.showToast({ title: '已重置', icon: 'success' })
      }
    })
  },

  /* ===== 记录（重置 = 清空记录 + 恢复奖项数量） ===== */
  _loadRecords() {
    var a = storage.getLotteryRecords() || []
    this.setData({ recordList: a.slice(0, 60), recordTotal: a.length })
  },

  // 一键重置：清空所有记录 + 恢复所有奖项数量
  onResetRec() {
    var that = this
    wx.showModal({
      title: '重置抽签', content: '清空所有抽签记录，并恢复所有奖项数量？\n这将彻底重新开始一轮。',
      confirmColor: '#FF6B4B',
      success: function(m) {
        if (!m.confirm) return
        // 1. 清空记录
        storage.setLotteryRecords([])
        // 2. 恢复每个奖项的 _origQuantity
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
        // 3. 刷新
        that._loadRecords()
        wx.showToast({ title: '已重置', icon: 'success' })
      }
    })
  },

  noop() {},
  onShareAppMessage() { return { title: '舔狗助手 · 幸运抽签', path: '/pages/lottery/lottery' } }
})
