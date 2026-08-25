# Session Delete (session-delete)

English | [中文](README.zh.md)

`@linxin666/dsh-client-ui-session-delete` (cordis plugin id `ui-session-delete`) adds a **Delete conversation** action to the conversation header of the dsh web GUI. The official GUI can only archive a session (hide it from the list while keeping the log files); this plugin deletes the current conversation permanently: the live session is removed from the host session store (the browser drops the row and clears back to the New Session view) and its durable JSONL log files are deleted from `$DSH_HOME/sessions/`. Child sessions forked from the conversation are removed together, so no orphan log can resurrect the conversation later.

## What it is

- **One additive entry**: the action registers into the official `conversation.session.header.actions` slot with a trash icon and a localized label, so nothing in the official shell is replaced.
- **Safe by construction**: a confirmation modal requires an explicit "I understand this is permanent" acknowledgement before the request is sent; a session that is currently **running** is refused host-side (HTTP 409) and the dialog shows the busy copy.
- **Host-side deletion**: the browser only confirms and reflects errors. `POST /api/session-delete/v1/delete` runs on the host, where the live session is detached through the same teardown the owning fiber would run, which emits the official `session/disposed` event and lets the api proxy publish `host/session-removed` — the official list store then removes the row and clears the current selection on its own.
- **Durable log removal**: the JSONL backend's own path encoding is reimplemented to verify a directory really belongs to the session before it is removed; a foreign or mismatched path is never deleted.
- **Best-effort caches**: workspace-registry and projection-cache memory maps are cleared for the removed ids. The durable workspace records self-heal on the next boot, because workspace `sessionIds` getters filter against the rebuilt header index.

## Install

From npm (when published):

```sh
dsh plugin --profile web add @linxin666/dsh-client-ui-session-delete
```

From the repository (development):

```sh
git clone https://github.com/zhu1090093659/dsh-web.git
cd dsh-web
pnpm install && pnpm -r build
dsh plugin --profile web add link:$(pwd)/packages/session-delete
```

Restart `dsh web` for the header action to appear.

## Usage

1. Open a conversation.
2. Click **Delete conversation** in the session header action row.
3. Tick the acknowledgement and confirm.
4. The conversation disappears from the session list and its log files are removed. The GUI falls back to the New Session view.

Deleting is refused while the conversation (or any child session of it) is running; cancel the turn and retry.

## Configuration

None. The plugin has no settings.

## Security model

- The deletion route is same-origin only: cross-site fetch (Sec-Fetch-Site or Origin mismatch) is rejected with 403.
- The body is capped at 16 KiB and holds a single session id; path separators and over-long ids are rejected.
- Deletion operates only on the current session id the browser sends together with its durable child closure; ids are validated and directory removal is name-checked against the backend encoding.
- The plugin never rewrites `cordis.patch.yml`, settings files, or the workspace registry's durable store; it relies on the official session-disposed frame and next-boot header re-indexing.

## Known limitations

- The durable workspace.json can temporarily retain a removed id inside a workspace `sessionIds` array until the next `dsh web` restart; the UI never renders the row in the meantime because the session summary is gone.
- Orphaned agent registry entries for an idle session are left to the process teardown; deleting only happens for non-running sessions, so no live work is interrupted.
- Deleting a running session is intentionally unsupported; cancel the turn first.

## Telemetry

The browser half sends one anonymous install heartbeat per UTC day to dsh-market.com: a random localStorage id plus this package's name, nothing else. The server stores only a salted hash of that id, never IP addresses, and exposes aggregate counts only. See [docs/telemetry.md](../../docs/telemetry.md) for the full contract.

## Directory structure

```
session-delete/
  src/index.ts                  # host entry: the deletion route
  src/host-bridge.ts            # live service ports over ctx.sessions / persistence / agents
  src/core/delete-session.ts    # planner: validation, closure, artifact safety, orchestration
  src/fence.ts                  # same-origin fence for the route
  src/client/DeleteConversationAction.tsx  # header action + confirmation modal
  src/client/locales.ts         # zh/en dictionaries
  tests/                        # planner + component interaction tests
```

## Acceptance checklist

- [x] The Delete conversation action renders in the conversation header with localized copy
- [x] The confirmation modal gates deletion behind an explicit acknowledgement
- [x] Running sessions are refused with clear busy copy (HTTP 409)
- [x] After deletion the session row disappears and the GUI clears to the New Session view (host/session-removed)
- [x] Durable session log files are removed; foreign paths are never deleted
