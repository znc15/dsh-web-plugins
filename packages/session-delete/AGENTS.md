# AGENTS.md — session-delete

DSH Web GUI 的**删除对话**插件：在会话头部动作行提供「删除对话」入口，
确认后由宿主侧**永久删除**当前对话（含其持久化 JSONL 日志与 fork 子会话）。

## 本包要点

- host 半区（`src/index.ts` + `src/host-bridge.ts` + `src/core/delete-session.ts` +
  `src/fence.ts`）提供 `POST /api/session-delete/v1/delete`：同源围栏 +
  会话 id 校验 + 运行中拒绝（409）+ 在线会话摘除（触发官方
  `session/disposed` → `host/session-removed`）+ JSONL 目录按编码核名删除。
- 官方浏览器契约没有删除 RPC；`host-bridge.ts` 是唯一触及
  SessionStore 内部 entry detach 的地方，其余全部走公开服务面
  （`ctx.sessions` / `ctx.agents` / `ctx.sessionPersistence`）。
- client 半区（`src/client/`）注册 `conversation.session.header.actions`
  槽位，弹窗必须勾选「永久删除」确认后才发请求；错误文案中英双语。
- 侧边栏三点菜单通过 DOM 座位（`SidebarMenuPatch.tsx`）追加删除行：
  官方 workspace 菜单无槽位、primitives 是冻结 seed，不可用包级补丁；
  点击删除行会打开该会话并驱动头部删除按钮（同一确认弹窗），运行中的
  会话保持「禁用 + busy 提示」的产品行为。
- 纯逻辑在 `tests/delete-session.spec.ts` 单测锁定（编码、闭包、目录安全、
  编排）；组件交互在 `tests/DeleteConversationAction.spec.tsx` 与
  `tests/SidebarMenuPatch.spec.tsx` 锁定。
- 删除目录前必须用 `encodeSegment` 核对目录名，禁止删除任何
  非会话自身目录；运行中会话一律拒绝。

## 提交前检查

```sh
pnpm --filter @linxin666/dsh-client-ui-session-delete typecheck
pnpm --filter @linxin666/dsh-client-ui-session-delete test
pnpm --filter @linxin666/dsh-client-ui-session-delete build
```
