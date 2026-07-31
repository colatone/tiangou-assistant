// config/typhoon-api.js
// 台风数据 API 契约（中央气象台台风网 nmc.cn —— 官方、免 Key、JSONP）
// 所有地址、密钥、字段映射集中在此，换源或上线只需改这里。

const BASE = 'https://typhoon.nmc.cn/weatherservice/typhoon/jsons'

module.exports = {
  BASE,
  // 腾讯位置服务 Key（已配置；MP 后台需将此 Key 与小程序 AppID 绑定，<map> 才能生效）
  MAP_KEY: 'ECSBZ-LLF6G-5TFQV-QTXJX-7KHOT-QLBJ3',

  // 上线需在微信公众平台 → 开发 → 开发管理 → 服务器域名 → request 合法域名 加入：
  // https://typhoon.nmc.cn
  REQUEST_DOMAIN: 'https://typhoon.nmc.cn',

  endpoints: {
    // 当年台风列表（JSONP）：name(({"typhoonList":[[...]]}))
    stormList: () => `${BASE}/list_default`,
    // 单个台风实况+预报路径（JSONP）：name(({"typhoon":[...]}))
    // id 取自列表第一项
    stormTrack: (stormId) => `${BASE}/view_${stormId}`
  },

  // 强度等级类型码映射（nmc 用 SuperTY，内部模型用 SUPERTY；其余 TD/TS/STS/TY/STY 一致）
  TYPE_MAP: {
    SuperTY: 'SUPERTY'
  }
}
