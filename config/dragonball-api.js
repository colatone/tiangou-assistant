// config/dragonball-api.js
// 七龙珠（龙珠召唤）数据接口契约
// 技术层：底层对接公开数字推演接口（仅内部使用，UI 全程龙珠主题，不出现敏感词）
// 上线需在微信公众平台 → 开发 → 开发管理 → 服务器域名 → request 合法域名加入 REQUEST_DOMAIN 所列域名

var MAIN = 'https://api.huiniao.top'     // 主源（免 key，同时支持 ssq/dlt）
var BACKUP = 'https://api.istero.com'    // 备源（免费 token，双Se 底层数据源明确支持）

module.exports = {
  MAIN_DOMAIN: MAIN,
  BACKUP_DOMAIN: BACKUP,
  REQUEST_DOMAIN: [MAIN, BACKUP],

  // 页面底部固定署名
  ATTRIBUTION: '数据来源：公开数字数据服务',

  // 两玩法配置（UI 使用 label，不暴露底层彩种名）
  CONFIG: {
    redblue: {
      label: 'S',
      mainCount: 6, mainMin: 1, mainMax: 33,
      subCount: 1, subMin: 1, subMax: 16,
      gatherWeekdays: [2, 4, 0],          // 周二/四/日（0=周日）
      gatherWindow: { start: '20:30', end: '22:00' },
      apiType: 'ssq'                       // 技术层字段映射标识（仅代码内使用）
    },
    star: {
      label: 'D',
      mainCount: 5, mainMin: 1, mainMax: 35,
      subCount: 2, subMin: 1, subMax: 12,
      gatherWeekdays: [1, 3, 6],          // 周一/三/六
      gatherWindow: { start: '20:30', end: '22:00' },
      apiType: 'dlt'
    }
  },

  endpoints: {
    // 主源 huiniao（免 key）。真实可用端点（已实测 2026-07-23）：
    //   GET /interface/home/lotteryHistory?type=ssq&rows=30
    //   GET /interface/home/lotteryHistory?type=dlt&rows=30
    // 返回 { code:1, data:{ last:{...}, data:{ list:[...] } } }
    //   last/list 元素字段：code(期号) day(日期) one..seven(补零号码串)
    //   限流返回 { code:401, info:"请求过于频繁" } —— 需识别且不重试
    // 一次请求同时拿到最新+历史，降低并发触发限流概率
    main: function (kind) {
      var type = kind === 'redblue' ? 'ssq' : 'dlt'
      return MAIN + '/interface/home/lotteryHistory?type=' + type + '&rows=30'
    },
    // 备源 istero（需免费 token）。路径以官方文档为准，未实测。
    backup: function (kind, token) {
      var path = kind === 'redblue' ? '/fucai/ssq/query' : '/ticate/dlt/query'
      return BACKUP + path + (token ? ('?token=' + token) : '')
    }
  }
}
