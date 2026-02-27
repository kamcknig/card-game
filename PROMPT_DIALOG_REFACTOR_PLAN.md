# Prompt Dialog Refactor Plan

## Goal
Replace bulky Pixi prompt modals with Angular dialog components while preserving deterministic gameplay behavior and existing socket contracts.

## Scope
- Migrate prompt rendering from Pixi modal containers to Angular dialogs.
- Keep server/client socket event contracts unchanged (`selectCard`, `userPrompt`, `userInputReceived`).
- Keep board-native selection behavior unchanged.
- Keep non-modal Way picker behavior on board/hand unchanged.
- Implement modal-local Way selection UI only for modal select flows.

## Key Rules
- `selectCard` remains board-first. Only fallback cases use a modal.
- `userPrompt` remains source of prompt payloads for prompt content types.
- No protocol changes to shared prompt payload shapes.
- No gameplay rule changes.

## Target Architecture
1. Prompt coordinator bridge
- Add a typed Angular service to coordinate prompt open/resolve lifecycle.
- Pixi-side code requests prompts through this bridge and awaits a promise.
- Angular host renders one active prompt at a time.

2. Angular prompt host
- Add a global prompt host component mounted in app root.
- Host uses `app-ui-dialog` (CDK overlay wrapper) and renders content by prompt type.
- Host handles shared action buttons, validation state, and close semantics.

3. Prompt content components
- Split prompt content by kind into focused components:
  - select/display-cards
  - number-input
  - name-card
  - overpay
  - (later) rearrange / blind-rearrange if still needed
- Centralize shared prompt validation and result mapping in host + content outputs.

## Incremental Implementation Steps
1. Add plan file (this document).
2. Add coordinator service and request model.
3. Add Angular prompt host wired to coordinator.
4. Implement first migrated content components (`select`/`display-cards`, `number-input`, `name-card`, `overpay`).
5. Wire `MatchScene` and `PlayerHand` to open prompts via coordinator for supported prompt types.
6. Keep legacy Pixi modal path as temporary fallback for unsupported prompt types while migration continues.
7. Migrate remaining prompt kinds and remove legacy Pixi prompt modal code when parity is complete.

## Behavior Compatibility Requirements
- `selectCard` fallback modal still returns selected ids and optional `selectedWayId`.
- `userPrompt` action-button behavior remains compatible, including validation-gated action buttons.
- Display-only prompts (`waitForInput = false`) still render without blocking server flow.
- Prompt lock state (`promptInteractionLockStore`) remains respected.

## Current Definition of Done for First Implementation Slice
- Prompt coordinator + host in place.
- Supported prompt types routed through Angular dialogs.
- Existing unsupported prompt types still work through legacy fallback.
- TypeScript app compiles.

## Follow-up Definition of Done (full migration)
- All modal prompt kinds rendered via Angular dialogs.
- Legacy Pixi prompt modal entrypoint no longer used.
- Shared model and components reduce duplicated selection logic.
