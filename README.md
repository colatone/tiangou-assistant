# 舔狗助手

一款**微信小程序多工具箱**，把日常实用的小工具收拢到一个 App 里。原生 MINA 框架、**无构建步骤**，微信开发者工具打开即可预览。

## 功能工具

| 工具 | 图标 | 说明 |
|------|------|------|
| 台风路径 | 🌀 | 实时追踪台风动态与路径 |
| 赛博木鱼 | 💰 | 自动敲木鱼，积攒每日运势 |
| 潮汐赶海 | 🌊 | 查询附近赶海最佳时间 |
| 幸运抽签 | 🎁 | 自定义 3D 卡片球抽签 |
| 美好时光 | ⏳ | 记录每一个重要时刻（正 / 倒计时） |

> 底部 Tab：工具 / 台风 / 时光；其余工具从「工具」页进入。

## 七龙珠（已独立为网页版）

七龙珠（神龙指引）已从本小程序移除，独立为纯前端网页，位于 `dragonball-web/` 目录：
- 调用公开数字数据源（经 Cloudflare Pages Function 代理解决跨域），功能比小程序更完整：最新现世 + 开奖倒计时、神龙指引、热门 / 冷门、我的龙珠阵（开奖对照）、自选守号、主珠走势图、号码频率热力、遗漏值、模拟摇号、今日运势、分享图。
- 免域名免服务器：推到 Cloudflare Pages（连接 Git 仓库或 `wrangler pages deploy`），自动获得 `*.pages.dev` 在线地址。
- 网页版不受微信小程序类目限制，可保留完整的号码推演与开奖对照功能。

## 技术栈

- 微信小程序原生框架（MINA），**无构建步骤**
- 本地持久化：`wx.getStorageSync` / `wx.setStorageSync`
- `canvas 2d` 绘制分享卡片（含小程序码）
- 自实现农历转换算法（`utils/lunar.js`，1900–2100），无外部依赖
- 全局样式使用 CSS 变量（`app.wxss`）

## 项目结构

```
├── app.js / app.json / app.wxss      # 全局逻辑 / 配置 / 样式
├── sitemap.json                      # 微信搜索索引配置
├── config/                           # 模块与接口配置（modules / *-api）
├── utils/                            # 业务逻辑（date / lunar / quote / tide / typhoon / lottery / storage）
├── components/                       # 自定义组件（custom-tabbar / 台风 / 潮汐 / 抽签）
├── pages/                            # 各工具页面（others 工具箱入口 / typhoon / wooden-fish / tide / lottery / index ...）
├── images/                          # 图标与小程序码
└── dragonball-web/                  # 七龙珠独立网页版（前端 + Cloudflare Pages Function）
```

## 本地运行（小程序）

1. 用**微信开发者工具**打开本项目根目录
2. 点击「编译」即可预览
3. 真机 / 提审前，请把各数据源接口配置到「request 合法域名」

## 本地预览（七龙珠网页版）

```bash
cd dragonball-web
npx wrangler dev        # 自带 /api/proxy 函数，数据正常加载
# 或仅静态托管（无函数时走内置种子兜底）：npx serve .
```

## 说明

- 本项目仅用于学习与小工具聚合，不含任何商业化博彩引导。
- 七龙珠网页版所有数字组合均为娱乐参考，与任何现实彩票 / 博彩无关。
