import { ExpansionConfiguratorContext } from '@server-types/index.ts';

// Port piles contain 12 copies instead of the usual 10 (Adventures rulebook).
const PORT_PILE_SIZE = 12;

// Pads the Port kingdom pile up to 12 copies. Configurators re-run (fixed-point
// loop at match setup, and mid-game reruns such as Divine Wind), so this must be
// idempotent: it only ever pads up to the target and never appends blindly.
export const configurePortPile = (args: ExpansionConfiguratorContext) => {
  const portSupply = args.config.kingdomSupply.find(supply => supply.name === 'port');
  if (!portSupply || !portSupply.cards.length) {
    return;
  }

  if (portSupply.cards.length >= PORT_PILE_SIZE) {
    return;
  }

  args.loggerService.info(
    `[adventures configurator - configuring port] padding port pile from ${portSupply.cards.length} to ${PORT_PILE_SIZE} copies`,
  );

  // Match match-configurator's `new Array(n).fill(card)` semantics: every copy in a
  // single-card pile shares the same definition object reference.
  const portCard = portSupply.cards[0];
  while (portSupply.cards.length < PORT_PILE_SIZE) {
    portSupply.cards.push(portCard);
  }
};
