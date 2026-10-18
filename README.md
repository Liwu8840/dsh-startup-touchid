# DeepSeek Harness 启动插件

蓝青 HUD、macOS 系统认证、真实 DeepSeek 账户状态，以及“小余”女声启动对话。支持深色、浅色主题，保留独立的音效与语音开关。

这是个人维护的第三方插件，**不是 DeepSeek 官方插件**。代码 Fork 自 [dsh-startup-screen](https://github.com/6shenhonghong9/dsh-startup-screen)，保留上游 MIT 版权声明。

## 安装

先安装并初始化 DeepSeek Harness，然后从 [Releases](https://github.com/Liwu8840/dsh-startup-touchid/releases) 下载安装包，执行：

```sh
dsh plugin --profile web add ./dsh-startup-touchid-1.6.3.tgz
```

重启 `dsh web`。在「设置 → 启动动画 → 立即预览」中体验和调整。

macOS 系统认证首次使用会编译原生辅助程序，需要 Xcode Command Line Tools：

```sh
xcode-select --install
```

公开版本提供原生源代码，不携带开发机编译的二进制。Windows/Linux 可显示动画和播放语音，不提供 macOS 认证。桌面端安装及验证范围见 [DESKTOP.md](DESKTOP.md)。

## 功能

- 多层环形扫描、确认脉冲和语音波形，适配窄屏与系统「减少动态效果」偏好。
- 指纹与 macOS 登录密码都在系统认证面板完成，网页没有密码输入或接收接口。
- 通过 DSH 的 DeepSeek 账户服务查询昵称和登录状态，不使用预设身份冒充已登录账户。
- HUD 开启「需要人工确认」时，只需系统验证和进入工作台两次操作；验证完成后自动连接账户并显示结果，未确认进入便保持等待，新操作取消旧语音。
- HUD 通过连续的蓝青光晕淡出进入工作台，语音回应与揭幕同时进行；系统「减少动态效果」模式使用短淡出。
- 固定中文语音在本地播放，整理首尾空白和长停顿，附轻微空间效果与电子提示音。

进入后的默认欢迎语：

> 欢迎主人回来，我是你的AI助手小余。工作台已经准备好了，有什么需要，随时交给我吧。

## 设置

| 设置 | 作用 |
|---|---|
| 主题 | HUD、浅色、深色 |
| 账户来源 | 当前 DeepSeek 账户，或明确标注的自定义展示 |
| macOS 系统认证 | 打开系统面板，使用指纹或系统登录密码 |
| 入场欢迎语 | 点击声音入口时播报；普通点击仅解锁声音，留空关闭 |
| 进入后欢迎语 | 工作台出现后播报；留空关闭 |
| 操作语音回应 | 验证与按钮操作反馈 |
| 语音来源 | 内置音频或浏览器 TTS |
| 语音提示音 | 关闭后使用不含进入提示音的版本 |
| 音效与音量 | 独立于语音控制 |

浏览器通常需要首次用户操作才允许发声。内置语音音量可调，系统语速、音调和音色只影响 TTS。自定义台词、英语/双语或指定系统音色时使用浏览器 TTS，部分浏览器音色可能需要联网。默认自定义展示名 `OPERATOR` 是占位符，不代表真实账户。

设置保存在 `$DSH_HOME/dsh-startup-touchid.json`，默认使用当前用户的 `~/.dsh`。文件会在运行时创建，仓库与安装包不包含开发者的设置文件。

## 隐私与使用范围

账户接口只返回昵称、登录状态和运行环境版本，不返回账户编号、联系方式、余额或令牌。昵称只保存在本次页面内存中，不写入插件设置，也不用于语音播报。

原生辅助程序使用 macOS `LocalAuthentication`。密码和生物特征由系统处理，插件接收认证结果；路由使用宿主信任检查与服务实例 nonce 限制调用。

**这是一段可跳过的启动动画，不是 DSH 数据或后端接口的访问控制。** 系统验证不证明对应某个 DeepSeek 账户。安装第三方插件会授予其本机执行能力，请审阅代码。

公开文件的检查范围见 [PRIVACY.md](PRIVACY.md)，音频来源见 [ASSETS.md](ASSETS.md)。

## 开发与检查

无需安装 npm 依赖：

```sh
npm test
npm run test:audio
npm run test:privacy
npm pack
```

声学检查使用 Python 3 标准库；真实音频解码比较需要 macOS `afconvert`，其他平台会明确跳过这项。重新生成已处理语音：

```sh
npm run build:audio
```

离线页面位于 `preview/index.html`，使用演示身份并关闭原生认证，不读取真实账户。离线预览不代表系统认证已经通过。

安装细节见 [INSTALL.md](INSTALL.md)，语音参数与测量见 [AUDIO-FIELDS.md](AUDIO-FIELDS.md)，版本变化见 [UPGRADE.md](UPGRADE.md)。

## 许可

代码采用 [MIT](LICENSE)。上游版权声明保留；公开版不包含原视频提取的人声和音效。内置合成语音的来源与参数单独列在 [ASSETS.md](ASSETS.md)。
