# PixiJS to Angular Migration Checklist

This document tracks the incremental migration from PixiJS rendering to Angular
templates/CSS.

## Layout policy

- Do not translate Pixi `x/y` directly into CSS `left/top` for normal layout.
- Prefer `display: flex` by default.
- Use `display: grid` only when flex cannot express the structure cleanly.
- Allow `position: absolute|fixed` only when required:
  - overlays/modal layers
  - viewport-anchored HUD elements
  - tooltip/popover/drag-preview layers

## Current scope defaults

- Migration strategy: UI-slice-first
- Dependency removal: end-only (remove Pixi packages in final chunk)
- Responsive scope: desktop-only

## Master checklist

- [x] Create migration tracker document
- [x] Chunk 1: waiting/pause/dialog-style transient overlays moved to Angular
- [x] Chunk 2: remaining transient prompt-adjacent overlays moved to Angular
- [x] Chunk 3: turn action controls moved to Angular
- [x] Chunk 4: Way picker moved to Angular
- [x] Chunk 5: supply area family converted (`basic-supply`, `kingdom-supply`)
- [x] Chunk 6: non-supply landscapes converted
- [ ] Chunk 7: hand/play/deck/discard area converted
- [ ] Chunk 8: shared primitives converted (card/pile/token/badges/buttons)
- [ ] Chunk 9: remove Pixi bootstrap (`PIXI_APP`, factory, canvas mount)
- [ ] Chunk 10: remove Pixi dependencies from `angular-frontend/package.json`

## Chunk acceptance criteria

- [x] No new `pixi.js` imports in migrated chunk files
- [x] No Pixi coordinate-style absolute positioning for normal layout
- [x] Existing gameplay/socket behavior unchanged
- [x] TypeScript check passes:
  - `cd angular-frontend && npx tsc -p tsconfig.app.json --noEmit`

## Chunk log

### Chunk 1 notes

- Goal: move waiting/pause overlays from Pixi scene rendering into Angular HUD.
- Scope:
  - waiting overlay
  - disconnected pause overlay
  - keep existing disconnected-player action dialog
- Status: completed
- Files:
  - `angular-frontend/src/app/state/match-ui-overlay-state.ts`
  - `angular-frontend/src/app/core/socket-service/socket-event-map.ts`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.ts`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.html`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.scss`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`

### Chunk 2 notes

- Goal: migrate remaining transient prompt-adjacent Pixi overlays to Angular prompt dialogs.
- Scope:
  - select-card confirm/cancel prompt controls
  - select-pile confirm/cancel prompt controls
  - pile-selection prompt content component in Angular host
- Status: completed
- Files:
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/prompt-dialog/prompt-dialog-host.component.ts`
  - `angular-frontend/src/app/components/prompt-dialog/prompt-dialog-host.component.html`
  - `angular-frontend/src/app/core/prompt-dialog/prompt-dialog.types.ts`
  - `angular-frontend/src/app/core/prompt-dialog/prompt-dialog-coordinator.service.ts`
  - `angular-frontend/src/app/components/prompt-dialog/content/prompt-select-pile-content.component.ts`
  - `angular-frontend/src/app/components/prompt-dialog/content/prompt-select-pile-content.component.html`
  - `angular-frontend/src/app/components/prompt-dialog/content/prompt-select-pile-content.component.scss`

### Chunk 3 notes

- Goal: move turn action controls from Pixi hand view into Angular HUD.
- Scope:
  - `NEXT` / phase-end button moved to Angular HUD
  - `PLAY ALL TREASURE` button moved to Angular HUD
  - App-to-scene wiring for turn action callbacks
  - remove Pixi hand turn-button rendering/events
- Status: completed
- Files:
  - `angular-frontend/src/app/components/match/views/player-hand.ts`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.ts`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.html`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.scss`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`

### Chunk 4 notes

- Goal: move the board-level Way picker UI from Pixi rendering to Angular overlay UI.
- Scope:
  - add Angular way-picker overlay component/service
  - replace Pixi way-picker container rendering in `MatchScene`
  - keep existing `cardTappedAsWay` socket behavior + lock flow
- Status: completed
- Files:
  - `angular-frontend/src/app/core/way-picker/way-picker-overlay.service.ts`
  - `angular-frontend/src/app/components/way-picker-overlay/way-picker-overlay.component.ts`
  - `angular-frontend/src/app/components/way-picker-overlay/way-picker-overlay.component.html`
  - `angular-frontend/src/app/components/way-picker-overlay/way-picker-overlay.component.scss`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`

### Chunk 5 notes

- Goal: move basic and kingdom supply rendering from Pixi views to Angular components.
- Scope:
  - add Angular supply overlay component for basic + kingdom pile families
  - migrate supply pile highlights, counts, trait tags, and supply-pile token overlays
  - preserve supply click behavior (`cardTapped`) and pile-select prompt toggling
  - keep board layout spacing for non-supply/play area aligned to supply footprint
- Status: completed
- Files:
  - `angular-frontend/src/app/components/match/supply/match-supply-overlay.component.ts`
  - `angular-frontend/src/app/components/match/supply/match-supply-overlay.component.html`
  - `angular-frontend/src/app/components/match/supply/match-supply-overlay.component.scss`
  - `angular-frontend/src/app/components/match/supply/supply-layout.constants.ts`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`
  - `angular-frontend/src/app/app.component.scss`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`

### Chunk 6 notes

- Goal: move non-supply landscape rendering from Pixi views to Angular overlay UI.
- Scope:
  - add Angular landscape overlay component for events, landmarks, projects, ways, and prophecies
  - preserve landscape tap behavior (`cardLikeTapped`) with server-lock release flow
  - preserve right-click landscape detail behavior
  - preserve landscape overlays:
    - event/project cost badges
    - project cube + Sinister Plot token indicators
    - prophecy Sun token count
  - remove Pixi landscape rendering classes and keep play-area spacing aligned to Angular landscape panel footprint
- Status: completed
- Files:
  - `angular-frontend/src/app/components/match/landscapes/match-landscapes-overlay.component.ts`
  - `angular-frontend/src/app/components/match/landscapes/match-landscapes-overlay.component.html`
  - `angular-frontend/src/app/components/match/landscapes/match-landscapes-overlay.component.scss`
  - `angular-frontend/src/app/components/match/landscapes/landscape-layout.constants.ts`
  - `angular-frontend/src/app/components/card-like/card-like.component.ts`
  - `angular-frontend/src/app/components/card-like/card-like.component.html`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`
  - `angular-frontend/src/app/app.component.scss`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/match/views/other-card-like-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/event-card.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/landmark-card.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/project-card.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/prophecy-card.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/way-card.ts` (deleted)
