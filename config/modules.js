// config/modules.js
// 工具模块注册表（配置化入口 / 即插即用核心）。
//
// 说明：微信原生 tabBar 为静态配置（平台限制，无法运行时由 JS 生成），
// 故一级菜单项写在 app.json 的 tabBar.list 中。本注册表作为模块元数据的
// 单一可信源，驱动「更多工具」目录并提供扩展范式：
//   新增一个工具 = 在此追加一条配置 + 新建一个页面 + 在 app.json 增加对应 tab，
//   核心渲染代码（tracker 组件、数据服务）无需改动。

module.exports = [
  {
    id: 'typhoon',
    name: '台风实时路径',
    icon: '🌀',
    page: '/pages/typhoon/typhoon',
    enabled: true,
    api: 'typhoon-api'
  },
  {
    id: 'tide',
    name: '潮汐赶海',
    icon: '🌊',
    page: '/pages/tide/tide',
    enabled: true,
    api: 'tide-api'
  }
]
