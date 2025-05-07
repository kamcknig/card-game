# Lower priority
- undo turn/steps
- when can't load assets (expansion modules) it still just goes on rather than stopping
- when select card effect happens, the UI needs to remove the play all treasure cards button
- seaside expansion - i haven't built outpost - taking an extra turn. the rules are so incredibly complicated it's jus tnot worth it right now.
- alchemy expansion - haven't built possession
- when using overpay feature, you can overpay with potions. this matters for stone mason. don't know how to do
the UI for this yet, and doesn't seem super important to get done right away

# Higher priority

- for overrides like cost overrides, look into rules that are applied based on filters rather than rules placed on every single card
- player disconnection
  - when player disconnects - ask others to vote to continue. leave the player in game, they just skip their turn 
  - work on the use-case when a player disconnects while waiting on input for that player - when they reconnected
they need to be asked for their input again
- organize modules again.
- ui updates
  - need to update app-mat-tab and the visible mat. i've clunked it together for now 

need to show the context of the kingdom card for something like young witch, and ferryman
- dominion.games puts the word "bane" in the type area of the card (but only while it's in the supply)
- it also puts it in the detail view of both the witch and the bane card, when viewing the details of one or the
other, it will show the opposite card smaller next to it


the rules state that "set aside" cards do not discard. you made that complicated logic for active
duration cards. but you can just use set-aside and then schedule a movecard reaction at
the start of next turn, and then they'll be in play and will be discarded. and the gray effect
can be checked by seeing if they are in the play area on the turn they were played or not

you've added a "nonSupplyCards" property to Match via the cornucopia types definitions. This
needs to be searchable in find card utility methods. probably need a way to "register"
searchable zones as a dynamic way to add things like that. when registering you can
register the "store key" that would normally be returned as well. for now i think i'll have
to hard-code searching that new property. maybe this can be done when refactorying the find
methods into find method factories