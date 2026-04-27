# Dominion Clone — Design Guidelines for Claude Code

**Repo:** `kamcknig/card-game` · **Frontend:** `angular-frontend/src/`

> Keep this document up to date whenever a design decision changes — token names, color values, new component patterns, etc.

## Typography

Three Google Fonts, loaded via CDN `<link>` in `index.html`:

| Font | CSS token | Role | Weights |
|---|---|---|---|
| **Cinzel** | `var(--theme-font-display)` | Display — h1–h4, section titles, panel titles, primary button labels, banner title, place badges, stat labels | 500, 600, 700 |
| **Source Sans 3** | `var(--theme-font-body)` | Body — paragraphs, inputs, labels, player names, card names, menus, secondary buttons, meta text. **Default for everything.** | 400, 500, 600, 700 |
| **Lora** (italic) | `var(--theme-font-accent)` | Accent — **game log only** (`<app-game-log>`). Nowhere else. Narrator voice. | 400, 500, italic 400 |

**Decision rule:** title/ceremony → Cinzel · body text the user reads/types → Source Sans 3 · game-event narrator in the log → Lora italic.

**Never** use hardcoded font-family strings. Always use `var(--theme-font-display)`, `var(--theme-font-body)`, or `var(--theme-font-accent)`.

Cinzel headings should use `letter-spacing: 0.04em–0.12em` and often `text-transform: uppercase`.

## Theming

The app supports **Light**, **Dark**, and **Auto** (OS preference) themes.

- Theme state is owned by `ThemeService` (`src/app/core/theme.service.ts`), which writes `data-theme="light"|"dark"` on `<html>`.
- A flash-prevention `<script>` in `index.html` reads `localStorage('dominion-theme')` before Angular boots.
- All colors MUST use CSS custom properties (tokens). **Never hardcode hex colors in component SCSS.**
- Theme toggle component: `<app-theme-toggle>` (standalone, lives in shared or ui folder).
- Dark theme overrides live under `:root[data-theme="dark"]` in `app-theme.scss`.

## Design Tokens

All tokens are defined in `src/app/theme/app-theme.scss` on `:root` (light) with `:root[data-theme="dark"]` overrides.

**CRITICAL: All tokens use the `--theme-` prefix.** Never use unprefixed token names. The only exceptions are card dimension tokens (`--card-width`, `--card-height`, etc.).

### Surfaces
| Token | Light | Dark | Use |
|---|---|---|---|
| `--theme-surface-app-start` | `#efe7da` | `#1a1714` | App gradient start |
| `--theme-surface-app-end` | `#e4d7c1` | `#231f1a` | App gradient end |
| `--theme-surface-header` | `#c1a277` | `#3d3226` | Header bar |
| `--theme-surface-nav` | `#e6dac6` | `#231f1a` | Navigation sidebar |
| `--theme-surface-panel` | `#e8d8c1` | `#2c2620` | Panel backgrounds |
| `--theme-surface-card` | `#f2e9da` | `#342d25` | Card/row backgrounds |
| `--theme-surface-danger-soft` | `#f9dfd8` | `#4a2620` | Danger background |
| `--theme-surface-count-badge` | `#aaaaaa` | `#5a4e3e` | Count badge bg |

### Text
| Token | Light | Dark |
|---|---|---|
| `--theme-text-primary` | `#2a241a` | `#e8dfd2` |
| `--theme-text-secondary` | `#544630` | `#a99b87` |
| `--theme-text-tertiary` | `#7a6a55` | `#7a6e5e` |
| `--theme-text-on-dark` | `#ffffff` | (same) |
| `--theme-text-disabled` | `#6b6153` | `#6b6153` |
| `--theme-text-banner` | `#6b5033` | `#d4b679` |
| `--theme-text-banner-subtitle` | `#7a5d3d` | `#b8a077` |
| `--theme-text-banner-shadow-main` | `#1a3650` | `#000000` |
| `--theme-text-banner-shadow-glow` | `rgba(12,34,52,0.8)` | `rgba(0,0,0,0.9)` |

### Borders
| Token | Light | Dark |
|---|---|---|
| `--theme-border-subtle` | `#bca98d` | `#3d3429` |
| `--theme-border-medium` | `#9e8b72` | `#5a4e3e` |
| `--theme-border-section-light` | `#c8b798` | `#4a3f32` |
| `--theme-border-strong` | `#7f6746` | `#8b7a62` |
| `--theme-border-action` | `#826a48` | `#6b5d48` |
| `--theme-border-danger` | `#b84d38` | `#c45a42` |
| `--theme-border-disabled` | `#a99981` | `#4a4238` |

### Interactive / Action
| Token | Light | Dark |
|---|---|---|
| `--theme-action-secondary-bg` | `#f4ecde` | `#2c2620` |
| `--theme-action-nav-selected-bg` | `#dbc39a` | `#4a3f32` |
| `--theme-action-primary-bg` | `#dcc093` | `#5a4e3e` |
| `--theme-action-primary-muted-bg` | `#e1c89e` | `#453b2e` |
| `--theme-action-danger-soft-bg` | `#f0cbcb` | `#5a2e25` |
| `--theme-action-disabled-bg` | `#d8d0c2` | `#2a251f` |
| `--theme-action-disabled-opacity` | `0.65` | (same) |

### Overlays
| Token | Light | Dark |
|---|---|---|
| `--theme-overlay-color` | `#000000` | (same) |
| `--theme-overlay-alpha-soft` | `0.5` | (same) |
| `--theme-overlay-alpha-medium` | `0.6` | (same) |
| `--theme-overlay-alpha-strong` | `0.8` | (same) |
| `--theme-panel-bg` | `rgba(0,0,0, var(--theme-overlay-alpha-medium))` | (same) |

### Card Type / Source Colors (shared across themes unless dark-overridden)
| Token | Light | Dark (if different) |
|---|---|---|
| `--theme-color-source-default` | `#ffffff` | `#f0e8dc` |
| `--theme-color-source-treasure` | `#fdda56` | `#e6c54a` |
| `--theme-color-source-victory` | `#8efb49` | `#6fa84a` |
| `--theme-color-source-curse` | `#d45ffb` | `#b054d4` |
| `--theme-color-source-duration` | `#ff8d34` | `#d97a2c` |
| `--theme-color-source-event` | `#ffe0a8` | — |
| `--theme-color-source-landmark` | `#ffd09d` | — |
| `--theme-color-source-project` | `#b6f1ad` | — |
| `--theme-color-way` | `#9fc6ff` | — |
| `--theme-color-source-boon` | `#a4f0ff` | — |
| `--theme-color-source-hex` | `#f2a9ff` | — |
| `--theme-color-source-state` | `#c4d4ff` | — |
| `--theme-color-source-artifact` | `#ffdca8` | — |

### Status Colors
| Token | Light | Dark | Use |
|---|---|---|---|
| `--theme-color-ready` | `#2e7d32` | `var(--theme-color-source-victory)` | Ready/success state indicators |

### Card Dimensions (no `--theme-` prefix)
| Token | Value |
|---|---|
| `--card-width` | `150px` |
| `--card-height` | `240px` |
| `--card-small-height` | `150px` |
| `--card-landscape-width` | `280px` |
| `--card-landscape-height` | `124px` |

## Component Patterns

### App Background
Always use the gradient: `background: linear-gradient(150deg, var(--theme-surface-app-start) 0%, var(--theme-surface-app-end) 100%)`.

### Buttons

Form-screen buttons (login, lobby, profile, etc.) use the four shared classes
defined globally in `angular-frontend/src/styles.scss`. Apply `.btn` plus one
variant; do **not** re-implement the recipe in component SCSS. Layout-only
properties (margin, width, parent flex gap) stay local.

| Class | Use when |
|---|---|
| `.btn .btn-primary` | The main submit on a screen — Login, Create account, Save, Confirm. One per visual group. |
| `.btn .btn-primary-muted` | A secondary primary action paired with a primary one (e.g. lobby Join row), or a single primary on a low-emphasis surface. Same visual weight as Primary, less saturated. |
| `.btn .btn-secondary` | The non-primary submit on a form (e.g. Cancel paired with Save). Transparent fill — recedes against the surface so the primary leads the eye. |
| `.btn .btn-danger` | A destructive confirmation that needs to read as risky (delete, ban, resign). |

The `.btn` base class supplies the shared shape (radius, padding, display
font, uppercase, letter-spacing, transition, focus-visible, disabled). The
variant class supplies the visual identity (border color, background, text
color). Hover states are encoded on the variant where it matters (`.btn-secondary`
darkens on hover; the others rely on background change via override).

**Do not** use `--theme-action-secondary-bg` directly for form submit buttons —
it is a hover/nav fill, not a button variant. The historical "Secondary"
recipe that used it has been replaced by `.btn-secondary` above.

**Disabled state** (built into `.btn`): `opacity: 0.6; cursor: not-allowed`.
Stronger fade (`saturate(0.45)`) is reserved for in-game interactive buttons
that need to look noticeably "off" mid-flow — keep the simpler form recipe
unless there's a reason.

Dialog footer buttons use a different, tighter scale documented in the
[Dialogs / Modals](#dialogs--modals) section below — those have their own
component-local classes for now.

### Inputs
- `background: var(--theme-surface-panel)`, `border: 1px solid var(--theme-border-action)`, `border-radius: 6px`.
- Focus: `border-color: var(--theme-border-strong); box-shadow: 0 0 0 2px rgba(130,106,72,0.2)`.
- Shared classes: `.form-field`, `.form-label`, `.form-input`, `.form-input-wrapper`, `.form-input-toggle`, `.form-field-error` are defined globally in `styles.scss`.

### Cards / Rows
- `background: var(--theme-surface-card)`, `border: 1px solid var(--theme-border-subtle)`, `border-radius: 8px`.
- Hover (lobby rows): `border-color: var(--theme-border-action); transform: translateY(-1px)`.

### Section Titles
- `font-family: var(--theme-font-display); font-size: 0.9–1rem; font-weight: 600; letter-spacing: 0.08–0.12em; text-transform: uppercase; color: var(--theme-text-secondary)`.

### Config Sections
- `border: 1px solid var(--theme-border-section-light)`, `border-radius: 8px`.

### Scene Banner
- Banner header: `background: var(--theme-surface-header)`, `border-bottom: 1px solid var(--theme-border-strong)`.
- Title: Cinzel 700, uppercase, `letter-spacing: 0.08–0.12em`, with text-shadow using `var(--theme-text-banner-shadow-main)` and `var(--theme-text-banner-shadow-glow)`.
- Actions row: absolute top-right, contains theme toggle + profile menu.

### Overlay Panels (match HUD, modals)
- `background: rgba(0, 0, 0, var(--theme-overlay-alpha-strong))`.
- `color: var(--theme-text-on-dark)`.
- `border: 1px solid var(--theme-border-strong)`.

### Dialogs / Modals

Dialogs are centered overlay panels used for card selection, confirmation prompts, settings, etc.

**Backdrop:**
- `position: fixed; inset: 0; z-index: 100`
- `background: rgba(0, 0, 0, var(--theme-overlay-alpha-medium))` (0.6)
- `display: flex; align-items: center; justify-content: center`
- Click on backdrop dismisses the dialog (same as Cancel)

**Dialog container:**
- `background: var(--theme-surface-panel)` — `#2c2620` dark / `#e8d8c1` light
- `border-radius: 12px`
- `border: 1px solid var(--theme-border-medium)`
- `box-shadow: 0 12px 48px rgba(0,0,0,0.5)` dark / `0 8px 32px rgba(0,0,0,0.2)` light
- `display: flex; flex-direction: column; overflow: hidden`
- Max dimensions: constrain to viewport with padding, e.g. `max-height: calc(100vh - 80px); max-width: calc(100vw - 40px)`

**Header:**
- `padding: 16px 20px; border-bottom: 1px solid var(--theme-border-subtle)`
- `display: flex; align-items: center`
- Title: `font-family: var(--theme-font-display); font-size: 15–16px; font-weight: 600; letter-spacing: 0.06–0.08em; text-transform: uppercase; color: var(--theme-text-primary)`
- Close button (right-aligned): `background: none; border: none; color: var(--theme-text-tertiary); font-size: 22px; cursor: pointer; line-height: 1`
- Optional subtitle / count badge: `font-size: 12–13px; color: var(--theme-text-secondary)`

**Scrollable body:**
- `flex: 1; overflow-y: auto; padding: 16px 20px`
- Scrollbar should be thin and subtle; use `scrollbar-width: thin` or styled webkit scrollbar matching the theme

**Footer:**
- `padding: 12px 20px; border-top: 1px solid var(--theme-border-subtle)`
- `display: flex; align-items: center; justify-content: flex-end; gap: 8px`
- Cancel button: secondary style — `background: transparent; border: 1px solid var(--theme-border-subtle); color: var(--theme-text-tertiary); border-radius: 6px; padding: 8px 18px; font-size: 13px`
- Confirm button: primary style — `background: var(--theme-action-primary-bg); border: 1px solid var(--theme-border-strong); color: var(--theme-text-primary); border-radius: 6px; padding: 8px 24px; font-family: var(--theme-font-display); font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; font-size: 13px`
- Optional left-aligned metadata (e.g. count): `font-size: 12px; color: var(--theme-text-tertiary)` — use `justify-content: space-between` when present

**Search input (when applicable):**
- Place in header or in a dedicated toolbar row below the header
- `background: var(--theme-surface-app-start); border: 1px solid var(--theme-border-subtle); border-radius: 8px; padding: 9px 12px 9px 34px; font-size: 14px; color: var(--theme-text-primary)`
- Search icon: 14×14 SVG magnifying glass, `position: absolute; left: 12px`, `stroke: var(--theme-text-tertiary)`
- Focus: `border-color: var(--theme-border-strong)`

**Filter chips (when applicable):**
- `display: flex; gap: 4px; flex-wrap: wrap`
- Inactive: `padding: 3px 10px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--theme-text-tertiary); font-size: 11px`
- Active: `border: 1px solid var(--theme-accent-gold); background: rgba(201,168,76,0.15); color: var(--theme-accent-gold)`

**Dismiss behavior:** Escape key, backdrop click, close button, and Cancel button all close without applying changes. Only the Confirm/primary action button applies.

**Transitions:**
- Backdrop: `opacity 180ms ease` (fade in/out)
- Dialog: `transform 180ms ease, opacity 180ms ease` — enter from `translateY(8px) + opacity 0`, exit to same

## Expansion Icons

Expansion icon PNGs are solid black on transparent. They are tinted via CSS `filter` (brightness/sepia/hue-rotate chains). Two options exist:
- **Option A:** Single warm-bronze tint for all icons, with dark-theme warm-gold override.
- **Option B:** Per-expansion thematic colors via `[attr.data-expansion]` data attribute, keyed to `expansion.name`.

Both use `transition: filter 120ms ease`. Dark theme applies `:host-context([data-theme="dark"])` overrides. Selected state gets a brighter tint.

## Key Rules

1. **Never hardcode colors.** Always use `var(--theme-*)` tokens. Run `grep -rE "#[0-9a-fA-F]{3,6}" angular-frontend/src/app/components` to find violations.
2. **Never hardcode font-family.** Use `var(--theme-font-display)`, `var(--theme-font-body)`, or `var(--theme-font-accent)`.
3. **No universal font-size rules.** The `* { font-size: 36px }` in game-summary was a known bug — never do this.
4. **Both themes must work.** Every new component should look correct in light AND dark. Test by toggling `document.documentElement.setAttribute('data-theme', 'dark')`.
5. **Transitions on theme-sensitive properties:** `background-color 180ms ease, color 180ms ease` on surfaces; `filter 120ms ease` on icons.
6. **Angular standalone components** are preferred for new UI pieces.
7. **`:host-context([data-theme="dark"])`** is the pattern for dark-theme overrides inside Angular component SCSS. If it doesn't work in your build, use a global selector in `styles.scss` instead.
8. **All new tokens must use the `--theme-` prefix** to match the existing convention.

## File Structure

```
src/
├── index.html              # Font links + theme flash-prevention script
├── styles.scss             # Global resets, shared .form-* / button classes
├── app/
│   ├── core/
│   │   └── theme.service.ts          # ThemeService (signal-based, providedIn: root)
│   ├── shared/ (or components/ui/)
│   │   └── theme-toggle/
│   │       └── theme-toggle.component.ts
│   ├── components/
│   │   ├── scene-banner/             # App header with banner image + toggle
│   │   ├── scene-content/            # Scrollable content wrapper
│   │   ├── login/
│   │   ├── lobby/
│   │   ├── match-configuration/
│   │   ├── match/match-hud/          # In-game HUD + overlays
│   │   ├── match/match-hud/game-log/ # Lora italic narrator voice
│   │   └── game-summary/            # Standings + deck summary
│   └── theme/
│       └── app-theme.scss            # ALL token definitions (light + dark)
```

## QA Checklist for Any New Component

- [ ] Uses only `var(--theme-*)` tokens for colors, fonts, spacing
- [ ] Headings use `var(--theme-font-display)` with appropriate letter-spacing
- [ ] Body text uses `var(--theme-font-body)` (inherited from global)
- [ ] Looks correct in both light and dark themes
- [ ] Buttons follow the primary/secondary/danger pattern above using `--theme-action-*` and `--theme-border-*` tokens
- [ ] Disabled states use `--theme-action-disabled-bg`, `--theme-border-disabled`, `--theme-text-disabled`, `--theme-action-disabled-opacity`
- [ ] Interactive elements have `transition` for smooth state changes
- [ ] No `* { }` universal rules that could break descendants
- [ ] New tokens (if any) follow the `--theme-` prefix convention
