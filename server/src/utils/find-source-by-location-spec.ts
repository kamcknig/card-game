import { CardLocation, isLocationMat, Match } from 'shared/shared-types.ts';

export function findSourceByLocationSpec(args: {
  location: CardLocation,
  playerId?: number,
  match: Match,
}) {
  const { location, playerId, match } = args;
  if (['playerDecks', 'playerHands', 'playerDiscards'].includes(location)) {
    if (isNaN(playerId ?? NaN)) {
      throw new Error('findSourceByLocationSpec with a player spec location needs a player ID');
    }
    
    switch (location) {
      case 'playerDecks':
        return match.playerDecks[playerId!];
      case 'playerHands':
        return match.playerHands[playerId!];
      case 'playerDiscards':
        return match.playerDiscards[playerId!];
    }
  }
  else if (isLocationMat(location)) {
    if (isNaN(playerId ?? NaN)) throw new Error('findSourceByLocationSpec requires a player ID with a mat');
    return match.mats[playerId!][location];
  }
  else {
    switch (location) {
      case 'kingdomSupply':
        return match.kingdomSupply;
      case 'basicSupply':
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
