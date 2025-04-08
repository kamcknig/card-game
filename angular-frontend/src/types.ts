import { ServerEmitEvents, TurnPhaseOrderValues } from 'shared/shared-types';

export type ClientListenEvents = ServerEmitEvents;
export type ServerEmitEventNames = keyof ServerEmitEvents;
export type ClientListenEventNames = ServerEmitEventNames;

export type CardFacing = 'front' | 'back';
export type CardSize = 'full' | 'half' | 'detail';
export type TurnPhase = typeof TurnPhaseOrderValues[number] | undefined;
