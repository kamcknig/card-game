# Lower priority
- undo turn/steps
- when can't load assets (expansion modules) it still just goes on rather than stopping
- when select card effect happens, the UI needs to remove the play all treasure cards button
- seaside expansion - i haven't built outpost - taking an extra turn. the rules are so incredibly complicated it's jus tnot worth it right now.
- alchemy expansion - haven't built possession
- overpay feature
  - cards that have it show a "+" on the treasure cost icon; but the game prompts the user
so is something like that needed?
- when using overpay feature, you can overpay with potions. this matters for stone mason. don't know how to do
the UI for this yet, and doesn't seem super important to get done right away

# Higher priority

- for overrides like cost overrides, look into rules that are applied based on filters rather than rules placed on every single card
- player disconnection
  - when player disconnects - ask others to vote to continue. leave the player in game, they just skip their turn 
  - work on the use-case when a player disconnects while waiting on input for that player - when they reconnected
they need to be asked for their input again
- need to finish implementation of coffers
  - state, actions, game setup with cards like baker has been completed
  - need to display coffers in the UI
  - using overpay should account for coffers as
  - need UI to exchange coffers for treasure
- overpay from cornucopia and guilds
- organize modules again.


CORNUCOPIA expansion
- joust isn't implemented - it uses 'rewards' - need to figure them out. 

need to show the context of the kingdom card for something like young witch, and ferryman
- dominion.games puts the word "bane" in the type area of the card (but only while it's in the supply)
- it also puts it in the detail view of both the witch and the bane card, when viewing the details of one or the
other, it will show the opposite card smaller next to it

currently working on
 - joust
   - need to create non supply cards at start of game
   - need to display non-supply cards in UI