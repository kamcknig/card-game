import { CardId, LogEntry, SelectActionCardArgs, ServerEmitEvents, TurnPhaseOrderValues } from 'shared/shared-types';

export type ClientListenEvents = ServerEmitEvents;
export type ServerEmitEventNames = keyof ServerEmitEvents;
export type ClientListenEventNames = ServerEmitEventNames;
export type SelectCardArgs = SelectActionCardArgs & {
  selectableCardIds: CardId[];
}
export type LogEntryMessage = LogEntry & { message: string; id: number; };

export type CardFacing = 'front' | 'back';
export type CardSize = 'full' | 'half' | 'detail';
export type TurnPhase = typeof TurnPhaseOrderValues[number] | undefined;
