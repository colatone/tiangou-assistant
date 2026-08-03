// components/flip-unit/flip-unit.js — 单个翻页数字（0-9）
Component({
  properties: {
    value: {
      type: String,
      value: '0',
      observer: function (nv, ov) {
        if (!this._inited) {
          this._inited = true
          this.setData({ prev: nv })
          return
        }
        if (ov === nv) return
        var self = this
        this.setData({ prev: ov, flipping: true })
        clearTimeout(this._t)
        this._t = setTimeout(function () {
          self.setData({ flipping: false })
        }, 620)
      }
    }
  },
  data: {
    prev: '0',
    flipping: false
  },
  methods: {},
  detached: function () {
    clearTimeout(this._t)
  }
})
