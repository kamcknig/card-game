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
- cards like throne room and disciple when making cards play multiple time need to stay in play as long as the
card they played stays in play. so if you throne room a duration, it would say until the duration was gone. same with
other cards that do the same like band of misfits


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
- when "waiting on player input" displays, cards are selectable. i played warchest, and while waiting on someone to name
cards, it showed highlights on cards. don't know if they were selected

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

the rules state that "set aside" cards do not discard. you made that complicated logic for active
duration cards. but you can just use set-aside and then schedule a movecard reaction at
the start of next turn, and then they'll be in play and will be discarded. and the gray effect
can be checked by seeing if they are in the play area on the turn they were played or not

update knights. i used that stupid randomizer. but there is a knights "card" on the dominion wiki. you can still
use randomizer null to remove cards like the individual knights. then you can add a "dummy" "knights" card to the 
library json. when this card is picked the expansion configurator can check for that kingdom in the config and replace
it with the individual knight. this will remove the need for the randomizer other than removing cards from it.

## Features for Adventures expansion

### Tokens

Coffers are tokens though I think they are a little different than the tokens added in this expansion.

The tokens added here are things like the "+1 action token", "+1 treasure token", etc. 

Token locations can include
- action supply piles e.g., +1 action token, -2 cost token, etc.
- player decks e.g., -1 card token
- in front of player e.g., -1 coin token
- "global" e.g., journey token
- even more e.g., the inheritance event - putting aside a card and the token being "on the card"

Token durations can include
- happening one time e.g., -1 coin token
- permanent/semi-permanent e.g., +1 action token

### Events

Events are "on-buy" effects. They are _not_ cards. Any reference to "cards" such as reducing prices does not apply
to events.

They can be bought during a player's buy phase and cost 1 buy. they can be purchased multiple times in the same
turn by the same player. They count towards the buy rule in that once a buy happens, no further treasures may be played.
because it's not a card, it doesn't trigger effects like haggler (buying a card).

One way to randomize including them in a game is to add them to the randomization process. And once you hit the 10
kingdoms, any that had been chosen up to that point will be included. some recommend not including more than 2 total
in a match - this actually includes landmarks, projects, ways, and traits which aren't developed yet. 

 I think i'll have a checkbox to "use random" to include them or not. if unchecked, use any hardcoded ones by the
configuration, if checked then if preselected ones are less than 2, then in match configurator when getting available
kingdoms, also get available events based on the expansions being used and use the above mentioned process.

### Reserve card type

A new card type

when played, they are put onto the tavern mat (a new mat)

then they will have a trigger to "call" them back for additional effects

calling back is to put them into play. this does not count as "playing" them. for triggering effects. however, they are
now considered in play. calling does not cost an action. you can call a card even if doing so would have no effect

they are discarded during clean up normally on the turn they are called - when they are in play

cards on the tavern mat are included in scoring at end of game

one rule "quirk" - if you play the reserve card at the start of turn via something like way of the turtle (not yet
developed), then you can also immediately react to that start of turn event to call it

### Traveller card type

A new card type

This is a card type that when discarded from play can be exchanged for other cards that are not in the supply. It cannot
happen if the card to exchange for is not in the supply

and exchanged card is not considered gained, nor is the card returned considered trashed. - so maybe a new stats block?

The traveller cards included in this expansion anyway will need something similar to using the randomizer. If the base
traveller card is picked then the other cards available for it to be upgraded are then included in the non-supply
kingdoms.

skipped
- bridge troll
- coin of the realm
- distant lands
- duplicate
- giant
- guide
- hireling
- miser
- page
- peasant
- ranger
- ratcatcher
- relic
- royal carriage