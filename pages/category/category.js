// pages/category/category.js

const storage = require('../../utils/storage')
const dateUtil = require('../../utils/date')

Page({
  data: {
    presetCategories: [],
    customCategories: [],
    showAddForm: false,
    newCategory: {
      name: '',
      icon: '🏷️',
      color: '#C085FF'
    },
    iconOptions: ['🏷️', '🌸', '🎨', '📚', '🎵', '🍀', '🌙', '⭐', '🔥', '💎', '🌈', '🍎', '🐱', '🐶', '🌿', '☕'],
    colorOptions: ['#FF8C69', '#FF6B6B', '#6ECBF5', '#52C41A', '#FFD700', '#C085FF', '#FF8C94', '#A0A0A0', '#4A90D9', '#FF9500', '#34C759', '#AF52DE']
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    this.loadCategories()
  },

  loadCategories() {
    const categories = storage.getCategories()
    this.setData({
      presetCategories: categories.filter(c => c.isPreset),
      customCategories: categories.filter(c => !c.isPreset)
    })
  },

  onShowAddForm() {
    this.setData({
      showAddForm: true,
      newCategory: { name: '', icon: '🏷️', color: '#C085FF' }
    })
  },

  onCancelAdd() {
    this.setData({ showAddForm: false })
  },

  onNewNameInput(e) {
    this.setData({ 'newCategory.name': e.detail.value })
  },

  onIconSelect(e) {
    const icon = e.currentTarget.dataset.icon
    this.setData({ 'newCategory.icon': icon })
  },

  onColorSelect(e) {
    const color = e.currentTarget.dataset.color
    this.setData({ 'newCategory.color': color })
  },

  onConfirmAdd() {
    const { newCategory } = this.data
    if (!newCategory.name.trim()) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }

    const categories = storage.getCategories()
    const exists = categories.find(c => c.name === newCategory.name.trim())
    if (exists) {
      wx.showToast({ title: '分类名称已存在', icon: 'none' })
      return
    }

    categories.push({
      id: 'custom-' + Date.now(),
      name: newCategory.name.trim(),
      icon: newCategory.icon,
      color: newCategory.color,
      isPreset: false,
      createdAt: Date.now()
    })

    storage.setCategories(categories)
    this.setData({ showAddForm: false })
    this.loadCategories()

    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  onDeleteCategory(e) {
    const id = e.currentTarget.dataset.id
    const target = storage.getCategories().find(c => c.id === id)
    if (target && target.isPreset) {
      wx.showToast({ title: '预设分类不可删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: '删除分类后，该分类下的事件将变为"自定义"分类，确定删除吗？',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          let categories = storage.getCategories()
          categories = categories.filter(c => c.id !== id)
          storage.setCategories(categories)

          let events = storage.getEvents()
          events = events.map(ev => {
            if (ev.category === id) {
              return { ...ev, category: 'custom' }
            }
            return ev
          })
          storage.setEvents(events)

          this.loadCategories()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  /* 分享给好友 */
  onShareAppMessage() {
    return {
      title: '舔狗助手 · 我的分类管理',
      path: '/pages/index/index'
    }
  },

  /* 分享到朋友圈 */
  onShareTimeline() {
    return {
      title: '舔狗助手 · 我的分类管理',
      query: ''
    }
  }
})
