import {
  Artifact,
  ArtifactNoId,
  Boon,
  BoonNoId,
  Card,
  CardKey,
  CardNoId,
  Event,
  EventNoId,
  Hex,
  HexNoId,
  Landmark,
  LandmarkNoId,
  Project,
  ProjectNoId,
  State,
  StateNoId,
  Way,
  WayNoId,
} from 'shared/types/index.ts';
import { formatCardName } from '../utils/format-card-name.ts';
import { ExpansionCatalogService } from './expansion-catalog-service.ts';

// Creates all card/card-like match instances with a single id sequence per match scope.
export class CardInstanceFactoryService {
  private _cardCount = 0;

  constructor(
    private readonly expansionCatalogService: ExpansionCatalogService,
  ) {}

  // Rehydrates a card instance while preserving its existing id.
  public rehydrateCard(card: Card): Card {
    return new Card({ ...card });
  }

  // Creates a supply/non-supply card instance.
  public createCard(cardKey: CardKey, card?: Partial<CardNoId>): Card {
    const rawCardLibrary = this.expansionCatalogService.getRawCardLibrary();
    const baseCardData = rawCardLibrary[cardKey] ?? {};
    return new Card({
      ...baseCardData,
      cardKey: cardKey,
      cardName: baseCardData.cardName ?? formatCardName(cardKey),
      ...card ?? {},
      id: ++this._cardCount,
    });
  }

  // Creates an event instance.
  public createEvent(event: EventNoId): Event {
    return new Event({
      ...event,
      id: ++this._cardCount,
    });
  }

  // Creates a boon instance.
  public createBoon(boon: BoonNoId): Boon {
    return new Boon({
      ...boon,
      id: ++this._cardCount,
    });
  }

  // Creates a hex instance.
  public createHex(hex: HexNoId): Hex {
    return new Hex({
      ...hex,
      id: ++this._cardCount,
    });
  }

  // Creates a landmark instance.
  public createLandmark(landmark: LandmarkNoId): Landmark {
    return new Landmark({
      ...landmark,
      id: ++this._cardCount,
    });
  }

  // Creates a project instance.
  public createProject(project: ProjectNoId): Project {
    return new Project({
      ...project,
      id: ++this._cardCount,
    });
  }

  // Creates a way instance.
  public createWay(way: WayNoId): Way {
    return new Way({
      ...way,
      id: ++this._cardCount,
    });
  }

  // Creates a state instance.
  public createState(state: StateNoId): State {
    return new State({
      ...state,
      id: ++this._cardCount,
    });
  }

  // Creates an artifact instance.
  public createArtifact(artifact: ArtifactNoId): Artifact {
    return new Artifact({
      ...artifact,
      id: ++this._cardCount,
    });
  }
}
