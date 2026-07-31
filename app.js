App({
  onLaunch() {
    this.initStorage()
    // 检查是否有待处理的提醒
    this.checkPendingReminders()
  },

  onShow(options) {
    // 每次回到前台时也检查提醒
    this.checkPendingReminders()
  },

  initStorage() {
    const storage = require('./utils/storage')
    storage.initDefaults()
  },

  /**
   * 检查待处理的倒计时提醒
   * 在小程序启动/切回前台时触发
   */
  checkPendingReminders() {
    try {
      const storage = require('./utils/storage')
      const dateUtil = require('./utils/date')
      var reminders = storage.getReminders() || []
      if (!reminders.length) return

      var now = new Date()
      var needNotify = []
      var changed = false

      reminders.forEach(function(r) {
        if (r.notified) return
        if (!r.beforeDays || r.beforeDays <= 0) return

        var targetDate = r.targetDate
        var target = new Date(targetDate + 'T00:00:00')
        var diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        // 在提前天数范围内且未通知过
        if (diffDays >= 0 && diffDays <= r.beforeDays) {
          needNotify.push({
            name: r.eventName,
            remainingDays: diffDays,
            targetDate: targetDate,
            beforeDays: r.beforeDays
          })
          r.notified = true
          changed = true
        }
        // 目标日当天
        else if (diffDays === 0 && !r.notifiedToday) {
          needNotify.push({
            name: r.eventName,
            remainingDays: 0,
            targetDate: targetDate
          })
          r.notified = true
          changed = true
        }
      })

      if (changed) {
        storage.setReminders(reminders)
      }

      if (needNotify.length > 0) {
        this.showReminderNotification(needNotify)
      }

      // 清理过期提醒
      storage.cleanExpiredReminders()
    } catch (e) {
      console.log('检查提醒失败:', e)
    }
  },

  /**
   * 显示提醒通知（通过 Modal 形式，因为小程序限制）
   */
  showReminderNotification(notifications) {
    var msgList = notifications.map(function(n) {
      if (n.remainingDays === 0) {
        return '🎉「' + n.name + '」今天就是目标日期！'
      } else if (n.remainingDays === 1) {
        return '⏰「' + n.name + '」明天就到了！'
      } else {
        return '⏰「' + n.name + '」还剩' + n.remainingDays + '天'
      }
    })

    // 使用全局数据存储提醒信息供页面读取
    this.globalData.pendingReminders = msgList
  },

  globalData: {
    userInfo: null,
    pendingReminders: null
  }
})
