/* ============================================================================
 * 启动动画初始化冒烟测试 —— 用最小 DOM 桩把 splash.js 完整跑一遍
 *
 * 为什么需要它：黑幕兜底是"贴在第一屏上的"，一旦 splash.js 初始化抛异常，
 * dsu-boot 就永远摘不掉 → 用户看到永久黑屏。这个测试专门守住那条线：
 *   1) 初始化不许抛异常
 *   2) 跑完必须摘掉 dsu-boot（否则就是黑屏）
 *   3) 暴露 __DSH_STARTUP_API__
 *   4) JS 里用到的每个选择器，都必须在生成出来的 markup 里真实存在
 *      —— 这条能抓到"接了个不存在的元素"这类手误
 *   5) 没有 speechSynthesis 的环境（Node / 老浏览器）也必须能跑
 *
 * 用法：node test/smoke-splash.mjs
 * ========================================================================== */
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const BUNDLE = fileURLToPath(new URL('../lib/splash.js', import.meta.url))

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra !== undefined ? '  → ' + extra : '')) }
}

/* ── 最小 DOM 桩 ─────────────────────────────────────────────────────────── */
function makeEl(tag) {
  const el = {
    tagName: tag,
    _cls: '',
    _text: '',
    _html: '',
    style: { setProperty() {}, removeProperty() {} },
    dataset: {},
    children: [],
    hidden: false,
    offsetWidth: 1,
    parentNode: null,
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c },
    insertBefore(c) { this.children.unshift(c); if (c) c.parentNode = this; return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c },
    setAttribute() {},
    getAttribute() { return null },
    listeners: new Map(),
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(fn)
    },
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) },
    dispatchEvent(event) {
      for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event)
    },
    animate() { return { cancel() {}, finish() {} } },
    getTotalLength() { return 120 },
    querySelector(sel) { return lookup(sel) },
    querySelectorAll() { return [] },
    focus() {},
    contains(node) { return node === this || this.children.some(child => child.contains(node)) },
  }
  Object.defineProperty(el, 'className', {
    get() { return el._cls },
    set(v) { el._cls = v == null ? '' : String(v) },
  })
  Object.defineProperty(el, 'textContent', {
    get() { return el._text },
    set(v) { el._text = v == null ? '' : String(v) },
  })
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html },
    set(v) { el._html = v == null ? '' : String(v); el.children.length = 0; MARKUP = el._html },
  })
  el.classList = {
    add(...cs) { cs.forEach((c) => { if (!el._cls.split(' ').includes(c)) el._cls = (el._cls + ' ' + c).trim() }) },
    remove(...cs) { cs.forEach((c) => { el._cls = el._cls.split(' ').filter((x) => x && x !== c).join(' ') }) },
    toggle(c, on) {
      const has = el._cls.split(' ').includes(c)
      const want = on === undefined ? !has : !!on
      if (want && !has) el.classList.add(c)
      if (!want && has) el.classList.remove(c)
    },
    contains(c) { return el._cls.split(' ').includes(c) },
  }
  return el
}

/* markup 里出现过的 class 集合：选择器必须命中它，否则视为"接了个不存在的元素" */
let MARKUP = ''
const MISSED = new Set()
const lookupCache = new Map()
function lookup(sel) {
  if (!sel) return null
  const key = String(sel)
  if (lookupCache.has(key)) return lookupCache.get(key)
  const m = /\.([A-Za-z0-9_-]+)/.exec(key)
  const cls = m ? m[1] : null
  const found = cls !== null && MARKUP.includes(cls)
  if (!found) MISSED.add(key)
  const node = found ? makeEl('div') : null
  lookupCache.set(key, node)
  return node
}

/* ── window / document ───────────────────────────────────────────────────── */
const spoken = []
function makeSpeech() {
  return {
    /* 故意混入"老拼接合成"音色：David(男) / Zira(女) / Huihui(女)，
       正确的选择应该跳过它们，挑 Online (Natural) 那两个 */
    _voices: [
      { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', localService: true },
      { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US', localService: true },
      { name: 'Microsoft Huihui Desktop - Chinese (Simplified)', lang: 'zh-CN', localService: true },
      { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', localService: false },
      { name: 'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)', lang: 'zh-CN', localService: false },
    ],
    getVoices() { return this._voices },
    speak(u) { spoken.push(u) },
    cancelCalls: 0,
    cancel() { this.cancelCalls++; spoken.length = 0 },
    resume() {},
    pause() {},
    addEventListener() {},
    removeEventListener() {},
  }
}

function run(withSpeech, cfgOverride, fetchStub, environment = {}) {
  MARKUP = ''
  MISSED.clear()
  lookupCache.clear()
  spoken.length = 0

  const root = makeEl('div')
  root._cls = 'dsu-root dsu-boot'
  const head = makeEl('head')
  const body = makeEl('body')
  const htmlEl = makeEl('html')

  const documentStub = {
    readyState: 'complete',
    head, body,
    documentElement: htmlEl,
    getElementById: (id) => (id === 'dsh-startup-root' ? root : null),
    createElement: (t) => makeEl(t),
    createDocumentFragment: () => makeEl("fragment"),
    createTextNode: (text) => Object.assign(makeEl("text"), { textContent: text }),
    createElementNS: (_ns, t) => makeEl(t),
    querySelector: () => null,
    listeners: new Map(),
    addEventListener: root.addEventListener,
    removeEventListener: root.removeEventListener,
    dispatchEvent: root.dispatchEvent,
  }

  const timers = []
  const windowStub = {
    __DSH_STARTUP__: {
      enabled: true, mode: 'always', theme: 'light', speed: 1,
      requireInteraction: true, allowSkip: true,
      identity: 'OPERATOR', identityId: '0001', accessLevel: '3',
      /* 只覆盖测试要变的；语速/音调/留白故意留空，好让断言直接校验 splash.js 出厂默认值 */
      voice: true, voiceLang: 'en', voiceName: '',
      sound: true, soundVolume: 0.5,
    },
    AudioContext: function () {
      return {
        state: 'running', currentTime: 0, sampleRate: 48000, destination: {},
        resume() {},
        createOscillator() {
          return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }
        },
        createGain() {
          return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
        },
        createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) } },
        createBufferSource() { return { buffer: null, connect() {}, start() {} } },
        createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} } },
      }
    },
    location: { host: '127.0.0.1:3080', href: 'http://127.0.0.1:3080/' },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    sessionStorage: { getItem: () => null, setItem() {} },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: (fn) => { fn(); return 1 },
    cancelAnimationFrame() {},
    /* 小延时同步执行 —— voiceLead 是 240ms，不这样做 line() 永远开不了口；
       大延时（动画时间线）照旧入队，测试保持同步可控 */
    setTimeout: (fn, ms) => {
      if ((ms || 0) <= 400) { fn(); return -1 }
      timers.push({ fn, ms })
      return timers.length
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    CustomEvent: function (t) { this.type = t },
  }
  if (environment.reducedMotion) windowStub.matchMedia = () => ({ matches: true })
  if (withSpeech) {
    windowStub.speechSynthesis = makeSpeech()
    if (environment.voices) windowStub.speechSynthesis._voices = environment.voices
    /* 浏览器里 window === globalThis，但沙箱里是两回事：
       splash.js 检查的是 window.SpeechSynthesisUtterance，所以两边都要挂 */
    windowStub.SpeechSynthesisUtterance = function (t) {
      this.text = t; this.rate = 1; this.pitch = 1; this.volume = 1
    }
  }
  if (environment.audioFactory) windowStub.AudioContext = environment.audioFactory
  windowStub.window = windowStub

  const sandbox = {
    window: windowStub,
    document: documentStub,
    fetch: fetchStub,
    console,
    Promise, Object, Array, JSON, String, Number, Math, Date, Error, RegExp, isFinite,
    setTimeout: windowStub.setTimeout,
    clearTimeout: windowStub.clearTimeout,
    setInterval: windowStub.setInterval,
    clearInterval: windowStub.clearInterval,
    requestAnimationFrame: windowStub.requestAnimationFrame,
    SpeechSynthesisUtterance: withSpeech
      ? function (t) { this.text = t; this.rate = 1; this.pitch = 1; this.volume = 1 }
      : undefined,
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox

  /* 配置覆盖必须在跑脚本之前生效 —— splash.js 只在加载时读一次配置 */
  Object.assign(windowStub.__DSH_STARTUP__, cfgOverride || {})

  vm.createContext(sandbox)
  const src = fs.readFileSync(BUNDLE, 'utf8')
  let thrown = null
  try {
    vm.runInContext(src, sandbox, { filename: 'splash.js' })
  } catch (e) {
    thrown = e
  }
  return { windowStub, root, head, timers, thrown, markup: MARKUP, sandbox, spoken, documentStub, nodes: new Map(lookupCache) }
}

/* ── 开跑 ───────────────────────────────────────────────────────────────── */
console.log('\n[1] 有 speechSynthesis 的环境（Chrome / Edge）')
let r = run(true)
check('初始化不抛异常', r.thrown === null, r.thrown && (r.thrown.message + '\n       ' + String(r.thrown.stack).split('\n')[1]))
check('摘掉了黑幕 dsu-boot（没摘掉 = 永久黑屏）', !r.root.classList.contains('dsu-boot'), '当前 class = ' + r.root._cls)
check('暴露了 __DSH_STARTUP_API__', !!(r.windowStub.__DSH_STARTUP_API__ && r.windowStub.__DSH_STARTUP_API__.replay))
check('API 上有 replay / skip / finish', ['replay', 'skip', 'finish'].every((k) => typeof (r.windowStub.__DSH_STARTUP_API__ || {})[k] === 'function'))
check('没有 FAILED 兜底标记', r.windowStub.__DSH_STARTUP_FAILED__ !== true)

console.log('\n[2] 生成出来的 markup 完整性')
for (const cls of [
  'dsu-plate', 'dsu-vignette', 'dsu-black-inner', 'dsu-wash', 'dsu-brand-1', 'dsu-frame',
  'dsu-scanline', 'dsu-corner', 'dsu-slats', 'dsu-voice', 'dsu-meta', 'dsu-status-zh',
  'dsu-sub-en', 'dsu-rule', 'dsu-logo', 'dsu-dots', 'dsu-idline', 'dsu-reticle', 'dsu-hex',
  'dsu-welcome', 'dsu-w1', 'dsu-btn', 'dsu-card', 'dsu-skip', 'dsu-foot', 'dsu-sub-zh',
  'dsu-progress', 'dsu-bloom', 'dsu-streak', 'dsu-flash',
]) {
  check('markup 含 .' + cls, r.markup.includes(cls))
}

console.log('\n[3] JS 用到的每个选择器都真实存在')
check('没有落空的选择器', MISSED.size === 0, [...MISSED].join(', '))

console.log('\n[4] 没有 speechSynthesis 的环境（老浏览器 / 隐私模式）')
r = run(false)
check('初始化不抛异常', r.thrown === null, r.thrown && r.thrown.message)
check('照样摘掉黑幕', !r.root.classList.contains('dsu-boot'), '当前 class = ' + r.root._cls)
check('暴露了 API', !!r.windowStub.__DSH_STARTUP_API__)

console.log('\n[5] 音色挑选：必须跳过拼接合成音色，挑神经网络女声')
r = run(true)
let api = r.windowStub.__DSH_STARTUP_API__
check('默认 voiceName 留空 = 自动挑', api.config.voiceName === '')
api.speak('Access permission required.')
let u = r.spoken[r.spoken.length - 1]
let vname = u && u.voice ? u.voice.name : '(未设置 voice)'
check('英文挑到 Aria Online (Natural)，而不是 David/Zira', /aria/i.test(vname) && /natural|online/i.test(vname), vname)
check('不是男声 David', !/david/i.test(vname), vname)

r = run(true, { voiceLang: 'zh' })
api = r.windowStub.__DSH_STARTUP_API__
api.speak('Access permission required.', '需要访问许可')
u = r.spoken[r.spoken.length - 1]
vname = u && u.voice ? u.voice.name : '(未设置 voice)'
check('中文挑到 Xiaoxiao Online (Natural)，而不是 Huihui', /xiaoxiao/i.test(vname) && /natural|online/i.test(vname), vname)

r = run(true, { voiceLang: 'both' })
api = r.windowStub.__DSH_STARTUP_API__
api.speak('Verification passed.', '验证通过')
const names = r.spoken.map((x) => (x.voice ? x.voice.name : '')).filter(Boolean)
check('中英各念一遍 = 排了两条 utterance', r.spoken.length === 2, String(r.spoken.length))
check('中文用中文音色、英文用英文音色', names.some((n) => /xiaoxiao/i.test(n)) && names.some((n) => /aria/i.test(n)), names.join(' | '))

console.log('\n[6] 播报语调节奏与名字念法')
r = run(true)
api = r.windowStub.__DSH_STARTUP_API__
api.speak('Identity verification.')
u = r.spoken[r.spoken.length - 1]
check('语速接近日常说话速度（0.95–1.05）', u.rate >= 0.95 && u.rate <= 1.05, String(u.rate))
check('音调自然明亮（1–1.1）', u.pitch >= 1 && u.pitch <= 1.1, String(u.pitch))
check('名字全大写会转 Title Case（避免逐字母念）', api.speakName('OPERATOR') === 'Operator', api.speakName('OPERATOR'))
check('中文名字原样不动', api.speakName('琉璃') === '琉璃', api.speakName('琉璃'))
check('API 暴露了 voice 供设置页显示', typeof api.voice === 'string')

console.log('\n[7] 动画不许掐断语音（这是这一版的核心诉求）')
r = run(true)
api = r.windowStub.__DSH_STARTUP_API__
const speech = r.windowStub.speechSynthesis
check('voiceLead 默认 240ms（提示音后留一拍再开口）', api.config.voiceLead === 240, String(api.config.voiceLead))
speech.cancelCalls = 0
api.speak('Access permission required.')
api.speak('Identity verification.')
api.speak('Access request received.')
check('连播三句，cancel 一次都没调用（队列顺序播报）', speech.cancelCalls === 0, 'cancel ' + speech.cancelCalls + ' 次')
check('三句都排进了队列', r.spoken.length === 3, String(r.spoken.length))
speech.cancelCalls = 0
api.skip()
check('按跳过时才真的掐断（cancel 1 次）', speech.cancelCalls === 1, 'cancel ' + speech.cancelCalls + ' 次')

console.log('\n[8] 终幕用真声欢迎语（旧主题可选素材 line-6）')
{
  const src = fs.readFileSync(BUNDLE, 'utf8')
  check('全程没有 voice.tts( 调用（不再用 TTS 念白）', !/voice\.tts\(/.test(src))
  check('终幕挂了 line-6 素材', /voice\.line\('Welcome back\.', '欢迎回来。', 'line-6'\)/.test(src))
  check('揭幕前会等欢迎语播完', /\.then\(function \(\) \{ return welcome \}\)/.test(src))
  check('预加载包含 line-6', /ensureAsset\('line-6'\)/.test(src))
  check('四步仍然各自挂着真声素材（第一步改指纹后不再挂）', (src.match(/audio: 'line-/g) || []).length === 4)
  check('开机语音素材默认 line-0', /wakeAudio: 'line-0'/.test(src))
  check('总共至少 5 份人声素材被引用（line-2..6）', (src.match(/'line-[1-6]'/g) || []).length >= 5)
}


console.log('\n[9] 指纹和密码均由 macOS 系统面板处理')
/* 虚拟时间推进完整动画，不等待真实时钟或调用本机认证。 */
async function advanceUntil(result, predicate) {
  for (let turn = 0; turn < 2000; turn++) {
    await Promise.resolve()
    if (predicate()) return
    const timer = result.timers.shift()
    if (timer) timer.fn()
  }
  throw new Error('未到达预期的动画交互状态')
}
function key(result, name) {
  result.documentStub.dispatchEvent({ type: 'keydown', key: name, preventDefault() {} })
}
const requests = []
let unlockResult = { ok: false, reason: 'cancelled', code: -2 }
let probeResult = { supported: true, platform: 'darwin', biometry: 'touchid' }
let accountFixture = { ok: true, status: 'signed-in', name: '测试账户', runtime: { version: '1.4.0', platform: 'darwin' } }
const fetchStub = async (url, options) => {
  requests.push({ url, body: options?.body ? JSON.parse(options.body) : null })
  const value = url.includes('/account?') ? accountFixture : url.endsWith('/status') ? probeResult : await unlockResult
  return { json: async () => value }
}
try {
  r = run(false, { voice: false, sound: false, wakeAudio: '', bioAttempts: 1, bioFallback: 'allow' }, fetchStub)
  const button = r.nodes.get('.dsu-btn')
  const hint = r.nodes.get('.dsu-hint')
  const card = r.nodes.get('.dsu-card')
  await advanceUntil(r, () => button.listeners.get('click')?.size > 0)
  check('初始入口明确打开系统认证面板', r.nodes.get('.dsu-btn-zh').textContent === '系统验证' && hint.innerHTML.includes('请勿在网页中输入密码'))
  for (const [reason, expected] of [
    ['cancelled', '已取消'], ['denied', '未通过'], ['network', '连接失败'],
    ['timeout', '超时'], ['needs-build', '组件不可用'], ['busy', '正在进行'],
    ['unavailable', '系统认证不可用'], ['error', '未完成'],
  ]) {
    unlockResult = { ok: false, reason }
    button.dispatchEvent({ type: 'click', preventDefault() {} })
    check('认证请求期间按钮禁用，避免重复面板', button.disabled === true && button.listeners.get('click')?.size === 0)
    await advanceUntil(r, () => button.listeners.get('click')?.size > 0)
    check(reason + ' 显示对应提示', hint.innerHTML.includes(expected), hint.innerHTML)
    check(reason + ' 后保持验证入口，不创建密码输入框', card.hidden && !card.children.some(child => child.type === 'password'))
  }
  check('旧最终放行配置不绕过系统认证', r.nodes.get('.dsu-btn-zh').textContent === '重试系统验证')
  check('认证请求只携带 nonce，无密码或客户端策略字段', requests.filter(q => q.url.endsWith('/unlock')).every(q => Object.keys(q.body).join() === 'nonce'))
  check('未向密码接口发送请求', !requests.some(q => q.url.endsWith('/password')))
  unlockResult = { ok: true, reason: 'granted' }
  button.dispatchEvent({ type: 'click', preventDefault() {} })
  await advanceUntil(r, () => !card.hidden)
  check('系统认证成功后才进入真实账户确认', !card.hidden && card.children.length === 3)
  check('身份卡显示账户接口昵称而非预设身份', card.children[1].children[1].textContent === '测试账户')
  check('真实账户昵称不写入配置身份字段', r.windowStub.__DSH_STARTUP_API__.config.identity === 'OPERATOR')
  r.windowStub.__DSH_STARTUP_API__.skip()

  probeResult = { supported: true, platform: 'darwin', biometry: 'none' }
  r = run(false, { voice: false, sound: false }, fetchStub)
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  check('无指纹设备仍提供系统密码认证入口', r.nodes.get('.dsu-btn-zh').textContent === '系统验证' && r.nodes.get('.dsu-card').hidden)
  key(r, 'Escape')
  check('仍可按 Esc 跳过动画', r.root.classList.contains('dsu-gone'))

  r = run(false, { voice: false, sound: false }, async () => { throw new Error('离线') })
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  check('设备探测网络失败时显示提示，不自动放行', r.nodes.get('.dsu-hint').innerHTML.includes('连接失败'))
  r.windowStub.__DSH_STARTUP_API__.skip()

  let completeUnlock
  unlockResult = new Promise(resolve => { completeUnlock = resolve })
  r = run(false, { voice: false, sound: false }, fetchStub)
  let audioStarts = 0
  r.sandbox.Audio = function () { audioStarts++; throw new Error('不应启动语音') }
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  r.nodes.get('.dsu-btn').dispatchEvent({ type: 'click', preventDefault() {} })
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').disabled === true)
  check('等待系统面板时显示验证中及密码操作提示', r.nodes.get('.dsu-hint').innerHTML.includes('使用密码'))
  key(r, 'Escape')
  completeUnlock({ ok: true, reason: 'granted' })
  for (let turn = 0; turn < 50; turn++) await Promise.resolve()
  check('跳过后迟到的系统认证成功不会重播开机语音', r.root.classList.contains('dsu-gone') && audioStarts === 0)
  for (const state of ['signed-in', 'signed-out', 'error', 'unavailable']) {
    accountFixture = { ok: true, status: state, name: state === 'signed-in' ? '<真实测试昵称>' : undefined, runtime: { version: '1.4.0', platform: 'darwin' } }
    r = run(false, { theme: 'hud', bioGate: false, voice: false, sound: false, wakeAudio: '' }, fetchStub)
    await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
    r.nodes.get('.dsu-btn').dispatchEvent({ type: 'click', preventDefault() {} })
    await advanceUntil(r, () => r.nodes.get('.dsu-btn-zh').textContent === '进入工作台' && !r.nodes.get('.dsu-btn').disabled)
    const nickname = r.nodes.get('.dsu-card').children[1].children[1].textContent
    check(state + ' 采用 HUD 且不冒用预设姓名', r.root.classList.contains('dsu-hud') && nickname === (state === 'signed-in' ? '<真实测试昵称>' : '—'))
    check(state + ' 不创建网页密码框', !r.nodes.get('.dsu-card').children.some(child => child.type === 'password'))
    r.windowStub.__DSH_STARTUP_API__.skip()
  }
  const accountCalls = requests.filter(q => q.url.includes('/account?')).length
  r = run(false, { theme: 'hud', identitySource: 'custom', bioGate: false, voice: false, sound: false, wakeAudio: '' }, fetchStub)
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  r.nodes.get('.dsu-btn').dispatchEvent({ type: 'click', preventDefault() {} })
  await advanceUntil(r, () => !r.nodes.get('.dsu-card').hidden)
  check('选择自定义称呼时不读取 DeepSeek 账户', requests.filter(q => q.url.includes('/account?')).length === accountCalls)
  r.windowStub.__DSH_STARTUP_API__.skip()
} catch (err) {
  check('完整系统认证交互可执行', false, err.message)
}

console.log('\n[10] HUD 欢迎语、顺序回应与静音清理')
async function flushVoice() { for (let i = 0; i < 40; i++) await Promise.resolve() }
function clickSound(result) {
  result.nodes.get('.dsu-sound-toggle').dispatchEvent({ type: 'click', stopPropagation() {} })
}
try {
  r = run(true, { theme: 'hud', voiceLang: 'zh', welcomeLine: '欢迎来到星舰控制台。' })
  api = r.windowStub.__DSH_STARTUP_API__
  api.speak('Stale phase.', '过期阶段。')
  await flushVoice()
  check('首次手势前不播报或积累阶段', r.spoken.length === 0)
  clickSound(r)
  await flushVoice()
  let welcome = r.spoken.find(item => item.text.trim())
  check('首次点击播报设置中的欢迎语', welcome?.text === '欢迎来到星舰控制台。')
  welcome.onstart()
  check('真正起播才点亮核心波形', r.nodes.get('.dsu-voice').classList.contains('dsu-on') && r.nodes.get('.dsu-sound-toggle').textContent.includes('正在播报'))
  api.speak('First acknowledgement.', '第一句回应。')
  api.speak('Second acknowledgement.', '第二句回应。')
  await flushVoice()
  check('欢迎语未结束时后续回应不会抢播', r.spoken.filter(item => item.text.trim()).length === 1)
  welcome.onend()
  await flushVoice()
  let acknowledgement = r.spoken[r.spoken.length - 1]
  check('欢迎语结束后按序播放回应', acknowledgement.text === '第一句回应。')
  acknowledgement.onstart()
  clickSound(r)
  await flushVoice()
  check('静音取消当前语音并关闭波形', !api.config.voice && !api.config.sound && !r.nodes.get('.dsu-voice').classList.contains('dsu-on'))
  clickSound(r)
  await flushVoice()
  check('重新开启不补播过期回应或重复欢迎', !r.spoken.some(item => item.text === '第二句回应。' || item.text === '欢迎来到星舰控制台。'))
  api.skip()
  const before = r.spoken.length
  for (const timer of r.timers.splice(0)) timer.fn()
  await flushVoice()
  check('退出后迟到的延迟回调不会恢复语音', r.spoken.length === before && r.root.classList.contains('dsu-gone'))

  r = run(true, { theme: 'hud', voiceLang: 'zh', welcomeLine: '' })
  clickSound(r)
  await flushVoice()
  check('欢迎语留空不会播默认品牌或账户昵称', r.spoken.every(item => !item.text.trim()))
  api = r.windowStub.__DSH_STARTUP_API__
  api.skip()

  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceLead: 500 })
  clickSound(r)
  await flushVoice()
  r.windowStub.__DSH_STARTUP_API__.skip()
  for (const timer of r.timers.splice(0)) timer.fn()
  await flushVoice()
  check('跳过取消尚在提示音留白期间的欢迎语', r.spoken.length === 0)
} catch (err) { check('HUD 语音交互可执行', false, err.stack) }

try {
  let authenticate
  const actualResult = new Promise(resolve => { authenticate = resolve })
  r = run(true, { theme: 'hud', voiceLang: 'zh', welcomeLine: '' }, async url => ({ json: async () => url.endsWith('/status') ? { supported: true, platform: 'darwin' } : url.endsWith('/unlock') ? actualResult : { ok: true, status: 'signed-out' } }))
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  key(r, 'Enter')
  await flushVoice()
  check('真实确认触发光环脉冲', r.root.classList.contains('dsu-impact'))
  check('系统验证尚未返回时不播报验证通过', !r.spoken.some(item => item.text === '验证通过，欢迎回来。'))
  authenticate({ ok: true, reason: 'granted' })
  await advanceUntil(r, () => r.spoken.some(item => item.text === '验证通过，欢迎回来。'))
  check('系统实际成功后播放验证回应', r.spoken.some(item => item.text === '验证通过，欢迎回来。'))
  await advanceUntil(r, () => !r.nodes.get('.dsu-card').hidden && r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  await advanceUntil(r, () => r.spoken.some(item => item.text === '你还没有登录账户，可以进入工作台后再登录。'))
  check('验证后连接账户并播放真实结果', r.spoken.some(item => item.text === '你还没有登录账户，可以进入工作台后再登录。'))
  r.windowStub.__DSH_STARTUP_API__.skip()
} catch (err) { check('系统验证语音与真实结果一致', false, err.stack) }

console.log('\n[11] 内置女声播放与音色选择')
try {
  const sources = []
  const contexts = []
  const decoded = { duration: 2.5 }
  function assetAudio() {
    const context = {
      state: 'running', currentTime: 0, sampleRate: 48000, destination: {},
      resume() { return Promise.resolve() },
      close() { context.closed = true; return Promise.resolve() },
      decodeAudioData() { return Promise.resolve(decoded) },
      createBuffer() { return {} },
      createBufferSource() {
        const source = { connect() {}, disconnect() {}, start() { sources.push(source) }, stop() { source.stopped = true } }
        return source
      },
      createGain() { return { gain: { value: 0 }, connect() {} } },
    }
    contexts.push(context)
    return context
  }
  const fetched = []
  r = run(true, { theme: 'hud', voiceLang: 'zh', sound: false }, async url => {
    fetched.push(url)
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(32) }
  }, { audioFactory: assetAudio })
  await flushVoice()
  clickSound(r)
  await flushVoice()
  const welcomeSource = sources.find(source => source.buffer === decoded)
  check('默认中文欢迎语实际启动内置女声音源', !!welcomeSource && fetched.some(url => url.endsWith('/hud-welcome.m4a')))
  check('内置女声不会同时叠加浏览器 TTS', r.spoken.every(item => !item.text.trim()))
  clickSound(r)
  await flushVoice()
  check('静音停止素材音源并释放音频上下文', welcomeSource?.stopped === true && contexts.some(context => context.closed))
  clickSound(r)
  r.windowStub.__DSH_STARTUP_API__.speak('Local service online.', '本地服务已响应。')
  await flushVoice()
  check('重新开启后新台词可以继续播放', sources.filter(source => source.buffer === decoded).length === 2)
  r.windowStub.__DSH_STARTUP_API__.skip()
  check('跳过也停止正在播放的女声素材', sources.filter(source => source.buffer === decoded).every(source => source.stopped))

  const macVoices = [
    { name: 'Eddy (中文（中国大陆）)', lang: 'zh-CN', localService: true },
    { name: 'Meijia', lang: 'zh-TW', localService: true },
    { name: 'Tingting', lang: 'zh-CN', localService: true },
  ]
  r = run(true, { voiceLang: 'zh' }, undefined, { voices: macVoices })
  r.windowStub.__DSH_STARTUP_API__.speak('', '欢迎回来。')
  check('macOS 自动选中文女声，避免误选列表首个男声', r.spoken.at(-1).voice.name === 'Tingting')
  r.windowStub.__DSH_STARTUP_API__.skip()
  r = run(true, { voiceLang: 'zh', voiceName: 'Meijia' }, undefined, { voices: macVoices })
  r.windowStub.__DSH_STARTUP_API__.speak('', '欢迎回来。')
  check('用户指定其他女声时保留选择', r.spoken.at(-1).voice.name === 'Meijia')
  r.windowStub.__DSH_STARTUP_API__.skip()

  const manifest = JSON.parse(fs.readFileSync(new URL('../lib/assets/hud-voice.json', import.meta.url)))
  check('内置素材清单标明实际女声音色', manifest.voice === 'zh-CN-XiaoxiaoNeural')
  check('小余欢迎语使用更柔和的晓伊音色', manifest.lines['hud-entry'] === '欢迎主人回来，我是你的AI助手小余。' && manifest.overrides['hud-entry'].voice === 'zh-CN-XiaoyiNeural')
  check('每份台词都有处理后的本地音频', Object.values(manifest.rendered).every(file => fs.statSync(new URL('../lib/assets/' + file, import.meta.url)).size > 1000))
  check('每份台词对应非空 MP3 文件', Object.keys(manifest.lines).every(name => fs.statSync(new URL('../lib/assets/' + name + '.mp3', import.meta.url)).size > 1000))
} catch (err) { check('内置女声可播放并正确清理', false, err.stack) }

console.log('\n[12] 工作台出现后欢迎小余')
try {
  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', welcomeLine: '', bioGate: false }, async url => ({ json: async () => url.includes('/account?') ? { ok: true, status: 'signed-out' } : { supported: true, platform: 'darwin' } }))
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  key(r, 'Enter')
  await advanceUntil(r, () => !r.nodes.get('.dsu-card').hidden && r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  check('工作台出现前不播小余欢迎语', !r.spoken.some(item => item.text.includes('主人')))
  key(r, 'Enter')
  await advanceUntil(r, () => r.spoken.some(item => item.text === '欢迎主人回来，我是你的AI助手小余。工作台已经准备好了，有什么需要，随时交给我吧。'))
  check('工作台出现后只播一遍指定欢迎语', r.spoken.filter(item => item.text === '欢迎主人回来，我是你的AI助手小余。工作台已经准备好了，有什么需要，随时交给我吧。').length === 1 && r.root.classList.contains('dsu-handoff'))
  check('欢迎语播放期间工作台可以点击和滚动', r.root.style.pointerEvents === 'none' && r.root.inert === true && !r.documentStub.documentElement.classList.contains('dsu-lock'))
  check('进入后的欢迎语不会被揭幕提前截断', !r.root.classList.contains('dsu-gone'))
  const entry = r.spoken.find(item => item.text.includes('主人'))
  entry.onend()
  await advanceUntil(r, () => r.root.classList.contains('dsu-gone'))
  check('播报完成后释放启动界面资源', r.root.classList.contains('dsu-gone'))

  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', welcomeLine: '', bioGate: false }, async () => ({ json: async () => ({ ok: true, status: 'signed-out' }) }))
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  key(r, 'Enter')
  r.windowStub.__DSH_STARTUP_API__.skip()
  for (const timer of r.timers.splice(0)) timer.fn()
  await flushVoice()
  check('跳过动画不补播进入后的欢迎语', !r.spoken.some(item => item.text.includes('主人')))
} catch (err) { check('进入后欢迎语流程可执行', false, err.stack) }

try {
  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', welcomeLine: '', bioGate: false, requireInteraction: false }, async () => ({ json: async () => ({ ok: true, status: 'signed-out' }) }))
  clickSound(r)
  await advanceUntil(r, () => r.spoken.some(item => item.text.includes('主人')))
  r.windowStub.__DSH_STARTUP_API__.replay()
  check('欢迎语播放期间重播会停止旧语音', r.windowStub.speechSynthesis.cancelCalls === 1 && r.spoken.length === 0)
} catch (err) { check('重播清理进入后欢迎语', false, err.stack) }

console.log('\n[13] 按实际状态补充台词，不播过期提示')
try {
  for (const [status, expected] of [
    ['signed-in', '账户已连接，正在为你准备工作台。'],
    ['signed-out', '你还没有登录账户，可以进入工作台后再登录。'],
    ['error', '账户暂时没有连上，你可以进入工作台后再检查。'],
    ['unavailable', '账户暂时没有连上，你可以进入工作台后再检查。'],
  ]) {
    r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', welcomeLine: '', bioGate: false }, async () => ({ json: async () => ({ ok: true, status, name: status === 'signed-in' ? '测试账户' : undefined }) }))
    await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
    key(r, 'Enter')
    await advanceUntil(r, () => r.spoken.some(item => item.text === expected))
    check(status + ' 播报实际账户结果', r.spoken.some(item => item.text === expected))
    if (status !== 'signed-in') check(status + ' 不播报账户已连接', !r.spoken.some(item => item.text === '账户已连接，正在为你准备工作台。'))
    r.windowStub.__DSH_STARTUP_API__.skip()
  }

  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', welcomeLine: '小余正在启动。' }, async url => ({ json: async () => url.endsWith('/status') ? { supported: true, platform: 'darwin' } : url.endsWith('/unlock') ? { ok: true, reason: 'granted' } : { ok: true, status: 'signed-out' } }))
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  clickSound(r)
  await flushVoice()
  const introduction = r.spoken.find(item => item.text === '小余正在启动。')
  key(r, 'Enter')
  await flushVoice()
  introduction.onend()
  await flushVoice()
  check('排队期间验证已完成，不再提示去系统面板验证', !r.spoken.some(item => item.text === '请在系统面板完成验证，我在这里等你。'))
  r.windowStub.__DSH_STARTUP_API__.skip()

  const fetched = []
  r = run(false, { theme: 'hud', voiceLang: 'zh', voiceCue: false }, async url => { fetched.push(url); return { ok: false } })
  await flushVoice()
  check('关闭提示音会预载不含电子提示音的欢迎语', fetched.some(url => url.endsWith('/hud-entry-extended-clean.m4a')) && !fetched.some(url => url.endsWith('/hud-entry-extended.m4a')))
  r.windowStub.__DSH_STARTUP_API__.skip()
} catch (err) { check('新增语音与实际状态一致', false, err.stack) }

console.log('\n[14] HUD 合并为验证与进入两次操作')
try {
  let accountRequests = 0
  let resolveAccount
  const accountReply = new Promise(resolve => { resolveAccount = resolve })
  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', bioGate: false }, async url => {
    if (url.includes('/account?')) { accountRequests++; return { json: () => accountReply } }
    return { json: async () => ({}) }
  })
  const buttonReady = label => r.nodes.get('.dsu-btn-zh').textContent === label && !r.nodes.get('.dsu-btn').disabled
  async function remainAt(label) {
    for (let turn = 0; turn < 100; turn++) {
      const timer = r.timers.shift()
      if (timer) timer.fn()
      await Promise.resolve()
    }
    check(label + ' 不操作便保持等待', buttonReady(label) && !r.root.classList.contains('dsu-handoff'))
  }
  await advanceUntil(r, () => buttonReady('系统验证'))
  r.documentStub.dispatchEvent({ type: 'pointerdown', target: r.root })
  await flushVoice()
  check('背景手势只解锁声音，不抢播台词', r.spoken.every(item => !item.text.trim()))
  await remainAt('系统验证')
  check('未确认验证前不会查询账户', accountRequests === 0)
  key(r, 'Enter')
  key(r, 'Enter')
  await flushVoice()
  check('验证后自动查询账户，等待结果期间不重复请求', accountRequests === 1 && r.nodes.get('.dsu-btn').disabled)
  resolveAccount({ ok: true, status: 'signed-in', name: '测试账户' })
  await advanceUntil(r, () => buttonReady('进入工作台'))
  await remainAt('进入工作台')
  check('只经过一次验证操作便到达最终确认', r.nodes.get('.dsu-stepcount').textContent.includes('02 / 02'))
  check('等待进入时不播中间步骤或小余欢迎语', !r.spoken.some(item => ['本地服务已响应。', '一切就绪，我们开始吧。', '好的，这就为你打开工作台。'].includes(item.text) || item.text.includes('主人')))
  r.nodes.get('.dsu-action').dispatchEvent({ type: 'click', target: r.nodes.get('.dsu-btn'), preventDefault() {} })
  await remainAt('进入工作台')
  r.documentStub.dispatchEvent({ type: 'keydown', key: 'Enter', repeat: true, preventDefault() {} })
  await flushVoice()
  check('点击冒泡及长按回车不会自动进入', buttonReady('进入工作台'))
  r.windowStub.__DSH_STARTUP_API__.speak('', '尚未结束的账户说明。')
  await advanceUntil(r, () => r.spoken.some(item => item.text === '尚未结束的账户说明。'))
  r.windowStub.__DSH_STARTUP_API__.speak('', '过期的排队说明。')
  const cancels = r.windowStub.speechSynthesis.cancelCalls
  key(r, 'Enter')
  await flushVoice()
  check('最终点击取消旧队列，语音未结束也开始揭幕', r.windowStub.speechSynthesis.cancelCalls > cancels && r.root.classList.contains('dsu-handoff') && r.spoken.some(item => item.text === '好的，这就为你打开工作台。') && !r.spoken.some(item => item.text.includes('说明')))
  check('HUD 收尾不启用旧闪屏或文字故障', !r.root.classList.contains('dsu-peak') && r.nodes.get('.dsu-flash').style.opacity !== '0.72' && !r.nodes.get('.dsu-w1').classList.contains('dsu-glitch'))
  await advanceUntil(r, () => r.spoken.some(item => item.text.includes('主人')))
  check('揭幕后才播放小余欢迎语并释放工作台点击', r.root.classList.contains('dsu-handoff') && r.root.inert === true)
  r.windowStub.__DSH_STARTUP_API__.skip()

  r = run(true, { theme: 'hud', voiceLang: 'zh', voiceSource: 'tts', bioGate: false, identitySource: 'custom' })
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  key(r, 'Enter')
  await advanceUntil(r, () => r.nodes.get('.dsu-btn-zh').textContent === '进入工作台' && !r.nodes.get('.dsu-btn').disabled)
  key(r, 'Enter')
  await flushVoice()
  check('点击进入后立即开始淡出', r.root.classList.contains('dsu-handoff'))
  r.windowStub.__DSH_STARTUP_API__.skip()
  for (const timer of r.timers.splice(0)) timer.fn()
  await flushVoice()
  check('淡出中跳过不会被迟到回调恢复欢迎语', r.root.classList.contains('dsu-gone') && !r.spoken.some(item => item.text.includes('主人')))

  r = run(false, { theme: 'hud', voice: false, sound: false, bioGate: false, identitySource: 'custom' }, undefined, { reducedMotion: true })
  await advanceUntil(r, () => r.nodes.get('.dsu-btn').listeners.get('click')?.size > 0)
  key(r, 'Enter')
  await advanceUntil(r, () => r.nodes.get('.dsu-btn-zh').textContent === '进入工作台' && !r.nodes.get('.dsu-btn').disabled)
  key(r, 'Enter')
  await flushVoice()
  check('减少动态效果模式使用短淡出并及时释放遮罩', r.root.inert === true && r.root.classList.contains('dsu-gone'))
} catch (err) { check('两次确认与平滑揭幕可执行', false, err.stack) }

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
process.exit(fail === 0 ? 0 : 1)
