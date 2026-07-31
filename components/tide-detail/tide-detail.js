// components/tide-detail/tide-detail.js
// 潮汐详情组件：日期选择条 + CSS 简化潮高曲线 + 涨退潮时刻表 + 推荐赶海高亮栏

Component({
  properties: {
    // 完整的归一化潮汐数据（来自 utils/tide.js）
    data: {
      type: Object,
      value: null,
      observer: function (val) {
        if (val) this._render(val)
      }
    }
  },

  data: {
    stationName: '',
    dateLabel: '',
    series: [],       // [{time, height}]
    curvePoints: '',  // SVG/CSS polyline points
    tides: [],        // [{type, time, height}]
    phases: [],       // [{phase, startTime, endTime}]
    recommend: [],    // 推荐时段
    mockHint: false
  },

  methods: {
    _render: function (d) {
      if (!d) return

      var that = this
      var weekDays = ['日', '一', '二', '三', '四', '五', '六']
      var dt = new Date(d.date.replace(/-/g, '/'))
      var dateStr = (dt.getMonth() + 1) + '月' + dt.getDate() + '日 周' + weekDays[dt.getDay()]

      // 构建柱状图数据（含 barHeight 百分比 + 高低潮标记）
      var barSeries = that._buildBarSeries(d.series, d.tides, d.beachcombing)
      var tideMarks = that._buildTideMarks(d.tides, d.series)

      // 时间标签统一放在「最高彩色圆点」上方同一条水平线
      // （修正 yPct 后：最高点 yPct 最大，故取 maxY）
      var maxY = 0
      for (var mi = 0; mi < tideMarks.length; mi++) {
        var y = parseFloat(tideMarks[mi].yPct)
        if (y > maxY) maxY = y
      }
      var tideLabelBaseline = Math.min(95, maxY + 8)
      // 圆点紧贴时间标签下方（缩小间隙），并抬到最高柱子(maxY)之上，避免与柱子叠加
      var tideDotBaseline = Math.max(maxY + 4, tideLabelBaseline - 4)

      that.setData({
        stationName: d.station ? d.station.name : '',
        dateLabel: dateStr,
        series: barSeries,
        tides: d.tides || [],
        phases: d.phases || [],
        recommend: d.beachcombing || [],
        mockHint: !!d.mock,
        tideMarks: tideMarks,
        tideLabelBaseline: tideLabelBaseline,
        tideDotBaseline: tideDotBaseline
      })
    },

    /**
     * 将序列归一化为柱状图数据：每个点增加 barHeight(0-100%) + isHigh/isLow 标记
     * 并依据推荐赶海时间段标记 suitable（用于柱顶打钩）。
     */
    _buildBarSeries: function (series, tides, beachcombing) {
      if (!series || !series.length) return []

      var heights = series.map(function (s) { return s.height })
      var hMin = Math.min.apply(null, heights)
      var hMax = Math.max.apply(null, heights)
      var range = hMax - hMin || 1

      // 收集高低潮时间集合用于标记
      var highTimes = {}
      var lowTimes = {}
      if (tides) {
        for (var t = 0; t < tides.length; t++) {
          var key = String(tides[t].time)
          if (tides[t].type === 'high') highTimes[key] = true
          else lowTimes[key] = true
        }
      }

      // 推荐赶海时间段（分钟区间），用于标记「适合」的柱子
      var windows = []
      if (beachcombing && beachcombing.length) {
        for (var b = 0; b < beachcombing.length; b++) {
          var w = beachcombing[b]
          if (!w || !w.start || !w.end) continue
          var ps = String(w.start).split(':')
          var pe = String(w.end).split(':')
          windows.push([
            (parseInt(ps[0], 10) || 0) * 60 + (parseInt(ps[1], 10) || 0),
            (parseInt(pe[0], 10) || 0) * 60 + (parseInt(pe[1], 10) || 0)
          ])
        }
      }
      function inWindow(min) {
        for (var k = 0; k < windows.length; k++) {
          if (min >= windows[k][0] && min <= windows[k][1]) return true
        }
        return false
      }

      var result = []
      for (var i = 0; i < series.length; i++) {
        var s = series[i]
        var normHeight = ((s.height - hMin) / range * 72 + 8) // 顶部留 20% 余量给标签
        var barH = Math.max(2, Math.min(100, normHeight))
        var timeKey = String(s.time)

        // 解析 HH:MM，判断该点是否落在推荐赶海时段内
        var mm = String(s.time).match(/T(\d{2}):(\d{2})/)
        var minOfDay = mm ? (parseInt(mm[1], 10) || 0) * 60 + (parseInt(mm[2], 10) || 0) : -1
        var suitable = minOfDay >= 0 ? inWindow(minOfDay) : false

        result.push({
          time: s.time,
          height: s.height,
          barHeight: barH.toFixed(1),
          isHigh: !!highTimes[timeKey],
          isLow: !!lowTimes[timeKey],
          suitable: suitable
        })
      }
      return result
    },

    /** 构建高/低潮标记点坐标 */
    _buildTideMarks: function (tides, series) {
      if (!tides || !tides.length || !series || !series.length) return []
      var marks = []
      var seriesLen = series.length
      var heights = series.map(function (s) { return s.height })
      var hMin = Math.min.apply(null, heights)
      var hMax = Math.max.apply(null, heights)
      var range = hMax - hMin || 1

      for (var i = 0; i < tides.length; i++) {
        var t = tides[i]
        // 找到最接近的时间索引
        var idx = 0
        var minDiff = Infinity
        for (var j = 0; j < seriesLen; j++) {
          var diff = Math.abs(new Date(series[j].time) - new Date(t.time))
          if (diff < minDiff) { minDiff = diff; idx = j }
        }

        marks.push({
          xPct: (((idx + 0.5) / seriesLen) * 100).toFixed(1),
          yPct: ((t.height - hMin) / range * 72 + 8).toFixed(1),
          type: t.type,
          hm: t.time.match(/T(\d{2}):(\d{2})/) ? t.time.match(/T(\d{2}):(\d{2})/)[1] + ':' + t.time.match(/T(\d{2}):(\d{2})/)[2] : '',
          height: t.height
        })
      }
      return marks
    },

    /** 切换日期 */
    onDateSelect: function () {
      // 由父组件处理日期切换，此处仅做事件转发
      this.triggerEvent('dateselect')
    }
  }
})
