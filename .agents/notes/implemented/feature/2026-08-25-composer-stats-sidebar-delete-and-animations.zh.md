# Agent Note: 输入优化、侧边栏删除、底部统计栏与弹层动效批次

Status: implemented

## Problem

作者在鲸吟皮肤与删除对话落地后提出五条改进：

1. 底部「工具调用」统计栏要有与输入框一致的外边框、宽度与圆角（长方形带圆角）。
2. 输入框上下文圆圈左侧增加「优化用户输入」按钮，提示词参考
   linshenkx/prompt-optimizer。
3. 设置按钮浮窗需要进入动画，并完善菜单/对话框/提示浮层动画。
4. 侧边栏会话行三点菜单也要出现「删除对话」。
5. 精简皮肤中心配置面板。

## Decision

1. **提示词优化器**（新插件 `packages/prompt-optimizer`，包
   `@linxin666/dsh-client-ui-prompt-optimizer`，行 id
   `ui-prompt-optimizer`）：
   - 宿主路由 `POST /api/prompt-optimizer/v1/optimize`：同源围栏 +
     会话 id 校验 + 用该会话 `requestContext()`（回退
     `requestHeader()`）解析 provider/model，经 `ctx.llm.stream`
     跑一次辅助调用（45 秒超时 / 800 token），复用 BlockAssembler 与
     finish 归因；核心策略（JSON 封装、系统提示词、规范化）在
     `src/core/optimize.ts`，纯逻辑可单测。
   - 客户端注册 `conversation.input.right`（渲染于上下文圆圈左侧），
     按钮用 `inputActions.setDraft` 回填优化结果，空草稿/无模型路由/
     失败均有本地化文案。
2. **侧边栏删除**（session-delete 扩展）：官方 workspace 包的三点菜单
   写死为 rename/fork/archive、无槽位，因此以「按工厂作用域的 require
   补丁」包裹 workspace 包的 `dsh-client-ui-primitives.Menu`：仅当菜单
   含 archive 项（会话行菜单特征）时追加 danger 的「删除对话」行；被选中
   时从锚点按钮 aria-label 解析标题、经浏览器 sessions store 反查会话 id，
   打开与头部一致的 `DeleteConversationDialog`。patch 在 apply 期挂到
   `window.__ModuleLoader__.load`，dispose 时还原。
3. **底部统计栏**（鲸吟 skin `patches.css`）：
   `[data-slot="conversation.composer.dock"] > div` 增加与输入卡相同的
   1px 边框、22px 圆角、`--dsh-composer-card-max-width` 宽度与
   `--dsw-specific-input-major` 背景。
4. **动画**（鲸吟 skin `patches.css`）：设置浮窗 overlay 淡入 + 面板
   右上角缩放滑入，`[role=dialog]/[role=menu]/[role=tooltip]` 统一进场
   动画；`prefers-reduced-motion` 下全部关闭。纯 CSS 无法做挂载式退出
   动画，进场 + hover 过渡承担动效。
5. **皮肤配置精简**（skin-center）：5 个背景滑块 + Wallpaper Engine +
   自定义主题卡折进默认收起的「高级设置」`<details>`，主卡只保留开关、
   主题预览与皮肤列表；新增 `advanced` / `advancedHint` 双语 key。

## Constraints

- workspace 菜单补丁只作用于该包 bundle 工厂的 require，其它菜单不受影响；
  依赖 `__ModuleLoader__.load` 的延迟工厂执行时机（注册先行、执行懒加载）。
- 优化器不读历史、不写会话文件，草稿只进宿主 LLM 服务；输出经官方输入
  动作面回填。
- 皮肤改动不动 skin.json / hooks.mjs，provenance 的 hooks 信任不受影响。
- 新插件进入聚合清单（dsh-web-all）、sync-shared 共享拷贝目标与
  publish-prep 注册表；profile 安装需用户重启 dsh web 后出现按钮。

## Source record

作者 2026-08-25 的五条口头需求；本批全部实现并推送
`znc15/dsh-web-plugins` 与 `znc15/dsh-skin-whale-song`。
