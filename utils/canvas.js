// utils/canvas.js — 共享 canvas 绘制工具
// 被 wooden-fish / share-card / lottery-wheel 复用，避免多份重复（且修正了 wooden-fish 旧版 roundRect 的 arcTo 控制点错误）

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  var chars = text.split('')
  var line = ''
  var lineY = y
  for (var i = 0; i < chars.length; i++) {
    var testLine = line + chars[i]
    var metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, lineY)
      line = chars[i]
      lineY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, lineY)
}

module.exports = { roundRect: roundRect, wrapText: wrapText }
