import { PlayerId } from 'shared/shared-types';

export interface FortuneMetadata {
  doubled: Record<PlayerId, boolean>;
}
