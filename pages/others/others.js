// pages/others/others.js
// 工具中心：已上线工具入口 + 敬请期待的 roadmap 占位，取代原 404 死胡同页。

Page({
  data: {
    appName: '舔狗助手',
    tools: [
      { id: 'typhoon', name: '台风路径', icon: '🌀', desc: '实时追踪台风动态', path: '/pages/typhoon/typhoon', ready: true, tab: true },
      { id: 'woodfish', name: '赛博木鱼', icon: '💰', desc: '自动敲木鱼积攒运势', path: '/pages/wooden-fish/wooden-fish', ready: true, tab: false },
      { id: 'tide', name: '潮汐赶海', icon: '🌊', desc: '查询附近赶海最佳时间', path: '/pages/tide/tide', ready: true, tab: false },
      { id: 'dragonball', name: '七龙珠', icon: '🐉', desc: '召唤神龙 · 龙珠指引', path: '/pages/dragonball/dragonball', ready: true, tab: false },
      { id: 'lottery', name: '幸运抽签', icon: '🎁', desc: '自定义3D卡片球抽签', path: '/pages/lottery/lottery', ready: true, tab: false },
      { id: 'time', name: '美好时光', icon: '⏳', desc: '记录每一个重要时刻', path: '/pages/index/index', ready: true, tab: true },
      { id: 'more', name: '更多工具', icon: '➕', desc: '陆续上线', ready: false }
    ]
  },

  onTapTool(e) {
    const item = e.currentTarget.dataset.item
    if (!item.ready) {
      wx.showToast({ title: '敬请期待', icon: 'none' })
      return
    }
    if (item.tab) {
      wx.switchTab({ url: item.path })
    } else {
      wx.navigateTo({ url: item.path })
    }
  },

  onShareAppMessage() {
    return {
      title: '舔狗助手 - 实用工具箱',
      path: '/pages/others/others'
    }
  },

  onShareTimeline() {
    return {
      title: '舔狗助手 - 实用工具箱',
      query: ''
    }
  }
})
