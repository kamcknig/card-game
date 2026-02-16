import { Assets, Container, Sprite, Text } from 'pixi.js';

// Displays a hex banner to indicate hexes are active in the match.
export class HexIndicatorView extends Container {
  private readonly _background: Sprite = new Sprite({ label: 'hexBanner' });
  private readonly _label: Text = new Text({
    text: 'HEX',
    label: 'hexLabel',
    style: {
      fontSize: 20,
      fill: 0x2d1b00,
      fontWeight: 'bold',
    },
  });

  constructor() {
    super({ label: 'hexIndicator' });

    this._label.anchor.set(0.5);
    this.addChild(this._background);
    this.addChild(this._label);

    void this.loadBannerTexture();
  }

  // Loads the hex banner texture on demand.
  private async loadBannerTexture() {
    const texture = await Assets.load('/assets/card-images/nocturne/hex-title-bg.png');
    this._background.texture = texture;
    this.layout();
  }

  // Centers the label over the hex banner.
  private layout() {
    this._label.x = Math.floor(this._background.width * 0.5);
    this._label.y = Math.floor(this._background.height * 0.5);
  }
}
