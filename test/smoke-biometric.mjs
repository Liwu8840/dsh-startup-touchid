/* ============================================================================
 * macOS 系统认证冒烟测试 —— 不弹真指纹面板，用假 helper 走完整条链路。
 * 覆盖：可用性探测、nonce、同源、系统认证结果与凭据接收接口的移除。
 * 用法：node smoke-biometric.mjs
 * ========================================================================== */
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SMOKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-bio-smoke-'))
process.env.DSH_HOME = SMOKE_HOME

/* 假 helper 只输出认证结果，并记录非敏感参数供断言。 */
const FAKE = path.join(SMOKE_HOME, 'fake-touchid.sh')
function writeFake(mode) {
  const granted = '{"ok":true,"reason":"granted","code":0,"biometry":"touchid"}'
  const denied = '{"ok":false,"reason":"denied","code":-2,"biometry":"touchid"}'
  const probe = '{"ok":true,"reason":"available","code":0,"biometry":"touchid"}'
  fs.writeFileSync(FAKE, [
    '#!/bin/sh',
    "printf '%s\\n' \"$@\" > \"$DSH_HOME/helper-args\"",
    'case "$1" in',
    '  --probe) echo \'' + probe + '\'; exit 0;;',
    '  --reason) ;;',
    '  *) echo \'{"ok":false,"reason":"invalid-arguments"}\'; exit 2;;',
    'esac',
    mode === 'deny' ? 'echo \'' + denied + '\'; exit 1' : 'echo \'' + granted + '\'; exit 0'
  ].join('\n') + '\n')
  fs.chmodSync(FAKE, 0o755)
}
writeFake('grant')
process.env.DSH_TOUCHID_HELPER = FAKE

const ROUTES = new Map()
const TAPS = []
const ctx = {
  webServer: {
    register(route) {
      ROUTES.set(route.kind + ' ' + route.path, route)
      return () => ROUTES.delete(route.kind + ' ' + route.path)
    },
    tapIndex(fn) { TAPS.push(fn); return () => TAPS.splice(TAPS.indexOf(fn), 1) },
  },
  inject() {},
  get(name) { return name === 'connection' ? { requestRejection() {} } : undefined },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
}

const mod = await import(pathToFileURL(path.join(PLUGIN_ROOT, 'lib', 'index.js')).href)
mod.apply(ctx)

class FakeReq extends EventEmitter {
  constructor(method, body, headers = {}) {
    super()
    this.method = method
    this.url = '/'
    this.headers = Object.assign({ host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }, headers)
    process.nextTick(() => {
      if (body !== undefined) this.emit('data', Buffer.from(body))
      this.emit('end')
    })
  }
}

function fakeRes() {
  return {
    statusCode: 0, headers: null, body: '',
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; return this },
    end(buf) { this.body = buf === undefined ? '' : Buffer.from(buf).toString('utf8') },
  }
}

async function call(kindPath, method = 'GET', body, headers) {
  const route = ROUTES.get(kindPath)
  if (!route) throw new Error('route missing: ' + kindPath)
  const res = fakeRes()
  await route.handler(new FakeReq(method, body, headers), res)
  let json = null
  try { json = JSON.parse(res.body) } catch { /* 非 JSON */ }
  return { code: res.statusCode, json, raw: res.body }
}

let pass = 0
let fail = 0
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ok   ' + label) }
  else { fail++; console.log('  FAIL ' + label + (extra ? '  → ' + extra : '')) }
}

const STATUS = 'exact /dsh-startup-touchid/biometric/status'
const UNLOCK = 'exact /dsh-startup-touchid/biometric/unlock'
const PASSWORD = 'exact /dsh-startup-touchid/biometric/password'

console.log('\n[1] 路由注册')
check('提供账户与 status / unlock，删除密码接收接口', ROUTES.size === 7 && ROUTES.has(STATUS) && ROUTES.has(UNLOCK) && !ROUTES.has(PASSWORD), String(ROUTES.size))

console.log('\n[2] nonce 注入')
const html = TAPS[0]('<html><head></head><body><div id="root"></div></body></html>')
const nonceMatch = /window\.__DSH_STARTUP_BIO_NONCE__="([0-9a-f]{32})"/.exec(html)
check('页面里注入了 32 位 hex nonce', !!nonceMatch)
const NONCE = nonceMatch ? nonceMatch[1] : ''

console.log('\n[3] 可用性探测')
const st = await call(STATUS)
check('supported = true', st.json && st.json.supported === true, JSON.stringify(st.json))
check('biometry = touchid', st.json && st.json.biometry === 'touchid')
check('带出 platform', st.json && st.json.platform === process.platform)

console.log('\n[4] 安全边界')
check('nonce 不符 → 403', (await call(UNLOCK, 'POST', JSON.stringify({ nonce: 'deadbeef' }))).code === 403)
check('缺 nonce → 403', (await call(UNLOCK, 'POST', '{}')).code === 403)
check('跨站来源 → 403', (await call(UNLOCK, 'POST', JSON.stringify({ nonce: NONCE }), { 'sec-fetch-site': 'cross-site' })).code === 403)
check('unlock GET → 405', (await call(UNLOCK, 'GET')).code === 405)
check('unlock 坏 JSON → 400', (await call(UNLOCK, 'POST', '{ not json')).code === 400)
console.log('\n[5] 指纹路径')
const ok1 = await call(UNLOCK, 'POST', JSON.stringify({ nonce: NONCE, policy: 'bio' }))
check('正确 nonce → ok:true', ok1.code === 200 && ok1.json.ok === true, JSON.stringify(ok1.json))
check('policy=any 仍然可用', (await call(UNLOCK, 'POST', JSON.stringify({ nonce: NONCE, policy: 'any' }))).json.ok === true)

console.log('\n[6] 凭据不经过插件')
const args = fs.readFileSync(path.join(SMOKE_HOME, 'helper-args'), 'utf8').trim().split('\n')
check('helper 仅接收说明，不接收认证策略或密码', args.length === 2 && args[0] === '--reason')
const native = fs.readFileSync(path.join(PLUGIN_ROOT, 'bin', 'touchid.m'), 'utf8')
check('原生程序不含 PAM 和标准输入密码读取', !/pam_|STDIN_FILENO|readPassword/.test(native))
check('原生程序使用系统设备所有者认证', /LAPolicy policy = LAPolicyDeviceOwnerAuthentication;/.test(native))
check('原生程序提供明确的系统密码选项', /setLocalizedFallbackTitle:@"使用 macOS 登录密码"/.test(native))

console.log('\n[8] 拒绝路径 + 互斥释放')
writeFake('deny')
const no = await call(UNLOCK, 'POST', JSON.stringify({ nonce: NONCE }))
check('helper 拒绝 → ok:false', no.json && no.json.ok === false, JSON.stringify(no.json))
writeFake('grant')
const again = await call(UNLOCK, 'POST', JSON.stringify({ nonce: NONCE }))
check('拒绝后互斥锁已释放', again.json && again.json.ok === true, JSON.stringify(again.json))

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
fs.rmSync(SMOKE_HOME, { recursive: true, force: true })
process.exit(fail === 0 ? 0 : 1)
