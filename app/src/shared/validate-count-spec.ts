import {CountSpec} from "shared/shared-types";
import { isNumber } from 'es-toolkit/compat';

export const validateCountSpec = (spec: CountSpec, count: number): boolean => {
    if (isNumber(spec)) {
        return count === spec;
    }

    switch (spec.kind) {
        case 'variable':
            return true;
        case 'exact':
            return count === spec.count;
        case 'upTo':
            return count <= spec.count;
        default:
            return false;
    }
}