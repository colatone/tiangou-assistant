// pages/tide/tide.js
// 潮汐赶海宿主页：默认秀屿港 → 后台定位成功后自动切最近站 → 日期切换 → 渲染

var tideUtils = require('../../utils/tide')

// 默认站点：泉港
var DEFAULT_STATION = {
  id: 'fujian_quangang',
  name: '泉港'
}

Page({
  data: {
    // 视图模式: 'map' | 'detail'
    viewMode: 'detail',

    // 站点信息（默认秀屿港）
    stationId: DEFAULT_STATION.id,
    stationName: DEFAULT_STATION.name,
    distanceKm: 0,

    // 用户位置
    userLat: 0,
    userLng: 0,
    hasLocation: false,
    userLocation: null,

    // 日期
    currentDate: '',
    dateOptions: [],
    currentIdx: 0,

    // 数据
    tideData: null,
    loading: true,
    error: '',
  },

  onLoad: function () {
    var that = this
    that._initDateOptions()
    // ① 立即用默认站（泉港）加载数据，用户打开就能看到内容
    that._loadWithStation(DEFAULT_STATION.id, null)
    // ② 后台静默尝试获取位置，成功了自动切换到最近站
    that._tryLocateInBackground()
  },

  onPullDownRefresh: function () {
    this.setData({ loading: true })
    this._loadTideData(function () {
      wx.stopPullDownRefresh()
    })
  },

  onShareAppMessage: function () {
    return {
      title: '舔狗助手 · 潮汐赶海 - ' + this.data.stationName,
      path: '/pages/tide/tide'
    }
  },

  onShareTimeline: function () {
    return {
      title: '舔狗助手 · 潮汐赶海 - ' + this.data.stationName,
      query: ''
    }
  },

  // ============================================================
  //  定位（后台静默，不影响默认站渲染）
  // ============================================================

  /**
   * 后台尝试获取位置：
   *   成功 → 自动切换到最近站
   *   失败/拒绝 → 静默保持默认秀屿港
   */
  _tryLocateInBackground: function () {
    var that = this
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: function (res) {
        that.setData({
          userLat: res.latitude,
          userLng: res.longitude,
          hasLocation: true,
          userLocation: { lat: res.latitude, lng: res.longitude }
        })
        // 匹配最近站，如果和当前不同则切换
        var result = tideUtils.getNearestStation(res.latitude, res.longitude)
        if (result && result.station.id !== that.data.stationId) {
          that.setData({
            stationId: result.station.id,
            stationName: result.station.name,
            distanceKm: result.distanceKm
          })
          that._loadTideData()
        } else if (result) {
          // 最近站就是当前站，只更新距离显示
          that.setData({ distanceKm: result.distanceKm })
        }
      },
      fail: function () {
        // 用户拒绝授权或定位失败 → 静默保持默认泉港
        that.setData({ hasLocation: false, userLocation: null })
      }
    })
  },

  // ============================================================
  //  数据加载
  // ============================================================

  _loadWithStation: function (stationId, userLoc) {
    var that = this
    that.setData({ loading: true, error: '' })
    that._loadTideData()
  },

  _loadTideData: function (callback) {
    var that = this
    var dateStr = that.data.currentDate || that.data.dateOptions[that.data.currentIdx].value

    tideUtils.getTideForecast(that.data.stationId, dateStr)
      .then(function (data) {
        if (!data || !data.series || !data.series.length) {
          throw new Error('EMPTY_DATA')
        }
        that.setData({
          tideData: data,
          loading: false,
          error: ''
        })
        if (callback) callback()
      })
      .catch(function (err) {
        console.error('[tide] load failed:', err)
        try {
          var station = tideUtils.getStationById(that.data.stationId)
          var mockData = require('../../utils/tide-mock').getData(dateStr, station)
          that.setData({
            tideData: mockData,
            loading: false,
            error: ''
          })
        } catch (e2) {
          that.setData({
            loading: false,
            error: '数据加载失败，请稍后重试'
          })
        }
        if (callback) callback()
      })
  },

  // ============================================================
  //  日期选择
  // ============================================================

  /** 初始化日期选项（今天 + 后 6 天） */
  _initDateOptions: function () {
    var opts = []
    var weekDays = ['日', '一', '二', '三', '四', '五', '六']
    var today = new Date()

    for (var i = 0; i < 7; i++) {
      var d = new Date(today)
      d.setDate(d.getDate() + i)
      var label = (d.getMonth() + 1) + '/' + d.getDate()
      opts.push({
        label: label,
        value: d.getFullYear() + '-' +
          ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
          ('0' + d.getDate()).slice(-2),
        weekday: weekDays[d.getDay()],
        isToday: i === 0
      })
    }

    this.setData({
      dateOptions: opts,
      currentDate: opts[0].value,
      currentIdx: 0
    })
  },

  /** 切换日期 */
  onSelectDate: function (e) {
    var idx = e.currentTarget.dataset.idx
    if (idx === this.data.currentIdx) return
    this.setData({
      currentIdx: idx,
      currentDate: this.data.dateOptions[idx].value,
      loading: true,
      tideData: null
    })
    this._loadTideData()
  },

  // ============================================================
  //  视图切换
  // ============================================================

  switchToMap: function () {
    this.setData({ viewMode: 'map' })
  },

  switchToDetail: function () {
    this.setData({ viewMode: 'detail' })
  },

  /** 地图组件选中了新站点 */
  onStationSelect: function (e) {
    var st = e.detail.station
    if (!st || st.id === this.data.stationId) return
    this.setData({
      stationId: st.id,
      stationName: st.name,
      viewMode: 'detail'
    })
    this._loadTideData()
  },

  /** 重试加载（错误提示栏按钮） */
  retryLoad: function () {
    this.setData({ loading: true, error: '', tideData: null })
    this._loadWithStation(this.data.stationId, null)
  }
})
