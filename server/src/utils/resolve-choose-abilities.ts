import { CardEffectFunctionContext } from '@server-types/index.ts';

// One choose-list option with a UI label and its resolver callback.
export type ChooseAbilityOption = {
  action: number;
  label: string;
  resolve: () => Promise<void>;
};

type ResolveChooseAbilitiesArgs = {
  context: Pick<CardEffectFunctionContext, 'cardId' | 'playerId' | 'promptService' | 'loggerService' | 'reactionContext'>;
  logTag: string;
  prompt?: string;
  options: ChooseAbilityOption[];
  baseChoiceCount: number;
  allowOptionalExtraChoice?: boolean;
};

// Resolves "Choose one / Choose two" ability lists with optional additional choices from context modifiers.
export const resolveChooseAbilities = async (args: ResolveChooseAbilitiesArgs): Promise<number[]> => {
  const prompt = args.prompt ?? 'Choose one';
  const allowOptionalExtraChoice = args.allowOptionalExtraChoice ?? true;
  const optionCount = args.options.length;
  if (optionCount < 1) {
    args.context.loggerService.debug(`[${args.logTag}] no options to choose from`);
    return [];
  }

  // Choice modifiers can grant optional additional different choices for this card play.
  const additionalChoiceBonus = Math.max(
    0,
    args.context.reactionContext?.chooseAbilityModifiersByCardId?.[args.context.cardId]?.additionalChoices ?? 0,
  );
  const mandatoryChoiceCount = Math.max(0, Math.min(args.baseChoiceCount, optionCount));
  const maxExtraChoiceCount = Math.max(0, Math.min(additionalChoiceBonus, optionCount - mandatoryChoiceCount));

  args.context.loggerService.debug(
    `[${args.logTag}] resolving choose list mandatory=${mandatoryChoiceCount} extra=${maxExtraChoiceCount}`,
  );

  const selectedActions: number[] = [];
  const remainingOptions = [...args.options];
  for (let i = 0; i < mandatoryChoiceCount; i++) {
    const selectedAction = await args.context.promptService.requestAction({
      playerId: args.context.playerId,
      prompt,
      actionButtons: remainingOptions.map((option) => ({ label: option.label, action: option.action })),
    });

    const selectedOption = remainingOptions.find((option) => option.action === selectedAction) ?? remainingOptions[0];
    if (!selectedOption) {
      break;
    }

    selectedActions.push(selectedOption.action);
    const selectedOptionIndex = remainingOptions.findIndex((option) => option.action === selectedOption.action);
    if (selectedOptionIndex >= 0) {
      remainingOptions.splice(selectedOptionIndex, 1);
    }
    args.context.loggerService.debug(`[${args.logTag}] selected mandatory option '${selectedOption.label}'`);
  }

  if (allowOptionalExtraChoice) {
    for (let i = 0; i < maxExtraChoiceCount && remainingOptions.length > 0; i++) {
      const selectedAction = await args.context.promptService.requestAction({
        playerId: args.context.playerId,
        prompt: 'You may choose an extra option',
        actionButtons: [
          { label: 'NO EXTRA OPTION', action: 0 },
          ...remainingOptions.map((option) => ({ label: option.label, action: option.action })),
        ],
      });

      if (selectedAction === null || selectedAction === 0) {
        args.context.loggerService.debug(`[${args.logTag}] player declined extra option`);
        break;
      }

      const selectedOption = remainingOptions.find((option) => option.action === selectedAction);
      if (!selectedOption) {
        args.context.loggerService.warn(`[${args.logTag}] selected extra option is invalid, skipping`);
        continue;
      }

      selectedActions.push(selectedOption.action);
      const selectedOptionIndex = remainingOptions.findIndex((option) => option.action === selectedOption.action);
      remainingOptions.splice(selectedOptionIndex, 1);
      args.context.loggerService.debug(`[${args.logTag}] selected extra option '${selectedOption.label}'`);
    }
  }

  // Resolve selected effects in printed option order, not pick order.
  const selectedSet = new Set(selectedActions);
  const selectedOptionsInTextOrder = args.options.filter((option) => selectedSet.has(option.action));
  for (const selectedOption of selectedOptionsInTextOrder) {
    args.context.loggerService.debug(`[${args.logTag}] resolving option '${selectedOption.label}'`);
    await selectedOption.resolve();
  }

  return selectedOptionsInTextOrder.map((option) => option.action);
};
