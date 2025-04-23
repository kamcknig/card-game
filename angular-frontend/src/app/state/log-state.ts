import { atom, map } from 'nanostores';
import { LogEntryMessage } from '../../types';

export const logEntryIdsStore = atom<number[]>([]);

export const logStore = map<Record<number, LogEntryMessage>>({});
