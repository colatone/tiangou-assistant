// pages/index/index.js

const dateUtil = require('../../utils/date')
const storage = require('../../utils/storage')
const quoteUtil = require('../../utils/quote')

Page({
  data: {
    events: [],
    categories: [],
    activeCategory: '',
    sortBy: 'days',
    sortOrder: 'desc',
    sortLabel: '按天数',
    quote: '',
    _timer: null  // 倒计时定时器
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
    this.startCountdownTimer()
    this.checkReminders()
    // 检查 app 级别的全局提醒
    this.checkGlobalReminders()
  },

  onHide() {
    this.stopCountdownTimer()
  },

  onUnload() {
    this.stopCountdownTimer()
  },

  onPullDownRefresh() {
    this.loadData()
    wx.stopPullDownRefresh()
  },

  loadData() {
    const categories = storage.getCategories()
    const rawEvents = storage.getEvents()
    const quote = quoteUtil.getDailyQuote()

    // 为每个事件补充农历信息和详细时间
    const enrichedEvents = rawEvents.map(event => {
      const category = categories.find(c => c.id === event.category) || categories[0]
      const days = dateUtil.calcDays(event.date, event.type)
      const lunarInfo = dateUtil.getFullLunarInfo(event.date)

      // 倒计时额外计算时分秒（仅当天数 < 30 时有意义）
      let countdownDetail = null
      if (event.type === 'countdown') {
        countdownDetail = this.getCountdownDetail(event.date)
      }

      return {
        ...event,
        days,
        formattedDate: dateUtil.formatDate(event.date),
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        lunarShort: lunarInfo ? lunarInfo.short : '',
        highlightTag: lunarInfo && lunarInfo.highlightTag ? lunarInfo.highlightTag : '',
        countdownDetail
      }
    })

    const filtered = this.filterEvents(enrichedEvents)
    const sorted = this.sortEvents(filtered)

    this.setData({
      events: sorted,
      categories,
      quote
    })
  },

  /**
   * 获取倒计时详细信息（天/时/分/秒）
   */
  getCountdownDetail(dateStr) {
    if (!dateStr) return null

    const target = new Date(dateStr + 'T00:00:00')
    const now = new Date()

    // 如果目标已过，返回0
    if (target <= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true }
    }

    // 计算剩余天数（从今天开始算）
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diffMs = target.getTime() - now.getTime()
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))

    const days = Math.floor(totalSeconds / (24 * 3600))
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds, isExpired: false }
  },

  /**
   * 启动倒计时秒级刷新定时器（仅对倒计时事件生效）
   */
  startCountdownTimer() {
    this.stopCountdownTimer()

    const that = this
    this.data._timer = setInterval(() => {
      const events = that.data.events
      const hasCountdown = events.some(e => e.type === 'countdown')

      if (!hasCountdown) return

      // 只更新有变化的倒计时项，避免全量刷新
      const updated = events.map(e => {
        if (e.type === 'countdown' && !e.isExpired && e.days > 0) {
          const detail = that.getCountdownDetail(e.date)
          return { ...e, countdownDetail: detail, days: detail.days }
        }
        return e
      })

      // 检查是否真的有变化，避免无意义的 setData
      const hasChanged = updated.some((e, i) =>
        e.countdownDetail !== events[i].countdownDetail || e.days !== events[i].days
      )

      if (hasChanged) {
        that.setData({ events: updated })
      }
    }, 1000)
  },

  stopCountdownTimer() {
    if (this.data._timer) {
      clearInterval(this.data._timer)
      this.data._timer = null
    }
  },

  /**
   * 检查是否有需要提醒的倒计时事件
   */
  checkReminders() {
    try {
      var reminders = storage.getReminders() || []
      var now = new Date()
      var todayStr = dateUtil.getTodayStr()
      var needNotify = []

      reminders.forEach(function(r) {
        if (r.notified) return
        if (r.beforeDays <= 0) return

        var targetDate = r.targetDate
        var target = new Date(targetDate + 'T00:00:00')
        var diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays >= 0 && diffDays <= r.beforeDays) {
          needNotify.push({
            name: r.eventName,
            remainingDays: diffDays,
            targetDate: targetDate
          })
          r.notified = true
        } else if (diffDays === 0) {
          needNotify.push({
            name: r.eventName,
            remainingDays: 0,
            targetDate: targetDate
          })
          r.notified = true
        }
      })

      if (needNotify.length > 0) {
        storage.setReminders(reminders)

        // 显示本地提醒通知
        var msgList = needNotify.map(function(n) {
          return n.remainingDays === 0
            ? '🎉 「' + n.name + '」今天就是目标日！'
            : '⏰ 「' + n.name + '」还剩' + n.remainingDays + '天'
        })

        wx.showModal({
          title: '⏰ 提醒通知',
          content: msgList.join('\n'),
          showCancel: false,
          confirmText: '我知道了',
          confirmColor: '#FF8C69'
        })
      }
    } catch (e) {
      console.log('检查提醒失败:', e)
    }
  },

  /**
   * 检查 app 级别的全局提醒（app.js 中设置的）
   */
  checkGlobalReminders() {
    const app = getApp()
    if (!app.globalData.pendingReminders) return

    const msgs = app.globalData.pendingReminders
    if (msgs.length > 0) {
      wx.showModal({
        title: '⏰ 提醒通知',
        content: msgs.join('\n'),
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#FF8C69'
      })
      // 清除已展示的提醒
      app.globalData.pendingReminders = null
    }
  },

  filterEvents(events) {
    const { activeCategory } = this.data
    if (!activeCategory) return events
    return events.filter(e => e.category === activeCategory)
  },

  sortEvents(events) {
    const { sortBy, sortOrder } = this.data
    const multiplier = sortOrder === 'asc' ? 1 : -1

    return events.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'days') {
        comparison = a.days - b.days
      } else if (sortBy === 'date') {
        comparison = new Date(a.date) - new Date(b.date)
      } else if (sortBy === 'created') {
        comparison = a.createdAt - b.createdAt
      }
      return comparison * multiplier
    })
  },

  onCategoryFilter(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id }, () => {
      this.loadData()
    })
  },

  onSortToggle() {
    const sorts = [
      { by: 'days', order: 'desc', label: '按天数' },
      { by: 'days', order: 'asc', label: '按天数' },
      { by: 'date', order: 'desc', label: '按日期' },
      { by: 'date', order: 'asc', label: '按日期' },
      { by: 'created', order: 'desc', label: '按创建' }
    ]

    const currentIndex = sorts.findIndex(s =>
      s.by === this.data.sortBy && s.order === this.data.sortOrder
    )
    const nextIndex = (currentIndex + 1) % sorts.length
    const next = sorts[nextIndex]

    this.setData({
      sortBy: next.by,
      sortOrder: next.order,
      sortLabel: next.label
    }, () => {
      this.loadData()
    })
  },

  onAddEvent() {
    wx.navigateTo({
      url: '/pages/add-event/add-event'
    })
  },

  /* 恢复出厂示例记录（追加不覆盖已有记录）*/
  onRestoreSample() {
    const added = storage.restoreSampleEvents()
    this.loadData()
    wx.showToast({
      title: added > 0 ? '已恢复示例记录' : '示例记录已在',
      icon: 'none'
    })
  },

  onEditEvent(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/add-event/add-event?id=${id}`
    })
  },

  onShareEvent(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/share-card/share-card?id=${id}`
    })
  },

  onDeleteEvent(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除吗？',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          const events = storage.getEvents().filter(ev => ev.id !== id)
          storage.setEvents(events)
          // 同时清理该事件的提醒
          const reminders = (storage.getReminders() || []).filter(r => r.eventId !== id)
          storage.setReminders(reminders)
          this.loadData()
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '舔狗助手 - 记录每一个重要时刻',
      path: '/pages/others/others',
      imageUrl: ''
    }
  },

  onShareTimeline() {
    return {
      title: '舔狗助手 - 记录每一个重要时刻'
    }
  }
})
