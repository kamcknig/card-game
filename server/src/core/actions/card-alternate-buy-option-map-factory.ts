import { CardKey } from 'shared/types/index.ts';
import { CardAlternateBuyOption } from '@server-types/index.ts';

// Stores alternate buy options registered by each card key at expansion-load time.
export const cardAlternateBuyOptionMapFactory: Record<CardKey, CardAlternateBuyOption[]> = {};
