import { Container, ContainerOptions, Graphics } from 'pixi.js';
import { events, landmarks, projects, prophecies, ways } from '../../../state/match-logic';
import { Event, Landmark, Project, Prophecy, Way } from 'shared/types';
import { EVENT_WIDTH, STANDARD_GAP } from '../../../core/app-contants';

import { EventCard } from './event-card';
import { LandmarkCard } from './landmark-card';
import { ProjectCard } from './project-card';
import { ProphecyCard } from './prophecy-card';
import { WayCard } from './way-card';
import { getPixiSceneTheme } from '../../../theme/pixi-theme';
import { createPanelShadowFilter } from './panel-shadow-filter';

const MAX_LANDSCAPE_COLUMNS = 4;

export class OtherCardLikeView extends Container {
  private readonly _pixiTheme = getPixiSceneTheme();
  private background: Graphics = new Graphics({ label: 'background' });
  private cardContainer: Container = new Container({ label: 'cardContainer' });
  private eventContainer: Container = new Container({ label: 'eventContainer' });
  private landmarkContainer: Container = new Container({ label: 'landmarkContainer' });
  private projectContainer: Container = new Container({ label: 'projectContainer' });
  private wayContainer: Container = new Container({ label: 'wayContainer' });
  private prophecyContainer: Container = new Container({ label: 'prophecyContainer' });
  private currentEvents: readonly Event[] = [];
  private currentLandmarks: readonly Landmark[] = [];
  private currentProjects: readonly Project[] = [];
  private currentWays: readonly Way[] = [];
  private currentProphecies: readonly Prophecy[] = [];

  constructor(args: ContainerOptions) {
    super(args);

    const eventsSub = events.subscribe(eventsList => {
      this.currentEvents = eventsList;
      this.draw();
    });
    const landmarksSub = landmarks.subscribe(landmarkList => {
      this.currentLandmarks = landmarkList;
      this.draw();
    });
    const projectsSub = projects.subscribe(projectList => {
      this.currentProjects = projectList;
      this.draw();
    });
    const waysSub = ways.subscribe(wayList => {
      this.currentWays = wayList;
      this.draw();
    });
    const propheciesSub = prophecies.subscribe(prophecyList => {
      this.currentProphecies = prophecyList;
      this.draw();
    });

    this.addChild(this.background);
    // Landscape panel shadow matches other board-area containers.
    this.background.filters = [createPanelShadowFilter()];

    this.cardContainer.x = STANDARD_GAP;
    this.cardContainer.y = STANDARD_GAP;
    this.cardContainer.addChild(this.eventContainer);
    this.cardContainer.addChild(this.landmarkContainer);
    this.cardContainer.addChild(this.projectContainer);
    this.cardContainer.addChild(this.wayContainer);
    this.cardContainer.addChild(this.prophecyContainer);
    this.addChild(this.cardContainer);

    this.on('removed', () => {
      eventsSub();
      landmarksSub();
      projectsSub();
      waysSub();
      propheciesSub();
    });
  }

  private draw() {
    this.drawEvents(this.currentEvents);
    this.drawLandmarks(this.currentLandmarks);
    this.drawProjects(this.currentProjects);
    this.drawWays(this.currentWays);
    this.drawProphecies(this.currentProphecies);
    this.layoutCardLikes();

    this.background.clear();

    if (
      this.currentEvents.length > 0
      || this.currentLandmarks.length > 0
      || this.currentProjects.length > 0
      || this.currentWays.length > 0
      || this.currentProphecies.length > 0
    ) {
      this.background.roundRect(0, 0, this.cardContainer.width + STANDARD_GAP * 2, this.cardContainer.height + STANDARD_GAP * 2, 5);
      this.background.stroke({ color: this._pixiTheme.ui.panelBorder, width: 1.5 });
      this.background.fill({ color: this._pixiTheme.overlay.color, alpha: this._pixiTheme.overlay.mediumAlpha });
    }
  }

  // Draws and syncs the event cards in the landscape container.
  private drawEvents(events: readonly Event[]) {
    this.removeMissingCards(this.eventContainer, events.map(event => event.cardKey));

    for (const event of events) {
      let cardContainer = this.eventContainer.getChildByLabel(event.cardKey) as EventCard;

      if (!cardContainer) {
        cardContainer = new EventCard({ label: event.cardKey, event });
        this.eventContainer.addChild(cardContainer);
      }

      cardContainer.event = event;
    }
  }

  // Draws and syncs the landmark cards in the landscape container.
  private drawLandmarks(landmarkList: readonly Landmark[]) {
    this.removeMissingCards(this.landmarkContainer, landmarkList.map(landmark => landmark.cardKey));

    for (const landmark of landmarkList) {
      let cardContainer = this.landmarkContainer.getChildByLabel(landmark.cardKey) as LandmarkCard;

      if (!cardContainer) {
        cardContainer = new LandmarkCard({ label: landmark.cardKey, landmark });
        this.landmarkContainer.addChild(cardContainer);
      }

      cardContainer.landmark = landmark;
    }
  }

  // Draws and syncs the project cards in the landscape container.
  private drawProjects(projectList: readonly Project[]) {
    this.removeMissingCards(this.projectContainer, projectList.map(project => project.cardKey));

    for (const project of projectList) {
      let cardContainer = this.projectContainer.getChildByLabel(project.cardKey) as ProjectCard;

      if (!cardContainer) {
        cardContainer = new ProjectCard({ label: project.cardKey, project });
        this.projectContainer.addChild(cardContainer);
      }

      cardContainer.project = project;
    }
  }

  // Draws and syncs the way cards in the landscape container.
  private drawWays(wayList: readonly Way[]) {
    this.removeMissingCards(this.wayContainer, wayList.map(way => way.cardKey));

    for (const way of wayList) {
      let cardContainer = this.wayContainer.getChildByLabel(way.cardKey) as WayCard;

      if (!cardContainer) {
        cardContainer = new WayCard({ label: way.cardKey, way });
        this.wayContainer.addChild(cardContainer);
      }

      cardContainer.way = way;
    }
  }

  // Draws and syncs the prophecy cards in the landscape container.
  private drawProphecies(prophecyList: readonly Prophecy[]) {
    this.removeMissingCards(this.prophecyContainer, prophecyList.map(prophecy => prophecy.cardKey));

    for (const prophecy of prophecyList) {
      let cardContainer = this.prophecyContainer.getChildByLabel(prophecy.cardKey) as ProphecyCard;

      if (!cardContainer) {
        cardContainer = new ProphecyCard({ label: prophecy.cardKey, prophecy });
        this.prophecyContainer.addChild(cardContainer);
      }

      cardContainer.prophecy = prophecy;
    }
  }

  // Removes landscape views when their source entries are no longer present.
  private removeMissingCards(cardContainer: Container, cardKeys: readonly string[]) {
    const sourceKeys = new Set(cardKeys);
    for (const child of [...cardContainer.children]) {
      if (!sourceKeys.has(child.label ?? '')) {
        child.removeFromParent();
      }
    }
  }

  // Lays out all landscape cards in a wrapped grid with up to four columns.
  private layoutCardLikes() {
    const allCardLikes = [
      ...this.currentEvents.map(event => this.eventContainer.getChildByLabel(event.cardKey)),
      ...this.currentLandmarks.map(landmark => this.landmarkContainer.getChildByLabel(landmark.cardKey)),
      ...this.currentProjects.map(project => this.projectContainer.getChildByLabel(project.cardKey)),
      ...this.currentWays.map(way => this.wayContainer.getChildByLabel(way.cardKey)),
      ...this.currentProphecies.map(prophecy => this.prophecyContainer.getChildByLabel(prophecy.cardKey))
    ].filter((cardLike): cardLike is Container => cardLike != null);

    const rowHeight = (Math.max(0, ...allCardLikes.map(cardLike => cardLike.height))) + STANDARD_GAP;

    for (const [index, cardLike] of allCardLikes.entries()) {
      const column = index % MAX_LANDSCAPE_COLUMNS;
      const row = Math.floor(index / MAX_LANDSCAPE_COLUMNS);
      cardLike.x = column * (EVENT_WIDTH + STANDARD_GAP);
      cardLike.y = row * rowHeight;
    }
  }
}
