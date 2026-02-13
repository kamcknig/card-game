import { PlayerId } from 'shared/types/index.ts';

export interface FortuneMetadata {
  doubled: Record<PlayerId, boolean>;
}
