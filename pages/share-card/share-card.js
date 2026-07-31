// pages/share-card/share-card.js

const dateUtil = require('../../utils/date')
const storage = require('../../utils/storage')
const quoteUtil = require('../../utils/quote')

Page({
  data: {
    event: null,
    canvasImage: null,   // Canvas 2D Image 对象
    cardReady: false,
    cardTempPath: ''     // 生成卡片的临时文件路径
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      wx.navigateBack()
      return
    }

    const events = storage.getEvents()
    const event = events.find(e => e.id === options.id)
    if (!event) {
      wx.showToast({ title: '事件不存在', icon: 'none' })
      wx.navigateBack()
      return
    }

    const categories = storage.getCategories()
    const category = categories.find(c => c.id === event.category) || categories[0]
    const days = dateUtil.calcDays(event.date, event.type)
    const lunarInfo = dateUtil.getFullLunarInfo(event.date)

    this.setData({
      event: {
        ...event,
        days,
        formattedDate: dateUtil.formatDate(event.date),
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        lunarShort: lunarInfo ? lunarInfo.short : '',
        highlightTag: (lunarInfo && lunarInfo.highlightTag) || ''
      }
    })

    wx.nextTick(() => {
      this.loadQRCodeAndDraw()
    })
  },

  /**
   * 使用 Canvas 2D createImage API 加载小程序码
   */
  loadQRCodeAndDraw() {
    const query = wx.createSelectorQuery()
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          console.warn('Canvas 节点未找到')
          return
        }

        const canvas = res[0].node

        // 使用 Canvas 2D 的 createImage 方法加载图片
        const img = canvas.createImage()
        img.onload = () => {
          this.setData({ canvasImage: img })
          this.drawCard(canvas)
        }
        img.onerror = (err) => {
          console.warn('加载小程序码失败:', err)
          // 图片加载失败也绘制卡片（不含二维码）
          this.drawCard(canvas)
        }
        img.src = '/images/qrcode.jpg'
      })
  },

  drawCard(canvas) {
    const { event, canvasImage } = this.data
    if (!event) return

    // 如果没有传入 canvas，重新查询
    if (!canvas) {
      const query = wx.createSelectorQuery()
      query.select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res[0] && res[0].node) {
            this.drawCardInternal(res[0].node)
          }
        })
      return
    }
    this.drawCardInternal(canvas)
  },

  drawCardInternal(canvas) {
    const { event, canvasImage } = this.data
    const ctx = canvas.getContext('2d')
    const dpr = wx.getSystemInfoSync().pixelRatio

    // 获取 canvas 显示尺寸，乘以 dpr 得到实际像素尺寸
    const query = wx.createSelectorQuery()
    query.select('#shareCanvas')
      .fields({ size: true })
      .exec((res) => {
        if (!res[0]) return
        const width = res[0].width * dpr
        const height = res[0].height * dpr

        canvas.width = width
        canvas.height = height

        // ===== 1. 背景渐变 =====
        const bgGradient = ctx.createLinearGradient(0, 0, width, height)
        bgGradient.addColorStop(0, '#FF8C69')
        bgGradient.addColorStop(1, '#FF6B6B')
        ctx.fillStyle = bgGradient
        ctx.fillRect(0, 0, width, height)

        // ===== 2. 装饰圆点 =====
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.beginPath()
        ctx.arc(width * 0.88, height * 0.12, width * 0.18, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(width * 0.08, height * 0.8, width * 0.14, 0, Math.PI * 2)
        ctx.fill()

        // ===== 3. 白色内容区域（调整大小以容纳二维码） =====
        const contentTop = height * 0.10
        const contentHeight = height * 0.72
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
        roundRect(ctx, width * 0.05, contentTop, width * 0.90, contentHeight, width * 0.04)
        ctx.fill()

        // ===== 4. 分类图标和名称 =====
        ctx.font = `bold ${width * 0.055}px sans-serif`
        ctx.fillStyle = event.categoryColor
        ctx.textAlign = 'center'
        ctx.fillText(`${event.categoryIcon} ${event.categoryName}`, width / 2, height * 0.19)

        // ===== 5. 事件名称 =====
        ctx.font = `bold ${width * 0.065}px sans-serif`
        ctx.fillStyle = '#333333'
        wrapText(ctx, event.name, width / 2, height * 0.275, width * 0.78, width * 0.07)

        // ===== 6. 天数数字 =====
        ctx.font = `bold ${width * 0.20}px sans-serif`
        const gradient = ctx.createLinearGradient(width * 0.25, height * 0.35, width * 0.75, height * 0.45)
        gradient.addColorStop(0, '#FF8C69')
        gradient.addColorStop(1, '#FF6B6B')
        ctx.fillStyle = gradient
        ctx.fillText(String(event.days), width / 2, height * 0.43)

        // 天数单位
        ctx.font = `${width * 0.055}px sans-serif`
        ctx.fillStyle = '#999999'
        const unitText = event.type === 'elapsed' ? '天' : '天 '
        ctx.fillText(unitText, width / 2, height * 0.49)

        // ===== 7. 日期信息 + 农历 =====
        ctx.font = `${width * 0.04}px sans-serif`
        ctx.fillStyle = '#888888'

        // 公历日期
        const dateLabel = event.type === 'elapsed' ? '📅 始于 ' : '🎯 目标日 '
        ctx.fillText(dateLabel + event.formattedDate, width / 2, height * 0.55)

        // 农历日期（如果有）
        if (event.lunarShort) {
          ctx.font = `${width * 0.036}px sans-serif`
          ctx.fillStyle = '#A0522D'
          let lunarStr = '🌙 ' + event.lunarShort
          if (event.highlightTag) {
            lunarStr += '  |  ✨ ' + event.highlightTag
          }
          ctx.fillText(lunarStr, width / 2, height * 0.59)
        }

        // 分隔线
        ctx.strokeStyle = '#F0F0F0'
        ctx.lineWidth = dpr
        ctx.beginPath()
        ctx.moveTo(width * 0.15, height * 0.63)
        ctx.lineTo(width * 0.85, height * 0.63)
        ctx.stroke()

        // ===== 8. 每日语录 =====
        ctx.font = `${width * 0.034}px sans-serif`
        ctx.fillStyle = '#AAAAAA'
        const quote = quoteUtil.getRandomQuote()
        wrapText(ctx, quote, width * 0.50, height * 0.68, width * 0.65, width * 0.05)

        // ===== 9. 小程序码区域 =====
        if (canvasImage) {
          const qrSize = width * 0.22
          const qrX = width - qrSize - width * 0.06
          const qrY = contentTop + contentHeight - qrSize - width * 0.04

          // 二维码背景圆角矩形
          ctx.fillStyle = '#FFFFFF'
          roundRect(ctx, qrX - width * 0.02, qrY - width * 0.02,
                    qrSize + width * 0.04, qrSize + width * 0.04, width * 0.02)
          ctx.fill()

          // 绘制二维码图片（使用 Canvas 2D Image 对象）
          ctx.drawImage(canvasImage, qrX, qrY, qrSize, qrSize)

          // 二维码下方文字
          ctx.font = `${width * 0.024}px sans-serif`
          ctx.fillStyle = '#CCCCCC'
          ctx.textAlign = 'center'
          ctx.fillText('扫码体验', qrX + qrSize / 2, qrY + qrSize + width * 0.04)
          ctx.textAlign = 'center'
        }

        // ===== 10. 底部品牌 =====
        ctx.font = `${width * 0.032}px sans-serif`
        ctx.fillStyle = '#DDDDDD'
        ctx.textAlign = 'center'
        ctx.fillText('— 舔狗助手 —', width / 2, height * 0.92)

        this.setData({ cardReady: true })

        // 同时生成临时文件路径供分享使用
        wx.canvasToTempFilePath({
          canvas,
          success: (tempRes) => {
            this.setData({ cardTempPath: tempRes.tempFilePath })
          }
        })
      })
  },

  onSaveToAlbum() {
    const query = wx.createSelectorQuery()
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        wx.canvasToTempFilePath({
          canvas,
          success: (tempRes) => {
            wx.saveImageToPhotosAlbum({
              filePath: tempRes.tempFilePath,
              success: () => {
                wx.showToast({ title: '已保存到相册', icon: 'success' })
              },
              fail: (err) => {
                if (err.errMsg.includes('auth deny')) {
                  wx.showModal({
                    title: '需要授权',
                    content: '请允许保存图片到相册',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        wx.openSetting()
                      }
                    }
                  })
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' })
                }
              }
            })
          },
          fail: () => {
            wx.showToast({ title: '生成图片失败', icon: 'none' })
          }
        })
      })
  },

  onShareAppMessage() {
    const { event, cardTempPath } = this.data
    return {
      title: `${event.name} - ${event.days}天 | 舔狗助手`,
      path: '/pages/index/index',
      imageUrl: cardTempPath || ''
    }
  },

  onShareTimeline() {
    const { event } = this.data
    return {
      title: `${event.name} - ${event.days}天 | 舔狗助手`
    }
  }
})

function roundRect(ctx, x, y, w, h, r) {
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
  const chars = text.split('')
  let line = ''
  let lineY = y

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i]
    const metrics = ctx.measureText(testLine)
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
