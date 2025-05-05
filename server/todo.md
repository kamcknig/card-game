# lower priority
- undo turn/steps
- when can't load assets (expansion modules) it still just goes on rather than stopping
- when select card effect happens, the UI needs to remove the play all treasure cards button
- seaside expansion - i haven't built outpost - taking an extra turn. the rules are so incredibly complicated it's jus tnot worth it right now.
- alchemy expansion - haven't built possession

# higher priority

- for overrides like cost overrides, look into rules that are applied based on filters rather than rules placed on every single card
- player disconnection
  - when player disconnects - ask others to vote to continue. leave the player in game, they just skip their turn 
  - work on the use-case when a player disconnects while waiting on input for that player - when they reconnected
they need to be asked for their input again


CORNUCOPIA expansion
- tournament card effects have been built but prizes haven't been implemented. so once prizes are in, then need to add the final effect for tournament for cards like charaltan in prosoperity that change cards need a way to display that change in the UI

need to show the context of the kingdom card for something like young witch
- dominion.games puts the word "bane" in the type area of the card (but only while it's in the supply)
  - it also puts it in the detail view of both the witch and the bane card, when viewing the details of one or the
other, it will show the opposite card smaller next to it