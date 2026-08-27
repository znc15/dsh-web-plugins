# Prompt Optimizer (prompt-optimizer)

English | [中文](README.zh.md)

`@linxin666/dsh-client-ui-prompt-optimizer` (cordis plugin id `ui-prompt-optimizer`) adds a **optimize prompt** button to the composer tool row of the dsh web GUI — the round sparkle entry just left of the context meter. One click rewrites the current draft into a clearer, better-structured prompt through the session's model route — or the app's default model when the session has none — and the optimized text replaces the draft.

The rewriting policy follows the approach of the [prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) project: pin the role and the goal, make implicit context explicit, remove vague wording, impose structure when the task benefits from it, and never change the user's intent or language.

## What it is

- **One additive entry**: the button registers into the official `conversation.input.right` slot (the tool row rendered just left of the context meter), so nothing in the official shell is replaced.
- **Uses the session model, or the default when none**: the host resolves the current provider/model from the session's last request context (falling back to the request header); a fresh session with no model record yet falls back to the app's default model selection (`agent-default-model`), then to the first registered provider advertising a text-capable model — so optimization works before the first message.
- **Draft in, draft out**: only the composed draft is sent; the returned text is written back through the official `inputActions.setDraft` face. Busy and error states stay inline under the button.
- **Host-side call**: the browser only POSTs `{sessionId, prompt}` to `/api/prompt-optimizer/v1/optimize`; every failure mode (empty prompt, oversized prompt, no model available, stream error, timeout) maps to a stable HTTP code and a localized message.

## Install

From npm (when published):

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-prompt-optimizer
```

From the repository (development):

```sh
git clone https://github.com/znc15/dsh-web-plugins.git
cd dsh-web-plugins
pnpm install && pnpm -r build
dsh plugin --profile web add link:$(pwd)/packages/prompt-optimizer
```

Restart `dsh web` for the button to appear.

## Usage

1. Type a draft into the composer (or open a session that already has content).
2. Click the sparkle button left of the context circle.
3. The button spins while the session model rewrites the draft; the optimized text replaces the draft — review and tweak it, then send.

A fresh blank session is fine: the host falls back to the app's default model (or the first available registered model), so there is no need to send a message first. Only when no provider/model is configured anywhere does the button ask you to set one up in settings.

## Configuration

None. The plugin has no settings.

## Security model

- The optimization route is same-origin only: cross-site fetch (Sec-Fetch-Site or Origin mismatch) is rejected with 403.
- The body is capped at 32 KiB and holds only the session id and the draft; the draft is capped at 12 000 characters and framed as JSON before it reaches the model.
- The plugin never reads conversation history, never rewrites session files, and never forwards the draft anywhere except the host's own LLM service.
- The output is only ever written into the user's own draft (same-origin store update); nothing is sent automatically.

## Known limitations

- Optimization needs at least one configured model: a session route, the app's default selection, or a registered provider with an advertised text-capable model.
- The call is capped at 45 seconds and 800 output tokens; very long drafts may be cut or refused.
- Exit animations for mount-driven popups are not possible with pure CSS; entry animations and hover transitions carry the polish instead.

## Telemetry

The browser half sends one anonymous install heartbeat per UTC day to dsh-market.com: a random localStorage id plus this package's name, nothing else. The server stores only a salted hash of that id, never IP addresses, and exposes aggregate counts only. See [docs/telemetry.md](../../docs/telemetry.md) for the full contract.

## Directory structure

```
prompt-optimizer/
  src/index.ts                  # host entry: the optimization route
  src/core/optimize.ts          # policy: framing, system prompt, assembly, normalization
  src/fence.ts                  # same-origin fence for the route
  src/client/OptimizePromptButton.tsx  # composer tool-row button + draft write-back
  src/client/locales.ts         # zh/en dictionaries
  tests/                        # core + component interaction tests
```

## Acceptance checklist

- [x] The optimize button renders in the composer tool row left of the context meter
- [x] One click rewrites the draft through the session's own model route
- [x] Empty drafts are refused client-side; fresh sessions fall back to the default/available model
- [x] The host route is same-origin and body-capped, with stable HTTP error codes
- [x] The optimized text replaces the draft through the official input action face
