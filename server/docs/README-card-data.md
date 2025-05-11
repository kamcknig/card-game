When an expansion is first loaded when the server starts up, that data is stored in
global object `rawExpansionCardLibrary`. This data _should_ remain pristine and never
change unless the expansion is reloaded. Currently, that only happens when the server
restarts.

The data inserted into this library includes some data derived from the json that holds
an expansion's card data. So take care when [configuring](README-expansion-configurator.md)
a Match and adding new cards to the Match that you properly create the card data e.g.,
with the built-in card data [creator method](../src/utils/create-card-data.ts) which
will properly populate things like image paths.

When a Match is created, the Match has a MatchCardLibrary instance associated with it.
This holds the card library specific to the Match; any cards that are included and used
within that Match.