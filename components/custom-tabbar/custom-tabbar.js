// components/custom-tabbar/custom-tabbar.js
// 自定义底部导航栏 —— 用于非 tabBar 页面（如潮汐页），保持与系统 tabBar 一致的视觉和交互

Component({
  properties: {
    // 当前高亮的页面标识
    current: { type: String, value: '' }
  },

  data: {
    tabs: [
      { key: 'tools', text: '工具', path: '/pages/others/others', icon: '/images/tab_more.png', iconActive: '/images/tab_more_active.png' },
      { key: 'typhoon', text: '台风', path: '/pages/typhoon/typhoon', icon: '/images/tab_typhoon.png', iconActive: '/images/tab_typhoon_active.png' },
      { key: 'time', text: '时光', path: '/pages/index/index', icon: '/images/tab_time.png', iconActive: '/images/tab_time_active.png' }
    ]
  },

  methods: {
    onTabTap: function (e) {
      var key = e.currentTarget.dataset.key
      var tab = this.data.tabs.find(function (t) { return t.key === key })
      if (!tab) return

      if (key === this.data.current) return

      // tabBar 页用 switchTab，非 tabBar 页（当前潮汐页）已在这里显示
      wx.switchTab({ url: tab.path })
    }
  }
})
