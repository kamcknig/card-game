*More coming soon hopefully*

Game actions defined actions that can be taken to manipulate the state of the game. Examples are

- drawCard
- gainCard
- usePrompt
- ...

Game actions are typically dispatched from a card's effect functions. These functions are provided a action runner
delegate function that can be used to run an action.

```ts
actionRunnerDelegate('actionName', actionArgs)
```

# Defining new actions

An expansion might need to define a new action. One example is the Baker in the Cornucopia and Guilds expansion.
This card adds a new trackable resource, the **Coffer**.

You can optionally extend the `GameActionDefinitionMap` to add typings for your action. The following is an
example that can be added to a "types.ts" file within the expansion's folder. This has given me limited
IDE typings for the actions.

```ts
declare module '../../types' {
  interface GameActionDefinitionMap {
    gainCoffer: (args: { playerId: PlayerId, count: number; }) => Promise<void>;
  }
}
```

## Adding action state changes

First, you will need an [expansion configurator](README-expansion-configurator.md) file.

This module should export an `ExpansionActionRegistry` property named "registerActions". This method
will accept a registration function and a context object as parameters. The registration function is invoked
with the new action name and a function to be used to manipulate the state when that action is performed.

```ts
export const registerActions = (registerFn, { match }) => {
  registerFn('<actionName>', async (args) => {
    // state changes
  })
}
```

In our Coffers example, it might look something like this.

```ts
export const registerActions = (registerFn, { match }) => {
  registerFn('gainCoffers', async (args) => {
    match.coffers[args.playerId] ??= 0;
    match.coffers[args.playerId] += args.count;
  })
}
```

You'll note that it's changing a property named `coffers` on the match. This isn't typically a property available
on a Match instance. You can extend the Match interface by declaring a module in a "types.ts" file in the
expansion directory.

```ts
declare module 'shared/shared-types.ts' {
  interface Match {
    coffers?: Record<PlayerId, number>;
  }
}
```