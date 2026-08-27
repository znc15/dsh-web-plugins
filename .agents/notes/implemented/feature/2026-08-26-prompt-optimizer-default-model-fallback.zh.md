# Agent Note: 提示词优化器新增默认模型回退

Status: implemented

## Problem

提示词优化按钮在全新会话（还没有任何模型请求记录）上点击时报错
「当前会话还没有模型记录，请先发送一条消息」。作者要求：优化提示词
应该直接使用可用的模型，不需要先发一条消息。

## Decision

宿主路由 `POST /api/prompt-optimizer/v1/optimize` 的模型路由解析升级为
三级回退链（`src/index.ts` 的 `resolveOptimizeRoute`）：

1. 会话自己的模型记录：`requestContext()`，再回退 `requestHeader().config`
   （与之前一致，仍是优先项）。
2. 应用默认模型：读取核心服务 `agentDefaultModel.currentSelection()`
   （对应设置项 `agent-default-model`，即新会话首条消息本会使用的
   provider/model），仅当该 provider 已注册时采用。
3. 可用模型轮询：`llm.listProviders()` 遍历注册 provider，逐个
   `llm.listModels()` 取公布的模型，选择第一个文本能力（
   `inputModalities` 缺失或含 `text`）的模型；明确仅图片能力的模型
   不会入选（`src/core/optimize.ts` 新增纯函数 `pickFallbackRoute`，
   可单测）。

配套改动：`no-model-route` 的服务端文案与客户端 `optimize.noRoute`
改为「没有可用模型，请在设置中配置」；按钮提示从「用当前会话的模型」
改为「用当前会话或默认模型」；README 对与根 README 同步更新。

## Constraints

- 会话有模型记录时行为完全不变；回退只作用于没有记录的新会话。
- 默认模型服务缺失或 provider 未注册时自动降级到 provider 列表探测，
  两者皆无才返回 409。
- 不引入新依赖：`ctx.agentDefaultModel` 走结构化松耦合读取；类型形状
  来自 dsh-llm 的 `LlmRuntime.listProviders/listModels`。
- host 侧路由变更需重启 `dsh web` 生效；客户端文案随 bundle 刷新生效。

## Source record

作者 2026-08-26 口头需求；本批实现并推送 `znc15/dsh-web-plugins`。
