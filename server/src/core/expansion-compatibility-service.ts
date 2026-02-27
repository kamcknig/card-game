import { MatchConfiguration } from 'shared/types/index.ts';
import { LoggerService } from './logger-service.ts';

// Handles expansion compatibility checks during lobby configuration updates.
export class ExpansionCompatibilityService {
  constructor(private readonly loggerService: LoggerService) {}

  // Applies mutual-exclusion rules from newly added expansion config modules.
  public async applyMutualExclusions(currentConfig: MatchConfiguration, nextConfig: MatchConfiguration): Promise<void> {
    const newExpansions = nextConfig.expansions.filter(
      expansion => currentConfig.expansions.findIndex(current => current.name === expansion.name) === -1,
    );

    const expansionsToRemove: string[] = [];

    // Evaluate mutual exclusion rules from each newly selected expansion.
    for (const expansion of newExpansions) {
      const configModule = await this.tryLoadExpansionConfig(expansion.name);

      if (!configModule) {
        this.loggerService.warn(
          `[expansion compatibility] could not find config module for expansion '${expansion.name}'`,
        );
        continue;
      }

      if (!configModule.mutuallyExclusiveExpansions?.length) {
        this.loggerService.debug(
          `[expansion compatibility] module for expansion '${expansion.name}' contains no mutually exclusive expansions`,
        );
        continue;
      }

      this.loggerService.info(
        `[expansion compatibility] '${expansion.name}' is mutually exclusive with ${configModule.mutuallyExclusiveExpansions.join(
          ', ',
        )}`,
      );

      for (const exclusiveExpansionName of configModule.mutuallyExclusiveExpansions) {
        const hasExclusiveExpansion = currentConfig.expansions.some(
          currentExpansion => currentExpansion.name === exclusiveExpansionName,
        );
        if (hasExclusiveExpansion && !expansionsToRemove.includes(exclusiveExpansionName)) {
          this.loggerService.info(
            `[expansion compatibility] removing expansion '${exclusiveExpansionName}' as it is not allowed with '${expansion.name}'`,
          );
          expansionsToRemove.push(exclusiveExpansionName);
        }
      }
    }

    if (!expansionsToRemove.length) {
      return;
    }

    // Enforce mutual exclusion by removing disallowed expansion names from the next config.
    nextConfig.expansions = nextConfig.expansions.filter(expansion => !expansionsToRemove.includes(expansion.name));
  }

  // Loads an expansion configuration module when present.
  private async tryLoadExpansionConfig(
    expansionName: string,
  ): Promise<{ mutuallyExclusiveExpansions?: string[] } | undefined> {
    try {
      return (
        await import(`../expansions/${expansionName}/configuration-${expansionName}.json`, {
          with: { type: 'json' },
        })
      )?.default as { mutuallyExclusiveExpansions?: string[] } | undefined;
    } catch {
      return undefined;
    }
  }
}
