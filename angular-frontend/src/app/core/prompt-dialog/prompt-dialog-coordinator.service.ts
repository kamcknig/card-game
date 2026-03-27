import { Injectable, computed, signal } from '@angular/core';
import { PlayerId, UserPromptActionArgs, UserPromptKinds } from 'shared/types';
import { ActivePromptRequest, SupportedPromptContent } from './prompt-dialog.types';

@Injectable({
  providedIn: 'root'
})
export class PromptDialogCoordinatorService {
  private _requestId = 0;
  private readonly _activeRequest = signal<ActivePromptRequest | null>(null);
  private _activeResolver: ((result: unknown) => void) | null = null;

  // Current active prompt request consumed by the Angular host component.
  readonly activeRequest = computed(() => this._activeRequest());

  // Returns true when this prompt can be rendered by the Angular host implementation.
  public supportsPrompt(args: UserPromptActionArgs): boolean {
    const content = args.content;
    if (!content) {
      return true;
    }
    return this.isSupportedContent(content);
  }

  // Opens one prompt request and resolves when the host reports a final result.
  public openPrompt(args: UserPromptActionArgs, selfPlayerId: PlayerId): Promise<unknown> {
    const content = args.content;
    if (content && !this.isSupportedContent(content)) {
      return Promise.reject(new Error('[prompt dialog coordinator] unsupported prompt content'));
    }

    if (this._activeRequest()) {
      return Promise.reject(new Error('[prompt dialog coordinator] another prompt is already active'));
    }

    return new Promise((resolve) => {
      this._requestId += 1;
      this._activeResolver = resolve;
      this._activeRequest.set({
        id: this._requestId,
        args: { ...args, content },
        selfPlayerId,
      });
    });
  }

  // Resolves and closes the current prompt with the provided payload.
  public resolveActivePrompt(result: unknown): void {
    const resolver = this._activeResolver;
    this.clearActivePrompt();
    resolver?.(result);
  }

  // Resolves and closes the current prompt with a default cancel response.
  public cancelActivePrompt(): void {
    this.resolveActivePrompt({ action: 0 });
  }

  // Clears active prompt state without resolving a payload.
  public clearActivePrompt(): void {
    this._activeResolver = null;
    this._activeRequest.set(null);
  }

  // Narrows prompt content payloads supported by the Angular prompt host.
  private isSupportedContent(content: UserPromptKinds): content is SupportedPromptContent {
    switch (content.type) {
      case 'select':
      case 'display-cards':
      case 'number-input':
      case 'name-card':
      case 'overpay':
      case 'rearrange':
      case 'blind-rearrange':
      case 'select-pile':
        return true;
      default:
        return false;
    }
  }
}
