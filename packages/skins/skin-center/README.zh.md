# 皮肤中心（GUI 内置皮肤中心）

[English](README.md) | 中文

`@linxin666/dsh-client-ui-skin-center`（cordis 插件 id `ui-skin-center`）是 dsh Web GUI 唯一的皮肤包：它把皮肤列表 / 试穿 / 应用做成一级设置分区「皮肤中心」（设置 → 皮肤中心，只列已安装皮肤），并且是所有皮肤的唯一加载器与渲染器。皮肤是纯资产目录——没有 package.json、不发 npm、不接 cordis 接线——只与皮肤中心契约（`contracts/`）耦合；皮肤中心把对官方 DSH 的全部耦合吸收在契约之后。卡片自带总开关（关闭即停用试穿、应用与背景控制）。

管理卡片只保留总开关、「官方默认」外观、Whale Song（鲸吟）与亮/暗主题切换；当前应用目标带「使用中」标记。目录册读取 `$DSH_HOME/skins/<id>/` 下的用户皮肤，本包**不再内置任何皮肤**——鲸吟（whale-song）以独立皮肤仓库分发：把它装进 `$DSH_HOME/skins/whale-song/` 即被目录收录。`skin.json` 校验失败的皮肤按 fail-closed 排除，并作为目录诊断上报。
- 试穿 / 应用：两者走同一个原子切换引擎（`src/client/runtime/skin-controller.ts`）。一次切换 = 一个新的 activation identity：取回已限定作用域的样式表，安装样式、背景媒体与可选 hooks，翻转 `html[data-dsh-skin="<id>"]`，然后销毁上一个 activation（append-only 效果账本，幂等清理）。最新请求永远胜出；失败或被淘汰的切换完整保留旧皮肤。试穿是同一个切换但不落盘——「退出试穿」恢复已提交的皮肤。应用会持久化选择（`POST /api/skin-center/v2/active`）。不刷新页面、不改写 `cordis.patch.yml`、不重建启动图。
- 首屏：host 半区注册一个 index.html 转换（`webServer.tapIndex`，单一适配模块 `src/tap-index-adapter.ts`），向每份送达的文档盖 `html[data-dsh-skin]` 属性并插入样式表链接，刷新后直接以当前皮肤启动，无官方原貌闪屏。tap 出任何问题都 fail-closed 回官方原貌。
- 皮肤格式（v2）：`skin.json`（fail-closed 校验，v1 字段 `package`/`wiring`/`bodyAttr` 忽略并给迁移警告）、`skin.css`（L1 token 重映射 + L2 语义选择器）、可选 `patches.css`（L3 自由选择器，高敏感）、可选 `hooks.mjs`（受信逃逸舱，高敏感）、`assets/`、`preview/`。所有 CSS 经过安全管线（`src/core/css-safety/transform.ts`）：每个选择器强制限定在 `html[data-dsh-skin]` 下，`@import` / 远程或协议相对 URL / 越界路径直接报错。见 `contracts/README.md`。
- 覆盖契约：L1 重映射官方 `--dsw-*` 设计 token；L2 样式语义属性（`data-dsh-surface` / `data-dsh-part` / `data-dsh-plugin`，枚举见 `contracts/semantic-attrs-v1.md`），由兼容适配器（`src/client/runtime/semantic-adapter.ts`）从稳定锚点（`data-slot` 出口、`data-chat-flow-kind` 等）为官方壳层 DOM 打标；L3 补丁任意选择器，脆弱性由皮肤作者自负。主动输出语义属性的插件获得完整 L2 覆盖；不输出的只享受 L1。目录皮肤、自定义主题或壁纸激活期间还会启用公共壳层渲染适配器：它清除工作区列表末端 fade，将 composer 占位符固定为不透明的主题次级文本色，并为会话滚动口保留底部安全间距以保证吸底正文不被输入区覆盖（#978），各皮肤无需重复补丁。
- 背景优先级：Wallpaper Engine 壁纸永远优先于用户手动背景遮罩，后者优先于皮肤清单背景媒体；开关壁纸会实时重估优先级。
- 背景桥（本构建仅保留 host 侧）：host 半区保留背景遮罩命名空间，客户端继续为画背景的皮肤施加已持久化的背景遮蔽/模糊；管理卡片本身不渲染任何滑杆。
- Wallpaper Engine 桥（本构建仅保留 host 侧）：host 半区（`src/we-library.ts` + `src/we-routes.ts`）定位本机 Wallpaper Engine 库并把它作为 GUI 背景提供（Steam 应用 431960：Windows 注册表、`libraryfolders.vdf` 中的全部库路径、持久的 `appmanifest_431960.acf` 所有权事实与探测路径），扫描项目与创意工坊内容及可选手动文件夹，经同源 `/api/skin-center/we/*` 路由提供清单、媒体（Range 流式）、预览图、web 壁纸项目文件（注入 WE API shim）与场景壁纸主贴图 PNG（由 `src/pkg-extract.ts` 进程内解码 PKG/TEX，磁盘缓存）。视频壁纸用 `<video>` 渲染，web 壁纸用沙箱 `<iframe>`，场景壁纸经内置 WebGL 播放器实时渲染（2D 图层场景与 3D 模型场景按 WE 材质/着色器语义回放）；场景内嵌脚本会被忽略，但受支持的图像、反射、水面与粒子通道仍保持实时渲染，「静态帧」模式可为任意类型钉一张零动画开销的图。单张壁纸的导入会把项目复制进 `<harness-home>/skin-center/wallpapers/`，脱离 Steam 库变更也能用，并检测创意工坊原作更新。壁纸都是用户本机文件，从不上传或再分发——创意工坊内容归原作者。「手动文件夹」行可接收零散 `.mp4`/`.webm` 媒体、单个项目、项目合集、Wallpaper Engine 安装根目录或 Steam 库根目录（`~` 展开为主目录）。
- 旧版迁移：v2 升级后的首次启动，一次性桥（`src/legacy-bridge.ts`）读取 harness home 根 `cordis.patch.yml`（v1 CLI 写入处；活动 profile 的 `cordis.patch.yml` 作为次级位置也会探测）里已退役的 `dsh-skin` 受管段，把活动皮肤 id 迁进 v2 选择存储，并清除旧行。迁移幂等且 fail-closed（出错时旧状态原样保留）。仅在发生迁移、清理或失败时输出日志，无 legacy 状态的稳态保持静默（issue #788）。

## 安装

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-skin-center
# 仓库开发：dsh plugin --profile web add link:$(pwd)/packages/skins/skin-center
```

`$(pwd)` 是 dsh-web monorepo 的本地克隆。本包不内置皮肤：**鲸吟（Whale Song）** 放在独立皮肤仓库（[znc15/dsh-skin-whale-song](https://github.com/znc15/dsh-skin-whale-song)）——克隆或复制到 `$DSH_HOME/skins/whale-song/` 即可（仓库 README 有完整命令；自带 provenance 文件，favicon 钩子安装后保持可信）。全新安装且鲸吟已就位、且尚无持久化选择时会自动以鲸吟为默认；未安装任何用户皮肤时保持官方默认外观。

皮肤中心是符合官方 DSH 插件标准的自包含 bundle（`dsh.bundle.patch` 指向 `cordis.patch.yml`）；也可经 git 安装：`dsh plugin --profile web add github:<org>/dsh-web#<sha>`（`prepare` 脚本就地构建 `lib/`）。pnpm ≥10 安装 git 依赖前需授权 `allowBuilds`；本地 `link:` 安装无此要求。

## 配置

- **总开关**：开关整张卡片（试穿 / 应用 / 背景控制）；持久化在 v2 活跃状态文档中。
- **背景持久化（支持远程）**：背景设置存放在 v2 活跃状态文档（`$DSH_HOME/skin-center-active.json` 的 `background` 段），经 `GET|POST /api/skin-center/v2/active` 读写，因此已配对的远程桌面（settings 通道仅限本机回环）也能读取并跨会话保存。旧的 `skin-background` 设置命名空间保留为官方设置页的输入面：已定制的配置在启动时一次性迁移进 v2 存储，之后的设置页修改由客户端转发。卡片内的修改不回写 `settings.yaml`，设置页可能显示旧值，直到下一次从设置页修改。
- **壁纸桥（host）**：壁纸选择由 host 半区持久化在 `skin-wallpaper` 命名空间，切换皮肤时仍会清除已持久化的壁纸选择；卡片本体刻意不渲染壁纸面板。
- **用户皮肤目录**：`$DSH_HOME/skins/<id>/`；覆盖优先级为 `DSH_SKINS_HOME`、`DSH_SKINS_DIR`、`$DSH_HOME/skins`。

## 安全模型

- 所有 `/api/skin-center/*` 路由仅接受同源请求：写操作拒绝跨站请求（Sec-Fetch-Site / Origin 围栏），资产读取限定在各皮肤目录之内（路径逃逸 fail-closed）。
- 皮肤 CSS 在服务前经白名单净化；`patches.css`（L3）按设计就是任意 CSS 并如实公示——它拥有完整页面样式能力，不构成安全边界。
- `hooks.mjs` 是与本仓库同审同发的受信代码，仅同源 serve，其 import/apply 错误永远不会拖垮静态皮肤。hooks 对内置皮肤放行；对用户目录皮肤，仅当其从官方 DSH 市场安装且 `dsh-market.provenance.json` 以 sha256 钉住磁盘上的 `skin.json` 与 hooks 入口字节时放行（由 `src/provenance.ts` 校验，issue #1073）；provenance 缺失或不匹配——手工投放或被篡改的目录——hooks facet 保持拒绝，声明式部分仍正常加载。

## 已知限制

- 插件运行时写入的内联样式只能经 L3 `!important` 补丁覆盖。
- 不输出语义属性（且无稳定 DOM 锚点）的插件只享受 L1 token 覆盖。
- 皮肤视频背景不受壁纸「隐藏时暂停」设置影响；该设置仅作用于 Wallpaper Engine 桥。

## 数据遥测

浏览器半区每个 UTC 日向 dsh-market.com 发送一次匿名安装心跳：仅含一个 localStorage 随机 ID 与本包名，无其他数据。服务端只存储该 ID 的加盐哈希，不存 IP，且只暴露聚合计数。完整契约见 [docs/telemetry.md](../../../docs/telemetry.md)。

## 目录结构

```
skins/skin-center/
  contracts/                                # 面向皮肤的契约面（schema、hooks API、语义属性）
  src/core/manifest-v2/                     # manifest v2 类型 + fail-closed 校验器
  src/core/css-safety/                      # lightningcss 作用域限定 + 白名单管线
  src/index.ts                              # host 入口：路由、tapIndex 适配器、旧版迁移桥
  src/skin-repo.ts                          # 双来源皮肤目录册（内置 + $DSH_HOME/skins）
  src/provenance.ts                         # 官方市场安装 provenance 校验（hooks 信任）
  src/routes-v2.ts                          # /api/skin-center/v2/* 路由
  src/tap-index-adapter.ts                  # 单一 tapIndex 适配器（防 FOUC）
  src/active-state.ts                       # 活动皮肤选择持久化
  src/legacy-bridge.ts                      # 一次性 v1 → v2 迁移
  src/http-utils.ts / harness-home.ts       # 路由共享助手 / DSH 路径解析
  src/we-library.ts / we-routes.ts / we-shim-source.ts / pkg-extract.ts   # Wallpaper Engine 桥
  src/client/runtime/                       # 效果账本、装饰层、语义适配器、切换控制器、启动存储
  src/client/SkinCenter.tsx                 # 设置卡片（开关 + 官方/Whale Song + 主题切换）
  src/client/background.ts / wallpaper.ts   # 遮罩 + 模糊与 WE 桥控制器
  skins/<id>/                               # 内置皮肤（纯资产目录）
```

## 验收清单

- [x] 皮肤中心出现在 设置 → 皮肤中心，无控制台报错
- [x] 卡片展示官方默认与 Whale Song；当前使用者有标记；非法皮肤以诊断形式呈现
- [x] 试穿即时生效，退出完整恢复已提交皮肤；页面上永远只有一套皮肤
- [x] 一键应用原子切换、无需刷新；后续页面加载直接以该皮肤启动（无 FOUC）
- [x] 亮/暗主题切换即时生效
- [x] Wallpaper Engine 桥与背景遮罩不受换肤影响
