// components/typhoon-tracker/typhoon-tracker.js
// 独立可插拔组件：台风路径地图 + 时间轴 + 图例 + 点击交互详情面板

const apiConfig = require('../../config/typhoon-api')

// 强度等级 → 名称 / 颜色（气象惯例）
const LEVEL_NAMES = {
  1: '热带低压',
  2: '热带风暴',
  3: '强热带风暴',
  4: '台风',
  5: '强台风',
  6: '超强台风'
}
const LEVEL_COLORS = {
  1: '#4CAF50',
  2: '#FFC107',
  3: '#FF9800',
  4: '#FF5722',
  5: '#E91E63',
  6: '#9C27B0'
}
const DIR_MAP = {
  N: '北', NNE: '北东北', NE: '东北', ENE: '东东北', E: '东',
  ESE: '东东南', SE: '东南', SSE: '南东南', S: '南', SSW: '南西南',
  SW: '西南', WSW: '西西南', W: '西', WNW: '西西北', NW: '西北', NNW: '北西北'
}

// 强度等级 → 对应 marker 图标路径（路径点：实心球）
function markerIconPath(level, isForecast) {
  if (isForecast) return '/images/marker_fcst.png'
  return '/images/marker_lvl' + level + '.png'
}

// 强度等级 → 对应「台风眼」图标路径（当前点：放大螺旋台风眼，沿路径移动演示用）
function markerIconEyePath(level, isForecast) {
  if (isForecast) return '/images/marker_eye_fcst.png'
  return '/images/marker_eye' + level + '.png'
}

// 时间格式化：2026-07-20T08:00+08:00 → 07-20 08:00
function formatTime(iso) {
  if (!iso) return ''
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso
  return m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5]
}
function formatTimeShort(iso) {
  if (!iso) return ''
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return m[2] + '-' + m[3]
}
function formatDir(code) {
  return DIR_MAP[code] ? DIR_MAP[code] + '(' + code + ')' : (code || '—')
}
function formatCoord(v, dir) {
  if (v == null || isNaN(v)) return '—'
  return v.toFixed(2) + '°' + dir
}

// 中央气象台标准台风警戒线（固定边界，围绕中国海岸线，不随台风位置变化）
// 24小时警戒线（实线）：(0°N,105°E) → (4.5°N,113°E) → (11°N,119°E) → (18°N,119°E) → (22°N,127°E) → (34°N,127°E)
// 48小时警戒线（虚线）：(0°N,105°E) → (0°N,120°E) → (15°N,132°E) → (34°N,132°E)
const WARN_24H = [
  { latitude: 0, longitude: 105 },
  { latitude: 4.5, longitude: 113 },
  { latitude: 11, longitude: 119 },
  { latitude: 18, longitude: 119 },
  { latitude: 22, longitude: 127 },
  { latitude: 34, longitude: 127 }
]
const WARN_48H = [
  { latitude: 0, longitude: 105 },
  { latitude: 0, longitude: 120 },
  { latitude: 15, longitude: 132 },
  { latitude: 34, longitude: 132 }
]

Component({
  properties: {
    points: { type: Array, value: [] },
    stormName: { type: String, value: '' }
  },

  data: {
    mapKey: apiConfig.MAP_KEY,
    latitude: 22,
    longitude: 125,
    scale: 4,
    polylines: [],
    // 全部路径点标记（强度色圆点）
    pathMarkers: [],
    // 合并后的全部标记（路径点 + 当前位置大标记 + 用户定位，传给 map）
    allMarkers: [],
    // 当前位置大标记（时间轴驱动）
    _currentMarker: [],
    currentIndex: 0,
    current: null,
    scaleStart: '',
    scaleEnd: '',
    isPlaying: false,
    tzLabel: '北京时间',

    // 定位按钮模式：'typhoon' = 当前以台风最新实况点为中心；'user' = 以我的位置为中心
    locateMode: 'typhoon',

    // 我的位置在屏幕上的像素坐标（cover-view 呼吸环定位用；null=尚未定位）
    userScreen: null,

    // ===== 弹窗状态 =====
    popupVisible: false,
    popupPoint: null,

    // 强度图例按行分组：第1行 弱（1~3），第2行 强（4~6），路径线单独一行
    legendRows: [
      [
        { level: 1, name: '热带低压', color: LEVEL_COLORS[1] },
        { level: 2, name: '热带风暴', color: LEVEL_COLORS[2] },
        { level: 3, name: '强热带风暴', color: LEVEL_COLORS[3] }
      ],
      [
        { level: 4, name: '台风', color: LEVEL_COLORS[4] },
        { level: 5, name: '强台风', color: LEVEL_COLORS[5] },
        { level: 6, name: '超强台风', color: LEVEL_COLORS[6] }
      ]
    ],
    _timer: null
  },

  observers: {
    'points': function (points) {
      if (points && points.length) {
        this.buildMap(points)
      }
    }
  },

  lifetimes: {
    ready: function () {
      // 地图渲染完成后创建上下文，供命令式 includePoints 使用
      this._mapCtx = wx.createMapContext('typhoonMap', this)
    },
    detached: function () {
      if (this.data._timer) {
        clearInterval(this.data._timer)
        this.data._timer = null
      }
    }
  },

  methods: {
    /**
     * 根据路径点构建全部地图数据：
     * - polyline（实况实线+强度色阶 / 预报虚线）
     * - pathMarkers（路径上每个采样点的强度色标记 + 时间 callout）
     * - markers（当前位置大标记，时间轴驱动）
     */
    buildMap: function (points) {
      var that = this
      var toLatLng = function (p) {
        return { latitude: p.lat, longitude: p.lng }
      }

      var real = points.filter(function (p) { return !p.isForecast })
      var forecast = points.filter(function (p) { return p.isForecast })

      var realPts = real.map(toLatLng)
      var forecastPts = forecast.map(toLatLng)
      var connect = realPts.length ? [realPts[realPts.length - 1]] : []
      var forecastFull = connect.concat(forecastPts)

      // 实况线：每段颜色对应当前点强度
      var realColorList = real.map(function (p) {
        return LEVEL_COLORS[p.level] || '#FF5722'
      })

      var polylines = []
      if (realPts.length > 1) {
        polylines.push({
          points: realPts,
          color: '#FF5722',
          width: 5,
          colorList: realColorList,
          dottedLine: false,
          arrowLine: true,
          borderWidth: 1,
          borderColor: '#FFFFFF'
        })
      }
      if (forecastFull.length > 1) {
        polylines.push({
          points: forecastFull,
          color: '#6ECBF5',
          width: 3,
          dottedLine: true
        })
      }

      // 构建路径点标记（强度色圆点 + 时间 callout）
      var pathMarkers = this.buildPathMarkers(points)

      // 默认显示最新实况点（最后一个非预报点），而非最早点
      var defaultIdx = real.length > 0 ? real.length - 1 : points.length - 1
      var currentMarker = this.buildCurrentMarker(points, defaultIdx)

      // 24h/48h 固定警戒线（中央气象台标准，围绕海岸线的固定边界，不随台风位置变化）
      var warningPolylines = this.buildWarningLines()
      polylines = polylines.concat(warningPolylines)

      // 进入页面时地图以「最新实况点」为中心
      // 兜底：若无实况点，则用序列最后一个点（可能为预报点）的坐标，
      // 避免出现中国海默认中心(22,125)导致「一进来没对准台风」的问题
      var lastPt = points[points.length - 1]
      var lastReal = realPts.length
        ? realPts[realPts.length - 1]
        : (lastPt ? { latitude: lastPt.lat, longitude: lastPt.lng } : { latitude: 22, longitude: 125 })

      var that = this
      this.setData({
        polylines: polylines,
        latitude: lastReal.latitude,
        longitude: lastReal.longitude,
        scale: 5,
        pathMarkers: pathMarkers,
        _currentMarker: currentMarker,
        allMarkers: this._mergeAllMarkers(pathMarkers, currentMarker),
        currentIndex: defaultIdx,
        current: this.formatCurrent(points[defaultIdx]),
        scaleStart: formatTimeShort(points[0].time),
        scaleEnd: formatTimeShort(points[points.length - 1].time),
        popupVisible: false,
        popupPoint: null
      }, function () {
        // 微信 <map> 初始渲染完成后不会因 latitude/longitude 的 setData 自动重新居中，
        // 必须用命令式 includePoints 框选「最新实况点附近的小范围」来强制把视野对准台风。
        that._centerOnLatest(points)
      })

      // 异步获取用户位置，成功后追加红色定位 marker
      this.fetchUserLocation()
    },

    /**
     * 判断某个点是否需要显示标记（避免太密）。
     * 规则：首尾点、强度变化点、每隔 SAMPLE_STEP 个点
     */
    shouldShowPathMarker: function (idx, points) {
      if (idx === 0 || idx === points.length - 1) return true
      if (idx % this._sampleStep(points) === 0) return true
      // 强度变化点始终显示
      if (idx > 0 && points[idx].level !== points[idx - 1].level) return true
      return false
    },

    _sampleStep: function (points) {
      // 点多时稀疏，点少时密集
      if (points.length > 40) return 4
      if (points.length > 20) return 3
      return 2
    },

    /**
     * 构建路径上的强度标记数组。
     * 每个可见标记带强度色 icon + 简短时间 callout。
     */
    buildPathMarkers: function (points) {
      var that = this
      var list = []
      for (var i = 0; i < points.length; i++) {
        if (!this.shouldShowPathMarker(i, points)) continue
        var p = points[i]
        var isFcst = !!p.isForecast
        var lvl = p.level || 1
        list.push({
          id: i + 1,           // 0 保留给当前点
          latitude: p.lat,
          longitude: p.lng,
          width: 16,
          height: 16,
          iconPath: markerIconPath(lvl, isFcst),
          anchor: { x: 0.5, y: 0.5 },
          // 时间标注 callout
          callout: {
            content: formatTime(p.time),
            color: '#333333',
            bgColor: '#FFFFFFEE',
            padding: 4,
            borderRadius: 6,
            display: 'BYCLICK',
            fontSize: 10,
            textAlign: 'center',
            borderWidth: 1,
            borderColor: (LEVEL_COLORS[lvl] || '#FF5722') + '60'
          }
        })
      }
      return list
    },

    /**
     * 构建 24h / 48h 固定警戒折线（中央气象台标准，围绕海岸线的固定边界）。
     * 不依赖台风位置——无论台风在哪，这两条线始终固定在地图上。
     *   24h = 红色实线
     *   48h = 绿色虚线
     */
    buildWarningLines: function () {
      return [
        {
          points: WARN_24H,
          color: '#EF9A9A',
          width: 2,
          dottedLine: false,
          arrowLine: false,
          zIndex: 1
        },
        {
          points: WARN_48H,
          color: '#81C784',
          width: 2,
          dottedLine: true,
          arrowLine: false,
          zIndex: 1
        }
      ]
    },

    /**
     * 合并：路径点标记 + 当前位置标记 + 警戒线文字标注 + 用户定位标记
     */
    _mergeAllMarkers: function (pathMarkers, currentMarker) {
      var userLoc = this.data.userLocationMarker
      var result = pathMarkers.concat(currentMarker).concat(this._warnLabelMarkers())
      if (userLoc) {
        result.push(userLoc)
      }
      return result
    },

    /**
     * 命令式把地图视野对准「最新实况点」。
     * 微信 <map> 的 latitude/longitude 绑定在初始渲染后不一定会重新居中，
     * 因此用 includePoints 框选一个点附近的小范围（±2°）来强制居中并锁定合适缩放。
     */
    _centerOnLatest: function (points) {
      var pts = points || this.data.points || []
      if (!pts.length) return
      var real = pts.filter(function (p) { return !p.isForecast })
      var last = real.length ? real[real.length - 1] : pts[pts.length - 1]
      var lat = last.lat
      var lng = last.lng
      var ctx = this.getMapCtx()
      if (ctx && ctx.includePoints) {
        // 框选「最新实况点 ±8°」范围，强制把视野中心对准台风，
        // 同时留出足够上下文让附近的 24h/48h 警戒线进入画面（文字标注才可见）。
        var pad = 8
        ctx.includePoints({
          points: [
            { latitude: Math.max(-89, lat - pad), longitude: Math.max(-179, lng - pad) },
            { latitude: Math.min(89, lat + pad), longitude: Math.min(179, lng + pad) }
          ],
          padding: [80, 60, 120, 60]
        })
      }
    },

    /**
     * 播放时把视野框选为「整条路径」（实况 + 预报全部点），便于观察动画全过程。
     */
    _fitAllTrack: function () {
      var pts = this.data.points || []
      if (!pts.length) return
      var fit = pts.map(function (p) { return { latitude: p.lat, longitude: p.lng } })
      var ctx = this.getMapCtx()
      if (ctx && ctx.includePoints) {
        ctx.includePoints({ points: fit, padding: [80, 60, 120, 60] })
      }
    },

    /**
     * 在警戒线上选取一个锚点：距离台风约 8° 的线顶点（保证文字落在线上、且远离台风标记不重叠），
     * 并计算该顶点附近线段在屏幕上的旋转角（让文字沿线排布）。
     */
    _anchorForLine: function (line, lat, lng) {
      var best = line[0]
      var bestScore = Infinity
      for (var i = 0; i < line.length; i++) {
        var d = Math.sqrt(Math.pow(line[i].latitude - lat, 2) + Math.pow(line[i].longitude - lng, 2))
        var score = Math.abs(d - 6)
        if (score < bestScore) { bestScore = score; best = line[i] }
      }
      var idx = line.indexOf(best)
      var nb = idx > 0 ? line[idx - 1] : (line[idx + 1] || best)
      var dLat = nb.latitude - best.latitude
      var dLng = nb.longitude - best.longitude
      var latRad = best.latitude * Math.PI / 180
      var angle = Math.atan2(-dLat, dLng * Math.cos(latRad)) * 180 / Math.PI
      return { lat: best.latitude, lng: best.longitude, angle: angle }
    },

    /**
     * 警戒线文字标注（原生 marker label，必显示在地图上；普通 view 覆盖层会被原生地图盖住）。
     * 锚点固定在警戒线本体上（距离台风约 6° 的线顶点），文字贴着线、无边框，干净不跳动。
     */
    _warnLabelMarkers: function () {
      var pts = this.data.points || []
      if (!pts.length) return []
      var real = pts.filter(function (p) { return !p.isForecast })
      var last = real.length ? real[real.length - 1] : pts[pts.length - 1]
      var p24 = this._anchorForLine(WARN_24H, last.lat, last.lng)
      var p48 = this._anchorForLine(WARN_48H, last.lat, last.lng)
      return [
        this._buildWarnLabel(90001, p24, '24小时警戒线', '#C62828'),
        this._buildWarnLabel(90002, p48, '48小时警戒线', '#2E7D32')
      ]
    },

    _buildWarnLabel: function (id, anchor, text, color) {
      return {
        id: id,
        latitude: anchor.lat,
        longitude: anchor.lng,
        iconPath: '/images/transparent.png',
        width: 1,
        height: 1,
        anchor: { x: 0.5, y: 0.5 },
        label: {
          content: text,
          color: color,
          fontSize: 11,
          bgColor: '#FFFFFFCC',
          padding: 3,
          borderRadius: 4,
          borderWidth: 0,
          textAlign: 'center',
          x: 0,
          y: -16
        },
        zIndex: 50
      }
    },

    /**
     * 获取地图上下文（懒加载，ready 时已创建）
     */
    getMapCtx: function () {
      if (!this._mapCtx) {
        this._mapCtx = wx.createMapContext('typhoonMap', this)
      }
      return this._mapCtx
    },

    /**
     * 把「我的位置」经纬度转成地图内的屏幕像素坐标，供 cover-view 呼吸环定位。
     * 地图平移/缩放后需重新计算（onRegionChange 调用）。
     */
    _updateUserScreen: function () {
      var self = this
      var ulat = this.data.userLat
      var ulng = this.data.userLng
      if (ulat == null || ulng == null) return
      var ctx = this.getMapCtx()
      if (ctx && ctx.toScreenLocation) {
        ctx.toScreenLocation({
          latitude: ulat,
          longitude: ulng,
          success: function (res) {
            self.setData({ userScreen: { x: res.x, y: res.y } })
          }
        })
      }
    },

    /**
     * 地图视野变化（平移/缩放/动画）时，重新计算我的位置屏幕坐标，
     * 让呼吸环始终跟随在定位点上。
     */
    onRegionChange: function () {
      this._updateUserScreen()
    },

    /**
     * 获取用户实时位置，成功后追加红色图钉 marker 到地图。
     * - 若用户位置接近台风路径，则命令式把「最新实况点 + 用户位置」一起框入视野，保证图钉可见
     * - 若远离（如内陆），地图仍保持「最新实况点」居中，图钉在地图上只是需点「定位」按钮跳转查看
     */
    fetchUserLocation: function () {
      var that = this
      wx.getLocation({
        type: 'gcj02',           // 国测局坐标（腾讯地图兼容）
        isHighAccuracy: true,
        success: function (res) {
          var ulat = res.latitude
          var ulng = res.longitude
          var marker = that._buildUserMarker(ulat, ulng)
          // 仅追加「我的位置」标记，不主动移动视野（视野由定位按钮显式控制）
          var all = that._mergeAllMarkers(that.data.pathMarkers, that.data._currentMarker)
          that.setData({
            userLocationMarker: marker,
            allMarkers: all,
            userLat: ulat,
            userLng: ulng
          }, function () {
            that._updateUserScreen()
          })
        },
        fail: function () {
          // 自动获取失败（未授权 / 未开启模拟定位）静默，由「定位」按钮重试
        }
      })
    },

    /**
     * 构建红色图钉 marker
     */
    _buildUserMarker: function (lat, lng) {
      return {
        id: 99999,             // 用户定位固定 id，不与路径点(1~N)/当前点(0)冲突
        latitude: lat,
        longitude: lng,
        width: 36,
        height: 36,
        iconPath: '/images/icon_location.png',
        anchor: { x: 0.5, y: 0.5 },   // GPS 脉冲点：圆心对准坐标
        zIndex: 998,
        callout: {
          content: '我的位置',
          color: '#E53935',
          bgColor: '#FFFFFFEE',
          padding: 4,
          borderRadius: 8,
          display: 'ALWAYS',
          fontSize: 10,
          textAlign: 'center'
        }
      }
    },

    /**
     * 「定位」按钮（切换式）：
     *  - 当前以台风最新实况点为中心（locateMode='typhoon'）时按下 → 以「我的位置」为中心；
     *  - 当前以「我的位置」为中心（locateMode='user'）时按下 → 切回台风最新实况点为中心。
     * 台风路径标记/折线始终保留，不会因定位而隐藏。
     */
    onLocateMe: function () {
      var that = this
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: function (res) {
          var ulat = res.latitude
          var ulng = res.longitude
          var userMarker = that._buildUserMarker(ulat, ulng)
          // 合并标记（路径点 + 当前点 + 用户点），台风路径标记始终保留
          var all = that.data.pathMarkers.concat(that.data._currentMarker).concat([userMarker])
          var ctx = that.getMapCtx()

          if (that.data.locateMode !== 'user') {
            // 第一次按：以「我的位置」为中心
            if (ctx && ctx.includePoints) {
              ctx.includePoints({
                points: [
                  { latitude: Math.max(-89, ulat - 2), longitude: Math.max(-179, ulng - 2) },
                  { latitude: Math.min(89, ulat + 2), longitude: Math.min(179, ulng + 2) }
                ],
                padding: [80, 60, 120, 60]
              })
            }
            that.setData({
              userLocationMarker: userMarker,
              allMarkers: all,
              userLat: ulat,
              userLng: ulng,
              locateMode: 'user'
            }, function () {
              that._updateUserScreen()
            })
          } else {
            // 再按：切回台风最新实况点为中心
            that.setData({
              userLocationMarker: userMarker,
              allMarkers: all,
              userLat: ulat,
              userLng: ulng,
              locateMode: 'typhoon'
            }, function () {
              that._updateUserScreen()
            })
            that._centerOnLatest()
          }
        },
        fail: function () {
          wx.showToast({ title: '无法获取定位，请检查位置权限', icon: 'none' })
        }
      })
    },

    /**
     * 当前位置的大标记（时间轴驱动，带醒目 callout）
     */
    buildCurrentMarker: function (points, index) {
      var cur = points[index]
      if (!cur) return []
      var lvl = cur.level || 1
      return [{
        id: 0,               // 当前点固定 id=0
        latitude: cur.lat,
        longitude: cur.lng,
        width: 40,
        height: 40,
        iconPath: markerIconEyePath(lvl, !!cur.isForecast),
        anchor: { x: 0.5, y: 0.5 },
        zIndex: 999,
        callout: {
          content: this.markerCallout(cur),
          color: '#FFFFFF',
          bgColor: '#FF8C69',
          padding: 8,
          borderRadius: 10,
          display: 'ALWAYS',
          fontSize: 11,
          textAlign: 'center'
        }
      }]
    },

    markerCallout: function (p) {
      var name = LEVEL_NAMES[p.level] || ''
      return formatTime(p.time) + '\n' + name + ' ' + (p.windSpeed || '?') + 'm/s'
    },

    /**
     * 格式化单点完整数据（供信息面板和弹窗使用）
     */
    formatCurrent: function (p) {
      return {
        time: formatTime(p.time),
        lat: p.lat,
        lng: p.lng,
        latFmt: formatCoord(p.lat, 'N'),
        lngFmt: formatCoord(p.lng, 'E'),
        level: p.level,
        levelName: LEVEL_NAMES[p.level] || '',
        color: LEVEL_COLORS[p.level] || '#FF5722',
        pressure: p.pressure,
        windSpeed: p.windSpeed,
        moveDir: formatDir(p.moveDir),
        moveSpeed: p.moveSpeed,
        radius7: p.radius7,
        isForecast: p.isForecast
      }
    },

    /**
     * 地图 markertap：点击任意路径点 → 弹出详情面板
     */
    onMapMarkerTap: function (e) {
      var markerId = e.markerId
      var points = this.data.points
      var targetIdx = -1

      // id=0 是当前点标记，id=1~N 是路径点标记(id=idx+1)
      if (markerId === 0) {
        targetIdx = this.data.currentIndex
      } else if (markerId >= 1 && markerId <= points.length) {
        targetIdx = markerId - 1
      }

      if (targetIdx < 0 || targetIdx >= points.length) return

      var pt = points[targetIdx]
      // 同步时间轴到该点位置
      this.setData({
        currentIndex: targetIdx,
        current: this.formatCurrent(pt),
        _currentMarker: this.buildCurrentMarker(points, targetIdx),
        allMarkers: this._mergeAllMarkers(this.data.pathMarkers, this.buildCurrentMarker(points, targetIdx)),
        popupVisible: true,
        popupPoint: this.formatCurrent(pt)
      })
    },

    /** 关闭弹窗 */
    onClosePopup: function () {
      this.setData({ popupVisible: false, popupPoint: null })
    },

    /**
     * 时间轴拖动 → 更新当前点
     */
    updateCurrent: function (idx) {
      var points = this.data.points
      if (!points || !points.length) return
      idx = Math.max(0, Math.min(points.length - 1, idx))
      this.setData({
        currentIndex: idx,
        current: this.formatCurrent(points[idx]),
        _currentMarker: this.buildCurrentMarker(points, idx),
        allMarkers: this._mergeAllMarkers(this.data.pathMarkers, this.buildCurrentMarker(points, idx))
      })
    },

    onSliderChanging: function (e) {
      this.updateCurrent(e.detail.value)
    },

    onSliderChange: function (e) {
      this.updateCurrent(e.detail.value)
    },

    /**
     * 播放 / 暂停：自动推进时间轴
     */
    onTogglePlay: function () {
      var that = this
      if (this.data._timer) {
        clearInterval(this.data._timer)
        this.data._timer = null
        this.setData({ isPlaying: false })
        // 停止播放：视野回到台风最新实况点为中心
        that._centerOnLatest()
        return
      }
      this.setData({ isPlaying: true })
      // 开始播放：视野框选整条路径（实况 + 预报），便于观察动画全过程
      that._fitAllTrack()
      var timer = setInterval(function () {
        var idx = that.data.currentIndex + 1
        if (idx >= that.data.points.length) idx = 0
        that.updateCurrent(idx)
      }, 600)
      this.data._timer = timer
    },

    /**
     * 阻止弹窗内触摸滑动穿透到页面（wxml 中 catchtouchmove 引用，必须存在否则报错）
     */
    preventMove: function () {}
  }
})
