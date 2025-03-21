import {map} from "nanostores";
import {Card} from "shared/types";

export const $cardsById = map<Record<number, Card>>({});
