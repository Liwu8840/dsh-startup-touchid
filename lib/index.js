/**
 * 提供启动动画资源、配置和 macOS 系统认证结果，并在首屏注入运行时。
 * DeepSeek 账户资料通过现有账户服务读取，仅向受信页面返回昵称和登录状态。
 * 配置保存在 DSH_HOME 下；账户昵称和凭据不写入插件配置或包文件。
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-startup-touchid.json')
/* 独立命名空间：与上游 dsh-startup-touchid 并存时不抢路由、不抢配置文件。 */
const NS = 'dsh-startup-touchid'
const ROUTE_BASE = '/dsh-startup-touchid'

/** 服务实例 nonce：注入受信页面，POST 回来的必须一致。
    没有它，任何本地网页都能往 127.0.0.1 发 POST 刷你的 Touch ID 弹窗。 */
const BIO_NONCE = crypto.randomBytes(16).toString('hex')
const TOUCHID_REASON = '请使用 Touch ID 或 macOS 登录密码启动 DeepSeek Harness'

/** 插件版本：读自己的 package.json，避免源码与版本号两处各写一份。
    读不到就退回占位符（设置页会显示它，不会显示 undefined）。 */
const PLUGIN_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'))
    const v = String(pkg.version || '').trim()
    return v || '0.0.0'
  } catch (err) {
    return '0.0.0'
  }
})()

/** 自动编译产物按插件版本缓存，不能复用旧认证程序。 */
const CACHE_DIR = path.join(DSH_HOME, 'cache', 'dsh-startup-touchid', PLUGIN_VERSION)

/** 默认配置：字段与 lib/splash.js 的 DEFAULTS 一一对应。 */
const DEFAULTS = {
  enabled: true,
  mode: 'session',            // always | session | daily
  theme: 'hud',               // 科技 HUD、浅色或深色
  speed: 1,
  requireInteraction: true,
  allowSkip: true,
  sound: true,                // 界面音效（WebAudio 合成，无音频文件）
  soundVolume: 0.5,
  voice: true,                // 女声播报（Web Speech API）
  voiceLang: 'zh',            // en | zh | both
  voiceName: '',              // '' = 自动挑（按分数优先神经网络女声）
  voiceRate: 0.98,            // 接近日常说话速度
  voicePitch: 1.04,           // 保留自然音调，略微明亮
  voiceVolume: 0.9,
  voiceCue: true,             // 念台词前的一声轻提示
  sfx: 'audio',               // 音效来源：audio=lib/assets 里的真素材 / synth=现场合成
  voiceSource: 'asset',       // 语音来源：asset=优先用真声素材（拿不到自动回落 TTS）/ tts=全 TTS
  voiceLead: 240,             // 提示音之后留一小段空白再开口
  identitySource: 'deepseek',
  identity: 'OPERATOR',    // ← 设置页里可改的「身份名称」
  identityId: '0001',
  accessLevel: '3',
  brand1: 'DEEPSEEK',
  brand2: 'SYNTHESIZE INTELLIGENCE',
  brand3a: 'HARNESS',
  brand3b: 'OS',
  orgZh: '深度求索',
  orgEn: 'DEEPSEEK',
  orgSub: 'DEEPSEEK HARNESS',
  welcomeBox: 'DEEPSEEK HARNESS',
  footer: 'POWERED BY DEEPSEEK',
  accent: '#ff7500',
  glitchA: '#ff3b30',
  glitchB: '#2971b8',
  /* ── 生物识别闸门（替换原第一步） ── */
  bioGate: true,              // 总开关；关掉就等于原版「需要访问许可」
  bioAttempts: 3,             // 兼容旧配置，系统认证不使用此字段
  bioFallback: 'password',    // 兼容旧配置，系统认证不使用此字段
  bioReason: '请使用 Touch ID 或 macOS 登录密码启动 DeepSeek Harness',
  /* ── 开机固定语音 ── */
  welcomeLine: '欢迎来到 DeepSeek Harness。我已准备好了，随时为你服务。',
  entryLine: '欢迎主人回来，我是你的AI助手小余。工作台已经准备好了，有什么需要，随时交给我吧。',
  interactionVoice: true,
  wakeLine: '系统已就绪，欢迎回来',   // 素材缺失时的 TTS 兜底文本
  wakeAudio: 'line-0',        // lib/assets/line-0.m4a
  wakeVolume: 0.9,
  wakeDelayMs: 0              // 解锁通过后延迟多久开口
}

const TEXT_KEYS = [
  'identity', 'identityId', 'accessLevel',
  'brand1', 'brand2', 'brand3a', 'brand3b',
  'orgZh', 'orgEn', 'orgSub', 'welcomeBox', 'footer', 'voiceName',
  'wakeLine', 'welcomeLine', 'entryLine', 'bioReason'
]
const COLOR_KEYS = ['accent', 'glitchA', 'glitchB']
const ENUMS = {
  mode: ['always', 'session', 'daily'],
  theme: ['hud', 'light', 'dark'],
  identitySource: ['deepseek', 'custom'],
  voiceLang: ['en', 'zh', 'both'],
  sfx: ['audio', 'synth'],
  voiceSource: ['asset', 'tts'],
  bioFallback: ['password', 'allow', 'deny']
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'voice', 'voiceCue', 'bioGate', 'interactionVoice']
/** 数值字段的合法区间（越界即夹取）。 */
const RANGES = {
  speed: [0.35, 3],
  soundVolume: [0, 1],
  voiceRate: [0.5, 2],
  voiceLead: [0, 1200],
  voicePitch: [0, 2],
  voiceVolume: [0, 1],
  bioAttempts: [0, 9],
  wakeVolume: [0, 1],
  wakeDelayMs: [0, 5000]
}

function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (key === 'speed' || RANGES[key]) {
      const [lo, hi] = RANGES[key] || RANGES.speed
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (COLOR_KEYS.includes(key)) {
      const s = String(value).trim()
      out[key] = /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : DEFAULTS[key]
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else {
      out[key] = value
    }
  }
  if (!String(out.identity).trim()) out.identity = DEFAULTS.identity
  if (!String(out.identityId).trim()) {
    out.identityId = String(out.identity).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  }
  if (!String(out.identityId).trim()) out.identityId = 'OPERATOR'
  return out
}

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return normalize(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULTS }
  }
}

function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/** 静态文件按 mtime 缓存，改完插件刷新页面即生效。 */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}

const readSplashCss = makeReader('lib/splash.css')
const readSplashJs = makeReader('lib/splash.js')

/* ── Touch ID helper ──────────────────────────────────────────────────────
 * 浏览器没有任何指纹 API，所以由 host 半边 spawn 一个原生小工具去弹系统面板，
 * 只把「通过 / 拒绝 / 不可用」这一个布尔结果带回页面。
 * 生物特征本身不经过这里，也不落盘。
 * ---------------------------------------------------------------------- */

function helperPath() {
  const candidates = [
    /* 测试与自编译用户可以用环境变量指定，优先于包内二进制 */
    process.env.DSH_TOUCHID_HELPER || null,
    path.join(PACKAGE_ROOT, 'bin', 'dsh-touchid'),  // 随包预编译
    path.join(CACHE_DIR, 'dsh-touchid')            // 首次使用时现场编译
  ].filter(Boolean)
  for (const file of candidates) {
    try {
      if (fs.statSync(file).isFile()) return file
    } catch (err) { /* 继续找下一个 */ }
  }
  return null
}

let buildPromise = null
function ensureHelper() {
  const existing = helperPath()
  if (existing) return Promise.resolve(existing)
  if (buildPromise) return buildPromise
  const script = path.join(PACKAGE_ROOT, 'bin', 'build.sh')
  buildPromise = new Promise((resolve) => {
    execFile('sh', [script, CACHE_DIR], { timeout: 120_000, encoding: 'utf8' }, (err) => {
      resolve(err ? null : helperPath())
    })
  })
  buildPromise.then(() => { buildPromise = null }, () => { buildPromise = null })
  return buildPromise
}

/** helper 的 stdout 是最后一行 JSON；拿不到就归类成 error/timeout。 */
function parseHelperOutput(err, stdout) {
  const lines = String(stdout || '').trim().split('\n').filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i])
      if (parsed && typeof parsed.ok === 'boolean') return parsed
    } catch (parseErr) { /* 不是 JSON 就继续往前找 */ }
  }
  const killed = !!(err && (err.killed || err.signal))
  return { ok: false, reason: killed ? 'timeout' : 'error', code: -1 }
}

/** 系统面板负责指纹、密码输入和重试，插件只接收结果。 */
let bioBusy = false

async function runTouchId({ reason } = {}) {
  if (process.platform !== 'darwin') return { ok: false, reason: 'unsupported' }
  if (bioBusy) return { ok: false, reason: 'busy' }
  bioBusy = true
  try {
    const bin = await ensureHelper()
    if (!bin) return { ok: false, reason: 'needs-build' }
    return await new Promise((resolve) => {
      execFile(bin, ['--reason', reason || TOUCHID_REASON],
        { timeout: 75_000, killSignal: 'SIGKILL', encoding: 'utf8' },
        (err, stdout) => resolve(parseHelperOutput(err, stdout)))
    })
  } finally {
    bioBusy = false
  }
}

/** 可用性探测：只问 canEvaluatePolicy，绝不弹窗。结果缓存 30 秒。 */
let probeCache = null

async function probeTouchId() {
  if (process.platform !== 'darwin') {
    return { ok: false, reason: 'unsupported', biometry: 'none' }
  }
  if (probeCache && Date.now() - probeCache.at < 30_000) return probeCache.value
  const bin = await ensureHelper()
  if (!bin) return { ok: false, reason: 'needs-build', biometry: 'none' }
  const value = await new Promise((resolve) => {
    execFile(bin, ['--probe'], { timeout: 15_000, encoding: 'utf8' }, (err, stdout) => {
      resolve(parseHelperOutput(err, stdout))
    })
  })
  probeCache = { at: Date.now(), value }
  return value
}

/** 内联脚本里绝对不能出现 `</script>`。 */
function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')
}

/** 首屏兜底：在应用挂载前先把窗口盖住，避免闪出界面本体。 */
const CRITICAL_CSS = [
  'html.dsu-lock,html.dsu-lock body{overflow:hidden!important}',
  '#dsh-startup-root.dsu-boot{position:fixed;inset:0;z-index:2147483000;background:#000}'
].join('')

const BOOTSTRAP_JS = `(function(){try{
var c=window.__DSH_STARTUP__||{};
var root=document.getElementById('dsh-startup-root');
var off=!c.enabled;
if(!off&&c.mode==='session'&&sessionStorage.getItem('dsh-startup-touchid:shown')==='1')off=true;
if(!off&&c.mode==='daily'&&localStorage.getItem('dsh-startup-touchid:day')===new Date().toISOString().slice(0,10))off=true;
if(off){window.__DSH_STARTUP_SKIP__=true;if(root&&root.parentNode)root.parentNode.removeChild(root);}
else{document.documentElement.classList.add('dsu-lock');/* 兜底：连 splash.js 都没跑起来（404/被拦/语法错）时，9 秒后无条件放行，绝不锁黑屏 */setTimeout(function(){try{var r=document.getElementById('dsh-startup-root');if(r&&r.className&&r.className.indexOf('dsu-boot')!==-1){if(r.parentNode)r.parentNode.removeChild(r);document.documentElement.classList.remove('dsu-lock');if(document.body)document.body.style.overflow='';window.__DSH_STARTUP_FAILED__=true;}}catch(e){}},9000);}
}catch(e){} })()`

const name = NS
const inject = ['webServer', 'connection']

/**
 * 取得 HTTP 载体服务。
 *
 * web profile 与桌面端（DeepSeek Harness Desktop）都会挂 `@deepseek-ai/dsh-web-app`，
 * 其中 `webserver` 这一行提供 `webServer`；但 Electron 也可能改成 `file://` + IPC
 * 直接下发前端（`dsh-host-webserver` 的文档注释就写着 "Electron uses file:// plus
 * IPC instead"）。那种情况下没有 webServer，本插件不该把一颗 fiber 炸掉 ——
 * 交给客户端半侧自举（`lib/client.js` 的 selfBoot）。
 */
function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch (err) { /* 取不到就当没有 */ }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function' && typeof server.tapIndex === 'function'
}

function apply(ctx) {
  const disposers = []
  const webServer = resolveWebServer(ctx)

  /** 没有可注册路由的 HTTP 载体：桌面端若走 IPC 下发前端就是这种形态。
      什么都不注册（plugin 仍然 APPLIED，不报错），页面由客户端半侧自举。 */
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        '[' + NS + '] 当前 profile 没有可用的 webServer（桌面端可能用 file:// + IPC 下发前端）；' +
        'Host 半侧跳过路由与首屏注入，改由浏览器半侧自举启动界面。'
      )
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  let accountService = null
  ctx.inject(['deepseekAccount'], (scope) => {
    const service = scope.deepseekAccount
    accountService = service
    scope.effect(() => () => { if (accountService === service) accountService = null })
  })

  /** 浏览器信任栅栏：自定义路由必须过一遍，否则可被任意网页读写。 */
  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') {
        res.statusCode = 503
        res.end()
        return true
      }
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      res.statusCode = 503
      res.end()
      return true
    }
  }

  function registerRoute(route) {
    const inner = route && route.handler
    const wrapped = Object.assign({}, route, {
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
    return webServer.register(wrapped)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.css',
    handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readSplashCss())
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/splash.js',
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readSplashJs())
  }))

  /* 音频素材：从用户提供的音轨里抠出来的音效（选项/确认音）。
     只读、白名单、不含子路径 —— 杜绝目录穿越。素材缺失时浏览器会自动回落到合成音。
     m4a 是为了固定语音：afconvert 编不了 mp3，但系统自带 AAC 编码。 */
  const AUDIO_TYPES = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav'
  }
  disposers.push(registerRoute({
    kind: 'prefix',
    path: ROUTE_BASE + '/asset',
    handler: (req, res) => {
      const name = path.basename(decodeURIComponent((req.url || '').split('?')[0]))
      const match = /^([a-z0-9._-]+)\.(mp3|m4a|aac|wav)$/i.exec(name)
      if (!match || name.includes('..')) {
        res.writeHead(404); res.end(); return
      }
      const file = path.join(PACKAGE_ROOT, 'lib', 'assets', name)
      let bytes
      try { bytes = fs.readFileSync(file) } catch (err) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'Content-Type': AUDIO_TYPES[match[2].toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/config',
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: readConfig(), defaults: DEFAULTS, file: CONFIG_FILE })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      try {
        if (payload && payload.action === 'reset') {
          const cfgNow = writeConfig(DEFAULTS)
          sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
          return
        }
        const current = readConfig()
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        const cfgNow = writeConfig({ ...current, ...patch })
        sendJson(res, 200, { ok: true, version: PLUGIN_VERSION, config: cfgNow, defaults: DEFAULTS })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/account',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const service = accountService
      const runtime = { version: PLUGIN_VERSION, platform: process.platform }
      if (!service) {
        sendJson(res, 200, { ok: true, status: 'unavailable', runtime })
        return
      }
      try {
        const state = await service.getState()
        if (state.status === 'signed-out') {
          sendJson(res, 200, { ok: true, status: 'signed-out', runtime })
          return
        }
        const url = new URL(req.url || '/', 'http://localhost')
        const locale = url.searchParams.get('locale') || 'zh-CN'
        const offset = Number(url.searchParams.get('offset') || '0')
        if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(locale) ||
            !Number.isInteger(offset) || Math.abs(offset) > 86400) {
          sendJson(res, 400, { ok: false, error: 'invalid client metadata' })
          return
        }
        const profile = await service.getProfile({ version: PLUGIN_VERSION, locale, timezoneOffsetSeconds: offset })
        if (accountService !== service) {
          sendJson(res, 200, { ok: true, status: 'unavailable', runtime })
        } else if (profile === null) {
          sendJson(res, 200, { ok: true, status: 'signed-out', runtime })
        } else if (profile.status !== 'ready') {
          sendJson(res, 200, { ok: true, status: 'error', runtime })
        } else {
          // 仅投影昵称，不向动画传递账户编号、联系方式、头像、余额或凭据。
          sendJson(res, 200, { ok: true, status: 'signed-in', name: profile.value.name || 'DeepSeek 用户', runtime })
        }
      } catch (err) {
        sendJson(res, 200, { ok: true, status: 'error', runtime })
      }
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/biometric/status',
    handler: async (req, res) => {
      const result = await probeTouchId()
      sendJson(res, 200, {
        ok: true,
        supported: result.ok === true,
        biometry: result.biometry || 'none',
        reason: result.reason || '',
        platform: process.platform
      })
    }
  }))

  disposers.push(registerRoute({
    kind: 'exact',
    path: ROUTE_BASE + '/biometric/unlock',
    handler: async (req, res) => {
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      /* 同源校验：没有这道，任何本地网页都能往 127.0.0.1 发 POST 刷你的指纹弹窗。 */
      const site = req.headers['sec-fetch-site']
      if (site && site !== 'same-origin') {
        sendJson(res, 403, { ok: false, error: 'cross-origin' })
        return
      }
      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      /* 受信页面注入的 nonce 必须原样带回。 */
      if (!payload || payload.nonce !== BIO_NONCE) {
        sendJson(res, 403, { ok: false, error: 'bad nonce' })
        return
      }
      const result = await runTouchId({
        reason: readConfig().bioReason
      })
      sendJson(res, 200, {
        ok: result.ok === true,
        reason: result.reason || '',
        code: typeof result.code === 'number' ? result.code : -1
      })
    }
  }))

  disposers.push(webServer.tapIndex((html) => {
    if (!html || html.includes(ROUTE_BASE + '/splash.js')) return html
    const cfg = readConfig()
    const head =
      '<link rel="stylesheet" href="' + ROUTE_BASE + '/splash.css">' +
      '<style id="dsh-startup-critical">' + CRITICAL_CSS + '</style>'
    const body =
      '<div id="dsh-startup-root" class="dsu-root dsu-boot"></div>' +
      '<script>window.__DSH_STARTUP_BOOT__="index";window.__DSH_STARTUP_VERSION__=' + safeJson(PLUGIN_VERSION) + ';window.__DSH_STARTUP_BIO_NONCE__=' + safeJson(BIO_NONCE) + ';window.__DSH_STARTUP__=' + safeJson(cfg) + ';' + BOOTSTRAP_JS + '</script>' +
      '<script defer src="' + ROUTE_BASE + '/splash.js"></script>'

    let out = html
    if (out.includes('</head>')) out = out.replace('</head>', head + '</head>')
    else out = head + out
    if (out.includes('<body>')) out = out.replace('<body>', '<body>' + body)
    else if (out.includes('</body>')) out = out.replace('</body>', body + '</body>')
    else out = out + body
    return out
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}

/* 导出形状对齐 DSH 内部插件（如 dsh-host-open-in-app）：
   只给具名 name / inject / apply。
   两点刻意不做：
   1) 不导出 default —— cordis-plugin-loader 的 unwrapExports 是
      `exports.default ?? exports`，一旦有 default 就只认 default，
      两边都写反而多一个"改一处忘一处"的坑；
   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
      我这份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。 */
export { apply, inject, name }
