// Single source of truth for the frontend version surfaced in the UI.
// Pulled from package.json so a manual bump (or `yarn version`) keeps the
// runtime display in sync with the released tag without a separate
// generated module. resolveJsonModule is enabled in tsconfig.json, so
// the JSON import is type-checked and tree-shaken to a single string.
import packageJson from '../../../package.json';

export const APP_VERSION: string = (packageJson as { version: string }).version;
