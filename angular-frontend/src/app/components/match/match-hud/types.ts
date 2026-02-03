import { CardLikeId, PlayerId } from 'shared/shared-types';

// Mat content can include card-like ids (e.g., boons set aside).
export type MatPlayerContent = Record<PlayerId, { cardIds: CardLikeId[], playerName: string }>;
