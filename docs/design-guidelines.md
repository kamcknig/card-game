# Dominion Clone — Design Guidelines

**Repo:** `kamcknig/card-game` · **Frontend:** `angular-frontend/src/`

> Keep this document up to date whenever a design decision changes — token names, color values, new component patterns, etc.
> **Visual palette reference:** see `Color Palette.html` for a live swatch sheet with all tokens rendered in both themes.

---

## Table of Contents

1. [Typography](#typography)
2. [Theming](#theming)
3. [Color Palette & Design Tokens](#color-palette--design-tokens)
4. [Spacing Scale](#spacing-scale)
5. [Border Radii](#border-radii)
6. [Shadows & Elevation](#shadows--elevation)
7. [Scrollbars](#scrollbars)
8. [Animation & Transitions](#animation--transitions)
9. [Component Patterns](#component-patterns)
10. [Key Rules](#key-rules)
11. [File Structure](#file-structure)
12. [QA Checklist](#qa-checklist)

---

## Typography

Three Google Fonts, loaded via CDN `<link>` in `index.html`:

| Font | CSS token | Role | Weights |
|---|---|---|---|
| **Cinzel** | `var(--theme-font-display)` | Display — h1–h4, section titles, panel titles, primary button labels, banner title, place badges, stat labels | 500, 600, 700 |
| **Source Sans 3** | `var(--theme-font-body)` | Body — paragraphs, inputs, labels, player names, card names, menus, secondary buttons, meta text. **Default for everything.** | 400, 500, 600, 700 |
| **Lora** (italic) | `var(--theme-font-accent)` | Accent — **game log only** (`<app-game-log>`). Nowhere else. Narrator voice. | 400, 500, italic 400 |
| System monospace | `var(--theme-font-mono)` | Mono — fixed-width labels (e.g. server-status diagnostic codes). Use sparingly. | system default |

### Decision rule

| Context | Font |
|---|---|
| Title, ceremony, heading, button label | Cinzel (`--theme-font-display`) |
| Body text the user reads or types | Source Sans 3 (`--theme-font-body`) |
| Game-event narrator in the log | Lora italic (`--theme-font-accent`) |
| Fixed-width identifier / diagnostic code | System monospace (`--theme-font-mono`) |

### Typography scale

| Element | Font | Size | Weight | Letter-spacing | Transform |
|---|---|---|---|---|---|
| Page heading (h1) | Display | 1.25–1.5rem | 700 | 0.08–0.12em | uppercase |
| Section heading (h2) | Display | 0.9–1rem | 600 | 0.08–0.12em | uppercase |
| Subsection heading (h3) | Display | 0.85–0.9rem | 600 | 0.06–0.08em | uppercase |
| Body text | Body | 1rem (16px) | 400 | normal | none |
| Small/meta text | Body | 0.875rem (14px) | 400–500 | normal | none |
| Tiny text (badges, counts) | Body | 0.75rem (12px) | 500–600 | normal | none |
| Button (default) | Display | 0.85rem | 600 | 0.06em | uppercase |
| Button (large) | Display | 0.95rem | 700 | 0.08em | uppercase |
| Form label | Body | 0.875rem | 600 | normal | none |
| Input text | Body | 1rem | 400 | normal | none |
| Filter chip | Body | 11px | 400 | normal | none |
| Dialog title | Display | 15–16px | 600 | 0.06–0.08em | uppercase |
| Game log | Accent | 0.875rem | 400 italic | normal | none |

**Never** use hardcoded `font-family` strings. Always reference `var(--theme-font-display)`, `var(--theme-font-body)`, or `var(--theme-font-accent)`.

Cinzel headings should use `letter-spacing: 0.04em–0.12em` and often `text-transform: uppercase`.

---

## Theming

The app supports **Light**, **Dark**, and **Auto** (OS preference) themes.

- Theme state is owned by `ThemeService` (`src/app/core/theme.service.ts`), which writes `data-theme="light"|"dark"` on `<html>`.
- A flash-prevention `<script>` in `index.html` reads `localStorage('dominion-theme')` before Angular boots.
- All colors MUST use CSS custom properties (tokens). **Never hardcode hex colors in component SCSS.**
- Theme toggle component: `<app-theme-toggle>` (standalone).
- Dark theme overrides live under `:root[data-theme="dark"]` in `app-theme.scss`.
- Inside Angular component SCSS, use `:host-context([data-theme="dark"])` for dark overrides. If that doesn't work in your build, use a global selector in `styles.scss`.

---

## Color Palette & Design Tokens

All tokens are defined in `src/app/theme/app-theme.scss` on `:root` (light) with `:root[data-theme="dark"]` overrides.

**CRITICAL: All tokens use the `--theme-` prefix.** The only exceptions are card dimension tokens (`--card-width`, `--card-height`, etc.).

### Surfaces

Surfaces are background fills for containers, panels, and page regions.

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-surface-app-start` | `#efe7da` | `#2a2620` | App background gradient start (top-left) |
| `--theme-surface-app-end` | `#e4d7c1` | `#332e27` | App background gradient end (bottom-right) |
| `--theme-surface-header` | `#c1a277` | `#3d3226` | Banner header bar background |
| `--theme-surface-nav` | `#e6dac6` | `#231f1a` | Sidebar navigation background |
| `--theme-surface-panel` | `#e8d8c1` | `#2c2620` | Panel, form, dialog, card container backgrounds |
| `--theme-surface-card` | `#f2e9da` | `#342d25` | Card/row item backgrounds (lobby rows, config items) |
| `--theme-surface-danger-soft` | `#f9dfd8` | `#4a2620` | Soft danger surface (behind error or destructive content) |
| `--theme-surface-count-badge` | `#c1a277` | `#5a4e3e` | Count badge backgrounds |
| `--theme-surface-log-bg` | `transparent` | `linear-gradient(150deg,#1a1714,#231f1a)` | Game-log panel background. Light theme is transparent (body shows through); dark theme reuses the pre-lift body gradient so the log reads as a deeper-toned block. |

**When to use which surface:**
- **App background** (`app-start` → `app-end`): always the page body, applied as `linear-gradient(150deg, ...)`.
- **Panel** (`surface-panel`): use for any elevated container — forms, dialog bodies, config sections, sidebars.
- **Card** (`surface-card`): use for individual items within a panel — lobby game rows, card grid items, list entries.
- **Nav** (`surface-nav`): sidebar navigation only.
- **Header** (`surface-header`): banner/top-bar only.

### Text

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-text-primary` | `#2a241a` | `#e8dfd2` | Default body text, headings, input values |
| `--theme-text-secondary` | `#544630` | `#a99b87` | Labels, meta text, secondary info, form labels |
| `--theme-text-tertiary` | `#7a6a55` | `#7a6e5e` | Placeholder text, hints, de-emphasized content, close buttons |
| `--theme-text-on-dark` | `#ffffff` | `#ffffff` | Text on dark overlays, dark buttons, overlay panels |
| `--theme-text-disabled` | `#6b6153` | `#6b6153` | Disabled button/input text (same in both themes) |
| `--theme-text-banner` | `#6b5033` | `#5a4220` | Banner title text |
| `--theme-text-banner-subtitle` | `#7a5d3d` | `#6b5033` | Banner subtitle text |
| `--theme-text-banner-shadow-main` | `#1a3650` | `#000000` | Banner text-shadow main color |
| `--theme-text-banner-shadow-glow` | `rgba(12,34,52,0.8)` | `rgba(0,0,0,0.9)` | Banner text-shadow glow layer |

**When to use which text color:**
- **Primary**: default for all readable content — paragraphs, headings, input values, player names.
- **Secondary**: labels above inputs, section subtitles, sidebar items, less prominent text.
- **Tertiary**: placeholders, hints, icon-only buttons, metadata counts, close-button icons.
- **On-dark**: any text on a dark overlay/panel (`--theme-panel-bg` or overlay-based backgrounds).
- **Disabled**: combined with `--theme-action-disabled-opacity` for disabled controls.

### Borders

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-border-subtle` | `#bca98d` | `#3d3429` | Card/row borders, dialog borders, dividers between sections |
| `--theme-border-medium` | `#9e8b72` | `#5a4e3e` | Dialog container border, stronger dividers |
| `--theme-border-section-light` | `#c8b798` | `#4a3f32` | Config section outlines, grouped content borders |
| `--theme-border-strong` | `#7f6746` | `#8b7a62` | Focus rings, overlay panel borders, banner bottom border |
| `--theme-border-action` | `#826a48` | `#6b5d48` | Input borders, primary/muted button borders, interactive element borders |
| `--theme-border-divider` | `#bca98d` | `#6b5d48` | Match-screen layout dividers (column verticals + row horizontals). Light theme matches `border-subtle`; dark theme is lifted to the `border-action` tone so dividers stay visible against the lighter dark body. |
| `--theme-border-danger` | `#b84d38` | `#c45a42` | Danger button borders, error messages, destructive action outlines |
| `--theme-border-disabled` | `#a99981` | `#4a4238` | Borders on disabled inputs and buttons |

**When to use which border:**
- **Subtle**: default border for containers (cards, rows, dialogs). Low visual weight.
- **Medium**: when you need a border slightly stronger than subtle — dialog outer frame.
- **Section-light**: grouping borders for config panels and form sections.
- **Strong**: focus-visible outlines, banner separators, overlay panel edges. High visual weight.
- **Action**: interactive elements at rest — inputs, primary buttons. Signals interactivity.
- **Danger**: anything destructive — error messages, danger buttons, ban/delete actions.
- **Disabled**: replaces action/subtle borders when the element is disabled.

### Interactive / Action Fills

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-action-primary-bg` | `#dcc093` | `#5a4e3e` | Primary button fill (Login, Confirm, Save) |
| `--theme-action-primary-muted-bg` | `#e1c89e` | `#453b2e` | Muted primary fill (Join button, paired secondary primary) |
| `--theme-action-secondary-bg` | `#f4ecde` | `#2c2620` | Secondary button hover fill, nav hover fill |
| `--theme-action-nav-selected-bg` | `#dbc39a` | `#4a3f32` | Selected navigation item background |
| `--theme-action-danger-soft-bg` | `#f0cbcb` | `#5a2e25` | Danger button fill, soft destructive surface |
| `--theme-action-disabled-bg` | `#d8d0c2` | `#2a251f` | Disabled button/input background |
| `--theme-action-disabled-opacity` | `0.65` | `0.65` | Opacity for disabled elements |

### Accent

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-accent-gold` | `#8b6f47` | `#c9a84c` | Active filter chips, selected states, gold highlights |
| `--theme-accent-gold-soft` | `rgba(139, 111, 71, 0.15)` | `rgba(201, 168, 76, 0.15)` | Translucent fill behind accent-gold elements (active filter-chip backgrounds). Each variant is the matching `accent-gold` solid at 15% alpha. |

### Status

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-color-ready` | `#2e7d32` | `var(--theme-color-source-victory)` | Ready checkmarks, success indicators, "player ready" state |
| `--theme-color-winner` | `#b89340` | `#e6c54a` | Winner indicator on game summary |

### Game State

These communicate selection state on cards/piles in-game. **Theme-constant** by design — they sit on rendered card art (which doesn't theme-shift), so the same value is used in both light and dark.

| Token | Value | When to use |
|---|---|---|
| `--theme-color-selectable` | `#ffaaaa` | Border on cards/piles available to select (supply, non-supply, landscapes, board cards) |
| `--theme-color-selected` | `#6dff8c` | Border on cards/piles currently selected |
| `--theme-color-way-selectable` | `rgba(0, 213, 255, 0.9)` | Solid cyan ring (`box-shadow`) for way-target highlights on cards/piles |
| `--theme-color-selected-glow` | `rgba(0, 213, 255, 0.35)` | Soft cyan glow for selected entries inside prompt-select / prompt-select-pile |

### Overlays

| Token | Light | Dark | When to use |
|---|---|---|---|
| `--theme-overlay-color` | `#000000` | `#000000` | Base color for overlay backdrops |
| `--theme-overlay-alpha-soft` | `0.5` | `0.5` | Lightest overlay (de-emphasis) |
| `--theme-overlay-alpha-medium` | `0.6` | `0.6` | Dialog backdrops |
| `--theme-overlay-alpha-strong` | `0.8` | `0.8` | Heavy overlays (match HUD panels) |
| `--theme-panel-bg` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.6)` | Pre-composed panel overlay background |

### Card Type / Source Colors

Used for card-type indicators, log entries, and source-labeled tabs. These are semantic game colors, not UI chrome.

| Token | Light | Dark | Card type |
|---|---|---|---|
| `--theme-color-source-default` | `#ffffff` | `#f0e8dc` | Action (no sub-type) |
| `--theme-color-source-treasure` | `#fdda56` | `#e6c54a` | Treasure cards |
| `--theme-color-source-victory` | `#8efb49` | `#6fa84a` | Victory cards |
| `--theme-color-source-curse` | `#d45ffb` | `#b054d4` | Curse cards |
| `--theme-color-source-duration` | `#ff8d34` | `#d97a2c` | Duration cards |
| `--theme-color-source-event` | `#ffe0a8` | — | Event landscapes |
| `--theme-color-source-landmark` | `#ffd09d` | — | Landmark landscapes |
| `--theme-color-source-project` | `#b6f1ad` | — | Project landscapes |
| `--theme-color-way` | `#9fc6ff` | — | Way landscapes |
| `--theme-color-source-boon` | `#a4f0ff` | — | Boon cards |
| `--theme-color-source-hex` | `#f2a9ff` | — | Hex cards |
| `--theme-color-source-state` | `#c4d4ff` | — | State cards |
| `--theme-color-source-artifact` | `#ffdca8` | — | Artifact cards |

### Card Dimensions (no `--theme-` prefix)

Base dimensions are defined on `:root` in `app-theme.scss`. The match
screen scopes its own narrower overrides on `app-match`'s `:host` so all
cards/card-likes inside a match render ~10% smaller without affecting
other screens (match config, etc.).

| Token | Base value | Match override | When to use |
|---|---|---|---|
| `--card-width` | `150px` | `135px` | Standard card width in supply/hand |
| `--card-height` | `245px` | `220px` | Standard card height |
| `--card-small-height` | `155px` | `140px` | Compressed card height (supply piles, half-size stacks) |
| `--card-landscape-width` | `238px` | `214px` | Landscape (card-like) width (events, landmarks, projects, ways, prophecies) |
| `--card-landscape-height` | `149px` | `134px` | Landscape (card-like) height |

The match component additionally exposes `--match-row-spacing` (`10px`)
on its host so the column gap, column padding, per-row padding, the
supply-row gap, the row-divider top padding, and the supply-row vertical
divider extension all read from one variable. Edit it once to retune
all match-screen layout spacing together.

---

## Spacing Scale

Use consistent spacing values throughout the app. The scale is based on a 4px grid.

| Token | Value | When to use |
|---|---|---|
| `--theme-space-2xs` | `2px` | Hairline gaps, icon padding, close-button inset |
| `--theme-space-xs` | `4px` | Tight gaps — form-field label-to-input gap, chip gaps, inline icon margins |
| `--theme-space-sm` | `8px` | Standard small gap — button padding (vertical), list item gaps, footer/header vertical padding |
| `--theme-space-md` | `12px` | Medium padding — dialog footer padding (vertical), input padding, button padding (large vertical), card grid gap |
| `--theme-space-lg` | `16px` | Standard padding — dialog body/header padding (vertical), section padding, panel padding |
| `--theme-space-xl` | `20px` | Dialog body/header horizontal padding, content area side padding |
| `--theme-space-2xl` | `24px` | Section spacing, gap between major layout blocks |
| `--theme-space-3xl` | `32px` | Large section margins, page-level vertical spacing |
| `--theme-space-4xl` | `40px` | Extra large — viewport edge padding on dialogs |
| `--theme-space-5xl` | `48px` | Major layout gaps |

Additionally, `14px` (button horizontal padding `8px 14px`) and `10px` (input vertical padding `10px 12px`) appear in shared recipes but are off-scale — keep them as raw values where the pattern matches the canonical recipe.

Defined in `app-theme.scss` on `:root`:

```css
--theme-space-2xs: 2px;
--theme-space-xs: 4px;
--theme-space-sm: 8px;
--theme-space-md: 12px;
--theme-space-lg: 16px;
--theme-space-xl: 20px;
--theme-space-2xl: 24px;
--theme-space-3xl: 32px;
--theme-space-4xl: 40px;
--theme-space-5xl: 48px;
```

### Common spacing patterns

| Pattern | Value |
|---|---|
| Form field vertical gap (label → input) | `4px` |
| Form field stack gap (field → field) | `16px` |
| Button padding (default) | `8px 14px` |
| Button padding (large) | `12px 16px` |
| Input padding | `10px 12px` |
| Dialog header/body padding | `16px 20px` |
| Dialog footer padding | `12px 20px` |
| Dialog footer button gap | `8px` |
| Card/row internal padding | `12–16px` |
| Sidebar item padding | `8px 12px` |
| Filter chip padding | `3px 10px` |
| Page content side margin | `16–24px` |
| Section-to-section vertical gap | `24–32px` |

---

## Border Radii

| Token | Value | When to use |
|---|---|---|
| `--theme-radius-sm` | `4px` | Small interactive elements — toggle buttons, icon buttons, close buttons |
| `--theme-radius-md` | `6px` | Inputs, standard buttons, form controls, small cards |
| `--theme-radius-lg` | `8px` | Cards, rows, config section borders, search inputs |
| `--theme-radius-pill` | `10px` | Filter chips |
| `--theme-radius-xl` | `12px` | Dialogs/modals, large elevated containers |

Defined in `app-theme.scss` on `:root`:

```css
--theme-radius-sm: 4px;
--theme-radius-md: 6px;
--theme-radius-lg: 8px;
--theme-radius-pill: 10px;
--theme-radius-xl: 12px;
```

---

## Shadows & Elevation

| Token | CSS value | When to use |
|---|---|---|
| `--theme-shadow-none` | `none` | Flat elements: inputs, buttons, sidebar items, table rows |
| `--theme-shadow-low` | `0 1px 3px rgba(0,0,0,0.1)` | Subtle lift — hover states on cards/rows |
| `--theme-shadow-medium` | `0 4px 16px rgba(0,0,0,0.15)` | Dropdown menus, popovers, tooltips |
| `--theme-shadow-high` | `0 8px 32px rgba(0,0,0,0.2)` | Dialogs/modals in light theme |
| `--theme-shadow-high` (dark) | `0 12px 48px rgba(0,0,0,0.5)` | Dialogs/modals in dark theme |

Defined in `app-theme.scss`:

```css
/* :root (light) */
--theme-shadow-none: none;
--theme-shadow-low: 0 1px 3px rgba(0,0,0,0.1);
--theme-shadow-medium: 0 4px 16px rgba(0,0,0,0.15);
--theme-shadow-high: 0 8px 32px rgba(0,0,0,0.2);

/* :root[data-theme="dark"] */
--theme-shadow-high: 0 12px 48px rgba(0,0,0,0.5);
```

Shadows should be minimal. Most elements use **no shadow** — the warm surface hierarchy provides enough contrast. Only floating elements (dialogs, dropdowns, popovers) use shadows.

---

## Scrollbars

One themed recipe applies to every scrollbar in the app — thin, colored to `--theme-border-strong`, transparent track. Defined **once, globally**, in `styles.scss`. No component ever needs its own scrollbar rule.

```css
/* Firefox — scrollbar-width/scrollbar-color are inherited, so setting them
   once on html cascades to every scrollable descendant. */
html {
  scrollbar-width: thin;
  scrollbar-color: var(--theme-border-strong) transparent;
}

/* WebKit (Chrome/Edge/Safari) — ::-webkit-scrollbar doesn't inherit, so it's
   targeted via the universal selector to cover every scrollable element. */
*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background-color: var(--theme-border-strong);
  border-radius: var(--theme-radius-lg);
}
```

`--theme-border-strong` was chosen because it already reads clearly against every backdrop a scrollbar appears on in this app: light panels, dark panels, and the near-black `rgba(0,0,0,0.8)` dialog backdrop used by `skin="dark"` dialogs and the chromeless `skin="none"` card-detail overlay.

**Never add a component-local `scrollbar-width` / `scrollbar-color` / `::-webkit-scrollbar*` rule.** The global rule already covers every `overflow: auto` / `overflow-y: auto` / `overflow-x: auto` region automatically, including ones added in the future. If a specific scrollable region genuinely needs different treatment, override locally and leave a comment explaining why.

---

## Animation & Transitions

### Standard durations

| Duration | When to use |
|---|---|
| `120ms` | Micro-interactions: button hover, border-color, filter changes, icon color |
| `150ms` | Button background transitions |
| `180ms` | Theme swap transitions (background, color), dialog enter/exit |
| `300ms` | Larger layout shifts, panel expand/collapse |

### Standard easings

| Easing | When to use |
|---|---|
| `ease` | Default — buttons, theme transitions, dialogs |
| `ease-out` | Exit animations (dialog closing, element removal) |
| `ease-in-out` | Layout animations, position changes |

### Common transition recipes

```css
/* Buttons */
transition: background 150ms ease, border-color 120ms ease, color 120ms ease;

/* Theme-sensitive surfaces */
transition: background-color 180ms ease, color 180ms ease;

/* Expansion icons */
transition: filter 120ms ease;

/* Dialog backdrop */
transition: opacity 180ms ease;

/* Dialog container */
transition: transform 180ms ease, opacity 180ms ease;
/* Enter: from translateY(8px) opacity(0) → translateY(0) opacity(1) */
/* Exit: reverse */

/* Card/row hover */
transition: border-color 120ms ease, transform 120ms ease;
```

---

## Component Patterns

### When to use which component

| Need | Component / Pattern |
|---|---|
| User text input (short) | `.form-field` + `.form-input` — single-line text field |
| User text input (with trailing icon) | `.form-input-wrapper` > `.form-input` + `.form-input-toggle` |
| Password field | `.form-input-wrapper` with visibility toggle (`.form-input-toggle`) |
| Select from a short list (2–5 items) | Tab bar / segmented control (like Sign In / Register) |
| Select from a long list | Dialog with search + filter chips (like Banned Cards) |
| Toggle a setting on/off | `.form-checkbox` (themed checkbox — see Inputs) |
| Primary action | `.btn .btn-primary` (one per visual group) |
| Secondary/cancel action | `.btn .btn-secondary` |
| Destructive action | `.btn .btn-danger` |
| Prominent CTA on focused screens | `.btn .btn--lg .btn-primary` |
| Paired primary of lesser emphasis | `.btn .btn-primary-muted` |
| Navigation between sections | Sidebar with `.form-input`-styled items (Security / Settings) |
| Overlay content selection | Dialog/modal pattern (see Dialogs section) |
| Status indicator | Colored dot or checkmark using `--theme-color-ready` |
| Error message | `.form-field-error` using `--theme-border-danger` color |
| Info/meta count | Badge with `--theme-surface-count-badge` background |

### App Background

Always use the gradient:
```css
background: linear-gradient(150deg, var(--theme-surface-app-start) 0%, var(--theme-surface-app-end) 100%);
```

### Buttons

Form-screen buttons use shared classes from `styles.scss`. Apply `.btn` plus one variant; do **not** re-implement in component SCSS. Layout-only properties (margin, width) stay local.

| Class | When to use |
|---|---|
| `.btn .btn-primary` | Main submit on a screen — Login, Create account, Save, Confirm. **One per visual group.** |
| `.btn .btn-primary-muted` | Secondary primary action paired with a primary (e.g. lobby Join row). Same weight, less saturated. |
| `.btn .btn-secondary` | Non-primary submit (e.g. Cancel paired with Save). Transparent fill — recedes behind primary. |
| `.btn .btn-danger` | Destructive confirmation (delete, ban, resign). Reads as risky. |

**Sizes:**
- **Default** (`.btn`): `padding: 8px 14px`, `font-size: 0.85rem`, `font-weight: 600`, `letter-spacing: 0.06em`. Use for lobby, profile, match-config, HUD.
- **Large** (`.btn--lg`): `padding: 12px 16px`, `font-size: 0.95rem`, `font-weight: 700`, `letter-spacing: 0.08em`. Use for Login, Create Account — prominent screen CTAs.

**Disabled state** (built into `.btn`): `opacity: 0.6; cursor: not-allowed`. Stronger fade (`saturate(0.45)`) is reserved for in-game HUD buttons that need to look noticeably "off".

### Inputs

```css
background: var(--theme-surface-panel);
border: 1px solid var(--theme-border-action);
border-radius: var(--theme-radius-md);
padding: 10px 12px;  /* raw values — input padding is intentionally off-token */
font-size: 1rem;
color: var(--theme-text-primary);
```

**Focus:** `border-color: var(--theme-border-strong); box-shadow: 0 0 0 2px rgba(130,106,72,0.2);`

**Disabled:** `opacity: 0.5; cursor: not-allowed;`

Use shared classes: `.form-field`, `.form-label`, `.form-input`, `.form-input-wrapper`, `.form-input-toggle`, `.form-field-error` (defined in `styles.scss`).

#### Checkboxes

Native browser checkboxes are visually inconsistent with the parchment theme — never render an `<input type="checkbox">` without the shared `.form-checkbox` class.

```css
width: 16px;
height: 16px;
appearance: none;
border: 1.5px solid var(--theme-border-action);
border-radius: var(--theme-radius-sm);
background: var(--theme-surface-panel);
```

**Checked:** background and border switch to `var(--theme-border-strong)`; the check is drawn via a rotated right+bottom border on `::after` in `var(--theme-text-on-dark)`.
**Disabled:** `var(--theme-action-disabled-bg)` background, `var(--theme-border-disabled)` border, `var(--theme-action-disabled-opacity)` opacity, `saturate(0.45)` filter.
**Focus:** `outline: 2px solid var(--theme-border-strong); outline-offset: 2px;`

Use the shared class: `.form-checkbox` (defined in `styles.scss`). When pairing with a label, wrap both inside a `<label>` so the click target spans the text.

**Semantic exceptions:** A component may override the checked fill locally only when the color carries meaning (e.g. `--theme-color-ready` green on the player roster's "ready" checkbox signals match-readiness). Add a comment explaining the semantic when overriding.

### Cards / Rows

```css
background: var(--theme-surface-card);
border: 1px solid var(--theme-border-subtle);
border-radius: var(--theme-radius-lg);
```

**Hover (lobby rows):** `border-color: var(--theme-border-action); transform: translateY(-1px);`

### Section Titles

```css
font-family: var(--theme-font-display);
font-size: 0.9–1rem;
font-weight: 600;
letter-spacing: 0.08–0.12em;
text-transform: uppercase;
color: var(--theme-text-secondary);
```

### Config Sections

```css
border: 1px solid var(--theme-border-section-light);
border-radius: var(--theme-radius-lg);
```

### Scene Banner

- Background: `var(--theme-surface-header)`, `border-bottom: 1px solid var(--theme-border-strong)`.
- Title: Cinzel 700, uppercase, `letter-spacing: 0.08–0.12em`, text-shadow using `--theme-text-banner-shadow-*` tokens.
- Actions row: absolute top-right, contains theme toggle + profile menu.

### Overlay Panels (match HUD, modals)

```css
background: rgba(0, 0, 0, var(--theme-overlay-alpha-strong));
color: var(--theme-text-on-dark);
border: 1px solid var(--theme-border-strong);
```

### Dialogs / Modals

All dialogs are built on the shared shell — **never hand-roll backdrop,
panel, header/footer chrome, or Escape handling in a component.** Use
`app-ui-dialog` (`angular-frontend/src/app/components/ui/dialog/`) directly
for bespoke layouts, or `app-confirm-dialog`
(`angular-frontend/src/app/components/ui/confirm-dialog/`) for the standard
heading + message + Cancel/Confirm footer pattern.

**Skins** (`skin` input on `app-ui-dialog` / `app-confirm-dialog`):
- `light` — the surface-panel standard below. Use for out-of-match screens
  (lobby, match-config, profile) and in-match confirmations that should read
  as a normal dialog (resign, save/load).
- `dark` — the "Overlay Panels" match standard (translucent black,
  `--theme-text-on-dark`). Use for in-match informational/prompt overlays
  (pause, waiting, disconnect, server prompts, mat viewer).
- `none` — chromeless; the consumer paints its own panel (card detail is the
  only user).

**Layers** (`layer` input): named z-index ladder, defined as
`UI_DIALOG_LAYERS` in `ui-dialog.component.ts`. Pick the layer for the
dialog's role rather than a raw z-index:

| Layer | z-index | Use for |
|---|---|---|
| `base` | 3000 | Lobby and general confirmations |
| `hud` | 4000 | In-match HUD dialogs (pause, waiting, disconnect, resign, undo, mats) |
| `prompt` | 4300 | Server-driven prompt dialogs |
| `picker` | 4400 | Match-config selection/save/load dialogs |
| `detail` | 5000 | Card detail zoom — always topmost |

Later-attached overlays at the same layer stack above earlier ones (CDK
appends in attach order), so per-dialog offsets within a layer are
unnecessary.

**Dismissal policy:** the `dismissable` input is a single gate covering
Escape, backdrop click, and the header close-X together — there is no way to
enable one without the others. Dismissal must always invoke the exact same
handler as the dialog's own Cancel/decline action, never a bare `close()`
that skips cancel logic (`app-confirm-dialog`'s `cancelled` output does this
automatically). Dialogs backing a required action — no decline path exists —
set `dismissable=false` so the user must complete the requested action.
Server prompts derive this per-prompt from the button set (see
`server/CLAUDE.md` "Prompt buttons"): a `role: 'cancel'` button makes the
prompt dismissable and dismissal submits that button's action; a prompt with
no cancel-role button cannot be dismissed.

**Backdrop:**
- `background: rgba(0, 0, 0, var(--theme-overlay-alpha-medium))` (variant
  `medium`, the default) or `var(--theme-overlay-alpha-strong)` (variant
  `strong`, used by prompts/card-detail/HUD confirmations)
- Click on backdrop dismisses per the policy above (same as Cancel)

**Container (shell-provided, `.ui-dialog-panel`):**
- Light skin: `background: var(--theme-surface-panel)`; dark skin:
  `background: rgba(0, 0, 0, var(--theme-overlay-alpha-strong))`,
  `color: var(--theme-text-on-dark)`
- `border-radius: var(--theme-radius-xl)` (12px)
- `border: 1px solid var(--theme-border-medium)` (light) /
  `var(--theme-border-strong)` (dark)
- `box-shadow: var(--theme-shadow-high)` (light: `0 8px 32px rgba(0,0,0,0.2)` / dark: `0 12px 48px rgba(0,0,0,0.5)`)
- `max-width: min(60vw, calc(100vw - 24px)); max-height: min(70vh, calc(100vh - 24px))`

**Header (shell-provided, `.ui-dialog-header`):** renders when `heading` or
`showClose` is set. `padding: 16px 20px; border-bottom: 1px solid
var(--theme-border-subtle)`. Title uses Display font, 15–16px, 600 weight,
uppercase.

**Scrollable body (shell-provided, `.ui-dialog-body`):** `flex: 1;
overflow-y: auto; padding: 16px 20px`. Scrollbar styling comes from the
global recipe (see [Scrollbars](#scrollbars)) — no local rule needed.

**Footer:** consumers project a `<div class="ui-dialog-footer">` into the
shell (absent footer renders nothing). `padding: 12px 20px; border-top: 1px
solid var(--theme-border-subtle)`. Cancel = `.btn .btn-secondary`, Confirm =
`.btn .btn-primary`, destructive = `.btn .btn-danger`. Gap: `8px`. Align
right with `justify-content: flex-end`.

**Search input:** use the shared `app-search-input` component
(`angular-frontend/src/app/components/ui/search-input/`) rather than
re-implementing — it owns the wrapper, magnifying-glass icon, text input,
and the clear (X) button that appears once there's text. `background:
var(--theme-surface-app-start); border: 1px solid var(--theme-border-subtle);
border-radius: 8px; padding: 9px 12px 9px 34px; font-size: 14px`. Search
icon: 14×14 magnifying glass at `left: 12px`.

**Filter chips:**
- Inactive: `padding: 3px 10px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--theme-text-tertiary); font-size: 11px`
- Active: `border: 1px solid var(--theme-accent-gold); background: var(--theme-accent-gold-soft); color: var(--theme-accent-gold)`

**Dismiss:** Escape, backdrop click, and the close button all route through
the single `dismissable` gate described above; Cancel closes without
applying regardless of `dismissable`. Only Confirm applies.

**Transitions:** Backdrop fades in 180ms. Dialog enters from
`translateY(8px) opacity(0)` over 180ms (`ui-dialog-enter` keyframes, shell-
provided — do not re-implement per dialog).

### Dropdown Menus

- `background: var(--theme-surface-panel)`
- `border: 1px solid var(--theme-border-subtle)`
- `border-radius: var(--theme-radius-lg)` (8px)
- `box-shadow: var(--theme-shadow-medium)`
- Items: `padding: 8px 12px`, `color: var(--theme-text-primary)`
- Hover: `background: var(--theme-action-secondary-bg)`
- Danger item (e.g. Logout): `color: var(--theme-border-danger)`

### Expansion Icons

Expansion icon PNGs are solid black on transparent. Tinted via CSS `filter` chains. Two approaches:
- **Option A:** Single warm-bronze tint for all, gold override in dark.
- **Option B:** Per-expansion thematic colors via `[data-expansion]` attribute.

Both use `transition: filter 120ms ease`. Dark overrides via `:host-context([data-theme="dark"])`.

---

## Key Rules

1. **Never hardcode colors.** Always use `var(--theme-*)` tokens. Audit with: `grep -rE "#[0-9a-fA-F]{3,6}" angular-frontend/src/app/components`
2. **Never hardcode font-family.** Use `var(--theme-font-display)`, `var(--theme-font-body)`, or `var(--theme-font-accent)`.
3. **No universal font-size rules.** Never use `* { font-size: ... }`.
4. **Both themes must work.** Test every component in light AND dark: `document.documentElement.setAttribute('data-theme', 'dark')`.
5. **Transitions on theme-sensitive properties:** `background-color 180ms ease, color 180ms ease` on surfaces; `filter 120ms ease` on icons.
6. **Angular standalone components** preferred for new UI pieces.
7. **`:host-context([data-theme="dark"])`** for dark overrides in component SCSS.
8. **All new tokens must use the `--theme-` prefix.**
9. **Spacing on a 4px grid.** All padding, margins, and gaps should be multiples of 4.
10. **Use shared button/form classes** from `styles.scss` — don't re-implement.
11. **Never re-implement scrollbar styling per component.** The global recipe in `styles.scss` (see [Scrollbars](#scrollbars)) covers every scrollable region automatically. Audit with: `grep -rn "scrollbar-width\|scrollbar-color\|::-webkit-scrollbar" angular-frontend/src/app/components` (should return nothing).

---

## File Structure

```
src/
├── index.html              # Font links + theme flash-prevention script
├── styles.scss             # Global resets, shared .form-* / .btn classes
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

---

## QA Checklist for Any New Component

- [ ] Uses only `var(--theme-*)` tokens for colors and fonts
- [ ] Headings use `var(--theme-font-display)` with appropriate letter-spacing
- [ ] Body text uses `var(--theme-font-body)` (inherited from global)
- [ ] Looks correct in both light and dark themes
- [ ] Buttons use `.btn` + variant class from `styles.scss`
- [ ] Disabled states use `--theme-action-disabled-bg`, `--theme-border-disabled`, `--theme-text-disabled`, `--theme-action-disabled-opacity`
- [ ] Interactive elements have appropriate `transition`
- [ ] No `* { }` universal rules that could break descendants
- [ ] New tokens (if any) follow the `--theme-` prefix convention
- [ ] Spacing values are multiples of 4px
- [ ] Border radii match the scale (4/6/8/10/12px)
- [ ] Shadows match the elevation scale (none/low/medium/high)
- [ ] Form fields use shared `.form-*` classes
- [ ] Dialogs follow the modal pattern with proper backdrop, header, body, footer
- [ ] Scrollable regions rely on the global scrollbar styling — no component-local `scrollbar-*` / `::-webkit-scrollbar*` rules added
