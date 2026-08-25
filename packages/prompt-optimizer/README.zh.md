# 提示词优化器（prompt-optimizer）

[English](README.md) | 中文

`@linxin666/dsh-client-ui-prompt-optimizer`（cordis 插件 id `ui-prompt-optimizer`）在 dsh web GUI 的输入工具栏加入 **优化提示词** 按钮——上下文圆圈左侧的圆形闪光按钮。一键把当前草稿改写成更清晰、结构更好的提示词，使用的正是当前会话自己的模型路由，优化结果直接回填到输入框。

改写策略参考了 [prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) 项目：明确角色与目标、把隐含上下文显式化、去除模糊措辞、需要时给出结构，同时绝不改写用户的意图与语言。

## 功能

- **只做加法**：按钮注册进官方 `conversation.input.right` 槽位（渲染在上下文圆圈左侧的工具行），不替换官方任何界面。
- **复用会话模型**：宿主从会话最近一次请求上下文解析 provider/model（缺省时回退请求头），优化调用与对话走同一条模型路由——不需要额外 API Key，也不需要配置。
- **草稿进、草稿出**：只发送已编辑的草稿文本，返回结果通过官方 `inputActions.setDraft` 写回输入框；忙碌与错误状态以内联提示展示在按钮下方。
- **宿主侧调用**：浏览器只向 `/api/prompt-optimizer/v1/optimize` POST `{sessionId, prompt}`；空草稿、超长、尚无模型路由、流错误、超时等失败都映射为稳定的 HTTP 状态码与本地化文案。

## 安装

npm（发布后）：

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-prompt-optimizer
```

仓库开发安装：

```sh
git clone https://github.com/znc15/dsh-web-plugins.git
cd dsh-web-plugins
pnpm install && pnpm -r build
dsh plugin --profile web add link:$(pwd)/packages/prompt-optimizer
```

安装后需要重启 `dsh web` 才会出现按钮。

## 使用

1. 在输入框里写好草稿（或打开已有内容的会话）。
2. 点击上下文圆圈左侧的闪光按钮。
3. 按钮旋转表示正在用当前会话的模型优化；完成后优化文本会替换草稿——先检查、微调再发送即可。

如果会话还从未发起过模型请求（全新空白会话），按钮会提示尚不知道模型路由，先发送一条消息即可。

## 配置

无。插件没有设置项。

## 安全模型

- 优化路由只接受同源请求：跨站 fetch（Sec-Fetch-Site 或 Origin 不匹配）以 403 拒绝。
- 请求体上限 32 KiB，仅包含会话 id 与草稿；草稿上限 12000 字符，进入模型前以 JSON 形式封装。
- 插件不读取对话历史、不改写会话文件，草稿只进入宿主自己的 LLM 服务。
- 输出只写回用户自己的草稿（同源 store 更新），不会自动发送任何内容。

## 已知限制

- 优化需要会话至少有过一次模型请求，宿主才能确定路由。
- 调用上限为 45 秒、800 输出 token；超长草稿可能被截断或拒绝。
- 纯 CSS 无法为挂载式弹层做退场动画；以进场动画与悬停过渡承担动效打磨。

## 遥测

浏览器端每个 UTC 日向 dsh-market.com 发送一次匿名安装心跳：一个随机 localStorage id 加本包名，别无其他。服务端只保存该 id 的加盐哈希，不存 IP，只展示聚合计数。完整约定见 [docs/telemetry.md](../../docs/telemetry.md)。

## 目录结构

```
prompt-optimizer/
  src/index.ts                  # 宿主入口：优化路由
  src/core/optimize.ts          # 策略：封装、系统提示词、组装、规范化
  src/fence.ts                  # 路由同源围栏
  src/client/OptimizePromptButton.tsx  # 输入工具栏按钮 + 草稿回填
  src/client/locales.ts         # 中英文案
  tests/                        # 核心与组件交互测试
```

## 验收清单

- [x] 优化按钮渲染在输入工具栏、上下文圆圈左侧
- [x] 一键通过当前会话模型改写草稿
- [x] 空草稿客户端拒绝；缺少模型路由给出明确提示
- [x] 宿主路由同源、正文带上限、错误码稳定
- [x] 优化文本通过官方输入动作面回填
