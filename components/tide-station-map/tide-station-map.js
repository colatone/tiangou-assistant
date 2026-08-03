// components/tide-station-map/tide-station-map.js
// 潮汐站点地图组件：在腾讯地图上标记沿海潮汐站 + 用户位置

var tideUtils = require('../../utils/tide')

// 安全获取 MAP_KEY（typhoon-api 可能不存在或无此字段）
var _mapKey = ''
try {
  var _apiConfig = require('../../config/typhoon-api')
  _mapKey = (_apiConfig && _apiConfig.MAP_KEY) || ''
} catch (e) {
  console.warn('[tide-map] typhoon-api not available, map may not render')
}

Component({
  properties: {
    // 当前选中的站点 ID（高亮显示）
    activeStationId: {
      type: String,
      value: ''
    },
    // 用户坐标 { lat, lng }
    userLocation: {
      type: Object,
      value: null
    }
  },

  data: {
    mapKey: _mapKey,
    latitude: 28,
    longitude: 120,
    scale: 5,
    markers: [],
    showPopup: false,
    popupStation: null,
    popupTide: null,
    // 组件内自行计算的地图高度（px）—— 原生 map 不支持 flex，必须显式 px
    mapHeight: 500,
    // 注意：activeStationId 已在 properties 中定义，此处不重复声明（避免覆盖父组件传入值）
  },

  lifetimes: {
      attached: function () {
        this._calcHeight()
      this._buildMarkers()
      this._centerMap()
    }
  },

  observers: {
    'activeStationId': function (id) {
      this._buildMarkers()
    },
    'userLocation': function (loc) {
      if (loc) {
        this._buildMarkers()
        this._centerMap()
      }
    }
  },

  methods: {
    /**
     * 计算地图可用高度（原生 map 不支持 flex，必须显式 px）
     * windowHeight 已排除状态栏+导航栏
     */
    _calcHeight: function () {
      try {
        var sysInfo = wx.getSystemInfoSync()
        var winH = sysInfo.windowHeight || 600
        // 头部卡片(~90px) + 底部导航占位(~70px) + 安全边距
        var mapH = Math.max(300, winH - 160)
        this.setData({ mapHeight: mapH })
      } catch (e) {
        console.warn('[tide-map] calc height failed, use default', e)
        this.setData({ mapHeight: 500 })
      }
    },

      /** 构建地图 markers（站点锚点 + 用户定位） */
      _buildMarkers: function () {
      var that = this
      var stations = tideUtils.getAllStations()
      if (!stations || !stations.length) return

      var activeId = that.data.activeStationId || ''
      var userLoc = that.data.userLocation

      var markers = []

      // 站点锚点
      for (var i = 0; i < stations.length; i++) {
        var s = stations[i]
        var isActive = s.id === activeId
        markers.push({
          id: i + 1,
          latitude: s.lat,
          longitude: s.lng,
          title: s.name,
          width: isActive ? 28 : 22,
          height: isActive ? 28 : 22,
          anchor: { x: 0.5, y: 0.5 },
          alpha: isActive ? 1 : 0.7,
          callout: isActive ? {
            content: s.name,
            display: 'ALWAYS',
            fontSize: 12,
            borderRadius: 8,
            padding: 4,
            bgColor: '#FFFFFF',
            color: '#FF8C69'
          } : null
        })
      }

      // 用户定位 marker
      if (userLoc && userLoc.lat && userLoc.lng) {
        markers.push({
          id: 99999,
          latitude: userLoc.lat,
          longitude: userLoc.lng,
          width: 24,
          height: 24,
          anchor: { x: 0.5, y: 1 },
          callout: {
            content: '我的位置',
            display: 'BYCLICK',
            fontSize: 11,
            borderRadius: 6,
            padding: 3,
            bgColor: '#E53935',
            color: '#FFF'
          }
        })
      }

      that.setData({ markers: markers })
    },

    /**
     * 地图居中到最近站或用户位置
     */
    _centerMap: function () {
      var activeId = this.data.activeStationId
      if (activeId) {
        var st = tideUtils.getStationById(activeId)
        if (st) {
          this.setData({ latitude: st.lat, longitude: st.lng, scale: 8 })
          return
        }
      }
      var user = this.data.userLocation
      if (user && user.lat) {
        this.setData({ latitude: user.lat, longitude: user.lng, scale: 6 })
        return
      }
      // 默认中国沿海中部
      this.setData({ latitude: 28, longitude: 120, scale: 5 })
    },

    /**
     * 点击站点 marker → 弹出赶海信息
     */
    onMarkerTap: function (e) {
      var markerId = e.detail.markerId
      if (markerId === 99999) return

      var allStations = tideUtils.getAllStations()
      if (!allStations || !allStations.length) return
      var idx = markerId - 1
      if (idx < 0 || idx >= allStations.length) return

      var station = allStations[idx]
      var that = this

      // 获取该站今日潮汐数据
      tideUtils.getTideForecast(station.id)
        .then(function (data) {
          var rec = (data.beachcombing && data.beachcombing.length)
            ? data.beachcombing[0] : null

          that.setData({
            showPopup: true,
            popupStation: station,
            popupTide: {
              date: data.date,
              recommend: rec
                ? rec.start + '~' + rec.end + ' 评分:' + rec.score + '(' + rec.levelText + ')'
                : '暂无推荐时段',
              nextTide: data.tides && data.tides.length
                ? extractNextTide(data.tides)
                : '',
              mock: !!data.mock
            }
          })

          // 触发父组件切换站点
          that.triggerEvent('stationselect', { station: station })
        })
        .catch(function () {
          that.setData({
            showPopup: true,
            popupStation: station,
            popupTide: { recommend: '数据加载失败', nextTide: '', mock: false }
          })
        })
    },

    /** 关闭弹窗 */
    onClosePopup: function () {
      this.setData({ showPopup: false, popupStation: null, popupTide: null })
    },

    /** 定位按钮 */
    onLocateMe: function () {
      var that = this
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: function (res) {
          that.setData({ userLocation: { lat: res.latitude, lng: res.longitude } })
          that._buildMarkers()
          that._centerMap()
        },
        fail: function () {
          wx.showToast({ title: '获取位置失败', icon: 'none' })
        }
      })
    }
  }
})

/** 取下一个潮况摘要 */
function extractNextTide(tides) {
  if (!tides || !tides.length) return ''
  var now = new Date()
  var curMin = now.getHours() * 60 + now.getMinutes()
  for (var i = 0; i < tides.length; i++) {
    var hm = tides[i].time.match(/T(\d{2}):(\d{2})/)
    if (!hm) continue
    var m = parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10)
    if (m >= curMin) {
      var label = tides[i].type === 'high' ? '高潮' : '低潮'
      return hm[1] + ':' + hm[2] + ' ' + label
    }
  }
  return ''
}
