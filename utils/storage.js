// utils/storage.js

const STORAGE_KEYS = {
  EVENTS: 'time_events',
  CATEGORIES: 'time_categories',
  QUOTE_INDEX: 'daily_quote_index',
  QUOTE_DATE: 'daily_quote_date',
  REMINDERS: 'time_reminders',
  LOTTERY_CONFIG: 'lottery_config',
  LOTTERY_RECORDS: 'lottery_records',
  LOTTERY_PEOPLE: 'lottery_people',
  WOODEN_FISH_MERIT: 'wooden_fish_merit',
  WOODEN_FISH_TODAY: 'wooden_fish_today',
  WOODEN_FISH_DATES: 'wooden_fish_dates',
  WOODEN_FISH_SETTINGS: 'wooden_fish_settings',
  DRAGONBALL_CACHE: 'dragonball_cache',
  DRAGONBALL_FOLLOW: 'dragonball_follow'
}

// 抽奖默认奖项配置（首次启动种子化）—— 团队抽签「谁做家务」场景
const DEFAULT_LOTTERY_CONFIG = {
  updatedAt: Date.now(),
  prizes: [
    { id: 'p1', name: '洗碗', icon: '🍽️', color: '#FF8C69', weight: 1, quantity: 1, drawCount: 1 },
    { id: 'p2', name: '扫地', icon: '🧹', color: '#6ECBF5', weight: 1, quantity: 1, drawCount: 1 }
  ]
}

// 抽奖默认人员列表（首次启动种子化）
const DEFAULT_LOTTERY_PEOPLE = [
  { id: 'u1', name: '大帅哥', color: '#FF6B9D' },
  { id: 'u2', name: '美女', color: '#A78BFA' },
  { id: 'u3', name: '关中王他哥', color: '#5B8DEF' },
  { id: 'u4', name: '关中王', color: '#FFB347' }
]

// 木鱼默认设置
const DEFAULT_WOODEN_FISH_SETTINGS = {
  autoSpeed: 500,
  showStick: true,
  theme: 'classic',
  vibration: false,
  fortuneN: 30
}

const PRESET_CATEGORIES = [
  { id: 'birthday', name: '生日', icon: '🎂', color: '#FF8C94', isPreset: true, createdAt: Date.now() },
  { id: 'love', name: '恋爱', icon: '❤️', color: '#FF6B6B', isPreset: true, createdAt: Date.now() },
  { id: 'festival', name: '节日', icon: '🎉', color: '#FFA07A', isPreset: true, createdAt: Date.now() },
  { id: 'anniversary', name: '纪念日', icon: '🌟', color: '#FFD700', isPreset: true, createdAt: Date.now() },
  { id: 'travel', name: '旅行', icon: '✈️', color: '#6ECBF5', isPreset: true, createdAt: Date.now() },
  { id: 'work', name: '工作', icon: '💼', color: '#A0A0A0', isPreset: true, createdAt: Date.now() },
  { id: 'custom', name: '自定义', icon: '🏷️', color: '#C085FF', isPreset: true, createdAt: Date.now() }
]

/* 获取出厂示例事件（每次调用实时计算，如元旦倒计时指向次年）*/
function getSampleEvents() {
  const now = new Date()
  return [
    {
      id: 'sample-1',
      name: '亲，你来世界已经',
      date: '1989-08-31',
      type: 'elapsed',
      category: 'birthday',
      note: '生命的起点',
      remindEnabled: false,
      remindBeforeDays: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'sample-2',
      name: '和她❤️相爱已经',
      date: '2011-08-06',
      type: 'elapsed',
      category: 'love',
      note: '美好的开始',
      remindEnabled: false,
      remindBeforeDays: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'sample-3',
      name: '元旦倒计时 🎆',
      date: `${now.getFullYear() + 1}-01-01`,
      type: 'countdown',
      category: 'festival',
      note: '未来已经在路上',
      remindEnabled: true,
      remindBeforeDays: 7,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ]
}

/* 恢复出厂示例事件（追加未存在的，不覆盖用户已有记录）*/
function restoreSampleEvents() {
  var events = getEvents()
  var samples = getSampleEvents()
  var existingIds = events.map(function (e) { return e.id })
  var toAdd = samples.filter(function (s) { return existingIds.indexOf(s.id) === -1 })
  if (toAdd.length) {
    setEvents(events.concat(toAdd))
  }
  return toAdd.length
}

function initDefaults() {
  try {
    const events = wx.getStorageSync(STORAGE_KEYS.EVENTS)
    if (!events || !events.length) {
      wx.setStorageSync(STORAGE_KEYS.EVENTS, getSampleEvents())
    }

    const categories = wx.getStorageSync(STORAGE_KEYS.CATEGORIES)
    if (!categories || !categories.length) {
      wx.setStorageSync(STORAGE_KEYS.CATEGORIES, PRESET_CATEGORIES)
    }

    // 初始化提醒列表（如不存在）
    var reminders = wx.getStorageSync(STORAGE_KEYS.REMINDERS)
    if (!reminders) {
      wx.setStorageSync(STORAGE_KEYS.REMINDERS, [])
    }

    // 初始化抽奖配置（如不存在）
    var lotteryConfig = wx.getStorageSync(STORAGE_KEYS.LOTTERY_CONFIG)
    if (!lotteryConfig || !lotteryConfig.prizes || !lotteryConfig.prizes.length) {
      wx.setStorageSync(STORAGE_KEYS.LOTTERY_CONFIG, JSON.parse(JSON.stringify(DEFAULT_LOTTERY_CONFIG)))
    }

    // 初始化人员列表（如不存在）
    var lotteryPeople = wx.getStorageSync(STORAGE_KEYS.LOTTERY_PEOPLE)
    if (!lotteryPeople || !lotteryPeople.length) {
      wx.setStorageSync(STORAGE_KEYS.LOTTERY_PEOPLE, JSON.parse(JSON.stringify(DEFAULT_LOTTERY_PEOPLE)))
    }

    // 初始化抽签记录（如不存在）
    var lotteryRecords = wx.getStorageSync(STORAGE_KEYS.LOTTERY_RECORDS)
    if (!lotteryRecords) {
      wx.setStorageSync(STORAGE_KEYS.LOTTERY_RECORDS, [])
    }

    // 初始化木鱼功德（如不存在）
    var merit = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_MERIT)
    if (merit === '' || merit === null || merit === undefined) {
      wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_MERIT, 0)
    }

    // 初始化木鱼今日敲击（如不存在或非今天则重置）
    var todayFish = getTodayStr()
    var fishTodayData = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_TODAY)
    if (!fishTodayData || fishTodayData.date !== todayFish) {
      wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_TODAY, { date: todayFish, count: 0 })
    }

    // 初始化木鱼连续天数（如不存在）
    var fishDates = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_DATES)
    if (!fishDates) {
      wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_DATES, [])
    }

    // 初始化木鱼设置（如不存在）
    var fishSettings = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_SETTINGS)
    if (!fishSettings) {
      wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_SETTINGS, JSON.parse(JSON.stringify(DEFAULT_WOODEN_FISH_SETTINGS)))
    }
  } catch (e) {
    console.error('初始化存储失败:', e)
  }
}

function getEvents() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.EVENTS) || []
  } catch (e) {
    return []
  }
}

function setEvents(events) {
  wx.setStorageSync(STORAGE_KEYS.EVENTS, events)
}

function getCategories() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.CATEGORIES) || PRESET_CATEGORIES
  } catch (e) {
    return PRESET_CATEGORIES
  }
}

function setCategories(categories) {
  wx.setStorageSync(STORAGE_KEYS.CATEGORIES, categories)
}

function getQuoteIndex() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.QUOTE_INDEX) || 0
  } catch (e) {
    return 0
  }
}

function setQuoteIndex(index) {
  wx.setStorageSync(STORAGE_KEYS.QUOTE_INDEX, index)
}

function getQuoteDate() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.QUOTE_DATE) || ''
  } catch (e) {
    return ''
  }
}

function setQuoteDate(date) {
  wx.setStorageSync(STORAGE_KEYS.QUOTE_DATE, date)
}

/* ===== 提醒相关 ===== */

function getReminders() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.REMINDERS) || []
  } catch (e) {
    return []
  }
}

function setReminders(reminders) {
  wx.setStorageSync(STORAGE_KEYS.REMINDERS, reminders)
}

/**
 * 清理已过期的提醒记录
 */
function cleanExpiredReminders() {
  var reminders = getReminders()
  const dateUtil = require('./date')
  const todayStr = dateUtil.getTodayStr()

  // 删除目标日期已过且已通知的提醒
  var cleaned = reminders.filter(function(r) {
    if (r.targetDate < todayStr && r.notified) return false
    return true
  })
  setReminders(cleaned)
  return cleaned
}

/* ===== 抽奖相关 ===== */

function getLotteryConfig() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.LOTTERY_CONFIG) || JSON.parse(JSON.stringify(DEFAULT_LOTTERY_CONFIG))
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_LOTTERY_CONFIG))
  }
}

function setLotteryConfig(config) {
  wx.setStorageSync(STORAGE_KEYS.LOTTERY_CONFIG, config)
}

function getLotteryRecords() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.LOTTERY_RECORDS) || []
  } catch (e) {
    return []
  }
}

function setLotteryRecords(records) {
  wx.setStorageSync(STORAGE_KEYS.LOTTERY_RECORDS, records)
}

function addLotteryRecord(record) {
  var records = getLotteryRecords()
  records.unshift(record)
  wx.setStorageSync(STORAGE_KEYS.LOTTERY_RECORDS, records)
  return records
}

/* ===== 抽奖人员列表 ===== */

function getLotteryPeople() {
  try {
    var arr = wx.getStorageSync(STORAGE_KEYS.LOTTERY_PEOPLE)
    if (!arr || !arr.length) return JSON.parse(JSON.stringify(DEFAULT_LOTTERY_PEOPLE))
    return arr
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_LOTTERY_PEOPLE))
  }
}

function setLotteryPeople(people) {
  wx.setStorageSync(STORAGE_KEYS.LOTTERY_PEOPLE, people || [])
}

/* ===== 木鱼相关 ===== */

function getTodayStr() {
  var d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function getWoodFishMerit() {
  try {
    var m = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_MERIT)
    return typeof m === 'number' ? m : (Number(m) || 0)
  } catch (e) {
    return 0
  }
}

function setWoodFishMerit(val) {
  wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_MERIT, Number(val) || 0)
}

function addWoodFishMerit(delta) {
  var m = getWoodFishMerit()
  m += delta
  setWoodFishMerit(m)
  return m
}

function getWoodFishToday() {
  try {
    var d = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_TODAY)
    if (!d) { var t = getTodayStr(); d = { date: t, count: 0 } }
    // 跨天重置
    if (d.date !== getTodayStr()) {
      d = { date: getTodayStr(), count: 0 }
      wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_TODAY, d)
    }
    return d
  } catch (e) {
    return { date: getTodayStr(), count: 0 }
  }
}

function incWoodFishToday() {
  var d = getWoodFishToday()
  d.count++
  wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_TODAY, d)

  // 更新连续天数
  var dates = getWoodFishDates()
  var today = getTodayStr()
  if (dates.length === 0 || dates[dates.length - 1] !== today) {
    dates.push(today)
    wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_DATES, dates)
  }

  return d.count
}

function getWoodFishDates() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_DATES) || []
  } catch (e) {
    return []
  }
}

function getWoodFishSettings() {
  try {
    var s = wx.getStorageSync(STORAGE_KEYS.WOODEN_FISH_SETTINGS)
    if (!s) return JSON.parse(JSON.stringify(DEFAULT_WOODEN_FISH_SETTINGS))
    return s
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_WOODEN_FISH_SETTINGS))
  }
}

function setWoodFishSettings(settings) {
  wx.setStorageSync(STORAGE_KEYS.WOODEN_FISH_SETTINGS, settings || {})
}

/* ===== 七龙珠（龙珠召唤）相关 ===== */

function getDBCache(kind) {
  try {
    var all = wx.getStorageSync(STORAGE_KEYS.DRAGONBALL_CACHE) || {}
    return all[kind] || null
  } catch (e) {
    return null
  }
}

function setDBCache(kind, data) {
  try {
    var all = wx.getStorageSync(STORAGE_KEYS.DRAGONBALL_CACHE) || {}
    all[kind] = data
    wx.setStorageSync(STORAGE_KEYS.DRAGONBALL_CACHE, all)
  } catch (e) {}
}

function getFollowRecords() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.DRAGONBALL_FOLLOW) || []
  } catch (e) {
    return []
  }
}

function setFollowRecords(records) {
  wx.setStorageSync(STORAGE_KEYS.DRAGONBALL_FOLLOW, records || [])
}

function addFollowRecord(record) {
  var records = getFollowRecords()
  records.unshift(record)
  setFollowRecords(records)
  return records
}

function updateFollowRecord(id, patch) {
  var records = getFollowRecords()
  for (var i = 0; i < records.length; i++) {
    if (records[i].id === id) {
      records[i] = Object.assign({}, records[i], patch)
      break
    }
  }
  setFollowRecords(records)
  return records
}

module.exports = {
  DEFAULT_LOTTERY_CONFIG,
  DEFAULT_LOTTERY_PEOPLE,
  initDefaults,
  restoreSampleEvents,
  getEvents,
  setEvents,
  getCategories,
  setCategories,
  getQuoteIndex,
  setQuoteIndex,
  getQuoteDate,
  setQuoteDate,
  getReminders,
  setReminders,
  cleanExpiredReminders,
  getLotteryConfig,
  setLotteryConfig,
  getLotteryRecords,
  setLotteryRecords,
  addLotteryRecord,
  getLotteryPeople,
  setLotteryPeople,
  getWoodFishMerit,
  addWoodFishMerit,
  getWoodFishToday,
  incWoodFishToday,
  getWoodFishDates,
  getWoodFishSettings,
  setWoodFishSettings,
  // 七龙珠（龙珠召唤）
  getDBCache,
  setDBCache,
  getFollowRecords,
  setFollowRecords,
  addFollowRecord,
  updateFollowRecord
}
