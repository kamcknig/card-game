# randomzier

each kingdom card has a randomizer card which is typcally how a kingdom is chosen. but the randomizer card also gives
you things like the supply's types (action, reaction, etc). Some kingdom piles could have different cards with different
types, but the randomzier is what says what that pile actually is; this also applies to costs of a pile or cards in it.

this can also be used for pile selection instead of using cards.

# Lower priority

- add pre commit to lint and or fmt
- do card-likes (boons, events, landmarks, hexes) actually need their own effect maps? or can they just be added to the
  card effect map that already exists? the effects they perform are no different. having different effect maps then
  hardcodes those effect maps with those names into the core functionality.
- undo turn/steps
- when can't load assets (expansion modules) it still just goes on rather than stopping
- when select card effect happens, the UI needs to remove the play all treasure cards button
- seaside expansion - i haven't built outpost - taking an extra turn. the rules are so incredibly complicated it's jus
  tnot worth it right now.
- adventures expansion - havent' done the mission event as it also takes an extra turn
- alchemy expansion - haven't built possession
- when using overpay feature, you can overpay with potions. this matters for stone mason. don't know how to do the UI
  for this yet, and doesn't seem super important to get done right away
- The wiki for the Spoils card states. I don't have a solution for that and how to prevent yet
- If you play an Ambassador and reveal a Spoils, the Spoils is not returned to the Supply (since it is not in the
  Supply) and other players do not gain Spoils.
- create some sort of "card picking" function or class. The match configurator has an algorithm to get available cards
  to choose to add to the kingdom. expansion configurators do this too such as the Ferryman card, or the Young Witch.
  They need ways to uniformly get available kingdoms.
- cards like throne room and disciple when making cards play multiple time need to stay in play as long as the card they
  played stays in play. so if you throne room a duration, it would say until the duration was gone. same with other
  cards that do the same like band of misfits. this was implemented with royal carriage in adventures expansion though
  it's not great.
- mats need a way to define who can view what cards exist on it e.g., the tavern mat i think all cards are visible to
  all players, but native village and island mat cards face down and can only be viewed by the player that owns the mat
- prosperity has the card that changes curses into a treasure card type, and also gains the effect to gain 1 treasure on
  play. need a way to visually denote this properly. also similar to inheritance in adventures
- missing card abilities [file](../missing-card-abilities.md)
- combine similar log entries like drawing multiple cards, discarding multiple, gaining treasure, etc. discarding could
  be a special case in that only the last discarded card is seen so ordering of when they go to disard could matter
- TokenIds are defined in expansion modules; so they are hard-coded strings in the front-end application. can we share
  them somehow between both
- update usages of `tags` to use a hard-coded list. these will be known tags from cards like young witch that adds a
  "bane" card. then you can add a custom tags property to track more custom ones.
- possible keep the enhanced logging for console logs but switch to a buffered file logger solution later for
  production.
- can the ruins pile be updated to use the newer randomizer and piles?

# Higher priority

- check duration behvavior. the offical rules say this "Additionally, if a Duration card is played extra times by a card
  such as [Throne Room, Scepter, Mastermind, Specialist, Flagship, or Daimyo], that card also stays in play until the
  Duration card is discarded, to track the fact that the Duration card was played extra times." Just make sure cards
  stay in play that need to stay in play. some has already been done, but ensure duration cards from the past before
  something like the nocturne expansion work the same
- Need to look into cards that might prevent movement. An example is the Necromancer card that has this in the official
  faq for it "The restriction on movement only" applies to effects that would have moved the card out of the play area
  if it were played normally, for example, Island will fail to move itself out of the trash and onto your Island Mat,
  although any other effect will still apply, such as moving a card from your hand onto your Island Mat; if a card is
  looking to move a card out of the trash, it may move itself - thus, if you choose to play a Lurker, Graverobber or
  Rogue in the trash, it can gain itself out of the trash as a result.
- boon and hex indicator views need to be displayed. they have been created, but not displayed to the user
  boon-indicator-view and hex-indicator-view
- when a player receives a boon or hex, display a modal with the boon/hex image to show them they got it
- when cards are in zones like set aside or a mat, they can be face up or face down. make sure all players who shoudl be
  able to see cards can see them and all those that can't are not able to
- player disconnection
  - work on the use-case when a player disconnects while waiting on input for that player - when they reconnected they
    need to be asked for their input again
- ui updates
  - need to update app-mat-tab and the visible mat. i've clunked it together for now
- when "waiting on player input" displays, cards are selectable. i played warchest, and while waiting on someone to name
  cards, it showed highlights on cards. don't know if they were selectable
- as noted in the gameplay wiki page here https://wiki.dominionstrategy.com/index.php/Gameplay, create game zones as
  noted. revealed area is a separate zone.
- some mats have rules that indicate cards are moved to the deck at the end of the game before scoring e.g., native
  village mat. others don't like the tavern mat
- there are a lot of reactions that happen where a condition and a trigger query the exact same data. one example is
  [arena](../dominion-docs/expansion-docs/empires/cardlikes/arena.md). I think maybe we can pass some data from the
  condition to the trigger.
- game actions that manipulate the deck can shuffle it rather than shuffling manually in card and card like effects

need to show the context of the kingdom card for something like young witch, and ferryman

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

the rules state that "set aside" cards do not discard. you made that complicated logic for active duration cards. but
you can just use set-aside and then schedule a movecard reaction at the start of next turn, and then they'll be in play
and will be discarded. and the gray effect can be checked by seeing if they are in the play area on the turn they were
played or not

update knights. i used that stupid randomizer. but there is a knights "card" on the dominion wiki. you can still use
randomizer null to remove cards like the individual knights. then you can add a "dummy" "knights" card to the library
json. when this card is picked the expansion configurator can check for that kingdom in the config and replace it with
the individual knight. this will remove the need for the randomizer other than removing cards from it.

empires

- for encampment/plunder, not sure if moving back to a kingdom supply works
- enchantress - need to replace a cards effects instead of just adding to them like we currently can.
