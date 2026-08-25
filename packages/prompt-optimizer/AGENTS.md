# AGENTS.md — prompt-optimizer

DSH Web GUI 的**提示词优化**插件：在输入工具栏（上下文圆圈左侧）提供
「优化提示词」按钮，由宿主用当前会话自己的模型路由改写草稿并回填。

## 本包要点

- host 半区（`src/index.ts` + `src/core/optimize.ts` + `src/fence.ts`）
  提供 `POST /api/prompt-optimizer/v1/optimize`：同源围栏 + 会话 id 校验 +
  会话模型路由解析（`requestContext()`，回退 `requestHeader()`）+ 经
  `ctx.llm.stream` 的一次性辅助调用（45s 超时、800 token 上限）。
- 路由解析失败（会话尚无任何模型请求）返回 409；同步错误 / 超时分别返回
  502 / 504；一切失败都有稳定 code 供客户端本地化。
- client 半区（`src/client/`）注册 `conversation.input.right` 槽位（位于
  上下文圆圈左侧），通过标准输入动作面 `inputActions.setDraft` 回填。
- 纯逻辑在 `tests/optimize.spec.ts` 单测锁定（封装、路由、finish 处理、
  规范化）；组件交互在 `tests/OptimizePromptButton.spec.tsx` 锁定。
- 优化系统提示词来自 prompt-optimizer 项目的思路：目标明确、上下文显式、
  消除模糊、合理结构化、保持用户语言与意图；只输出改写后的提示词本身。

## 提交前检查

```sh
pnpm --filter @linxin666/dsh-client-ui-prompt-optimizer typecheck
pnpm --filter @linxin666/dsh-client-ui-prompt-optimizer test
pnpm --filter @linxin666/dsh-client-ui-prompt-optimizer build
```
