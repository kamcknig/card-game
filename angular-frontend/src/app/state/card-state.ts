import {map} from "nanostores";
import {Card} from "shared/shared-types";

export const cardStore = map<Record<number, Card>>({});

export const cardOverrideStore = map<Record<string, Partial<Card>>>({});
