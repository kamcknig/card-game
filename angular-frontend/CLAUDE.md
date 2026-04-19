# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See the parent `../CLAUDE.md` for full project architecture, game rules, coding standards, and constraints. This file covers Angular frontend specifics only.

## Build & Validation Commands

```bash
# Dev server (http://localhost:51455, proxies API via src/proxy.conf.json)
npm run start

# Type-check only (preferred validation for routine changes)
npx tsc -p tsconfig.app.json --noEmit

# Production build (not required for routine validation)
npm run build

# Unit tests (Karma/Jasmine) — only run when explicitly asked
npm test
```

## Architecture

### Zoneless Change Detection

Angular 19 with `provideExperimentalZonelessChangeDetection()`. All components use `ChangeDetectionStrategy.OnPush` with signals. No Zone.js — change detection is driven entirely by signal updates.

### Scene System (No Router)

`AppComponent` switches between 4 scenes (`lobby`, `configuration`, `match`, `gameSummary`) driven by `sceneStore` in `src/app/state/game-state.ts`. There is no Angular Router for main views.

When scene is `match`, `AppComponent` creates a `MatchScene` instance (plain TypeScript class at `src/app/components/match/views/scenes/match-scene.ts`) that manages game interaction logic, prompt coordination, and way picker overlay. It is destroyed when leaving the match scene.

### State Management (Nanostores)

All global state lives in `src/app/state/` using nanostores atoms and computed stores:
- `*-state.ts` files: atomic stores (raw state atoms)
- `*-logic.ts` files: computed/derived stores (combine atoms into derived state)

Components consume stores via `@nanostores/angular`'s `NanostoresService` and `toSignal()`. All core stores are exposed on `globalThis` for console debugging.

### Key State Files

| File | Purpose |
|------|---------|
| `match-state.ts` | Core match atom, configuration, summary |
| `card-source-store.ts` | Per-source card atoms with hydration cache |
| `interactive-state.ts` | Server-driven selectables, locks |
| `interactive-logic.ts` | Computed selectables merging server + client state |
| `turn-state.ts` | Turn phase, current player |
| `player-state.ts` | Per-player atoms |

### Socket Communication

`SocketService` (`src/app/core/socket-service/socket.service.ts`) manages the Socket.IO connection. All server-to-store event bindings are in `socket-event-map.ts`. Server JSON patches are applied via `fast-json-patch` to update nanostores, which trigger signal updates and re-renders.

### Prompt System

`PromptDialogCoordinatorService` (`src/app/core/prompt-dialog/`) manages one active prompt at a time, returning a Promise that resolves when the user responds. `PromptDialogHostComponent` renders the active prompt's content component.

### UI Interaction Locks

Multiple lock stores prevent race conditions during gameplay:
- `promptInteractionLockStore`: UI is handling a prompt
- `awaitingServerLockReleaseStore`: Waiting for card play resolution
- `MatchScene` checks a computed `uiInteractive` flag before allowing player actions

### Component Organization

All components are standalone under `src/app/components/`, organized by domain:
- `match/` — supply, player-area, hud, landscapes, non-supply piles
- `prompt-dialog/` — prompt host + per-type content components
- `card/`, `card-like/` — card rendering
- `lobby/`, `match-configuration/`, `game-summary/` — scene components

### Shared Package

Imported via tsconfig path `shared/*` → `../shared/src/*`. No build step — TypeScript consumed directly. Core types come from `shared/types`.

## Conventions

- Use `input()` / `output()` signal APIs for component I/O, not decorators
- Use new control flow syntax (`@if`, `@for`, `@let`) in templates
- Convert nanostores to signals with `toSignal(nanoStoresService.useStore(store))`
- SCSS with `@use` (never `@import`); prefer flexbox over grid
- Card source keys use format `sourceKey` or `sourceKey:playerId` (e.g., `playerHand:1`, `setAside:TrashToken`)
- Card images at `public/assets/card-images/base-v2/{full-size,half-size}/`
- Dev server port: 51455

## Icons

All icons use [`lucide-angular`](https://lucide.dev/guide/packages/lucide-angular). Do not add inline SVGs or Unicode glyphs for iconography.

### Usage pattern

1. Import the named icon and `LucideAngularModule` from `lucide-angular`.
2. Add `LucideAngularModule` to the component's `imports` array.
3. Expose the icon as a `readonly` class field so the template can reference it.
4. Use `<lucide-icon [img]="IconRef" [size]="N" />` in the template.

```typescript
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';

@Component({
  imports: [LucideAngularModule],
  // ...
})
export class MyComponent {
  // Lucide icon references — class fields required; Angular templates cannot
  // access module-level bindings directly.
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;
}
```

```html
<lucide-icon [img]="showPassword() ? EyeOffIcon : EyeIcon" [size]="18" />
```

Button containers that wrap a lucide icon should use `display: inline-flex; align-items: center; justify-content: center` so the icon is flush-centered without needing extra padding.
