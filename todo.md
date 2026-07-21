# Randoms

---

need a VP breakdown per person on ohw each point was received

---

add stats tracking
cards played on board not for current player - such as black cat - have some indication of who they belong to
in active duration cards modal - show which player owns which cards

---

add password reset

---

Send configuration to front-end include things like

- regex for email
- regex for username

---

when mousing over a card in the hand, it should bring that card to front
similar to how ways do it in the condensed view.

enter should submit forms such as match save dialog

# Lower priority

- add pre commit to lint and or fmt
- when using overpay feature, you can overpay with potions. this matters for
  stonemason. don't know how to do the UI
  for this yet, and doesn't seem super important to get done right away
- If you play an Ambassador and reveal a Spoils, the Spoils is not returned to
  the Supply (since it is not in the
  Supply) and other players do not gain Spoils.
- prosperity has the card that changes curses into a treasure card type, and
  also gains the effect to gain 1 treasure on
  play. need a way to visually denote this properly. also similar to inheritance
  in adventures
- update usages of `tags` to use a hard-coded list. these will be known tags
  from cards like young witch that adds a
  "bane" card. then you can add a custom tags property to track more custom
  ones.
- possible keep the enhanced logging for console logs but switch to a buffered
  file logger solution later for
  production.
- Lobby ban identity currently uses `sessionId`; replace with durable
  authenticated identity and provide a migration path.
- once all game data is added, update all effects that set aside cards to add
  source and properly be face up or down so that they are sorted correctly in
  tabs

# Higher priority

- some mats have rules that indicate cards are moved to the deck at the end of
  the game before scoring e.g., native
  village mat. others don't like the tavern mat

## cards yet to implement

### alchemy

- possession
