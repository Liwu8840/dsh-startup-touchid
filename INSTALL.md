# 安装与卸载

## 安装

从本仓库 Releases 下载 `dsh-startup-touchid-1.6.2.tgz`：

```sh
dsh plugin --profile web add ./dsh-startup-touchid-1.6.2.tgz
```

或者克隆本仓库后自行打包：

```sh
npm pack
dsh plugin --profile web add ./dsh-startup-touchid-1.6.2.tgz
```

重启 `dsh web`，在「设置 → 启动动画」调整。使用 `dsh plugin add` 让宿主注册插件，不要只复制到 `node_modules`。如果以前手工添加过同名插件配置，请移除重复条目，避免注册两次。

macOS 指纹和密码均使用系统面板，首次使用需要系统编译工具：

```sh
xcode-select --install
```

公开包不带预编译的认证程序；也可运行 `npm run build:helper` 自行构建，或通过 `DSH_TOUCHID_HELPER` 指定自己编译的程序。该程序属于可执行代码，只应使用自己信任的版本。

## 验证

1. 页面出现启动界面。
2. 点击「系统验证」后出现 macOS 系统面板，可使用指纹或系统登录密码。
3. 登录密码只在系统面板输入，网页不要求密码。
4. 账户查询失败或未登录时显示对应状态，进入后可用宿主账户菜单处理。
5. 首次点击或按键启用声音，可在左下角静音；「立即预览」可重播。

设置位于当前用户的 `$DSH_HOME/dsh-startup-touchid.json`。配置、账户资料和凭据不随源码或安装包分发。

## 卸载

```sh
dsh plugin --profile web remove dsh-startup-touchid
```

重启宿主。卸载插件不会主动删除个人设置文件。
