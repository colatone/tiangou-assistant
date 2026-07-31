// pages/typhoon/typhoon.js
// 宿主页面：拉取风暴列表、切换风暴、加载路径，嵌入 typhoon-tracker 组件。

const typhoon = require('../../utils/typhoon')

function nowHM() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return hh + ':' + mm
}

Page({
  data: {
    storms: [],
    activeStormId: '',
    activeStormName: '',
    trackPoints: [],
    loading: true,
    error: '',
    usingMock: false,
    lastUpdated: ''
  },

  onLoad: function () {
    this.loadStorms(false)
  },

  /**
   * 下拉刷新：重新拉取列表 + 当前路径
   */
  onPullDownRefresh: function () {
    this.loadStorms(true)
  },

  /**
   * 加载当年风暴列表，默认选中第一个
   */
  loadStorms: function (isRefresh) {
    const that = this
    this.setData({ loading: true, error: '' })
    const year = new Date().getFullYear()
    typhoon.getStormList(year).then(function (storms) {
      if (!storms || !storms.length) {
        that.setData({ loading: false, storms: [], error: '当前暂无活跃台风' })
        if (isRefresh) wx.stopPullDownRefresh()
        return
      }
      const active = storms[0]
      that.setData({
        storms: storms,
        activeStormId: active.id,
        activeStormName: active.name,
        loading: false
      })
      that.loadTrack(active.id, isRefresh)
      if (isRefresh) wx.stopPullDownRefresh()
    }).catch(function () {
      that.setData({ loading: false, error: '加载台风列表失败' })
      if (isRefresh) wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载指定风暴的路径
   */
  loadTrack: function (stormId, isRefresh) {
    const that = this
    this.setData({ loading: true })
    typhoon.getStormTrack(stormId).then(function (result) {
      that.setData({
        trackPoints: result.points,
        usingMock: result.mock,
        loading: false,
        lastUpdated: nowHM()
      })
      if (isRefresh) wx.stopPullDownRefresh()
    }).catch(function () {
      that.setData({ loading: false, error: '加载路径失败' })
      if (isRefresh) wx.stopPullDownRefresh()
    })
  },

  /**
   * 切换风暴
   */
  onSelectStorm: function (e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeStormId) return
    const storm = this.data.storms.find(function (s) { return s.id === id })
    this.setData({
      activeStormId: id,
      activeStormName: storm ? storm.name : ''
    })
    this.loadTrack(id, false)
  },

  onShareAppMessage: function () {
    return {
      title: '舔狗助手 · 台风实时路径追踪',
      path: '/pages/typhoon/typhoon'
    }
  },

  onShareTimeline: function () {
    return {
      title: '舔狗助手 · 台风实时路径追踪',
      query: ''
    }
  }
})
