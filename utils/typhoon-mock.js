// utils/typhoon-mock.js
// 内置样例数据（归一化内部模型）。当网络请求失败 / 域名未配置时回退，
// 保证 UI 在未接入真实接口时也能完整演示。字段与组件消费模型一致。

const SAMPLE_TRACK = [
  // ===== 实况路径（isForecast: 0）=====
  { time: '2026-07-20T08:00:00+08:00', lng: 132.0, lat: 13.0, type: 'TD',     level: 1, pressure: 1002, windSpeed: 15, moveDir: 'WNW', moveSpeed: 22, radius7: 150, isForecast: 0 },
  { time: '2026-07-20T14:00:00+08:00', lng: 131.0, lat: 13.8, type: 'TS',     level: 2, pressure: 998,  windSpeed: 18, moveDir: 'WNW', moveSpeed: 22, radius7: 180, isForecast: 0 },
  { time: '2026-07-21T02:00:00+08:00', lng: 129.8, lat: 14.9, type: 'TS',     level: 2, pressure: 992,  windSpeed: 23, moveDir: 'WNW', moveSpeed: 24, radius7: 200, isForecast: 0 },
  { time: '2026-07-21T14:00:00+08:00', lng: 128.3, lat: 16.2, type: 'STS',    level: 3, pressure: 985,  windSpeed: 28, moveDir: 'WNW', moveSpeed: 20, radius7: 220, isForecast: 0 },
  { time: '2026-07-22T02:00:00+08:00', lng: 126.8, lat: 17.8, type: 'TY',     level: 4, pressure: 970,  windSpeed: 33, moveDir: 'WNW', moveSpeed: 18, radius7: 250, isForecast: 0 },
  { time: '2026-07-22T14:00:00+08:00', lng: 125.2, lat: 19.5, type: 'TY',     level: 4, pressure: 960,  windSpeed: 38, moveDir: 'NW',  moveSpeed: 16, radius7: 280, isForecast: 0 },
  { time: '2026-07-23T02:00:00+08:00', lng: 123.6, lat: 21.3, type: 'STY',    level: 5, pressure: 945,  windSpeed: 45, moveDir: 'NW',  moveSpeed: 14, radius7: 300, isForecast: 0 },
  { time: '2026-07-23T14:00:00+08:00', lng: 122.0, lat: 23.1, type: 'STY',    level: 5, pressure: 938,  windSpeed: 48, moveDir: 'NNW', moveSpeed: 12, radius7: 320, isForecast: 0 },
  { time: '2026-07-24T02:00:00+08:00', lng: 120.6, lat: 24.8, type: 'SUPERTY', level: 6, pressure: 925,  windSpeed: 52, moveDir: 'NNW', moveSpeed: 10, radius7: 350, isForecast: 0 },
  { time: '2026-07-24T14:00:00+08:00', lng: 119.5, lat: 26.2, type: 'TY',     level: 4, pressure: 955,  windSpeed: 42, moveDir: 'N',   moveSpeed: 8,  radius7: 280, isForecast: 0 },
  { time: '2026-07-25T02:00:00+08:00', lng: 118.8, lat: 27.4, type: 'STS',    level: 3, pressure: 975,  windSpeed: 30, moveDir: 'NNE', moveSpeed: 10, radius7: 200, isForecast: 0 },
  { time: '2026-07-25T14:00:00+08:00', lng: 118.5, lat: 28.3, type: 'TS',     level: 2, pressure: 992,  windSpeed: 20, moveDir: 'NNE', moveSpeed: 12, radius7: 150, isForecast: 0 },
  // ===== 预报路径（isForecast: 1）=====
  { time: '2026-07-26T02:00:00+08:00', lng: 118.6, lat: 29.4, type: 'TD',     level: 1, pressure: 1000, windSpeed: 15, moveDir: '',    moveSpeed: 0,  radius7: 0,   isForecast: 1 },
  { time: '2026-07-26T14:00:00+08:00', lng: 119.0, lat: 30.6, type: 'TD',     level: 1, pressure: 1002, windSpeed: 12, moveDir: '',    moveSpeed: 0,  radius7: 0,   isForecast: 1 },
  { time: '2026-07-27T02:00:00+08:00', lng: 119.6, lat: 31.8, type: 'TD',     level: 1, pressure: 1004, windSpeed: 10, moveDir: '',    moveSpeed: 0,  radius7: 0,   isForecast: 1 }
]

const SAMPLE_TRACK_2 = [
  { time: '2026-08-10T08:00:00+08:00', lng: 135.0, lat: 18.0, type: 'TS',  level: 2, pressure: 990, windSpeed: 20, moveDir: 'W',   moveSpeed: 25, radius7: 180, isForecast: 0 },
  { time: '2026-08-10T20:00:00+08:00', lng: 133.5, lat: 18.6, type: 'STS', level: 3, pressure: 980, windSpeed: 28, moveDir: 'WNW', moveSpeed: 22, radius7: 220, isForecast: 0 },
  { time: '2026-08-11T08:00:00+08:00', lng: 131.8, lat: 19.5, type: 'TY',  level: 4, pressure: 965, windSpeed: 35, moveDir: 'WNW', moveSpeed: 20, radius7: 260, isForecast: 0 },
  { time: '2026-08-11T20:00:00+08:00', lng: 129.9, lat: 20.7, type: 'TY',  level: 4, pressure: 955, windSpeed: 40, moveDir: 'NW',  moveSpeed: 18, radius7: 280, isForecast: 0 },
  { time: '2026-08-12T08:00:00+08:00', lng: 127.9, lat: 22.0, type: 'STY', level: 5, pressure: 940, windSpeed: 46, moveDir: 'NW',  moveSpeed: 15, radius7: 300, isForecast: 0 },
  { time: '2026-08-12T20:00:00+08:00', lng: 126.0, lat: 23.4, type: 'STY', level: 5, pressure: 935, windSpeed: 48, moveDir: 'N',   moveSpeed: 12, radius7: 320, isForecast: 0 },
  { time: '2026-08-13T08:00:00+08:00', lng: 124.5, lat: 24.8, type: 'TY',  level: 4, pressure: 960, windSpeed: 38, moveDir: 'N',   moveSpeed: 10, radius7: 260, isForecast: 1 },
  { time: '2026-08-13T20:00:00+08:00', lng: 123.6, lat: 26.0, type: 'STS', level: 3, pressure: 978, windSpeed: 30, moveDir: 'NNE', moveSpeed: 12, radius7: 200, isForecast: 1 }
]

module.exports = {
  stormList: [
    {
      id: '2026-03',
      name: '示例台风',
      number: '2603',
      year: '2026',
      status: 'start',
      startTime: '2026-07-20T08:00:00+08:00'
    },
    {
      id: '2026-02',
      name: '另一台风',
      number: '2602',
      year: '2026',
      status: 'stop',
      startTime: '2026-08-10T08:00:00+08:00'
    }
  ],
  tracks: {
    '2026-03': SAMPLE_TRACK,
    '2026-02': SAMPLE_TRACK_2
  }
}
