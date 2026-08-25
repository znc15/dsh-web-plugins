# Agent Note: Single-skin collection (whale-song only) plus session delete

Status: implemented

## Problem

The repo shipped a 19-skin collection with blue-fantasy as the bundled
default, and the official DSH browser contract exposed no way to delete a
conversation (archiving only hides it while keeping the log files).

## Decision

1. Trim the skin collection to exactly `whale-song` (鲸吟): the other 18
   skin asset directories under `packages/skins/skin-center/skins/` were
   deleted, the bundled default (`DEFAULT_SKIN_ID`) became
   `whale-song`, the package `files` whitelist ships
   `skins/whale-song` only, and the market/gallery dists were
   regenerated from the single-skin source.
2. Add the `session-delete` plugin
   (`@linxin666/dsh-client-ui-session-delete`): a conversation-header
   action that permanently deletes the current conversation. The host half
   serves `POST /api/session-delete/v1/delete` and, for a non-running
   session, detaches the live store entry (the official teardown path, which
   emits `session/disposed` → the api proxy frames `host/session-removed`
   so the browser drops the row and clears the selection) and deletes the
   durable JSONL artifact directory (name-checked against the backend's own
   path encoding). Forked children are removed with the parent.

## Constraints

- The skin trim keeps the skin-center contract untouched (pure asset
  directories, v2 manifests, one loader); only the catalog contents and the
  bundled default changed.
- Session deletion never rewrites `cordis.patch.yml` or the durable
  workspace store; stale workspace `sessionIds` entries self-heal on the
  next boot through the rebuilt header index.
- Deleting a running session is refused (HTTP 409) so no live agent work is
  interrupted; the browser confirms with an explicit acknowledgement before
  sending the request.
- The only internal-reach in the plugin is the SessionStore entry detach in
  `host-bridge.ts`; everything else rides public service faces.

## Source record

The whale-song skin was authored earlier in the collection and is the only
skin its author wants to keep; deletion support follows the same host-side
building blocks the archived-session manager community plugin uses.
