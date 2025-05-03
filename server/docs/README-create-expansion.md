# Creating an expansion

Add the expansion to the [expansion-list.json](../src/expansions/expansion-list.json). This will cause it 
to show up in the match configuration UI's expansion list.

The entry should look like

```json
{
  "title": "Human readable Title",
  "name": "unique-name",
  "order": 2
}
```

## Creating the expansion modules

Create a directory within [expansions](../src/expansions) with the name of `name` used in the above
expansion list json addition. This will hold the expansion's modules.

### Card library (required)

This is a JSON file that describes a list of an expansion's cards and their basic data.

Add a file named "card-library-<expansion-name>.json" within the directory created in the last step.

This file should contain basic card data about the cards in the expansion. The json schema is located
here [card-library-schema.json](../card-library-schema.json). Only cards listed in here will be used
even if they have effects defined. This file is the file that indicates what cards are in the expansion.

### Card effects (required)

This is a TypeScript module that defines the effects the cards have on the game.

Create a file named "card-effects-<expansion-name>.ts" within the expansion's directory.

This file defines the effects for the cards listed in the expansion's library. The interface is
defined as `CardExpansionModule` in [types.ts](../src/types.ts).

See more about [card effects](README-card-effects.md)

### Configurator module (optional)

An expansion's configurator module will define how that expansion modifies a match configuration. Some expansion's
add new behaviors, or based on kingdom cards chosen for the kingdom might add other kingdom cards or trigger other
game behaviors e.g., the Charlatan from Prosperity

