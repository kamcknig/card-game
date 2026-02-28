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
- [x] Chunk 7: hand/play/deck/discard area converted
- [x] Chunk 8: shared primitives converted (card/pile/token/badges/buttons)
- [x] Chunk 9: remove Pixi bootstrap (`PIXI_APP`, factory, canvas mount)
- [x] Chunk 10: remove Pixi dependencies from `angular-frontend/package.json`

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

### Chunk 7 notes

- Goal: move hand/play/deck/discard rendering from Pixi views to Angular overlay UI.
- Scope:
  - add Angular player-area overlay for:
    - hand card stacks
    - play area card row
    - deck/discard stack views
    - phase/resource status controls (coffers, villagers, debt)
    - state/artifact prompt buttons
    - active-duration-card access button
  - preserve card tap interactions (`cardTapped`) with lock flow
  - preserve card Way hover behavior through the shared Angular way picker overlay
  - remove Pixi hand/play/deck/discard view classes and scene mounting
  - keep non-supply kingdom Pixi area in place (outside this chunk)
- Status: completed
- Files:
  - `angular-frontend/src/app/components/match/player-area/match-player-area-overlay.component.ts`
  - `angular-frontend/src/app/components/match/player-area/match-player-area-overlay.component.html`
  - `angular-frontend/src/app/components/match/player-area/match-player-area-overlay.component.scss`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`
  - `angular-frontend/src/app/app.component.scss`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/match/views/player-hand.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/play-area.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/deck-stack.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/card-stack.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/phase-status.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/active-duration-card-list.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/coffers-exchange-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/villagers-spend-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/debt-pay-view.ts` (deleted)

### Chunk 8 notes

- Goal: remove remaining shared Pixi card/pile/token/button primitives by migrating non-supply piles and select-pile controls to Angular overlays.
- Scope:
  - add Angular non-supply kingdom overlay:
    - non-supply pile panel rendering (including Loot pile behavior)
    - pile highlights for `selectable-card`, `selected-card`, `selectable-pile`, and `selected-pile`
    - pile token badges/chips and trait tag support
    - non-supply pile tap + Way hover behavior with existing lock flow
  - add Angular pile-selection action overlay:
    - bottom-center confirm/cancel controls for select-pile prompts
    - remove Pixi `createAppButton`/`AppList` dependency in `MatchScene#doSelectPiles`
  - remove remaining Pixi non-supply/shared primitive classes/files
  - adjust hand phase-status bar positioning so the bar sits above the hand panel with aligned left edges
- Status: completed
- Files:
  - `angular-frontend/src/app/components/match/non-supply/match-non-supply-overlay.component.ts`
  - `angular-frontend/src/app/components/match/non-supply/match-non-supply-overlay.component.html`
  - `angular-frontend/src/app/components/match/non-supply/match-non-supply-overlay.component.scss`
  - `angular-frontend/src/app/components/match/pile-selection/pile-selection-action-overlay.component.ts`
  - `angular-frontend/src/app/components/match/pile-selection/pile-selection-action-overlay.component.html`
  - `angular-frontend/src/app/components/match/pile-selection/pile-selection-action-overlay.component.scss`
  - `angular-frontend/src/app/state/pile-selection-overlay-state.ts`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/match/player-area/match-player-area-overlay.component.html`
  - `angular-frontend/src/app/components/match/player-area/match-player-area-overlay.component.scss`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`
  - `angular-frontend/src/app/app.component.scss`
  - `angular-frontend/src/app/core/create-app-button.ts` (deleted)
  - `angular-frontend/src/app/core/card/create-card-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/app-list.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/non-supply-kingdom-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/pile.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/card-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/card-like-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/token-badge-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/count-badge-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/pull-out.ts` (deleted)

### Chunk 9 notes

- Goal: remove Pixi app bootstrap wiring while preserving match interaction flow through Angular.
- Scope:
  - remove Pixi app initializer/injection token wiring from Angular app config
  - remove Pixi canvas host mount from app root template/component styles
  - convert `MatchScene` from Pixi scene class to a pure controller class for:
    - socket event subscriptions (`selectCard`, `userPrompt`, `ping`)
    - turn action requests (`nextPhase`, `playAllTreasure`)
    - prompt/selection lock coordination
  - keep scene lifecycle in `AppComponent` using controller init/destroy instead of Pixi stage add/remove
  - remove obsolete Pixi bootstrap/support files
- Status: completed
- Files:
  - `angular-frontend/src/app/app.config.ts`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/app.component.html`
  - `angular-frontend/src/app/app.component.scss`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.ts`
  - `angular-frontend/src/app/core/pixi-application.factory.ts` (deleted)
  - `angular-frontend/src/app/core/pixi-application.token.ts` (deleted)
  - `angular-frontend/src/app/core/scene/scene.ts` (deleted)
  - `angular-frontend/src/app/state/app-state.ts` (deleted)

### Chunk 10 notes

- Goal: remove remaining Pixi package dependencies and leftover Pixi references from Angular source.
- Scope:
  - remove Pixi dependencies from `angular-frontend/package.json`:
    - `pixi.js`
    - `pixi-filters`
    - `@pixi/ui`
    - `@pixi/devtools`
  - remove dead Pixi-only files no longer referenced after chunk 9:
    - `boon-indicator-view.ts`
    - `hex-indicator-view.ts`
    - `cube-token-view.ts`
    - `panel-shadow-filter.ts`
    - `theme/pixi-theme.ts`
  - remove leftover Pixi asset-bundle wiring in socket event handling (`Assets.addBundle(...)`)
  - remove/update remaining code comments that referenced Pixi behavior where no longer applicable
- Status: completed
- Files:
  - `angular-frontend/package.json`
  - `angular-frontend/src/app/core/socket-service/socket-event-map.ts`
  - `angular-frontend/src/app/app.component.ts`
  - `angular-frontend/src/app/components/match/match-hud/match-hud.component.scss`
  - `angular-frontend/src/app/components/match/views/token-utils.ts`
  - `angular-frontend/src/app/components/match/landscapes/match-landscapes-overlay.component.ts`
  - `angular-frontend/src/app/components/match/supply/supply-layout.constants.ts`
  - `angular-frontend/src/app/components/match/supply/match-supply-overlay.component.ts`
  - `angular-frontend/src/app/components/match/views/scenes/match-scene.ts`
  - `angular-frontend/src/app/components/match/views/boon-indicator-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/hex-indicator-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/cube-token-view.ts` (deleted)
  - `angular-frontend/src/app/components/match/views/panel-shadow-filter.ts` (deleted)
  - `angular-frontend/src/app/theme/pixi-theme.ts` (deleted)
