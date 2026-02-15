import { expansionLibrary } from '../expansion-library.ts';
import { ComputedMatchConfiguration } from 'shared/types/index.ts';
import { ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { registerArtifactEffects } from './artifact-effects-renaissance.ts';
import { renaissanceArtifactKeys, RenaissanceArtifactKey } from './artifact-keys-renaissance.ts';
import { registerRenaissanceTokenDefinitions } from './token-definitions-renaissance.ts';
import { renaissanceTokenIds } from './token-ids-renaissance.ts';

// Maps Renaissance kingdom cards to the artifacts they can grant.
const artifactSourceMap: Record<string, RenaissanceArtifactKey[]> = {
  'border-guard': [renaissanceArtifactKeys.horn, renaissanceArtifactKeys.lantern],
  'flag-bearer': [renaissanceArtifactKeys.flag],
  'swashbuckler': [renaissanceArtifactKeys.treasureChest],
  'treasurer': [renaissanceArtifactKeys.key],
};

// Tracks artifact keys managed by the Renaissance configurator.
const managedArtifactKeys = new Set<string>(Object.values(artifactSourceMap).flat());

const configurator: ExpansionConfiguratorFactory = () => {
  // Track artifact effect registration to avoid duplicates across configurator iterations.
  let artifactEffectsRegistered = false;

  return async (args) => {
    registerRenaissanceTokenDefinitions();
    if (!artifactEffectsRegistered) {
      registerArtifactEffects(args.artifactEffectRegistrar);
      artifactEffectsRegistered = true;
    }

    const kingdomCards = args.config.kingdomSupply.flatMap((supply) => supply.cards);
    const requiredArtifactKeys = new Set<RenaissanceArtifactKey>();

    for (const card of kingdomCards) {
      const pileKey = getCardPileKey(card);
      const artifacts = artifactSourceMap[pileKey];
      if (!artifacts?.length) continue;
      for (const artifactKey of artifacts) {
        requiredArtifactKeys.add(artifactKey);
      }
    }

    const existingArtifacts = args.config.artifacts ?? [];
    const nonManagedArtifacts = existingArtifacts.filter((artifact) => !managedArtifactKeys.has(artifact.cardKey));

    if (requiredArtifactKeys.size < 1) {
      if (existingArtifacts.length !== nonManagedArtifacts.length) {
        console.info('[renaissance configurator] removing artifacts because no source cards are present');
      }
      args.config.artifacts = nonManagedArtifacts;
      return args.config;
    }

    const artifactDefinitions = Array.from(requiredArtifactKeys).flatMap((artifactKey) => {
      const artifact = expansionLibrary['renaissance']?.artifacts?.[artifactKey];
      if (!artifact) {
        console.warn(`[renaissance configurator] missing artifact ${artifactKey}`);
        return [];
      }
      return structuredClone(artifact);
    });

    args.config.artifacts = uniqueByProp([...nonManagedArtifacts, ...artifactDefinitions], 'cardKey');
    return args.config;
  };
};

export default configurator;

export const registerGameEvents: (registrar: GameEventRegistrar, config: ComputedMatchConfiguration) => void = (
  registrar,
  config,
) => {
  registrar('onGameStart', async (args) => {
    const projectCount = config.projects?.length ?? 0;
    if (projectCount < 1) {
      console.debug('[renaissance configurator] no projects configured, skipping cube placement');
      return;
    }

    for (const player of args.match.players) {
      const existingCubes = Object.values(args.match.tokens ?? {}).filter((token) =>
        token.tokenId === renaissanceTokenIds.cube && token.ownerId === player.id
      );
      const cubesToAdd = Math.max(0, projectCount - existingCubes.length);

      if (cubesToAdd < 1) {
        console.debug(
          `[renaissance configurator] player ${player.id} already has ${existingCubes.length} cube token(s)`,
        );
        continue;
      }

      console.info(`[renaissance configurator] adding ${cubesToAdd} cube token(s) for player ${player.id}`);
      for (let i = 0; i < cubesToAdd; i++) {
        await args.runGameActionDelegate('placeToken', {
          tokenId: renaissanceTokenIds.cube,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    }
  });
};
