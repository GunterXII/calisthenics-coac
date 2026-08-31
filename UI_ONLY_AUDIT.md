# UI-only audit — Calisthenics Coach

## Scope
Visual and UX changes only. No workout logic, calculations, stored data model, progression rules, timers, persistence behavior, or business decisions were changed.

## Findings and treatment

| Area | Audit finding | Treatment |
|---|---|---|
| Visual hierarchy | Primary actions were competing with many equal-weight cards | Stronger CTA hierarchy, quieter secondary controls and more restrained surfaces |
| Typography | Too many tiny labels and low-contrast secondary strings | Increased label/copy legibility and normalized hierarchy |
| Spacing | Dense groups of controls/cards could feel fragmented | Standardized control heights, radii and spacing behavior |
| Cards | Nested cards were visually overused | Unified surface treatment and reduced visual separation |
| Borders | Too many bright borders created noise | Softer global border token and quieter panel chrome |
| Purple accent | Purple was present in too many large surfaces | Reduced purple surface/border intensity; retained purple for focus, active and Coach context |
| Buttons | Secondary actions were too visually close to primary actions | Clearer primary/secondary/danger hierarchy and stronger touch targets |
| Icons | Lucide icons are used consistently for navigation/actions | Preserved icon system; improved control sizing/focus treatment |
| Mobile ergonomics | Several controls were below ideal touch sizing | Standardized main controls around 44–48px touch targets and safe-area spacing |
| Bottom navigation | Active state was clear but chrome could be quieter | Retained 5-tab structure and made active/inactive contrast more intentional |
| Workout player | Important data competed with explanatory copy | Quieter supporting copy, larger numeric controls and clearer effort input hierarchy |
| Information density | Technical labels such as `V16 ACCUMULATION` were exposed directly | Added presentation-only copy normalization; underlying prescription remains unchanged |
| Accessibility | Secondary text was too dim on dark/OLED screens | Raised muted text contrast and added visible focus states |
| Empty/loading/error states | Several states used inconsistent English copy | Normalized visible copy and loading presentation without changing state behavior |
| Active/inactive states | Selected controls could be subtle | Stronger `aria-pressed` visual state for RIR/fatigue choices |
| Consistency | Italian and English UI were mixed | Normalized visible UI copy toward Italian where touched |
| Premium feel | App had strong foundations but looked like a collection of feature cards | Reduced decorative chrome and emphasized athlete decisions/actions |

## Explicitly preserved

- Workout behavior
- Timers and recovery behavior
- Exercise prescriptions
- Progression calculations
- Coach calculations/decisions
- Persistence and synchronization
- Workout/session data
- Navigation structure
- Existing functionality

## Main UI principle

Every visible element should help the athlete **understand, decide, or perform**. Decorative emphasis was reduced rather than adding new functionality.
