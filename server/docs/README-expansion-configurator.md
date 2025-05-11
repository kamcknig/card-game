An expansion configurator module should export methods that will be invoked by the system
during specific times of match configuration or possibly even during a match.

# Default export

The default export of a configurator module should be a `ExpansionConfiguratorFactory`.

The method returned by the factory is invoked after the player's have configured the match in the UI and
are ready to start the game. This is after the kingdoms have been selected based on the user-selected 
expansions and any hard-coded or requested kingdoms. It is _before_ the supply cards themselves have been
created. This is where one might add extra cards to the supply such as in response to certain kingdom
cards being selected e.g., Joust, or Marauder

The system will loop over expansion configurators based on what kingdoms are included in the match.
The configurators will run in a loop until no new changes to the match configuration are detected.
This will allow for expansions earlier in the list to react to configuration changes later in the
expansion list.


# Examples

## Adding non-supply cards

Examples of these are Rewards from the Prosperity expansion, or Spoils from the Dark Ages expansions. Cards
here are part of the kingdom but are not part of the supply. They generally cannot be gained except by
specific means through other cards' effects.

These should generally be configured in the `ExpansionConfiguratorFactory`. You can add the kingdom card
data to the match's config under the `nonSupplyCard` and `nonSupplyCardCounts` properties.

Make sure to [create](README-card-data.md) the data correctly when inserting it.

The front-end will need some way to display these cards and because it has all expansions
hard-coded into it for display purposes right now that means we usually tag it. One example
is Spoils from Dark Ages. When the configurator for the expansion adds the card data
to the match configuration, it will add the "spoils" tag and the front-end uses this as a 
filter to display them.