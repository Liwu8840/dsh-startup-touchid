# 桌面端与平台范围

插件使用 DSH 的 web profile 及客户端扩展机制。已覆盖真实 Web 服务的资源与配置接口；桌面端自举有单元检查，**未完成真实 Electron 桌面端安装与播放验证**。

如需尝试桌面端，先启动一次 DeepSeek Harness Desktop 初始化 profile，再完全退出：

```sh
dsh plugin --profile desktop add ./dsh-startup-touchid-1.6.2.tgz
```

重新打开桌面端，在设置中检查「启动动画」。桌面端的插件管理方式可能随宿主版本变化，请优先使用宿主提供的管理入口。

macOS 系统认证需要 `LocalAuthentication` 和 Xcode Command Line Tools。Windows/Linux 显示动画并播放支持的音频，不调用 macOS 原生认证。

Web profile 安装见 [INSTALL.md](INSTALL.md)。本仓库未提供 Windows 安装脚本或独立启动器。
