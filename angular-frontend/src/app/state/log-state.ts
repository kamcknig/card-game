import { atom, map } from 'nanostores';
import { LogEntryMessage } from 'shared/shared-types';

export const logEntryIdsStore = atom<number[]>([]);

export const logStore = map<Record<number, LogEntryMessage>>({});
