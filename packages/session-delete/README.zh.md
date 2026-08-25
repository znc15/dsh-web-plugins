# 删除对话（session-delete）

[English](README.md) | 中文

`@linxin666/dsh-client-ui-session-delete`（cordis 插件 id `ui-session-delete`）在 dsh web 的会话头部**和侧边栏三点菜单**增加**删除对话**入口。官方 GUI 只能归档会话（从列表隐藏、日志保留）；本插件会把当前对话**永久删除**：先从宿主会话存储中摘除在线会话（浏览器自动移除该行并回到「新建会话」视图），再删除 `$DSH_HOME/sessions/` 下的持久化 JSONL 日志文件。该对话 fork 出的子会话会一并删除，避免残留日志把对话「复活」。

## 功能

- **纯增量入口**：头部按钮注册进官方 `conversation.session.header.actions` 槽位；侧边栏三点菜单通过包裹 workspace 包自己的 `Menu`（只作用于该包的工厂）追加危险样式删除行，不改动官方其它外壳。
- **安全设计**：确认弹窗必须勾选「我了解这是永久删除」才能提交；**运行中**的会话由宿主拒绝（HTTP 409），弹窗显示忙碌文案。
- **宿主侧执行**：浏览器只负责确认与展示错误。`POST /api/session-delete/v1/delete` 在宿主进程执行：在线会话通过与拥有方 fiber 相同的摘除路径脱离存储，触发官方 `session/disposed` 事件，api proxy 据此广播 `host/session-removed`——官方列表存储自行移除行并清空当前选中。
- **日志落盘删除**：插件复刻 JSONL 后端的路径编码，先核对目录确实属于该会话再删除；不匹配或外部路径绝不触碰。
- **尽力清理缓存**：工作区注册表与投影缓存的进程内映射同步清除；持久化 workspace 记录在下次启动时自愈（工作区 `sessionIds` getter 按重建的 header 索引过滤）。

## 安装

npm（发布后）：

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-session-delete
```

仓库开发安装：

```sh
git clone https://github.com/zhu1090093659/dsh-web.git
cd dsh-web
pnpm install && pnpm -r build
dsh plugin --profile web add link:$(pwd)/packages/session-delete
```

重启 `dsh web` 后头部出现删除入口。

## 使用

1. 打开一个对话。
2. 点击会话头部的「删除对话」。
3. 勾选确认项，点击「永久删除」。
4. 对话从会话列表消失，日志文件被移除，界面回到「新建会话」视图。

对话（或其任一子会话）运行中时禁止删除；先取消本轮再重试。

## 配置

无。插件没有设置项。

## 安全模型

- 删除路由仅限同源：跨站 fetch（Sec-Fetch-Site 或 Origin 不匹配）一律 403。
- 请求体上限 16 KiB，只带一个会话 id；路径分隔符与超长 id 直接拒绝。
- 只删除浏览器发送的当前会话 id 及其持久化子闭包；id 经校验，目录删除前按后端编码核对目录名。
- 插件从不改写 `cordis.patch.yml`、settings 文件或工作区注册表持久化数据；依赖官方 session-disposed 事件帧与下次启动的 header 重建。

## 已知限制

- 持久化 workspace.json 可能在下次重启前短暂保留已删 id（工作区 `sessionIds`）；期间 UI 不会渲染该行，因为会话摘要已消失。
- 空闲会话留下的 agent 注册表条目交给进程收尾；本插件只删除非运行会话，不会打断任何在线工作。
- 不支持删除运行中的会话；请先取消。

## 遥测

浏览器半区每天向 dsh-market.com 发送一次匿名安装心跳：随机 localStorage id + 本包名，不带其它数据。服务端只存该 id 的加盐哈希、不存 IP，仅暴露汇总计数。完整契约见 [docs/telemetry.md](../../docs/telemetry.md)。

## 目录结构

```
session-delete/
  src/index.ts                  # 宿主入口：删除路由
  src/host-bridge.ts            # ctx.sessions / persistence / agents 的真实服务端口
  src/core/delete-session.ts    # 规划器：校验、闭包、目录安全、编排
  src/fence.ts                  # 路由同源围栏
  src/client/DeleteConversationAction.tsx  # 头部入口
  src/client/DeleteConversationDialog.tsx   # 共享确认弹窗 + 删除请求
  src/client/SidebarMenuPatch.tsx           # workspace Menu 补丁：三点菜单删除行
  src/client/locales.ts         # 中英文案
  tests/                        # 规划器与组件交互测试
```

## 验收清单

- [x] 会话头部渲染「删除对话」入口，文案中英双语
- [x] 确认弹窗需显式勾选后才可删除
- [x] 运行中的会话被拒绝，并显示忙碌文案（HTTP 409）
- [x] 删除后会话行消失、界面回到「新建会话」视图（host/session-removed）
- [x] 持久化日志文件被删除；外部路径绝不删除
