// pages/wooden-fish/history.js — 独立历史战绩页（V29.4）
var S = require('../../utils/storage')

Page({
  data: {
    historyList: [],
    totalDays: 0,
    totalHits: 0
  },

  onLoad: function () {
    this._loadHistory()
  },

  onShow: function () {
    this._loadHistory()
  },

  _loadHistory: function () {
    var log = wx.getStorageSync('wf_daily_log') || {}
    var list = []
    var totalHits = 0
    var totalDays = 0
    var now = new Date()

    // 从近到远排序（今天=第0行在最前面）
    for (var i = 0; i < 30; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      var key = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0')
      var hits = Number(log[key]) || 0
      if (hits > 0) { totalDays++; totalHits += hits }
      list.push({
        date: key,
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        weekday: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        hits: hits,
        isToday: i === 0
      })
    }

    this.setData({
      historyList: list,
      totalDays: totalDays,
      totalHits: totalHits
    })
  }
})
