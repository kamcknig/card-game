import {EventEmitter} from 'eventemitter3'
import {GameEvents} from "shared/types";

export const gameEvents = new EventEmitter<GameEvents>();
