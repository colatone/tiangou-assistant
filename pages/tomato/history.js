// pages/tomato/history.js — 烂番茄统计（近 30 天）
var S = require('../../utils/storage')

function dateKeyOf(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function addDays(d, n) {
  var x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

Page({
  data: {
    totalCount: 0,
    totalMinutes: 0,
    streakDays: 0,
    days: [],
    hasData: false
  },

  onShow: function () {
    this._build()
  },

  onShareAppMessage: function () {
    return { title: '烂番茄专注 · 我的 30 天', path: '/pages/tomato/tomato' }
  },
  onShareTimeline: function () {
    return { title: '烂番茄专注 · 我的 30 天', query: '' }
  },

  _build: function () {
    var records = S.getTomatoRecords()
    var today = new Date()
    var days = []
    var totalCount = 0
    var totalMinutes = 0
    var maxCount = 0
    for (var i = 29; i >= 0; i--) {
      var d = addDays(today, -i)
      var key = dateKeyOf(d)
      var rec = records[key] || { count: 0, minutes: 0 }
      days.push({
        key: key,
        label: (d.getMonth() + 1) + '/' + d.getDate(),
        count: rec.count,
        minutes: rec.minutes,
        isToday: i === 0
      })
      totalCount += rec.count
      totalMinutes += rec.minutes
      if (rec.count > maxCount) maxCount = rec.count
    }
    for (var j = 0; j < days.length; j++) {
      days[j].percent = maxCount > 0 ? Math.round(days[j].count / maxCount * 100) : 0
    }
    var streak = S.getTomatoStreak()
    this.setData({
      days: days,
      totalCount: totalCount,
      totalMinutes: totalMinutes,
      streakDays: streak,
      hasData: totalCount > 0
    })
  }
})
