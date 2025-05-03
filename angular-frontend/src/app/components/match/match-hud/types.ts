import { CardId, PlayerId } from 'shared/shared-types';

export type MatPlayerContent = Record<PlayerId, { cardIds: CardId[], playerName: string }>;
