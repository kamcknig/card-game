# Randoms

- add email registration via supabase
  - add password reset
  - email change after registration

---

Send configuration to front-end include things like

- regex for email
- regex for username

---

# Lower priority

- add pre commit to lint and or fmt
- undo turn/steps
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
- cards like throne room need to have log entries updated so that the cards
  they play show the source (the throne room) in parentheses. maybe then they
  don't need to be indented?
- document application from developers point of view
- once all game data is added, update all effects that set aside cards to add
  source and properly be face up or down so that they are sorted correctly in
  tabs
- once all game data is added, need to make sure to update all
  card/landscapes effects to use the new choose ability functionality from elder
  from allies expansion.

# Higher priority

- stop following rule
  - need to figure how to implement this across entire app rather than in each place.
- check duration behavior. the official rules say this "Additionally, if a
  Duration card is played extra times by a card
  such as [Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo],
  that card also stays in play until the
  Duration card is discarded, to track the fact that the Duration card was
  played extra times." Just make sure cards
  stay in play that need to stay in play. some has already been done, but ensure
  duration cards from the past before
  something like the nocturne expansion work the same
- boon and hex indicator views need to be displayed. they have been created, but
  not displayed to the user
  boon-indicator-view and hex-indicator-view
- player disconnection
  - work on the use-case when a player disconnects while waiting on input for
    that player - when they reconnected they
    need to be asked for their input again
- when "waiting on player input" displays, cards are selectable. i played
  war chest, and while waiting on someone to name
  cards, it showed highlights on cards. don't know if they were selectable
- some mats have rules that indicate cards are moved to the deck at the end of
  the game before scoring e.g., native
  village mat. others don't like the tavern mat
- there are a lot of reactions that happen where a condition and a trigger query
  the exact same data. one example is
  [arena](../dominion-docs/expansion-docs/empires/cardlikes/arena.md). I think
  maybe we can pass some data from the
  condition to the trigger.

need to show the context of the kingdom card for something like young witch, and
ferryman

- young witch (new kingdom)
- ferryman (new kingdom)
- joust (rewards, maybe not needed since rewards simply appear)
- charlatan (curse)
- bandit camp (spoils)
- pillage (spoils)
- marauder (spoils and ruins kingdom)
- death cart (ruins kingdom)
- cultist (ruins kingdom)
- hermit (madman kingdom)
- urchin (mercenary kingdom)

## cards yet to implement

### empires

- enchantress - need to replace a cards effects instead of just adding to them
  like we currently can.

### rising sun

- divine-wind (prophecy)

### alchemy

- possession
