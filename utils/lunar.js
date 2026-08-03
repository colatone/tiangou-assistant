// utils/lunar.js - 农历日历转换与节气模块

/**
 * 农历转换核心模块
 * 支持：公历→农历互转、二十四节气、节假日标注、天干地支、生肖
 * 适用范围：1900年 - 2100年
 */

// ==================== 农历数据表 ====================

// 农历数据表（1900-2100）
// 每个元素16进制，低12位表示每月大小（1=大月30天，0=小月29天），高4位表示闰月月份（0=无闰月）
var LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520
]

// 天干
var TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
// 地支
var DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
// 生肖
var SHENG_XIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
// 农历月份名（从正月开始，index 0 = 正月）
var LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
// 农历日期名（从初一开始）
var LUNAR_DAY_NAMES = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
]
// 节气名称
var SOLAR_TERMS = [
  '小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨',
  '立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑',
  '白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'
]

// 节气计算基础数据（1900年起各节气的小数近似值）
var TERM_INFO = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
  173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
  353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
]

// ==================== 节假日定义 ====================

// 公历节日（固定日期）
var SOLAR_HOLIDAYS = {
  '01-01': { name: '元旦', level: 'holiday' },
  '02-14': { name: '情人节', level: 'special' },
  '03-08': { name: '妇女节', level: 'holiday' },
  '03-12': { name: '植树节', level: 'holiday' },
  '04-01': { name: '愚人节', level: 'funny' },
  '04-23': { name: '世界读书日', level: 'special' },
  '05-01': { name: '劳动节', level: 'holiday' },
  '05-04': { name: '青年节', level: 'holiday' },
  '06-01': { name: '儿童节', level: 'holiday' },
  '07-01': { name: '建党节', level: 'holiday' },
  '08-01': { name: '建军节', level: 'holiday' },
  '09-10': { name: '教师节', level: 'holiday' },
  '10-01': { name: '国庆节', level: 'major' },
  '10-31': { name: '万圣夜', level: 'funny' },
  '11-11': { name: '光棍节', level: 'funny' },
  '12-24': { name: '平安夜', level: 'special' },
  '12-25': { name: '圣诞节', level: 'special' }
}

// 农历节日（农历月-日格式）
var LUNAR_HOLIDAYS = {
  '01-01': { name: '春节', level: 'major' },
  '01-15': { name: '元宵节', level: 'major' },
  '02-02': { name: '龙抬头', level: 'traditional' },
  '05-05': { name: '端午节', level: 'major' },
  '07-07': { name: '七夕节', level: 'major' },
  '07-15': { name: '中元节', level: 'traditional' },
  '08-15': { name: '中秋节', level: 'major' },
  '09-09': { name: '重阳节', level: 'traditional' },
  '12-08': { name: '腊八节', level: 'traditional' },
  '12-23': { name: '小年', level: 'traditional' },
  '12-30': { name: '除夕', level: 'major' }  // 注意：除夕需要特殊处理闰月情况
}

// ==================== 工具函数 ====================

/**
 * 返回农历年的总天数
 */
function lYearDays(y) {
  var sum = 348
  for (var i = 0x8000; i > 0x8; i >>= 1) {
    sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0
  }
  return sum + leapDays(y)
}

/**
 * 返回农历年闰月的天数
 */
function leapDays(y) {
  if (leapMonth(y)) {
    return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29
  }
  return 0
}

/**
 * 返回农历年哪个月是闰月，没有返回0
 */
function leapMonth(y) {
  return LUNAR_INFO[y - 1900] & 0xf
}

/**
 * 返回农历年某月的总天数
 */
function monthDays(y, m) {
  return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29
}

// ==================== 核心转换函数 ====================

/**
 * 将公历日期转为农历对象
 * @param {number} year - 公历年
 * @param {number} month - 公历月 (1-12)
 * @param {number} day - 公历日 (1-31)
 * @returns {object} 农历信息对象
 */
function solarToLunar(year, month, day) {
  // 计算与1900.1.31相差的天数（使用UTC避免夏令时导致天数偏差）
  var baseDate = new Date(Date.UTC(1900, 0, 31)) // 1900年1月31日是农历正月初一
  var objDate = new Date(Date.UTC(year, month - 1, day))
  var offset = Math.floor((objDate.getTime() - baseDate.getTime()) / 86400000)

  var i, temp = 0

  // 确定农历年份
  for (i = 1900; i < 2101 && offset > 0; i++) {
    temp = lYearDays(i)
    offset -= temp
  }

  if (offset < 0) {
    offset += temp
    i--
  }

  var lunarYear = i
  var leap = leapMonth(i)
  var isLeap = false
  var hasLeapMonth = !!leap

  // 确定农历月份
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === (leap + 1) && !isLeap) {
      --i
      isLeap = true
      temp = leapDays(lunarYear)
    } else {
      temp = monthDays(lunarYear, i)
    }

    if (isLeap && i === (leap + 1)) {
      isLeap = false
    }

    offset -= temp
  }

  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) {
      isLeap = false
    } else {
      isLeap = true
      --i
    }
  }

  if (offset < 0) {
    offset += temp
    --i
  }

  var lunarMonth = i
  var lunarDay = offset + 1

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: isLeap,
    hasLeapMonth: hasLeapMonth
  }
}

/**
 * 格式化农历信息为可读字符串
 * @param {object} lunarInfo - solarToLunar 的返回值
 * @returns {object} 包含各种格式化信息的对象
 */
function formatLunarInfo(lunarInfo) {
  if (!lunarInfo) return null

  var yearStr = lunarInfo.year.toString()
  var monthName = LUNAR_MONTH_NAMES[lunarInfo.month - 1] || ''
  var dayName = LUNAR_DAY_NAMES[lunarInfo.day - 1] || ''

  var lunarDateStr = '农历' + yearStr + '年' +
    (lunarInfo.isLeap ? '闰' : '') +
    monthName + '月' + dayName

  // 天干地支（年柱）- 以立春为界简化处理
  var ganIdx = (lunarInfo.year - 4) % 10
  var zhiIdx = (lunarInfo.year - 4) % 12
  var ganZhiYear = TIAN_GAN[ganIdx >= 0 ? ganIdx : ganIdx + 10] +
                   DI_ZHI[zhiIdx >= 0 ? zhiIdx : zhiIdx + 12]

  // 生肖
  var animal = SHENG_XIAO[(lunarInfo.year - 4) % 12 >= 0 ? (lunarInfo.year - 4) % 12 : (lunarInfo.year - 4) % 12 + 12]

  // 短格式
  var shortStr = (lunarInfo.isLeap ? '闰' : '') + monthName + '月' + dayName

  return {
    full: lunarDateStr,
    short: shortStr,
    monthDay: monthName + '月' + dayName,
    yearGanZhi: ganZhiYear,
    animal: animal,
    animalEmoji: getAnimalEmoji(animal),
    lunarYear: lunarInfo.year,
    lunarMonth: lunarInfo.month,
    lunarDay: lunarInfo.day,
    isLeapMonth: lunarInfo.isLeap
  }
}

/**
 * 根据公历日期获取完整农历信息
 * @param {string} dateStr - YYYY-MM-DD 格式
 * @returns {object} 包含农历、节日、节气等全部信息
 */
function getFullLunarInfo(dateStr) {
  if (!dateStr) return null

  var parts = dateStr.split('-')
  var year = parseInt(parts[0], 10)
  var month = parseInt(parts[1], 10)
  var day = parseInt(parts[2], 10)

  var lunarObj = solarToLunar(year, month, day)
  var formatted = formatLunarInfo(lunarObj)

  // 查找节气
  var termInfo = getSolarTerm(year, month, day)

  // 查找公历节日
  var m = String(month).padStart(2, '0')
  var d = String(day).padStart(2, '0')
  var solarHoliday = SOLAR_HOLIDAYS[m + '-' + d] || null

  // 查找农历节日
  var lm = String(lunarObj.month).padStart(2, '0')
  var ld = String(lunarObj.day).padStart(2, '0')
  var lunarHoliday = LUNAR_HOLIDAYS[lm + '-' + ld] || null

  // 特殊处理：除夕（腊月最后一天）
  if (!lunarHoliday && lunarObj.day === 29 || lunarObj.day === 30) {
    var nextDayLunar = solarToLunar(year, month, day + 1)
    if (nextDayLunar.month !== lunarObj.month || nextDayLunar.year !== lunarObj.year) {
      lunarHoliday = LUNAR_HOLIDAYS['12-30'] || null
    }
  }

  // 合并所有标注
  var tags = []
  if (termInfo) tags.push({ type: 'term', text: termInfo.name })
  if (solarHoliday) tags.push({ type: solarHoliday.level, text: solarHoliday.name })
  if (lunarHoliday) tags.push({ type: lunarHoliday.level, text: lunarHoliday.name })

  return {
    ...formatted,
    term: termInfo,
    solarHoliday: solarHoliday,
    lunarHoliday: lunarHoliday,
    tags: tags,
    displayText: buildDisplayText(formatted, termInfo, solarHoliday, lunarHoliday),
    highlightTag: getHighlightTag(termInfo, solarHoliday, lunarHoliday)
  }
}

// ==================== 节气计算 ====================

/**
 * 获取指定日期的节气
 * @param {number} year - 年
 * @param {number} month - 月 (1-12)
 * @param {number} day - 日
 * @returns {object|null}
 */
function getSolarTerm(year, month, day) {
  // 计算当年第一个节气（小寒）的日期
  var baseDate = new Date(1900, 0, 6, 2, 5, 0) // 1900.1.6 小寒基准时间

  for (var i = 0; i < 24; i++) {
    var termMs = baseDate.getTime() + TERM_INFO[i] * 60000
    // 加上年份差修正（每365.2422天增加约5.82分钟）
    termMs += ((year - 1900) * 365.2422 * 1440 + Math.floor((year - 1900) / 4) * 1440) * 60000

    var termDate = new Date(termMs)

    if (termDate.getFullYear() === year &&
        termDate.getMonth() + 1 === month &&
        termDate.getDate() === day) {
      return {
        index: i,
        name: SOLAR_TERMS[i],
        order: i + 1
      }
    }
  }

  return null
}

// ==================== 辅助显示函数 ====================

function getAnimalEmoji(animal) {
  var map = {
    '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
    '龙': '🐲', '蛇': '🐍', '马': '🐴', '羊': '🐏',
    '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
  }
  return map[animal] || ''
}

function buildDisplayText(formatted, term, sHoliday, lHoliday) {
  var parts = []
  if (formatted) parts.push(formatted.short)
  if (term) parts.push(term.name)
  if (sHoliday) parts.push(sHoliday.name)
  if (lHoliday) parts.push(lHoliday.name)
  return parts.join(' · ')
}

function getHighlightTag(term, sHoliday, lHoliday) {
  // 优先级：主要节日 > 节气 > 其他节日
  if (lHoliday && (lHoliday.level === 'major')) return lHoliday.name
  if (sHoliday && (sHoliday.level === 'major')) return sHoliday.name
  if (term) return term.name
  if (lHoliday) return lHoliday.name
  if (sHoliday) return sHoliday.name
  return null
}

module.exports = {
  solarToLunar,
  formatLunarInfo,
  getFullLunarInfo,
  getSolarTerm,

  // 常量供外部使用
  TIAN_GAN,
  DI_ZHI,
  SHENG_XIAO,
  SOLAR_TERMS,
  SOLAR_HOLIDAYS,
  LUNAR_HOLIDAYS,
  LUNAR_MONTH_NAMES,
  LUNAR_DAY_NAMES
}
