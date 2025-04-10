import { List } from "@pixi/ui";

export class AppList extends List {
  override arrangeChildren() {
    super.arrangeChildren();

    const h = this.height;
    const w = this.width;

    for (const child of this.children) {
      if (this.type === 'horizontal') {
        child.y = Math.floor(h * .5 - child.height * .5);
      } else if (this.type === 'vertical') {
        child.x = Math.floor(w * .5 - child.width * .5);
      }
    }
  }
}
