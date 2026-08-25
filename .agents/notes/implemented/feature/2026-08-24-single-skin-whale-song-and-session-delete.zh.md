# Agent Note: 皮肤集只保留鲸吟（whale-song）并新增删除对话

Status: implemented

## Problem

仓库随带 19 款皮肤的皮肤集，默认内置 blue-fantasy；而官方 DSH 浏览器契约
没有删除会话的能力（归档只会隐藏列表项并保留日志文件）。

## Decision

1. 皮肤集裁剪为只有 `whale-song`（鲸吟）：删除
   `packages/skins/skin-center/skins/` 下另外 18 个皮肤资产目录，
   内置默认（`DEFAULT_SKIN_ID`）改为 `whale-song`，包的 `files`
   白名单只发布 `skins/whale-song`，市场与画廊 dist 按单一皮肤源重新生成。
2. 新增 `session-delete` 插件
   （`@linxin666/dsh-client-ui-session-delete`）：会话头部动作，可
   **永久删除**当前对话。宿主半区提供 `POST /api/session-delete/v1/delete`：
   对非运行中的会话，沿官方摘除路径脱离在线存储（触发 `session/disposed`
   → api proxy 广播 `host/session-removed`，浏览器自动移除行并清空选中），
   并按后端自身路径编码核对后删除持久化 JSONL 目录；fork 子会话随父级一并删除。

## Constraints

- 皮肤裁剪不触碰皮肤中心契约（纯资产目录、v2 清单、单一加载器），只改
  目录内容与内置默认。
- 会话删除从不改写 `cordis.patch.yml` 或持久化工作区存储；残留的
  workspace `sessionIds` 条目在下次启动时经重建的 header 索引自愈。
- 运行中的会话拒绝删除（HTTP 409），不打断任何在线 agent 工作；浏览器侧
  必须先显式勾选确认才发送请求。
- 插件唯一触及内部实现的地方是 `host-bridge.ts` 的 SessionStore entry
  detach；其余全部走公开服务面。

## Source record

鲸吟皮肤是皮肤集中作者唯一希望保留的一款；删除能力沿用归档管理社区插件
使用的同一套宿主侧构件。
