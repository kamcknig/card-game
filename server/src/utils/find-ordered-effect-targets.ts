import {EffectTarget} from "shared/shared-types.ts";
import { isNull } from 'es-toolkit';
import {Match} from "shared/shared-types.ts";
import { EffectExceptionSpec } from '../types.ts';

export const findOrderedEffectTargets =
    (currentPlayerTurnId: number, target: EffectTarget, match: Match, exception?: EffectExceptionSpec): number[] => {
        console.log('findEffectTargetIds current player', currentPlayerTurnId, 'target', target, 'exception', exception);

        const otherCountRegExResult = /(\d+)_OTHER/.exec(target);
        let otherCount;
        if (!isNull(otherCountRegExResult)) {
            target = 'X_OTHER';
            otherCount = otherCountRegExResult[1];
            console.log('X_OTHER count', otherCount);
        }

        let result = [];
        const currentTurnOrder = match.players;

        switch (target) {
            case 'ALL': {
                console.log('find targets for ALL');
                const startIndex = currentTurnOrder.findIndex(player => player.id === currentPlayerTurnId);
                const l = currentTurnOrder.length;
                for (let i = 0; i < l; i++) {
                    const idx = (startIndex + i) % currentTurnOrder.length;
                    result.push(currentTurnOrder[idx]);
                }
                console.log('target players in order starting from current player', result);
                break;
            }
            case 'ANY':
                console.error('find targets for ANY not implemented');
                return [1];
            case 'ALL_OTHER': {
                console.log('find targets for ALL_OTHER');
                const startIndex = currentTurnOrder.findIndex(player => player.id === currentPlayerTurnId);
                const turnOrder = currentTurnOrder.filter(player => player.id !== currentPlayerTurnId);

                const l = turnOrder.length;
                for (let i = 0; i < l; i++) {
                    const idx = (startIndex + i) % turnOrder.length;
                    result.push(turnOrder[idx]);
                }
                console.log('target players in order starting from current player', result);
                break;
            }
            case 'X_OTHER':
                console.error('find targets for X_OTHER not implemented');
                result = [];
                break;
            default:
                result = [];
                break;
        }

        if (exception?.kind === 'player') {
            result = result.filter(player => !exception.playerIds.includes(player.id));
        }

        return result.map(player => player.id);
    }