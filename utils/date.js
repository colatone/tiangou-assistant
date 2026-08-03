// utils/date.js

const lunarUtil = require('./lunar')

/**
 * 计算两个日期之间的天数差
 */
function calcDays(dateStr, type = 'elapsed') {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (type === 'countdown') {
    return diffDays >= 0 ? diffDays : 0
  }
  return diffDays <= 0 ? Math.abs(diffDays) : 0
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

/**
 * 获取完整农历信息对象（供卡片详情使用）
 */
function getFullLunarInfo(dateStr) {
  if (!dateStr) return null
  try {
    return lunarUtil.getFullLunarInfo(dateStr)
  } catch (e) {
    return null
  }
}

/**
 * 生成 UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 获取今天的日期字符串
 */
function getTodayStr() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

module.exports = {
  calcDays,
  formatDate,
  getFullLunarInfo,
  generateUUID,
  getTodayStr
}
