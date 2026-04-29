import { ComputedMatchConfiguration, PlayerId } from 'shared/types/index.ts';
import { EndGamePolicyRegistrar, ExpansionConfiguratorFactory, GameEventRegistrar } from '@server-types/index.ts';
import { uniqueByProp } from '../../core/match-configurator.ts';
import { getCardPileKey } from '../../utils/get-card-pile-key.ts';
import { registerArtifactEffects } from './artifact-effects-renaissance.ts';
import { RenaissanceArtifactKey, renaissanceArtifactKeys } from './artifact-keys-renaissance.ts';
import { registerRenaissanceTokenDefinitions } from './token-definitions-renaissance.ts';
import { renaissanceTokenIds } from './token-ids-renaissance.ts';

// Maps Renaissance kingdoms cards to the artifacts they can grant.
const artifactSourceMap: Record<string, RenaissanceArtifactKey[]> = {
  'border-guard': [renaissanceArtifactKeys.horn, renaissanceArtifactKeys.lantern],
  'flag-bearer': [renaissanceArtifactKeys.flag],
  swashbuckler: [renaissanceArtifactKeys.treasureChest],
  treasurer: [renaissanceArtifactKeys.key],
};

// Tracks artifact keys managed by the Renaissance configurator.
const managedArtifactKeys = new Set<string>(Object.values(artifactSourceMap).flat());

const configurator: ExpansionConfiguratorFactory = () => {
  // Track artifact effect registration to avoid duplicates across configurator iterations.
  let artifactEffectsRegistered = false;

  return async args => {
    registerRenaissanceTokenDefinitions(args.expansionRegistration.registerTokenDefinition);
    if (!artifactEffectsRegistered) {
      registerArtifactEffects(args.expansionRegistration.registerArtifactEffect);
      artifactEffectsRegistered = true;
    }

    const kingdomCards = args.config.kingdomSupply.flatMap(supply => supply.cards);
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
    const nonManagedArtifacts = existingArtifacts.filter(artifact => !managedArtifactKeys.has(artifact.cardKey));

    if (requiredArtifactKeys.size < 1) {
      args.config.artifacts = nonManagedArtifacts;
      return args.config;
    }

    const artifactDefinitions = Array.from(requiredArtifactKeys).flatMap(artifactKey => {
      const artifact = args.expansionCatalog['renaissance']?.artifacts?.[artifactKey];
      if (!artifact) {
        args.loggerService.warn(`[renaissance configurator] missing artifact ${artifactKey}`);
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
  registrar('onGameStartSetup', async args => {
    const projectCount = config.projects?.length ?? 0;
    if (projectCount < 1) {
      args.loggerService.debug('[renaissance configurator] no projects configured, skipping cube placement');
      return;
    }

    for (const player of args.match.players) {
      const existingCubes = Object.values(args.match.tokens ?? {}).filter(
        token => token.tokenId === renaissanceTokenIds.cube && token.ownerId === player.id,
      );
      const cubesToAdd = Math.max(0, projectCount - existingCubes.length);

      if (cubesToAdd < 1) {
        args.loggerService.debug(
          `[renaissance configurator] player ${player.id} already has ${existingCubes.length} cube token(s)`,
        );
        continue;
      }

      for (let i = 0; i < cubesToAdd; i++) {
        await args.actionService.run('placeToken', {
          tokenId: renaissanceTokenIds.cube,
          ownerId: player.id,
          location: { type: 'playerAvailable', playerId: player.id },
        });
      }
    }
  });
};

// Registers Fleet-specific endgame handling as an expansion policy.
export const registerEndGamePolicies = (registrar: EndGamePolicyRegistrar): void => {
  registrar(
    ({ match, endTriggered }) => {
      // Fleet latches game-end state once activated; do not re-evaluate base conditions during Fleet turns.
      if (match.fleetRound.completed) {
        return { decision: 'end_now' };
      }

      if (match.fleetRound.active) {
        return { decision: 'continue' };
      }

      if (!endTriggered) {
        return { decision: 'continue' };
      }

      const fleetProjectId = match.projects.find(project => project.cardKey === 'fleet')?.id;
      if (fleetProjectId === undefined) {
        return { decision: 'end_now' };
      }

      const doesPlayerOwnFleet = (playerId: PlayerId): boolean => {
        return Object.values(match.tokens ?? {}).some(
          token =>
            token.tokenId === renaissanceTokenIds.cube &&
            token.ownerId === playerId &&
            token.location.type === 'cardLike' &&
            token.location.cardLikeId === fleetProjectId,
        );
      };

      const fleetEligiblePlayerIds: PlayerId[] = [];
      for (let offset = 1; offset <= match.players.length; offset++) {
        const playerIndex = (match.currentPlayerTurnIndex + offset) % match.players.length;
        const player = match.players[playerIndex];
        if (!player) continue;
        if (doesPlayerOwnFleet(player.id)) {
          fleetEligiblePlayerIds.push(player.id);
        }
      }

      if (!fleetEligiblePlayerIds.length) {
        return { decision: 'end_now' };
      }

      match.fleetRound.active = true;
      match.fleetRound.completed = false;
      match.fleetRound.eligiblePlayerIdsInOrder = fleetEligiblePlayerIds;
      match.fleetRound.nextFleetPlayerIndex = 0;
      match.fleetRound.endingPlayerId = match.players[match.currentPlayerTurnIndex]?.id;
      match.fleetRound.startedAtTurnNumber = match.turnNumber;

      return { decision: 'defer' };
    },
    { priority: 100 },
  );
};
