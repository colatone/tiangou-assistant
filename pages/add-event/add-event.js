// pages/add-event/add-event.js

const dateUtil = require('../../utils/date')
const storage = require('../../utils/storage')

Page({
  data: {
    isEdit: false,
    eventId: '',
    form: {
      name: '',
      date: '',
      type: 'elapsed',
      category: 'custom',
      note: '',
      remindEnabled: false,
      remindBeforeDays: 7
    },
    categories: [],
    formattedDate: '',
    lunarInfo: null,       // 农历信息
    lunarShort: '',        // 简短农历
    highlightTag: '',      // 节日/节气高亮标签
    remindOptions: [1, 3, 7, 15, 30]
  },

  onLoad(options) {
    const categories = storage.getCategories()
    this.setData({ categories })

    if (options.id) {
      const events = storage.getEvents()
      const event = events.find(e => e.id === options.id)
      if (event) {
        const lunarInfo = dateUtil.getFullLunarInfo(event.date)
        this.setData({
          isEdit: true,
          eventId: options.id,
          form: {
            name: event.name,
            date: event.date,
            type: event.type || 'elapsed',
            category: event.category,
            note: event.note || '',
            remindEnabled: event.remindEnabled || false,
            remindBeforeDays: event.remindBeforeDays || 7
          },
          formattedDate: dateUtil.formatDate(event.date),
          lunarInfo: lunarInfo,
          lunarShort: lunarInfo ? lunarInfo.short : '',
          highlightTag: lunarInfo ? (lunarInfo.highlightTag || '') : ''
        })
      }
    } else {
      const todayStr = dateUtil.getTodayStr()
      const lunarInfo = dateUtil.getFullLunarInfo(todayStr)
      this.setData({
        'form.date': todayStr,
        formattedDate: dateUtil.formatDate(todayStr),
        lunarInfo: lunarInfo,
        lunarShort: lunarInfo ? lunarInfo.short : '',
        highlightTag: lunarInfo ? (lunarInfo.highlightTag || '') : ''
      })
    }
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value })
  },

  onDateChange(e) {
    const date = e.detail.value
    const lunarInfo = dateUtil.getFullLunarInfo(date)
    this.setData({
      'form.date': date,
      formattedDate: dateUtil.formatDate(date),
      lunarInfo: lunarInfo || null,
      lunarShort: lunarInfo ? (lunarInfo.short || '') : '',
      highlightTag: lunarInfo ? ((lunarInfo && lunarInfo.highlightTag) || '') : ''
    })
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ 'form.type': type })
  },

  onCategorySelect(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ 'form.category': id })
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  onRemindToggle() {
    this.setData({ 'form.remindEnabled': !this.data.form.remindEnabled })
  },

  onRemindDaysChange(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ 'form.remindBeforeDays': days })
  },

  onManageCategory() {
    wx.navigateTo({
      url: '/pages/category/category'
    })
  },

  validate() {
    const { form } = this.data
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入事件名称', icon: 'none' })
      return false
    }
    if (!form.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' })
      return false
    }
    if (form.type === 'countdown' && form.date < dateUtil.getTodayStr()) {
      wx.showToast({ title: '倒计时日期不能早于今天', icon: 'none' })
      return false
    }
    return true
  },

  onSave() {
    if (!this.validate()) return

    const { isEdit, eventId, form } = this.data
    const events = storage.getEvents()

    if (isEdit) {
      const index = events.findIndex(e => e.id === eventId)
      if (index !== -1) {
        events[index] = {
          ...events[index],
          name: form.name.trim(),
          date: form.date,
          type: form.type,
          category: form.category,
          note: form.note.trim(),
          remindEnabled: form.remindEnabled,
          remindBeforeDays: form.type === 'countdown' ? form.remindBeforeDays : 0,
          updatedAt: Date.now()
        }
      }
    } else {
      events.push({
        id: dateUtil.generateUUID(),
        name: form.name.trim(),
        date: form.date,
        type: form.type,
        category: form.category,
        note: form.note.trim(),
        remindEnabled: form.remindEnabled,
        remindBeforeDays: form.type === 'countdown' ? form.remindBeforeDays : 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })

    }

    storage.setEvents(events)

    // 如果是倒计时且开启提醒，检查是否需要设置定时器
    if (form.type === 'countdown' && form.remindEnabled) {
      this.scheduleReminder(events[isEdit ? index : events.length - 1])
    }

    wx.showToast({
      title: isEdit ? '保存成功' : '创建成功',
      icon: 'success'
    })

    setTimeout(() => {
      wx.navigateBack()
    }, 800)
  },

  scheduleReminder(event) {
    // 本地存储提醒信息，在 app onShow 时检查
    var reminders = storage.getReminders() || []
    reminders.push({
      eventId: event.id,
      eventName: event.name,
      targetDate: event.date,
      beforeDays: event.remindBeforeDays || 7,
      notified: false,
      createdAt: Date.now()
    })
    storage.setReminders(reminders)
  },

  onCancel() {
    wx.navigateBack()
  },

  /* 分享给好友 */
  onShareAppMessage() {
    const title = this.data.isEdit ? '舔狗助手 · 编辑我的重要时光' : '舔狗助手 · 记录我的重要时光'
    return {
      title: title,
      path: '/pages/index/index'
    }
  },

  /* 分享到朋友圈 */
  onShareTimeline() {
    const title = this.data.isEdit ? '舔狗助手 · 编辑我的重要时光' : '舔狗助手 · 记录我的重要时光'
    return {
      title: title,
      query: ''
    }
  }
})
