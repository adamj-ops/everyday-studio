# Everyday Studio — Design specification (Sessions 9–11)

Contract for parallel design-elevation work. Align new UI with these tokens and patterns; do not invent per-screen color systems.

## Inspiration benchmarks

TODO: User to specify 2–3 reference apps for visual anchor (e.g. Stripe, Linear, Raycast).

## Design tokens

### Typography

| Role | Size / line-height / letter-spacing |
|------|-------------------------------------|
| Display | 48px / 1.1 / -0.02em |
| H1 | 32px / 1.2 / -0.015em |
| H2 | 24px / 1.3 / -0.01em |
| H3 | 18px / 1.4 / -0.005em |
| Body | 15px / 1.5 / 0 |
| Small | 13px / 1.4 / 0 |
| Micro | 12px / 1.3 / 0 |

**Font:** Inter (variable), weights 400, 500, 600, 700.

### Spacing (Tailwind-compatible, 4px base)

Scale: 1, 2, 3, 4, 6, 8, 12, 16, 20, 24 (multiply by 4 for px). Prefer 4 / 8 / 16 / 24 for most layouts; 12 / 20 for intermediate; larger steps sparingly.

### Color

Start from shadcn neutrals. Semantic roles:

- `bg-canvas` — app background
- `bg-surface` — cards, panels
- `bg-muted` — secondary surfaces
- `text-primary` — main text
- `text-secondary` — supporting text
- `text-tertiary` — hints, metadata
- `border-subtle` — dividers, low emphasis
- `border-default` — inputs, card edges
- `accent` — primary actions, focus (brand)

TODO: Define one strong brand accent; until then map `accent` to the existing theme primary. Stripe-style: mostly neutrals, one confident accent.

### Radii

| Token | px | Use |
|-------|-----|-----|
| sm | 6 | tight controls |
| md | 10 | default components |
| lg | 14 | cards |
| xl | 20 | hero panels |

Default **md** for most components; **lg** for cards; **xl** for large hero surfaces.

### Shadows

- **Elevation 1:** subtle card lift (resting state).
- **Elevation 2:** hover / active on interactive surfaces.
- **Elevation 3:** modals, popovers, dropdowns.

Prefer OKLCH-based shadow tokens where the design system exposes them; avoid flat black at high opacity. Goal: realistic depth, not heavy drop shadows.

## Component patterns

### Buttons

Variants: default (accent), secondary, ghost, destructive.

States: hover, active, disabled, loading (spinner inline, preserve min width).

Focus: visible ring on keyboard focus only (not on mouse click).

### Cards

Surface background, subtle border, **lg** radius, elevation 1. Interactive cards: elevation 2 on hover with 150ms ease transition.

### Inputs

Surface background, subtle border, **md** radius. Focus: accent border or ring. Error: destructive border + helper text below; never rely on color alone.

### Loading

- **Content areas:** skeleton placeholders.
- **Inline actions:** spinner in button.
- **Long operations (e.g. render pipeline):** progress or staged message where applicable.

### Empty states

Icon or light illustration + headline + supporting line + single primary action. No blank panels.

## Page patterns

### Dashboard / list

- Max-width content region (~1200px) centered or left-aligned per layout grid.
- Header row: title + subtitle + primary action top-right.
- Optional filter bar below header.
- Responsive grid or list of cards.

### Detail

- Back link top-left.
- Title + status + actions top-right.
- Two-column or stacked sections; sticky sub-nav when the page is long.

### Forms

- Single column, max width ~640px for readability.
- Section headers with clear hierarchy.
- Inline validation on blur or submit.
- Primary action bottom-right (or trailing in header on short forms); secondary bottom-left or ghost in header.

## Interaction patterns

- **Hover:** subtle background or border shift, ~150ms ease.
- **Press:** optional scale to 0.98 on mousedown for tactile controls.
- **Transitions:** ~200ms ease for layout and opacity; ~150ms for micro-interactions.
- **Feedback:** show loading or acknowledgement within ~100ms of a destructive or expensive action.

## Anti-patterns (avoid)

- Default shadcn look with no hierarchy or density tuning (“AI slop”).
- Heavy drop shadows or neon glows.
- Oversaturated accent colors on large fills.
- Pill radius on non-pill components.
- Dense text blocks without headings or spacing rhythm.
- Missing empty and error states.
- Arbitrary spacing outside the scale.
