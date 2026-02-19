import { Container, ContainerOptions, Graphics } from 'pixi.js';
import { events, landmarks, projects, ways } from '../../../state/match-logic';
import { Event, Landmark, Project, Way } from 'shared/types';
import { EVENT_WIDTH, STANDARD_GAP } from '../../../core/app-contants';

import { EventCard } from './event-card';
import { LandmarkCard } from './landmark-card';
import { ProjectCard } from './project-card';
import { WayCard } from './way-card';
import { getPixiSceneTheme } from '../../../theme/pixi-theme';

export class OtherCardLikeView extends Container {
  private readonly _pixiTheme = getPixiSceneTheme();
  private background: Graphics = new Graphics({ label: 'background' });
  private cardContainer: Container = new Container({ label: 'cardContainer' });
  private eventContainer: Container = new Container({ label: 'eventContainer' });
  private landmarkContainer: Container = new Container({ label: 'landmarkContainer' });
  private projectContainer: Container = new Container({ label: 'projectContainer' });
  private wayContainer: Container = new Container({ label: 'wayContainer' });
  private currentEvents: readonly Event[] = [];
  private currentLandmarks: readonly Landmark[] = [];
  private currentProjects: readonly Project[] = [];
  private currentWays: readonly Way[] = [];

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

    this.addChild(this.background);

    this.cardContainer.x = STANDARD_GAP;
    this.cardContainer.y = STANDARD_GAP;
    this.cardContainer.addChild(this.eventContainer);
    this.cardContainer.addChild(this.landmarkContainer);
    this.cardContainer.addChild(this.projectContainer);
    this.cardContainer.addChild(this.wayContainer);
    this.addChild(this.cardContainer);

    this.on('removed', () => {
      eventsSub();
      landmarksSub();
      projectsSub();
      waysSub();
    });
  }

  private draw() {
    this.drawEvents(this.currentEvents);
    this.drawLandmarks(this.currentLandmarks);
    this.drawProjects(this.currentProjects);
    this.drawWays(this.currentWays);

    this.background.clear();

    if (
      this.currentEvents.length > 0
      || this.currentLandmarks.length > 0
      || this.currentProjects.length > 0
      || this.currentWays.length > 0
    ) {
      this.background.roundRect(0, 0, this.cardContainer.width + STANDARD_GAP * 2, this.cardContainer.height + STANDARD_GAP * 2, 5);
      this.background.stroke({ color: this._pixiTheme.ui.panelBorder, width: 1.5 });
      this.background.fill({ color: this._pixiTheme.overlay.color, alpha: this._pixiTheme.overlay.mediumAlpha });
    }
  }

  // Draws the event row in the card-like container.
  private drawEvents(events: readonly Event[]) {
    for (const event of events) {
      let cardContainer = this.eventContainer.getChildByLabel(event.cardKey) as EventCard;

      if (!cardContainer) {
        cardContainer = new EventCard({ label: event.cardKey, event });
        cardContainer.x = this.eventContainer.children.length * (EVENT_WIDTH + STANDARD_GAP);
        this.eventContainer.addChild(cardContainer);
      }

      cardContainer.event = event;
    }
    this.eventContainer.y = 0;
  }

  // Draws the landmark row beneath events when present.
  private drawLandmarks(landmarkList: readonly Landmark[]) {
    for (const landmark of landmarkList) {
      let cardContainer = this.landmarkContainer.getChildByLabel(landmark.cardKey) as LandmarkCard;

      if (!cardContainer) {
        cardContainer = new LandmarkCard({ label: landmark.cardKey, landmark });
        cardContainer.x = this.landmarkContainer.children.length * (EVENT_WIDTH + STANDARD_GAP);
        this.landmarkContainer.addChild(cardContainer);
      }

      cardContainer.landmark = landmark;
    }

    this.landmarkContainer.y = this.eventContainer.height > 0
      ? this.eventContainer.height + STANDARD_GAP
      : 0;
  }

  // Draws the project row beneath landmarks when present.
  private drawProjects(projectList: readonly Project[]) {
    for (const project of projectList) {
      let cardContainer = this.projectContainer.getChildByLabel(project.cardKey) as ProjectCard;

      if (!cardContainer) {
        cardContainer = new ProjectCard({ label: project.cardKey, project });
        cardContainer.x = this.projectContainer.children.length * (EVENT_WIDTH + STANDARD_GAP);
        this.projectContainer.addChild(cardContainer);
      }

      cardContainer.project = project;
    }

    const eventRowHeight = this.eventContainer.height > 0
      ? this.eventContainer.height + STANDARD_GAP
      : 0;
    const landmarkRowHeight = this.landmarkContainer.height > 0
      ? this.landmarkContainer.height + STANDARD_GAP
      : 0;
    this.projectContainer.y = eventRowHeight + landmarkRowHeight;
  }

  // Draws the way row beneath projects when present.
  private drawWays(wayList: readonly Way[]) {
    for (const way of wayList) {
      let cardContainer = this.wayContainer.getChildByLabel(way.cardKey) as WayCard;

      if (!cardContainer) {
        cardContainer = new WayCard({ label: way.cardKey, way });
        cardContainer.x = this.wayContainer.children.length * (EVENT_WIDTH + STANDARD_GAP);
        this.wayContainer.addChild(cardContainer);
      }

      cardContainer.way = way;
    }

    const eventRowHeight = this.eventContainer.height > 0
      ? this.eventContainer.height + STANDARD_GAP
      : 0;
    const landmarkRowHeight = this.landmarkContainer.height > 0
      ? this.landmarkContainer.height + STANDARD_GAP
      : 0;
    const projectRowHeight = this.projectContainer.height > 0
      ? this.projectContainer.height + STANDARD_GAP
      : 0;
    this.wayContainer.y = eventRowHeight + landmarkRowHeight + projectRowHeight;
  }
}
