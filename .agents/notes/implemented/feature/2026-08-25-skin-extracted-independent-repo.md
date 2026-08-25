# Agent Note: Whale Song skin extracted to an independent skin repository

Status: implemented

## Problem

The whale-song (鲸吟) skin was bundled inside the skin-center package as its
only built-in asset. The author wanted the skin decoupled from the loader:
a standalone, independently versioned skin repository that users install by
hand, with the skin-center shipping zero skins.

## Decision

1. Create the independent skin repository `znc15/dsh-skin-whale-song`
   (public, fresh single commit) containing the complete v2 skin assets
   (skin.json / skin.css / patches.css / hooks.mjs / assets / preview),
   bilingual install READMEs, an Apache-2.0 LICENSE, and a
   `dsh-market.provenance.json` that sha256-pins `skin.json` /
   `hooks.mjs` / `skin.css` so the skin-center still treats the favicon
   hook facet as trusted after a manual install.
2. Remove the bundled skin from dsh-web-plugins:
   - `packages/skins/skin-center/skins/` deleted; the package `files`
     whitelist no longer lists any `skins/*` entry.
   - `DEFAULT_SKIN_ID` stays `whale-song` but is now only a first-boot
     default when the skin is present in the user skins directory; an empty
     catalog keeps the official stock look.
   - market-build / gallery-build tolerate an empty skin catalog; the
     regenerated market/gallery dists carry zero skins.
   - The root README montage and per-skin sub-sections were removed; the
     skin section now points at the independent repository.

## Constraints

- The v2 skin contract stays unchanged: skins remain pure asset
  directories loaded by the skin-center; no per-skin npm plugin shape was
  revived.
- The provenance file records the same reviewed bytes the repo previously
  published; a tampered or missing file only refuses the hook facet
  (favicon), never the declarative skin.
- The user runbook: clone/copy the repository into
  `$DSH_HOME/skins/whale-song/` (reply "install" to apply it on the
  current machine after a dsh web restart).

## Source record

Extraction follows the author's "独立皮肤仓库" decision from the 2026-08-25
planning round; the previous bundled-default behavior is recorded in the
2026-08-24 note.
