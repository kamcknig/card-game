import { Project, TokenInstance } from 'shared/shared-types';
import { Assets, Container, ContainerOptions, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { displayCardDetail } from './modal/display-card-detail';
import { CardLikeView } from './card-like-view';
import { selectableCardStore } from 'src/app/state/interactive-logic';
import { matchStore } from '../../../state/match-state';
import { CubeTokenView } from './cube-token-view';

export interface ProjectCardArgs {
  project: Project;
}

// Renders a project card-like with optional highlight and cube overlays.
export class ProjectCard extends CardLikeView {
  private readonly _highlight: Graphics = new Graphics({ label: 'highlight' });
  private readonly _costView: Container = new Container({ label: 'costView' });
  private readonly _cubeContainer: Container = new Container({ label: 'cubeContainer' });
  private _project: Project | undefined;
  private _cardImage: Texture | undefined;
  private _cardSprite: Sprite = new Sprite({ label: 'cardSprite' });

  // Update the project sprite when the backing data changes.
  public set project(value: Project) {
    if (this._project?.cardKey === value.cardKey) return;

    this._project = value;
    this._cardImage = Assets.get(`${value.cardKey}-full`);

    if (this._cardImage) {
      this._cardSprite.texture = this._cardImage;
    }

    this.draw();
  }

  // Builds the display objects for the project card.
  constructor({ project, ...args }: ContainerOptions & ProjectCardArgs) {
    super({ ...args, id: project.id });
    this.addChild(this._highlight);
    this.addChild(this._cardSprite);
    this.addChild(this._cubeContainer);
    this.addChild(this._costView);
    this.project = project;

    const selectableCardSub = selectableCardStore.subscribe(() => this.draw());
    const matchSub = matchStore.subscribe(() => this.draw());
    this.on('removed', () => {
      selectableCardSub();
      matchSub();
    });
  }

  private buildCostView(project: Project) {
    this._costView.removeChildren();

    const costBgSprite = Sprite.from(Assets.get('treasure-bg'));
    const maxSide = 32;
    costBgSprite.scale = Math.min(maxSide / costBgSprite.width, maxSide / costBgSprite.height);
    this._costView.addChild(costBgSprite);

    const costText = new Text({
      label: 'costText',
      text: project.cost.treasure ?? 0,
      style: {
        fill: 'black'
      },
      anchor: .5,
    });
    costText.x = Math.floor(costBgSprite.width * .5);
    costText.y = Math.floor(costBgSprite.height * .5);
    this._costView.addChild(costText);

    // Track the next cost element position as we add potion/debt icons.
    let nextCostX = costBgSprite.x + costBgSprite.width + 3;

    if ((project.cost?.potion ?? 0) > 0) {
      const potion = Sprite.from(Assets.get('potion-icon'));
      const potionMaxSide = 32;
      potion.scale = Math.min(potionMaxSide / potion.width, potionMaxSide / potion.height);
      potion.x = nextCostX;
      potion.y = Math.floor(costBgSprite.y + costBgSprite.height - potion.height);
      this._costView.addChild(potion);
      nextCostX = potion.x + potion.width + 3;
    }

    if ((project.cost?.debt ?? 0) > 0) {
      const debt = Sprite.from(Assets.get('debt-icon'));
      const debtMaxSide = 32;
      debt.scale = Math.min(debtMaxSide / debt.width, debtMaxSide / debt.height);
      debt.x = nextCostX;
      debt.y = Math.floor(costBgSprite.y + costBgSprite.height - debt.height);
      this._costView.addChild(debt);

      const debtText = new Text({
        label: 'debtText',
        text: project.cost.debt,
        style: {
          fill: 'black'
        },
        anchor: .5,
      });
      debtText.x = Math.floor(debt.x + debt.width * .5);
      debtText.y = Math.floor(debt.y + debt.height * .5);
      this._costView.addChild(debtText);
    }
  }

  // Supports debug logging and right-click detail view.
  override onPointerdown(event: FederatedPointerEvent) {
    if (this._project) {
      if (event.ctrlKey) {
        console.debug(this._project);
        return;
      }

      if (event.button === 2) {
        void displayCardDetail(this._project);
        return;
      }
    }
  }

  // Draws selection highlights and cube overlays when the project is selectable.
  public draw() {
    this._highlight.clear();

    const selectableCards = selectableCardStore.get();
    if (this._project && selectableCards.includes(this._project.id)) {
      this._highlight
        .roundRect(-3, -3, this._cardSprite.width + 6, this._cardSprite.height + 6, 5)
        .fill(0xffaaaa);
    }

    if (this._project) {
      this.buildCostView(this._project);
      this._costView.x = 2;
      this._costView.y = this._cardSprite.y + this._cardSprite.height - this._costView.height - 5;
      this.drawCubes(this._project);
    }
  }

  // Draws cube tokens that have been placed on this project.
  private drawCubes(project: Project) {
    this._cubeContainer.removeChildren();

    const match = matchStore.get();
    if (!match) return;

    const tokens = Object.values(match.tokens ?? {}) as TokenInstance[];
    const cubeTokens = tokens.filter(token =>
      token.tokenId === 'cube-token' &&
      token.location.type === 'cardLike' &&
      token.location.cardLikeId === project.id
    );

    const playerColorMap = new Map(match.players.map(player => [player.id, player.color]));
    const cubeSize = 16;
    const gap = 6;

    cubeTokens.forEach((token, index) => {
      const playerColor = playerColorMap.get(token.ownerId ?? -1) ?? '#ffffff';
      const cube = new CubeTokenView({
        size: cubeSize,
        color: this.parseColor(playerColor),
      });
      cube.x = 8 + index * (cubeSize + gap);
      cube.y = 8;
      this._cubeContainer.addChild(cube);
    });
  }

  // Parses a hex color string into a numeric color for Pixi.
  private parseColor(color: string): number {
    if (!color) return 0xffffff;
    const normalized = color.replace('#', '');
    return Number.parseInt(normalized, 16);
  }
}
