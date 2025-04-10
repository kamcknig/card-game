import {cardStore} from "../../state/card-state";
import {CardView} from "../../components/match/views/card-view";
import {Card} from "shared/shared-types";
import { isNumber } from 'es-toolkit/compat';

export const createCardView = (cardOrCardId: Card | number) => {
    const actualCard = isNumber(cardOrCardId) ? cardStore.get()[cardOrCardId] : cardOrCardId;
    const c = new CardView(actualCard);
    c.on('removed', () => {
        c.removeAllListeners();
    });
    return c;
}
