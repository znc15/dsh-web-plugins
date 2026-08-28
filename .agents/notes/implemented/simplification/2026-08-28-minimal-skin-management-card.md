# Agent Note: Minimal skin management card (switch / stock / Whale Song / theme)

Status: implemented

## Problem

The Skin Center card had grown into a settings workbench: background occlusion and blur sliders, an input-card blur, bubble opacity, a custom-theme editor with per-mode color pickers, and a Wallpaper Engine panel. The user only wanted skin management: the enable switch, the stock look, Whale Song, and the light/dark theme toggle.

## Decision

The card now renders only the enable switch, the "官方默认" (official default) look, Whale Song (鲸吟) and the light/dark theme toggle. The catalog still loads all installed skins through the v2 runtime, but the card filters its list to `whale-song`; other skins remain loadable by the runtime and stay available to the market/install path, they just do not appear in this minimal management list. Background and custom-theme runtime bridges stay wired host-side/client-side: a persisted custom theme still applies and deactivates correctly on skin switch, the wallpaper selection still clears, and the background scrim namespace is untouched. Only the card's rendered surface shrinks.

The custom-theme editor panel, background sliders and wallpaper panel are no longer imported by the card, so the client bundle tree-shakes them out; their controllers and host settings stay for persistence. The spec file was renamed to `tests/skin-center-card.spec.tsx` and asserts the minimal surface plus apply/restore/theme-toggle behavior.

## Alternatives considered

- Deleting the custom-theme feature entirely: rejected because a persisted custom theme (applied through the official settings schema) must keep working; removing only the editor keeps that contract.
- Filtering the catalog in the runtime: rejected, the runtime must stay a general catalog loader; the card is the presentation filter.
- Keeping the sliders but hiding them behind a disclosure: rejected, the user asked for only the four items visible.

## Consequences

- The card is four items: switch, stock look, Whale Song, 亮/暗 theme toggle.
- Applying Whale Song or restoring the stock look keeps the atomic switch, wallpaper-clear and custom-theme-deactivate transaction.
- The card description and README pair now describe only the minimal surface; background and custom-theme bridges are documented as host/controller-side only.
- The `skin-center-card.spec.tsx` smoke suite covers render, apply, restore, active marker and enable switch.