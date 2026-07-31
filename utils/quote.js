// utils/quote.js

const QUOTES = [
  '时光不语，却回答了所有问题。',
  '每一个不曾起舞的日子，都是对生命的辜负。',
  '岁月漫长，然而值得等待。',
  '生活不是等待暴风雨过去，而是学会在雨中跳舞。',
  '愿你成为自己的太阳，无需借谁的光。',
  '最好的时光，是你在我身边。',
  '时间会告诉我们，简单的喜欢最长远。',
  '山河远阔，人间烟火，无一是你，无一不是你。',
  '愿有岁月可回首，且以深情共白头。',
  '世界那么大，遇见你真好。',
  '每天都要好好生活，因为未来值得期待。',
  '你的坚持，终将美好。',
  '愿你的生活常温暖，日子总是温柔又闪光。',
  '春风十里，不如你。',
  '陪伴是最长情的告白。',
  '心若向阳，无畏悲伤。',
  '生活明朗，万物可爱。',
  '保持热爱，奔赴山海。',
  '星光不问赶路人，时光不负有心人。',
  '愿你遍历山河，觉得人间值得。',
  '因为有你，世界才美好。',
  '今日份的温暖，请查收。',
  '把每一天都当作礼物来珍惜。',
  '记忆是相会的一种形式，忘记是自由的一种形式。',
  '时间会治愈一切，请给时间一点时间。',
  '愿你眼里有光，心中有爱。',
  '所有的美好，都恰逢其时。',
  '日子甜甜的，像清晨的柠檬水。',
  '遇见你，是我最美的意外。',
  '生命太短，没时间留给遗憾。',
  '珍惜所有的不期而遇，看淡所有的不辞而别。',
  '你是我今生最美的遇见。',
  '愿所有的等待，都不被辜负。',
  '每一天都是新的开始，每一个瞬间都值得铭记。',
  '微笑向暖，安之若素。',
  '始于初见，止于终老。',
  '爱你所爱，行你所行。',
  '心存感激，所遇皆温柔。',
  '你的过去我来不及参与，你的未来我奉陪到底。',
  '世界很甜，因为有你。',
  '愿有人问你粥可温，有人与你立黄昏。',
  '岁月静好，现世安稳。',
  '时光不老，我们不散。',
  '我在等风，也在等你。',
  '一屋两人，三餐四季。',
  '此生有你，足矣。',
  '愿岁月可回首，且以深情共白头。',
  '人间值得，未来可期。',
  '和你在一起的每一天，都是最好的日子。',
  '以梦为马，不负韶华。'
]

function getDailyQuote() {
  const storage = require('./storage')
  const today = new Date().toDateString()
  const savedDate = storage.getQuoteDate()

  if (savedDate !== today) {
    const index = Math.floor(Math.random() * QUOTES.length)
    storage.setQuoteIndex(index)
    storage.setQuoteDate(today)
    return QUOTES[index]
  }

  const index = storage.getQuoteIndex()
  return QUOTES[index] || QUOTES[0]
}

function getRandomQuote() {
  const index = Math.floor(Math.random() * QUOTES.length)
  return QUOTES[index]
}

module.exports = {
  QUOTES,
  getDailyQuote,
  getRandomQuote
}
