App Summary

  - Dominion-style multiplayer card game with an authoritative Deno server and an Angular + PixiJS client, sharing types and socket event contracts across shared/, server/, and angular-frontend/.
  - Agent constraints from AGENTS.md: deterministic gameplay, explicit state transitions, no hidden side effects, and preserve existing abstractions; new code should be explicit, typed, and comment new logic.

  Architecture Notes

  - Shared contracts live in shared/src/shared-types.ts (cards, match state, actions, socket events); both server and client import from shared/.
  - Server entry server/src/server.ts boots Socket.IO on Deno, loads expansions from server/src/expansions/*, and delegates to server/src/core/game.ts + server/src/core/match-controller.ts for lobby, match setup, and
    lifecycle.
  - Core gameplay runs through explicit actions in server/src/core/actions/game-action-controller.ts, with reactions/lifecycle handling and score computation inside server/src/core/*; state diffs use fast-json-patch and are
    broadcast via patchUpdate.
  - Expansion system: JSON card libraries/configurations and TS effect/configurator modules under server/src/expansions/*; configurators add non-supply cards/events, custom actions, and scoring hooks.
  - Frontend uses Angular + nanostores (angular-frontend/src/app/state/*) and a Socket.IO client (angular-frontend/src/app/core/socket-service/*) to apply patches; PixiJS scene/rendering helpers live in angular-frontend/
    src/app/core/*, assets under angular-frontend/public/assets.