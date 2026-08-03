// utils/wav.js — 共享 WAV(base64) 编码
// 各页仅提供不同的采样函数（音色不同），44 字节头 + 采样循环 + base64 兜底统一在此，避免重复

function genWavB64(opts) {
  var sr = opts.sr, dur = opts.dur
  var n = Math.floor(sr * dur), bytes = n + 44
  var buf = new ArrayBuffer(bytes), v = new DataView(buf)
  var ws = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, bytes - 8, true); ws(8, 'WAVE')
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(30, 1, true); v.setUint16(32, 8, true)
  ws(36, 'data'); v.setUint32(40, n, true)
  for (var i = 0; i < n; i++) {
    v.setUint8(44 + i, opts.sample(i / sr, i))
  }
  var arr = new Uint8Array(buf), str = ''
  for (var j = 0; j < arr.length; j++) str += String.fromCharCode(arr[j])
  return wx.arrayBufferToBase64 ? wx.arrayBufferToBase64(buf) : str
}

module.exports = { genWavB64: genWavB64 }
