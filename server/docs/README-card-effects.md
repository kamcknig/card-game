Card effects define how a card affects the state of the game. They are somewhat declarative in that they
don't mutate state themselves. They dispatch "game actions" which the engine will interpret and mutate
state. See more about [game actions](README-game-actions.md)

A card's effects generally take place when the card is played. These "card played" effects are defined in
the `registerEffects` factory method of the expansion's card effects module. The resulting functions
are invoked when the card is played. The card has access to the current state, and other
core systems to perform actions such as prompting the user for input or to dispatch game actions to change the state. 