# Dominion Clone — Design Guidelines

**Repo:** `kamcknig/card-game` · **Frontend:** `angular-frontend/src/`

> Keep this document up to date whenever a design decision changes — token names, color values, new component patterns, etc.

## Typography

Three Google Fonts, loaded via CDN `<link>` in `index.html`:

| Font | CSS token | Role | Weights |
|---|---|---|---|
| **Cinzel** | `var(--font-display)` | Display — h1–h4, section titles, panel titles, primary button labels, banner title, place badges, stat labels | 500, 600, 700 |
| **Source Sans 3** | `var(--font-body)` | Body — paragraphs, inputs, labels, player names, card names, menus, secondary buttons, meta text. **Default for everything.** | 400, 500, 600, 700 |
| **Lora** (italic) | `var(--font-accent)` | Accent — **game log only** (`<app-game-log>`). Nowhere else. Narrator voice. | 400, 500, italic 400 |

**Decision rule:** title/ceremony → Cinzel · body text the user reads/types → Source Sans 3 · game-event narrator in the log → Lora italic.

**Never** use hardcoded `font-family` strings. Always use `var(--font-display)`, `var(--font-body)`, or `var(--font-accent)`.

Cinzel headings should use `letter-spacing: 0.04em–0.12em` and often `text-transform: uppercase`.

## Theming

The app supports **Light**, **Dark**, and **Auto** (OS preference) themes.

- Theme state is owned by `ThemeService` (`src/app/core/theme.service.ts`), which writes `data-theme="light"|"dark"` on `<html>`.
- A flash-prevention `<script>` in `index.html` reads `localStorage('dominion-theme')` before Angular boots.
- All colors MUST use CSS custom properties (tokens). **Never hardcode hex colors in component SCSS.**
- Theme toggle component: `<app-theme-toggle>` (standalone, lives in shared or ui folder).

## Design Tokens

All tokens are defined in `src/app/theme/app-theme.scss` on `:root` (light) with `[data-theme="dark"]` overrides.

### Surfaces
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f5ecd9` | `#1a1714` | App background |
| `--bg-elevated` | `#ede0c3` | `#231f1a` | Elevated panels, nav |
| `--surface-panel` | `#e8d9b8` | `#2c2620` | Panel backgrounds |
| `--surface-card` | `#f9f2dc` | `#342d25` | Card/row backgrounds |
| `--surface-header` | `#d9c291` | `#3d3429` | Header bar |
| `--surface-input` | `#fdf8e8` | `#252019` | Input fields |

### Text
| Token | Light | Dark |
|---|---|---|
| `--text-primary` | `#3d2f1a` | `#e8dfd2` |
| `--text-secondary` | `#6b5a3e` | `#a99b87` |
| `--text-tertiary` | `#9b8968` | `#7a6e5e` |
| `--text-on-accent` | `#ffffff` | `#1a1714` |

### Borders
| Token | Light | Dark |
|---|---|---|
| `--border-subtle` | `#d4c190` | `#3d3429` |
| `--border-medium` | `#b59b5f` | `#5a4e3e` |
| `--border-strong` | `#8b6f3a` | `#8b7a62` |
| `--border-danger` | `#b84d38` | `#c45a42` |

### Accents
| Token | Light | Dark |
|---|---|---|
| `--accent-primary` | `#8b6f3a` | `#c9a84c` |
| `--accent-primary-hover` | `#a08349` | `#d4b45a` |
| `--accent-gold` | `#b89340` | `#c9a84c` |
| `--accent-success` | `#5a8a3c` | `#6fa84a` |
| `--accent-danger` | `#b84d38` | `#c45a42` |
| `--accent-info` | `#4a7a9b` | `#5a9ac0` |

### Card Type Colors (shared)
| Token | Value |
|---|---|
| `--color-treasure` | `#fdda56` |
| `--color-victory` | `#6b8e3d` |
| `--color-curse` | `#d45ffb` |
| `--color-duration` | `#ff8d34` |

### Spacing (4px base)
`--sp-4` through `--sp-64`: `4, 8, 12, 16, 24, 32, 48, 64`

### Radii
`--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-xl: 16px`, `--radius-full: 999px`

### Elevation
`--shadow-sm`, `--shadow-md`, `--shadow-lg` — all warm-toned in light, black-based in dark.

## Component Patterns

### Buttons
- **Primary:** `background: var(--accent-primary)`, `color: var(--text-on-accent)`, `border: 1px solid var(--accent-primary)`, `border-radius: var(--radius-md)`. Hover → `var(--accent-primary-hover)`. Disabled → `opacity: 0.5; cursor: not-allowed`.
- **Secondary:** transparent bg, `border: 1px solid var(--border-medium)`. Hover → `var(--bg-elevated)`.
- **Ghost:** no border, `color: var(--text-secondary)`. Hover → text-primary + bg-elevated.
- Primary button labels use `font-family: var(--font-display); letter-spacing: 0.05–0.08em; text-transform: uppercase`.
- All buttons: `transition: background 150ms, border-color 120ms, color 120ms`.
- Disabled state: `background: var(--action-disabled-bg); opacity: 0.65; filter: saturate(0.45); cursor: not-allowed`.

### Inputs
- `background: var(--surface-input)`, `border: 1px solid var(--border-medium)`, `border-radius: var(--radius-md)`.
- Focus: `border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(184,147,64,0.2)`.
- Placeholder: `color: var(--text-tertiary)`.

### Cards / Rows
- `background: var(--surface-card)`, `border: 1px solid var(--border-subtle)`, `border-radius: var(--radius-md)` or `var(--radius-lg)`.
- Hover: `border-color: var(--border-medium); transform: translateY(-1px)`.

### Section Titles
- `font-family: var(--font-display); font-size: 0.9–1rem; font-weight: 600; letter-spacing: 0.08–0.12em; text-transform: uppercase; color: var(--text-secondary)`.

### Scene Banner
- Banner header: `background: var(--surface-header)`, `border-bottom: 1px solid var(--border-strong)`.
- Title: Cinzel 700, uppercase, `letter-spacing: 0.12em`, with text-shadow.
- Actions row: absolute top-right, contains theme toggle + profile menu.

## Expansion Icons

Expansion icon PNGs are solid black on transparent. They are tinted via CSS `filter` (brightness/sepia/hue-rotate chains). Two options exist:
- **Option A:** Single warm-bronze tint for all icons, with dark-theme warm-gold override.
- **Option B:** Per-expansion thematic colors via `[attr.data-expansion]` data attribute, keyed to `expansion.name`.

Both use `transition: filter 120ms ease`. Dark theme applies `:host-context([data-theme="dark"])` overrides. Selected state gets a brighter tint.

## Key Rules

1. **Never hardcode colors.** Always use `var(--token-name)`. Run `grep -rE "#[0-9a-fA-F]{3,6}" angular-frontend/src/app/components` to find violations.
2. **Never hardcode font-family.** Use `var(--font-display)`, `var(--font-body)`, or `var(--font-accent)`.
3. **No universal font-size rules.** Never use `* { font-size: ... }` — it breaks descendants.
4. **Both themes must work.** Every new component must look correct in light AND dark. Test by toggling `document.documentElement.setAttribute('data-theme', 'dark')`.
5. **Transitions on theme-sensitive properties:** `background-color 180ms ease, color 180ms ease` on surfaces; `filter 120ms ease` on icons.
6. **Angular standalone components** are preferred for new UI pieces.
7. **`:host-context([data-theme="dark"])`** is the pattern for dark-theme overrides inside Angular component SCSS. If it doesn't work in the build, use a global selector in `styles.scss` instead.

## File Structure

```
src/
├── index.html              # Font links + theme flash-prevention script
├── styles.scss             # Global tokens, resets, shared .btn-* / .input classes
├── app/
│   ├── core/
│   │   └── theme.service.ts          # ThemeService (signal-based, providedIn: root)
│   ├── shared/ (or components/ui/)
│   │   └── theme-toggle/
│   │       └── theme-toggle.component.ts
│   ├── components/
│   │   ├── scene-banner/             # App header with banner image + toggle
│   │   ├── login/
│   │   ├── lobby/
│   │   ├── match-configuration/
│   │   ├── match/match-hud/game-log/ # Lora italic narrator voice
│   │   └── game-summary/            # Standings + deck summary
│   └── theme/
│       └── app-theme.scss            # Token definitions (light + dark overrides)
```

## QA Checklist for Any New Component

- [ ] Uses only `var(--*)` tokens for colors, fonts, spacing, radii, shadows
- [ ] Headings use `var(--font-display)` with appropriate letter-spacing
- [ ] Body text uses `var(--font-body)` (inherited from global)
- [ ] Looks correct in both light and dark themes
- [ ] Buttons follow the primary/secondary/ghost pattern above
- [ ] Disabled states use token-based styling, not hardcoded grays
- [ ] Interactive elements have `transition` for smooth state changes
- [ ] No `* { }` universal rules that could break descendants
