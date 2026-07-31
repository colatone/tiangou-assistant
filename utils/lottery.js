// utils/lottery.js
// 抽奖加权抽取与概率计算（纯逻辑，不依赖 wx，方便复用与测试）

/**
 * 过滤出当前仍可抽取的奖项（库存无限或 >0）
 */
function _available(prizes) {
  return (prizes || []).filter(function (p) {
    return p.quantity === null || p.quantity === undefined || p.quantity > 0
  })
}

/**
 * 按权重随机抽取一个奖项
 * @param {Array} prizes 奖项数组
 * @returns {Object|null} 抽中的奖项对象；若全部抽完返回 null
 */
function weightedPick(prizes) {
  var pool = _available(prizes)
  if (!pool.length) return null

  var total = 0
  for (var i = 0; i < pool.length; i++) {
    var w = Number(pool[i].weight)
    if (!(w > 0)) w = 0
    total += w
  }
  if (total <= 0) return pool[Math.floor(Math.random() * pool.length)]

  var r = Math.random() * total
  var acc = 0
  for (var j = 0; j < pool.length; j++) {
    var ww = Number(pool[j].weight)
    if (!(ww > 0)) ww = 0
    acc += ww
    if (r < acc) return pool[j]
  }
  return pool[pool.length - 1]
}

/**
 * 递减某奖项库存（仅当 quantity 为数字且 >0 时），返回新 config
 */
function decrementQuantity(config, prizeId) {
  if (!config || !config.prizes) return config
  var prizes = config.prizes.map(function (p) {
    if (p.id === prizeId && typeof p.quantity === 'number' && p.quantity > 0) {
      return Object.assign({}, p, { quantity: p.quantity - 1 })
    }
    return p
  })
  return Object.assign({}, config, { prizes: prizes, updatedAt: Date.now() })
}

/**
 * 计算每个奖项的生效概率（%）
 * @returns {Object} { prizeId: 百分比数字 }
 */
function effectiveProbability(prizes) {
  var pool = _available(prizes)
  var map = {}
  var total = 0
  pool.forEach(function (p) {
    var w = Number(p.weight)
    if (!(w > 0)) w = 0
    total += w
  })
  ;(prizes || []).forEach(function (p) {
    var inPool = p.quantity === null || p.quantity === undefined || p.quantity > 0
    map[p.id] = inPool && total > 0 ? +((Number(p.weight) / total) * 100).toFixed(1) : 0
  })
  return map
}

module.exports = {
  weightedPick: weightedPick,
  decrementQuantity: decrementQuantity,
  effectiveProbability: effectiveProbability
}
