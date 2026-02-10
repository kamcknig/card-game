import { expansionLibrary } from '../expansion-library.ts';
import { ExpansionConfiguratorFactory } from '../../types.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { registerArtifactEffects } from './artifact-effects-renaissance.ts';

// Maps Renaissance kingdom cards to the artifacts they can grant.
const artifactSourceMap: Record<string, string[]> = {
  'border-guard': ['horn', 'lantern'],
  'flag-bearer': ['flag'],
  'swashbuckler': ['treasure-chest'],
  'treasurer': ['key'],
};

// Tracks artifact keys managed by the Renaissance configurator.
const managedArtifactKeys = new Set(Object.values(artifactSourceMap).flat());

const configurator: ExpansionConfiguratorFactory = () => {
  // Track artifact effect registration to avoid duplicates across configurator iterations.
  let artifactEffectsRegistered = false;

  return async (args) => {
    if (!artifactEffectsRegistered) {
      registerArtifactEffects(args.artifactEffectRegistrar);
      artifactEffectsRegistered = true;
    }

    const kingdomCards = args.config.kingdomSupply.flatMap(supply => supply.cards);
    const requiredArtifactKeys = new Set<string>();

    for (const card of kingdomCards) {
      const pileKey = getCardPileKey(card);
      const artifacts = artifactSourceMap[pileKey];
      if (!artifacts?.length) continue;
      for (const artifactKey of artifacts) {
        requiredArtifactKeys.add(artifactKey);
      }
    }

    const existingArtifacts = args.config.artifacts ?? [];
    const nonManagedArtifacts = existingArtifacts.filter(artifact => !managedArtifactKeys.has(artifact.cardKey));

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
