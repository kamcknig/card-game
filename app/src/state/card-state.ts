import {map} from "nanostores";
import {Card} from "shared/shared-types";

export const $cardsById = map<Record<number, Card>>({});
