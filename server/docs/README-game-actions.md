More coming soon hopefully

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