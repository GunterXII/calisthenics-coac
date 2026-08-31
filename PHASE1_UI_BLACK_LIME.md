# Phase 1 — Black + Lime Design System

UI-only refactor. No business logic, workout behavior, data, calculations, prescriptions, or persistence were changed.

## Visual system
- Background: near-black OLED-friendly surface.
- Primary accent: neon lime `#B8F500`.
- Secondary accent: soft lime `#D7FF5A`.
- Surfaces: charcoal/black hierarchy instead of purple-tinted panels.
- Borders: low-contrast neutral borders used only for separation.
- Primary CTA: solid lime with dark text.
- Secondary CTA: neutral charcoal.
- Selected controls: lime outline + restrained lime tint.
- Focus states: lime focus ring.
- Bottom navigation: lime active state.

## Scope
The phase intentionally changes only presentation tokens and global visual rules. Existing JSX class names such as `violet-*` remain compatible so no interaction or application logic is altered.

## Ergonomics
- Primary/secondary actions keep at least 48–50px mobile height.
- Counter controls remain large touch targets.
- Bottom navigation keeps a generous touch area.
- Disabled controls are visually quieter without disappearing.
- Contrast of secondary text is raised for OLED/mobile readability.

## Validation
`npm run build` was attempted against the archived dependency tree. The archive's `node_modules` is incomplete and TypeScript reports missing type-definition packages (`react`, `react-dom`, several Babel types, `estree`). No TypeScript source error attributable to the Phase 1 CSS/theme edits was observed before dependency resolution failed.

Run `npm install` (or `npm ci`) locally, then `npm run build` to perform the normal project build.
