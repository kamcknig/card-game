# Lower priority
- undo turn/steps
- when can't load assets (expansion modules) it still just goes on rather than stopping
- when select card effect happens, the UI needs to remove the play all treasure cards button
- seaside expansion - i haven't built outpost - taking an extra turn. the rules are so incredibly complicated it's jus tnot worth it right now.
- alchemy expansion - haven't built possession
- when using overpay feature, you can overpay with potions. this matters for stone mason. don't know how to do
the UI for this yet, and doesn't seem super important to get done right away
- The wiki for the Spoils card states. I don't have a solution for that and how to prevent yet
- If you play an Ambassador and reveal a Spoils, the Spoils is not returned to the Supply (since it is not in the Supply) and other players do not gain Spoils.
- create some sort of "card picking" function or class. The match configurator has an algorithm to get
available cards to choose to add to the kingdom. expansion configurators do this too such as the Ferryman card, or the
Young Witch. They need ways to uniformly get available kingdoms.


# Higher priority

- for overrides like cost overrides, look into rules that are applied based on filters rather than rules placed on every single card
- player disconnection
  - when player disconnects - ask others to vote to continue. leave the player in game, they just skip their turn 
  - work on the use-case when a player disconnects while waiting on input for that player - when they reconnected
they need to be asked for their input again
- ui updates
  - need to update app-mat-tab and the visible mat. i've clunked it together for now
- when load bundle on MatchScene fails (add a try/catch maybe) - need to show error screen
- the kingdom property of a Card is set when the card is created in MatchController. I think this should be set
before that point. Maybe on card data creation when loading the expansions. the problem with that is the mixed
kingdoms where cards within a single kingdom might be different; do i allow a optional kingdom property in the card
library json files? and those that are like that will define a kingdom - that kind of stinks to have to remember. we
have the randomizer property now used for selecting the randomized kingdoms that might be in that situation. maybe just
change that to kingdom. and null stays meaning it can't be chosen like rewards, not defined would use the card key,
and defined would use the defined value

need to show the context of the kingdom card for something like young witch, and ferryman
- dominion.games puts the word "bane" in the type area of the card (but only while it's in the supply)
- it also puts it in the detail view of both the witch and the bane card, when viewing the details of one or the
other, it will show the opposite card smaller next to it
- a list follows - could be incomplete?
  - ferryman

the rules state that "set aside" cards do not discard. you made that complicated logic for active
duration cards. but you can just use set-aside and then schedule a movecard reaction at
the start of next turn, and then they'll be in play and will be discarded. and the gray effect
can be checked by seeing if they are in the play area on the turn they were played or not


