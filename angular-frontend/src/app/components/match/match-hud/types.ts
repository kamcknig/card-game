import { CardLikeId, PlayerId } from 'shared/types/index.ts';

// Mat content can include card-like ids (e.g., boons set aside).
export type MatPlayerContent = Record<PlayerId, { cardIds: CardLikeId[], playerName: string }>;
