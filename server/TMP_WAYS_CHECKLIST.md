# Ways Implementation Checklist

## Shared Model and Core Types
- [x] 1. Add `Way` / `WayNoId` to shared card-like model.
- [x] 2. Add `ways` to `MatchConfiguration` and `Match` state.
- [x] 3. Export `Way` / `WayNoId` from shared card-like type entrypoints.
- [x] 4. Extend card-like find helpers with `way` kind and `findWayInMatch`.
- [x] 5. Add `ways` to expansion catalog data structures.

## Loading and Registry
- [x] 6. Create way loader service (`load-ways.ts`) for JSON + optional effects.
- [x] 7. Wire way loader into expansion loader pipeline.
- [x] 8. Add way effect factory registry/materialization map.
- [x] 9. Inject way effect map into match-scope action controller wiring.

## Match Setup and Selection
- [x] 10. Create active match ways in setup (`createWays`).
- [x] 11. Include Ways in landscape randomizer selection/cap logic.
- [x] 12. Keep kingdom-only selectors (e.g. Bane) isolated from landscapes.
- [x] 13. Persist selected Ways per match scope (`preselected-ways.json`).
- [x] 14. Add server search index and socket endpoints for Ways.

## Match Configuration and Scene UI
- [x] 15. Add Way selection UI in match configuration.
- [x] 16. Render active Ways in match scene card-like area/state.

## Way Play Interaction (Non-Blocking UI)
- [x] 17. Add socket event `cardTappedAsWay(playerId, cardId, wayId)`.
- [x] 18. Handle `cardTappedAsWay` in server interactivity controller.
- [x] 19. Extend `playCard` args with optional `wayId`.
- [x] 20. Execute normal-vs-way effect path in `playCard` while preserving existing trigger/lifecycle order.
- [x] 21. Ensure Way context `this` points at the played Action card (`cardId` semantics).
- [x] 22. Add deterministic logging for `normal` vs `way:<key>` play path.
- [x] 23. Keep AI policy on normal play only for now.

## Pixi Way Picker UX
- [x] 24. Add cyan playable border for Way-eligible cards.
- [x] 25. Add hover popover with active Ways (vertical, full art at 0.75 scale).
- [x] 26. Card body click keeps normal play behavior.
- [x] 27. Way click emits `cardTappedAsWay`.
- [x] 28. Close picker on leave/phase change/prompt/action completion.
- [x] 29. Reuse existing client action lock patterns for way-click flow.

## Future Hooking
- [x] 30. Add TODO + explicit hook point for future top-vs-bottom effect split.
