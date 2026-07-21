// Per-card runtime metadata shapes used by base-v2 card effects.

// Tracks Merchant's per-play sequence number so each activation of a
// physical Merchant (including Throne-Room-style replays of the same
// card instance) registers and unregisters its own uniquely-id'd
// "first Silver this turn" reaction rather than colliding on a shared id.
export interface MerchantMetadata {
  merchantPlayCount?: number;
}
