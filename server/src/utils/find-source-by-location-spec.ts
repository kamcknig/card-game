import { LocationSpec, Match } from "shared/shared-types.ts";

export function findSourceByLocationSpec(
  spec: { spec: LocationSpec; playerId?: number },
  match: Match,
): number[] | undefined {
  if (spec.spec.location.length > 1) {
    throw new Error("findSourceByLocationSpec can only accept one location");
  }

  if (
    ["playerDecks", "playerHands", "playerDiscards"].includes(
      spec.spec.location[0],
    )
  ) {
    if (isNaN(spec.playerId ?? NaN)) {
      throw new Error(
        "findSourceByLocationSpec with a player spec location needs a player ID",
      );
    }

    switch (spec.spec.location[0]) {
      case "playerDecks":
        return match.playerDecks[spec.playerId!];
      case "playerHands":
        return match.playerHands[spec.playerId!];
      case "playerDiscards":
        return match.playerDiscards[spec.playerId!];
    }
  } else {
    switch (spec.spec.location[0]) {
      case "kingdom":
        return match.kingdom;
      case "supply":
        return match.supply;
      case "trash":
        return match.trash;
      case "playArea":
        return match.playArea;
    }
  }
}
