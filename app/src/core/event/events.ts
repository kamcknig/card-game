import {EventEmitter} from 'eventemitter3'
import {GameEvents} from "shared/shared-types";

export const gameEvents = new EventEmitter<GameEvents>();
