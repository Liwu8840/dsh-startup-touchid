/**
 * dsh-startup-touchid — 浏览器半侧（设置页「启动动画」）
 * ----------------------------------------------------------------------------
 * 以 dsh.client bundle 格式加载（手写 ModuleLoader bundle，无需构建）：
 * 在 DSH 设置里注册一个 `settings.section`，用来改启动动画的身份名称、
 * 权限等级、配色、速度、交互开关等等。
 *
 * 数据不走 settings 命名空间，而是走 Host 半侧自带的 HTTP API
 * （GET/POST /dsh-startup-touchid/config）——与 dsh-meme 同款做法，少受
 * dsh-settings 版本变更影响。注册 id 必须等于 loader entry 名
 * （dsh-startup-touchid），否则 ModuleLoader 会报
 * "loaded without registering dsh-startup-touchid"。
 */
window.__ModuleLoader__.load({
  id: 'dsh-startup-touchid',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement

    var API = '/dsh-startup-touchid/config'

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var CSS = [
      '.__ss_root{max-width:620px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.__ss_version{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.__ss_groupTitle{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_field{display:flex;flex-direction:column;gap:5px}',
      '.__ss_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.__ss_hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.__ss_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.__ss_input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_inputMono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.06em}',
      '.__ss_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:180px}',
      '.__ss_check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.__ss_check input{margin-top:2px;accent-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_checkText{display:flex;flex-direction:column;gap:2px}',
      '.__ss_two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.__ss_actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.__ss_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.__ss_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.__ss_btn:disabled{opacity:.5;cursor:default}',
      '.__ss_btnPrimary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.__ss_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.__ss_ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.__ss_err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.__ss_swatch{width:38px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}',
      '.__ss_preview{margin-top:2px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.__ss_previewText{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5}'
    ].join('')
    var tagId = 'dsh-startup-touchid/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-startup-touchid'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /* ── 表单原子 ────────────────────────────────────────────────────────── */
    function Field(props) {
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, props.label),
        props.children,
        props.hint ? h('div', { className: '__ss_hint' }, props.hint) : null
      )
    }

    function TextInput(props) {
      return h('input', {
        className: '__ss_input' + (props.mono ? ' __ss_inputMono' : ''),
        type: 'text',
        value: props.value == null ? '' : String(props.value),
        placeholder: props.placeholder || '',
        maxLength: props.maxLength || 64,
        spellCheck: false,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Select(props) {
      return h('select', {
        className: '__ss_select',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      }, props.options.map((o) => h('option', { key: o[0], value: o[0] }, o[1])))
    }

    function Check(props) {
      return h('label', { className: '__ss_check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: (e) => props.onChange(e.target.checked)
        }),
        h('span', { className: '__ss_checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: '__ss_hint' }, props.hint) : null
        )
      )
    }

    function ColorInput(props) {
      return h('input', {
        className: '__ss_swatch',
        type: 'color',
        value: props.value,
        onChange: (e) => props.onChange(e.target.value)
      })
    }

    function Range(props) {
      return h('div', { className: '__ss_row' },
        h('input', {
          type: 'range',
          min: props.min, max: props.max, step: props.step || 0.05,
          value: props.value,
          style: { flex: '1 1 200px' },
          onChange: (e) => props.onChange(Number(e.target.value))
        }),
        h('span', { className: '__ss_status' }, props.display)
      )
    }

    /* ── 语音：读系统里可用的音色，女声排在前面 ─────────────────────────── */
    var NATURAL_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google']
    var FEMALE_HINTS = [
      'aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
      'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
      'susan', 'fiona', 'hazel', 'female', 'woman',
      'xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', '晓晓', '晓伊', '女声',
      'tingting', 'meijia', 'sinji', '婷婷', '美佳', '善怡'
    ]
    var MALE_HINTS = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred',
      'male', 'yunxi', 'yunjian', 'kangkang', 'eddy', 'reed', 'rocko', 'grandpa']

    function hits(name, list) {
      for (var i = 0; i < list.length; i++) if (name.indexOf(list[i]) !== -1) return true
      return false
    }
    /** 神经网络音色优先，其次女声，最后剔掉男声 —— 和运行时 splash.js 的打分口径一致 */
    function scoreVoice(name, lang, want) {
      var sc = 0
      if (hits(name, NATURAL_HINTS)) sc += 60
      if (hits(name, FEMALE_HINTS)) sc += 40
      if (MALE_HINTS.some(function (hint) { return hint === 'male' ? /(^|[^a-z])male([^a-z]|$)/.test(name) : name.indexOf(hint) !== -1 })) sc -= 45
      if (name.indexOf('tingting') !== -1 || name.indexOf('婷婷') !== -1) sc += 10
      if (/zh[-_]cn/i.test(lang) && want === 'zh') sc += 6
      if (String(lang || '').indexOf(want) === 0) sc += 25
      return sc
    }

    function readVoices() {
      try {
        var s = window.speechSynthesis
        if (!s || typeof s.getVoices !== 'function') return []
        var list = s.getVoices() || []
        var want = 'en'
        var scored = list.map(function (v, i) {
          var name = String(v.name || '').toLowerCase()
          return {
            v: v,
            natural: hits(name, NATURAL_HINTS),
            female: hits(name, FEMALE_HINTS),
            sc: scoreVoice(name, String(v.lang || '').toLowerCase(), want),
            i: i
          }
        })
        scored.sort(function (a, b) {
          if (a.sc !== b.sc) return b.sc - a.sc
          return a.i - b.i
        })
        return scored.map(function (x) { return x.v })
      } catch (e) { return [] }
    }

    function speakSample(text, draft) {
      try {
        var s = window.speechSynthesis
        if (!s) return false
        s.cancel()
        var u = new window.SpeechSynthesisUtterance(text || 'Welcome back. I am ready to help.')
        var list = readVoices()
        var target = null
        for (var i = 0; i < list.length; i++) if (list[i].name === draft.voiceName) target = list[i]
        var want = draft.voiceLang === 'zh' || draft.voiceLang === 'both' ? 'zh' : 'en'
        if (!target) {
          var candidates = list.filter(function (v) { return String(v.lang || '').toLowerCase().indexOf(want) === 0 })
          candidates.sort(function (a, b) { return scoreVoice(b.name.toLowerCase(), b.lang.toLowerCase(), want) - scoreVoice(a.name.toLowerCase(), a.lang.toLowerCase(), want) })
          target = candidates[0]
        }
        if (target) { u.voice = target; u.lang = target.lang }
        u.rate = Math.min(2, Math.max(0.5, Number(draft.voiceRate) || 1))
        u.pitch = Math.min(2, Math.max(0, Number(draft.voicePitch) || 1))
        u.volume = Math.min(1, Math.max(0, Number(draft.voiceVolume) || 0.9))
        if (draft.voiceLang === 'zh') { u.text = '欢迎回来，我已准备好了，随时为你服务。'; if (!target) u.lang = 'zh-CN' }
        s.speak(u)
        return true
      } catch (e) { return false }
    }

    function VoicePicker(props) {
      var [list, setList] = react.useState(readVoices)
      react.useEffect(function () {
        var s = window.speechSynthesis
        if (!s) return
        var on = function () { setList(readVoices()) }
        try { s.addEventListener('voiceschanged', on) } catch (e) {}
        var t = setTimeout(on, 400)
        return function () {
          try { s.removeEventListener('voiceschanged', on) } catch (e) {}
          clearTimeout(t)
        }
      }, [])
      var auto = window.__DSH_STARTUP_API__ && window.__DSH_STARTUP_API__.voice
      var opts = [['', '自动（优先神经网络女声）' + (auto ? ' → ' + auto : '')]].concat(
        list.map(function (v) {
          var name = String(v.name || '').toLowerCase()
          var mark = hits(name, NATURAL_HINTS) ? '★ ' : (hits(name, FEMALE_HINTS) ? '♀ ' : '')
          return [v.name, mark + v.name + ' · ' + (v.lang || '')]
        })
      )
      return h('div', { className: '__ss_field' },
        h('label', { className: '__ss_label' }, '音色'),
        h('div', { className: '__ss_row' },
          h(Select, { value: props.value || '', options: opts, onChange: props.onChange }),
          h('button', {
            className: '__ss_btn',
            type: 'button',
            onClick: props.onPreview
          }, '试听')
        ),
        h('div', { className: '__ss_hint' },
          list.length
            ? '★ 表示可能提供自然语音的音色；♀ 表示已识别的女声。实际效果可点击试听。'
              + '共 ' + list.length + ' 个，已按"神经网络 → 女声 → 排除男声"排好序。'
            : '这台机器暂时读不到系统音色（浏览器可能要等 voiceschanged，或系统未安装对应语音包）。'
        )
      )
    }

    /* ── 面板 ────────────────────────────────────────────────────────────── */
    /* 本地兜底默认值：Host 半侧若是旧版本（配置里还没有语音字段），
       面板也要能正常显示这些控件，而不是一片 undefined。 */
    var FALLBACK = {
      voice: true, voiceLang: 'zh', voiceName: '', voiceRate: 0.98, voicePitch: 1.04,
      welcomeLine: '欢迎来到 DeepSeek Harness。我已准备好了，随时为你服务。',
      entryLine: '欢迎主人回来，我是你的AI助手小余。工作台已经准备好了，有什么需要，随时交给我吧。', interactionVoice: true,
      voiceVolume: 0.9, voiceCue: true, voiceLead: 240, voiceSource: 'asset',
      sound: true, soundVolume: 0.5
    }
    function num(v, d) {
      var n = Number(v)
      return isFinite(n) ? n : d
    }

    /* 版本号的来源，按可靠性排序：
       1) 面板自己从 /dsh-startup-touchid/config 拿到的（Host 读的是它自己的 package.json）
       2) Host 往 index 里注入的 window.__DSH_STARTUP_VERSION__
          —— 桌面端走浏览器半侧自举时没有 1，就靠这一条
       3) 下面这个常量：两份都没拿到时的兜底，别让面板显示 undefined
       版本号本身只在 lib/index.js 里读一次，这里不重复维护。 */
    var FALLBACK_VERSION = '1.6.2'
    function readInjectedVersion() {
      try {
        var v = window.__DSH_STARTUP_VERSION__
        return v ? String(v) : ''
      } catch (e) { return '' }
    }

    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [defaults, setDefaults] = react.useState(null)
      var [file, setFile] = react.useState('')
      var [version, setVersion] = react.useState(readInjectedVersion)
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)
      var [voiceSample] = react.useState(function () { return { element: null } })
      react.useEffect(function () {
        return function () { if (voiceSample.element) voiceSample.element.pause() }
      }, [])

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setDefaults(Object.assign({}, FALLBACK, j.defaults))
            setFile(j.file || '')
            if (j.version) setVersion(String(j.version))
          })
          .catch((e) => setError('读取配置失败：' + String(e && e.message ? e.message : e)))
      }

      react.useEffect(() => { load() }, [])

      function set(key, value) {
        setNotice(null)
        setDraft((d) => Object.assign({}, d, { [key]: value }))
      }

      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(j.config)
            setNotice('已保存。下次打开 DSH 生效；点「立即预览」可以先看效果。')
          })
          .catch((e) => setError('保存失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      function reset() {
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then((r) => r.json())
          .then((j) => {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(j.config)
            setNotice('已恢复默认。')
          })
          .catch((e) => setError('恢复默认失败：' + String(e && e.message ? e.message : e)))
          .then(() => setBusy(false))
      }

      /** 用宿主里已经注入好的配置做一次即时预览；没有就退回刷新页面。 */
      function preview() {
        var api = window.__DSH_STARTUP_API__
        if (api && typeof api.replay === 'function') {
          api.replay()
          return
        }
        window.location.reload()
      }

      /* 版本号常驻顶部，不进骨架屏 —— 它不依赖配置接口，
         接口挂了也该看得见当前装的是哪一版。 */
      var versionLine = h('div', { className: '__ss_version' }, '版本 v' + (version || FALLBACK_VERSION))

      if (!draft) {
        return h('div', { className: '__ss_root' },
          versionLine,
          h('div', { className: '__ss_status' }, error ? error : '读取配置中…'),
          error ? h('div', { className: '__ss_actions' },
            h('button', { className: '__ss_btn', onClick: load }, '重试')
          ) : null
        )
      }

      var modeOptions = [
        ['session', '每个浏览器会话一次'],
        ['daily', '每天一次'],
        ['always', '每次打开都播放']
      ]

      return h('div', { className: '__ss_root' },
        versionLine,

        /* 开关 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '播放'),
          h(Check, {
            label: '启用启动动画',
            hint: '关闭后直接进主界面，不再显示启动界面。',
            checked: draft.enabled,
            onChange: (v) => set('enabled', v)
          }),
          h(Field, { label: '播放时机' },
            h(Select, { value: draft.mode, options: modeOptions, onChange: (v) => set('mode', v) })
          ),
          h(Field, { label: '速度倍率', hint: '0.35 慢放 · 1 原速 · 3 快放；参考片时长约 27 秒，默认整套约 16 秒。' },
            h('div', { className: '__ss_row' },
              h('input', {
                type: 'range', min: 0.35, max: 3, step: 0.05,
                value: draft.speed,
                style: { flex: '1 1 240px' },
                onChange: (e) => set('speed', Number(e.target.value))
              }),
              h('span', { className: '__ss_status' }, Number(draft.speed).toFixed(2) + '×')
            )
          )
        ),

        /* 身份 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '账户显示'),
          h(Field, { label: '账户来源', hint: '真实账户只读取 DeepSeek 昵称和登录状态；系统验证不代表 DeepSeek 已登录。' },
            h(Select, { value: draft.identitySource || 'deepseek', options: [['deepseek', '当前 DeepSeek 账户'], ['custom', '自定义称呼（仅展示）']], onChange: (v) => set('identitySource', v) })),
          h(Field, {
            label: '自定义身份名称',
            hint: '仅在选择自定义称呼时生效，不代表已验证的账户或权限。'
          }, h(TextInput, { value: draft.identity, placeholder: '例如：OPERATOR', onChange: (v) => set('identity', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '身份编号', hint: '显示在第二步身份卡上，建议用数字（如 0001）。' },
              h(TextInput, { value: draft.identityId, mono: true, onChange: (v) => set('identityId', v) })),
            h(Field, { label: '权限等级' },
              h(TextInput, { value: draft.accessLevel, mono: true, onChange: (v) => set('accessLevel', v) }))
          )
        ),

        /* 交互 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '交互'),
          h(Check, {
            label: '需要人工确认',
            hint: 'HUD 每步等待按钮 / Enter / 空格；浅色、深色保留前两步确认。关闭则自动播放。',
            checked: draft.requireInteraction,
            onChange: (v) => set('requireInteraction', v)
          }),
          h(Check, {
            label: '允许跳过',
            hint: '右上角显示 SKIP，按 Esc 也能直接进主界面。',
            checked: draft.allowSkip,
            onChange: (v) => set('allowSkip', v)
          }),
          h(Check, {
            label: '音效',
            hint: '按钮确认、阶段切换和揭幕时播放电子音，可与语音独立开关。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          })
        ),

        /* Touch ID 与开机语音 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, 'Touch ID 与开机语音'),
          h(Check, {
            label: '启用 macOS 系统认证',
            hint: '指纹和密码均在 macOS 系统面板中验证，网页不接收密码。其他平台自动跳过。',
            checked: draft.bioGate,
            onChange: (v) => set('bioGate', v)
          }),
          h(Field, { label: '入场欢迎语', hint: 'HUD 首次点击或按键后播报一次；留空关闭。请使用产品名或不含个人信息的称呼。' },
            h(TextInput, { value: draft.welcomeLine, maxLength: 64, onChange: (v) => set('welcomeLine', v) })),
          h(Field, { label: '进入后欢迎语', hint: 'HUD 动画结束、工作台出现后播报一次；留空关闭。' },
            h(TextInput, { value: draft.entryLine, maxLength: 64, onChange: (v) => set('entryLine', v) })),
          h(Check, { label: '操作语音回应', hint: 'HUD 系统验证通过、确认进入时播放简短回应。', checked: draft.interactionVoice, onChange: (v) => set('interactionVoice', v) }),
          h(Field, { label: '开机语音文案', hint: '内置素材拿不到时用系统 TTS 念这一句。' },
            h(TextInput, { value: draft.wakeLine, maxLength: 64, onChange: (v) => set('wakeLine', v) })),
          h(Field, { label: '开机语音素材', hint: 'lib/assets/<名字>.m4a。换自己的录音只改这里，代码不用动。' },
            h(TextInput, { value: draft.wakeAudio, mono: true, onChange: (v) => set('wakeAudio', v) })),
          h(Field, { label: '语音音量' },
            h(Range, {
              min: 0, max: 1, step: 0.05,
              value: draft.wakeVolume,
              display: Math.round(Number(draft.wakeVolume) * 100) + '%',
              onChange: (v) => set('wakeVolume', v)
            })),
          h(Field, { label: '解锁后延迟', hint: '0 = 系统认证通过立刻开口。' },
            h(Range, {
              min: 0, max: 3000, step: 50,
              value: draft.wakeDelayMs,
              display: Number(draft.wakeDelayMs) + ' ms',
              onChange: (v) => set('wakeDelayMs', v)
            }))
        ),

        /* 语音与音效 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '语音与音效'),
          h(Check, {
            label: '启动语音播报',
            hint: 'HUD 支持入场欢迎、操作回应和阶段播报；首次点击或按键开启声音。语音音色由当前浏览器提供。',
            checked: draft.voice,
            onChange: (v) => set('voice', v)
          }),
          h(Field, { label: '内置柔美女声试听', hint: '小余欢迎语使用晓伊女声，缩短长空白并加入轻电子提示音，与进入工作台后的语音相同。' },
            h('audio', { controls: true, preload: 'none', src: '/dsh-startup-touchid/asset/hud-entry-extended.m4a', ref: function (element) {
              if (!element && voiceSample.element) voiceSample.element.pause()
              voiceSample.element = element
            }, style: { width: '100%' } })),
          h(Field, {
            label: '语音来源',
            hint: 'HUD 中文固定台词默认使用内置晓晓女声，离线播放。自定义文案或指定系统音色时使用 TTS；内置音频不受系统语速和音调滑块影响。'
          },
            h(Select, {
              value: draft.voiceSource || 'asset',
              options: [['asset', '内置女声 / 素材（推荐）'], ['tts', '系统 TTS 合成']],
              onChange: (v) => set('voiceSource', v)
            })
          ),
          h(Field, { label: '播报语言' },
            h(Select, {
              value: draft.voiceLang,
              options: [['en', '英语（照参考片）'], ['zh', '中文'], ['both', '中英各念一遍']],
              onChange: (v) => set('voiceLang', v)
            })
          ),
          draft.voice ? h(VoicePicker, {
            value: draft.voiceName,
            onChange: (v) => set('voiceName', v),
            onPreview: () => speakSample(null, draft)
          }) : null,
          draft.voice ? h('div', { className: '__ss_row' },
            h('button', {
              className: '__ss_btn',
              type: 'button',
              onClick: () => {
                set('voiceRate', 0.98)
                set('voicePitch', 1.04)
                set('voiceName', '')
                set('voiceSource', 'asset')
                set('voiceLang', 'zh')
                set('voiceCue', true)
                set('voiceLead', 240)
              }
            }, '↺ 套用「自然柔美女声」'),
            h('span', { className: '__ss_hint' }, '固定中文台词使用内置晓晓女声；自定义文本使用系统女声，语速 0.98、音调 1.04。')
          ) : null,
          draft.voice ? h('div', { className: '__ss_two' },
            h(Field, { label: '系统 TTS 语速' },
              h(Range, { value: num(draft.voiceRate, 1), min: 0.5, max: 2, display: num(draft.voiceRate, 1).toFixed(2) + '×', onChange: (v) => set('voiceRate', v) })
            ),
            h(Field, { label: '系统 TTS 音调' },
              h(Range, { value: num(draft.voicePitch, 1), min: 0, max: 2, display: num(draft.voicePitch, 1).toFixed(2), onChange: (v) => set('voicePitch', v) })
            )
          ) : null,
          draft.voice ? h(Field, { label: '开口前留白', hint: '提示音响过之后停多久再开口。电影旁白/机场广播都有这一拍，240ms 起最像"系统在播报"。' },
            h(Range, {
              value: num(draft.voiceLead, 240), min: 0, max: 800, step: 20,
              display: Math.round(num(draft.voiceLead, 240)) + ' ms',
              onChange: (v) => set('voiceLead', v)
            })
          ) : null,
          draft.voice ? h(Field, { label: '音量' },
            h(Range, { value: num(draft.voiceVolume, 0.9), min: 0, max: 1, display: Math.round(num(draft.voiceVolume, 0.9) * 100) + '%', onChange: (v) => set('voiceVolume', v) })
          ) : null,
          draft.voice ? h(Check, {
            label: '播报前提示音',
            hint: '念台词之前先响两声轻提示 —— 这一笔让 TTS 从「浏览器念字」变成「系统播报」，是 AI 感的关键。',
            checked: draft.voiceCue,
            onChange: (v) => set('voiceCue', v)
          }) : null,
          h(Check, {
            label: '界面音效',
            hint: '咔哒 / 双音确认 / 过场噪声扫频 / 结尾和声钟，全部 WebAudio 现场合成，不含音频文件。',
            checked: draft.sound,
            onChange: (v) => set('sound', v)
          }),
          draft.sound ? h(Field, { label: '音效音量' },
            h(Range, { value: num(draft.soundVolume, 0.5), min: 0, max: 1, display: Math.round(num(draft.soundVolume, 0.5) * 100) + '%', onChange: (v) => set('soundVolume', v) })
          ) : null
        ),

        /* 视觉 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '视觉'),
          h(Field, { label: '主题' },
            h(Select, {
              value: draft.theme,
              options: [['hud', '蓝青科技 HUD'], ['light', '浅色 · 暖白档案底板（参考片原色）'], ['dark', '深色 · 暗底板']],
              onChange: (v) => set('theme', v)
            })
          ),
          h('div', { className: '__ss_two' },
            h(Field, { label: '强调色 · 橙' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.accent, onChange: (v) => set('accent', v) }),
                h('span', { className: '__ss_status' }, draft.accent)
              )
            ),
            h(Field, { label: '故障色 · 蓝' },
              h('div', { className: '__ss_row' },
                h(ColorInput, { value: draft.glitchB, onChange: (v) => set('glitchB', v) }),
                h('span', { className: '__ss_status' }, draft.glitchB)
              )
            )
          )
        ),

        /* 文案 */
        h('div', { className: '__ss_group' },
          h('div', { className: '__ss_groupTitle' }, '文案'),
          h('div', { className: '__ss_two' },
            h(Field, { label: '左上 · 主标题' }, h(TextInput, { value: draft.brand1, onChange: (v) => set('brand1', v) })),
            h(Field, { label: '左上 · 产品行' },
              h('div', { className: '__ss_row' },
                h(TextInput, { value: draft.brand3a, onChange: (v) => set('brand3a', v) }),
                h('span', { className: '__ss_status' }, '+'),
                h(TextInput, { value: draft.brand3b, onChange: (v) => set('brand3b', v) })
              )
            )
          ),
          h(Field, { label: '左上 · 副标题' }, h(TextInput, { value: draft.brand2, maxLength: 40, onChange: (v) => set('brand2', v) })),
          h('div', { className: '__ss_two' },
            h(Field, { label: '黑幕 · 中文' }, h(TextInput, { value: draft.orgZh, onChange: (v) => set('orgZh', v) })),
            h(Field, { label: '黑幕 · 英文' }, h(TextInput, { value: draft.orgEn, mono: true, onChange: (v) => set('orgEn', v) }))
          ),
          h('div', { className: '__ss_two' },
            h(Field, { label: '黑幕 · 小字' }, h(TextInput, { value: draft.orgSub, mono: true, onChange: (v) => set('orgSub', v) })),
            h(Field, { label: '终幕 · 黑框' }, h(TextInput, { value: draft.welcomeBox, onChange: (v) => set('welcomeBox', v) }))
          ),
          h(Field, { label: '右下 · 页脚' }, h(TextInput, { value: draft.footer, mono: true, onChange: (v) => set('footer', v) }))
        ),

        /* 预览 + 操作 */
        h('div', { className: '__ss_preview' },
          h('div', { className: '__ss_previewText' },
            '预览会按当前「已保存」的配置重播一次。想先看新配置，先点保存再预览。',
            file ? h('div', { style: { marginTop: '4px', opacity: 0.75 } }, '配置文件：' + file) : null
          ),
          h('button', { className: '__ss_btn', onClick: preview }, '立即预览')
        ),

        h('div', { className: '__ss_actions' },
          h('button', {
            className: '__ss_btn __ss_btnPrimary',
            disabled: busy,
            onClick: save
          }, busy ? '处理中…' : '保存'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: reset }, '恢复默认'),
          h('button', { className: '__ss_btn', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: '__ss_ok' }, notice) : null,
          error ? h('span', { className: '__ss_err' }, error) : null
        )
      )
    }

    /* ── 桌面端自举 ──────────────────────────────────────────────────────── */
    /* Host 半侧靠 ctx.webServer.tapIndex 往 index.html 里注入启动界面。
       web profile 一定走这条路；但 Electron 也可能改用 file:// + IPC 直接下发
       前端（dsh-host-webserver 的注释就写着 "Electron uses file:// plus IPC
       instead"），那时 index 注入整条不生效。所以浏览器半侧自己兜一层：
       没被 Host 接管时，由本侧建根节点 + 拉 splash.css/splash.js 自举。

       判定全在 window 上，不去猜宿主类型：
         __DSH_STARTUP_BOOT__  Host 已经注入过（index）/ 本侧已经自举过（client）
         __DSH_STARTUP_SKIP__  Host 侧的兜底脚本已判定"这次不播"
         __DSH_STARTUP__       配置已就位（Host 注入的）
       Host 判定失效时不该被静默吃掉，所以这里在拦到 SKIP 之前，还要看一眼
       Host 侧根本没跑过（BOOT 标记为空）这种情况：把兜底脚本的同款判定补做一遍。 */
    var BOOT_ROUTE = '/dsh-startup-touchid'

    function readFlag(store, key) {
      try {
        var s = window[store]
        return s ? s.getItem(key) : null
      } catch (e) { return null }
    }

    function writeFlag(store, key, value) {
      try {
        var s = window[store]
        if (s) s.setItem(key, value)
      } catch (e) { /* 隐私模式下可能抛，忽略 */ }
    }

    function markBooted() {
      try { window.__DSH_STARTUP_BOOT__ = 'client' } catch (e) { /* noop */ }
    }

    /** 挂一个 <script src>；失败时调 fail(err)。 */
    function loadScript(src, fail) {
      var s = document.createElement('script')
      s.src = src
      s.async = false
      if (typeof fail === 'function') {
        s.addEventListener('load', function () { fail(null) })
        s.addEventListener('error', function () { fail(new Error('script load failed: ' + src)) })
      }
      ;(document.head || document.documentElement).appendChild(s)
    }

    /** 挂一份 <link rel=stylesheet>；失败时调 fail(err)。 */
    function loadCss(href, fail) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      if (typeof fail === 'function') {
        link.addEventListener('load', function () { fail(null) })
        link.addEventListener('error', function () { fail(new Error('css load failed: ' + href)) })
      }
      ;(document.head || document.documentElement).appendChild(link)
    }

    /** 移除根节点、解开滚动锁定 —— 自举任何一步失败都要把页面还回去。 */
    function release(ok) {
      if (ok) return
      try {
        var r = document.getElementById('dsh-startup-root')
        if (r && r.parentNode) r.parentNode.removeChild(r)
        if (document.documentElement.classList) document.documentElement.classList.remove('dsu-lock')
        if (document.body && document.body.style) document.body.style.overflow = ''
        window.__DSH_STARTUP_FAILED__ = true
      } catch (e) { /* 兜底不再抛 */ }
    }

    function injectRoot(cfg) {
      var root = document.getElementById('dsh-startup-root')
      if (!root) {
        root = document.createElement('div')
        root.id = 'dsh-startup-root'
        document.body.appendChild(root)
      }
      root.className = 'dsu-root dsu-boot'
      if (document.documentElement.classList) document.documentElement.classList.add('dsu-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'

      /* 样式与运行时都从 Host 路由取 —— 同一份文件，不额外维护内联副本 */
      var failed = false
      var cssReady = false
      var scriptReady = false
      function guard(err) {
        if (err) {
          if (!failed && typeof console !== 'undefined' && console.warn) {
            console.warn('[dsh-startup-touchid] 启动界面自举失败，已放开页面：', err.message)
          }
          failed = true
          release(false)
          return
        }
        if (cssReady && scriptReady) release(true)
      }

      loadCss(BOOT_ROUTE + '/splash.css', function (err) {
        if (err) { guard(err); return }
        cssReady = true
        guard(null)
      })

      /* 配置先落 window：splash.js 载入时直接读它 */
      window.__DSH_STARTUP__ = cfg || {}
      try {
        delete window.__DSH_STARTUP_LOADED__
      } catch (e) { window.__DSH_STARTUP_LOADED__ = undefined }
      loadScript(BOOT_ROUTE + '/splash.js?t=' + Date.now(), function (err) {
        if (err) { guard(err); return }
        scriptReady = true
        guard(null)
      })

      /* 自愈：样式与脚本都拿到了、这个标记还在，就说明动画没接管，放行 */
      setTimeout(function () {
        try {
          var r = document.getElementById('dsh-startup-root')
          if (r && r.className && r.className.indexOf('dsu-boot') !== -1) release(false)
        } catch (e) { /* 兜底不再抛 */ }
      }, 9000)
    }

    function selfBoot() {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return
        if (!document.body) return
        if (window.__DSH_STARTUP_BOOT__) return          /* 已被 Host 或本侧接管 */
        if (window.__DSH_STARTUP__) return               /* 配置已在页面上：Host 注入过 */
        if (document.getElementById('dsh-startup-root')) return
        /* 已经出过错的地方不要再扑一次 */
        if (window.__DSH_STARTUP_FAILED__ === true) return
        markBooted()
        fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json() })
          .then(function (j) { return j && j.ok === true ? j.config : null })
          .catch(function () { return null })
          .then(function (cfg) {
            cfg = cfg || { enabled: true, mode: 'session', speed: 1 }
            if (cfg.enabled === false) return
            var today = new Date().toISOString().slice(0, 10)
            if (cfg.mode === 'session' && readFlag('sessionStorage', 'dsh-startup-touchid:shown') === '1') return
            if (cfg.mode === 'daily' && readFlag('localStorage', 'dsh-startup-touchid:day') === today) return
            /* 回填判定标记，保证与 Host 侧同款语义（splash.js 会读这两个键） */
            if (cfg.mode === 'session') writeFlag('sessionStorage', 'dsh-startup-touchid:shown', '1')
            if (cfg.mode === 'daily') writeFlag('localStorage', 'dsh-startup-touchid:day', today)
            return injectRoot(cfg)
          })
          .catch(function () { /* 自举失败就算了，页面本来就是好的 */ })
      } catch (e) { /* 自举是兜底，绝不许把宿主带崩 */ }
    }

    /* ── 插件 ────────────────────────────────────────────────────────────── */
    var inject = ['slots']

    function apply(ctx) {
      /* 桌面端兜底：Host 的 index 注入不生效时，由这里自举启动界面。
         正常 web 流程下 __DSH_STARTUP__/__DSH_STARTUP_BOOT__ 已就位，本调用直接返回。 */
      selfBoot()
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'startup-screen', order: 26, label: '启动动画' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
