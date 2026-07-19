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

  private readonly _displayRequest = signal<ActivePromptRequest | null>(null);
  private _displayResolver: ((result: unknown) => void) | null = null;

  // Current active prompt request consumed by the Angular host component.
  readonly activeRequest = computed(() => this._activeRequest());

  // Display-only prompt (boon/hex reveal, card showcase) consumed by the
  // host component; renders in parallel with (beneath) the interactive
  // prompt and stays open until the player closes it.
  readonly displayRequest = computed(() => this._displayRequest());

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

    if ((args.waitForInput ?? true) === false) {
      // Display-only prompts get their own slot so they never block (or get
      // dismissed by) interactive prompts — the server sends a boon's own
      // choice prompt immediately after the reveal, and the reveal must stay
      // open until the player closes it. One display slot: a newer display
      // prompt replaces an unclosed older one (resolving its floating
      // promise so no await leaks).
      this._displayResolver?.({ action: 0 });
      return new Promise((resolve) => {
        this._requestId += 1;
        this._displayResolver = resolve;
        this._displayRequest.set({
          id: this._requestId,
          args: { ...args, content },
          selfPlayerId,
        });
      });
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

  // Closes the display-only prompt (its close button / match teardown).
  public dismissDisplayPrompt(): void {
    const resolver = this._displayResolver;
    this._displayResolver = null;
    this._displayRequest.set(null);
    resolver?.({ action: 0 });
  }

  // Clears active prompt state without resolving a payload.
  public clearActivePrompt(): void {
    this._activeResolver = null;
    this._activeRequest.set(null);
    // Match teardown / undo abort must not leave a stale reveal open either.
    this._displayResolver = null;
    this._displayRequest.set(null);
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
