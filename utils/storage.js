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
  TOMATO_SETTINGS: 'tomato_settings',
  TOMATO_RECORDS: 'tomato_records',
  TOMATO_TODAY: 'tomato_today',
  TOMATO_SESSION: 'tomato_session'
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

// 烂番茄默认设置（focus 在 UI 暴露档位选择，其余走内部默认值）
const DEFAULT_TOMATO_SETTINGS = {
  focus: 45,        // 专注时长（分钟），UI 档位：5 / 15 / 45
  focusCustom: 0,   // 自定义专注时长（分钟），0 表示未启用
  long: 15,         // 休息时长（分钟），UI 档位：5 / 10 / 15；每完成 1 个番茄即进休息
  longCustom: 0,    // 自定义休息时长（分钟），0 表示未启用
  vibrate: true,    // 阶段结束震动提醒
  sound: true,      // 阶段结束声音提醒
  keepScreenOn: true // 专注中保持屏幕常亮
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

    // 初始化烂番茄设置（如不存在）
    var tomatoSettings = wx.getStorageSync(STORAGE_KEYS.TOMATO_SETTINGS)
    if (!tomatoSettings) {
      wx.setStorageSync(STORAGE_KEYS.TOMATO_SETTINGS, JSON.parse(JSON.stringify(DEFAULT_TOMATO_SETTINGS)))
    }

    // 初始化烂番茄历史记录（如不存在）
    var tomatoRecords = wx.getStorageSync(STORAGE_KEYS.TOMATO_RECORDS)
    if (!tomatoRecords) {
      wx.setStorageSync(STORAGE_KEYS.TOMATO_RECORDS, {})
    }

    // 初始化烂番茄今日统计（如不存在或非今天则重置）
    var todayTomato = getTodayStr()
    var tomatoTodayData = wx.getStorageSync(STORAGE_KEYS.TOMATO_TODAY)
    if (!tomatoTodayData || tomatoTodayData.date !== todayTomato) {
      wx.setStorageSync(STORAGE_KEYS.TOMATO_TODAY, { date: todayTomato, count: 0, minutes: 0 })
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

/* ===== 烂番茄相关 ===== */

function getTomatoSettings() {
  try {
    var s = wx.getStorageSync(STORAGE_KEYS.TOMATO_SETTINGS)
    if (!s) return JSON.parse(JSON.stringify(DEFAULT_TOMATO_SETTINGS))
    return s
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_TOMATO_SETTINGS))
  }
}

function setTomatoSettings(settings) {
  wx.setStorageSync(STORAGE_KEYS.TOMATO_SETTINGS, settings || {})
}

// 历史记录：{ 'YYYY-MM-DD': { count, minutes } }
function getTomatoRecords() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEYS.TOMATO_RECORDS)
    if (!raw) return {}
    // 兼容纯数字形态（旧版仅存 count）
    var records = {}
    Object.keys(raw).forEach(function (k) {
      var v = raw[k]
      if (typeof v === 'number') {
        records[k] = { count: v, minutes: 0 }
      } else if (v && typeof v === 'object') {
        records[k] = { count: Number(v.count) || 0, minutes: Number(v.minutes) || 0 }
      } else {
        records[k] = { count: 0, minutes: 0 }
      }
    })
    return records
  } catch (e) {
    return {}
  }
}

function setTomatoRecords(records) {
  wx.setStorageSync(STORAGE_KEYS.TOMATO_RECORDS, records || {})
}

// 今日统计（跨天自动重置，并与历史记录保持一致）
function getTomatoToday() {
  try {
    var today = getTodayStr()
    var data = wx.getStorageSync(STORAGE_KEYS.TOMATO_TODAY)
    if (!data || data.date !== today) {
      var rec = getTomatoRecords()[today]
      data = { date: today, count: rec ? rec.count : 0, minutes: rec ? rec.minutes : 0 }
      wx.setStorageSync(STORAGE_KEYS.TOMATO_TODAY, data)
    }
    return data
  } catch (e) {
    return { date: getTodayStr(), count: 0, minutes: 0 }
  }
}

// 完成一个番茄：dateKey 默认为今天；同步更新历史记录与今日统计
function addTomatoRecord(dateKey, minutes) {
  var key = dateKey || getTodayStr()
  var minutesNum = Number(minutes) || 0
  var records = getTomatoRecords()
  var entry = records[key] || { count: 0, minutes: 0 }
  entry.count += 1
  entry.minutes += minutesNum
  records[key] = entry
  setTomatoRecords(records)

  // 同步今日统计：仅当本次番茄的开始日就是“今天”才更新；跨午夜的番茄按开始日计入历史，不污染今日计数
  if (key === getTodayStr()) {
    var today = getTomatoToday()
    today.count = entry.count
    today.minutes = entry.minutes
    wx.setStorageSync(STORAGE_KEYS.TOMATO_TODAY, today)
  }
  return entry
}

// 连续天数：今天有记录则从今天起算；今天为 0 则从昨天起算（今天尚未打破连击）
function getTomatoStreak() {
  var records = getTomatoRecords()
  var d = new Date()
  function keyOf(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
  }
  if (!records[keyOf(d)] || records[keyOf(d)].count <= 0) {
    d.setDate(d.getDate() - 1)
  }
  var streak = 0
  while (records[keyOf(d)] && records[keyOf(d)].count > 0) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function getTomatoSession() {
  try {
    return wx.getStorageSync(STORAGE_KEYS.TOMATO_SESSION) || null
  } catch (e) {
    return null
  }
}

function setTomatoSession(session) {
  if (session === null || session === undefined) {
    wx.removeStorageSync(STORAGE_KEYS.TOMATO_SESSION)
  } else {
    wx.setStorageSync(STORAGE_KEYS.TOMATO_SESSION, session)
  }
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
  getTomatoSettings,
  setTomatoSettings,
  getTomatoRecords,
  setTomatoRecords,
  getTomatoToday,
  addTomatoRecord,
  getTomatoStreak,
  getTomatoSession,
  setTomatoSession
}
