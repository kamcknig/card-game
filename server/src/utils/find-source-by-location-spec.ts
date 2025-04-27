import { isLocationMat, isLocationZone, LocationSpec, Match } from 'shared/shared-types.ts';

export function findSourceByLocationSpec(
  spec: { spec: LocationSpec; playerId?: number },
  match: Match,
) {
  if (spec.spec.location.length > 1) {
    throw new Error('findSourceByLocationSpec can only accept one location');
  }
  
  if (['playerDecks', 'playerHands', 'playerDiscards'].includes(spec.spec.location[0])) {
    if (isNaN(spec.playerId ?? NaN)) {
      throw new Error('findSourceByLocationSpec with a player spec location needs a player ID');
    }
    
    switch (spec.spec.location[0]) {
      case 'playerDecks':
        return match.playerDecks[spec.playerId!];
      case 'playerHands':
        return match.playerHands[spec.playerId!];
      case 'playerDiscards':
        return match.playerDiscards[spec.playerId!];
    }
  }
  else if (isLocationMat(spec.spec.location[0])) {
    if (isNaN(spec.playerId ?? NaN)) throw new Error('findSourceByLocationSpec requires a player ID with a mat');
    return match.mats[spec.playerId!][spec.spec.location[0]];
  }
  else if (isLocationZone(spec.spec.location[0])) {
    return match.zones[spec.spec.location[0]];
  }
  else {
    switch (spec.spec.location[0]) {
      case 'kingdom':
        return match.kingdomSupply;
      case 'supply':
        return match.basicSupply;
      case 'trash':
        return match.trash;
      case 'playArea':
        return match.playArea;
      case 'activeDuration':
        return match.activeDurationCards;
    }
  }
  
  throw new Error('findSourceByLocationSpec could not find source');
}
