# PRPS — Design System

**Phase:** 1 · **Scope:** Public website. Every future dashboard reuses this
system so the whole product feels like one thing.

## 1. Principles

- Modern, premium, bright, professional and welcoming.
- Highly readable; clarity beats decorative effects.
- Minimal gradients, glassmorphism and animation.
- **Never** entirely pink; **never** entirely blue.

## 2. Brand Palette

Source of truth: `frontend/src/styles/index.css` (`@theme`). The illustration
system mirrors it in `components/illustrations/illustration-colors.ts`.

| Token | Value | Role |
| --- | --- | --- |
| `cream-50` | `#FDFBF5` | Lightest surfaces |
| `cream-100` | `#FAF5EA` | Primary background / identity |
| `cream-200` | `#F4EBDC` | Cards, illustration surfaces |
| `cream-300` | `#EADDC4` | Borders |
| `magenta-500` | `#E11D74` | **Signature accent** (buttons, highlights) |
| `magenta-600` | `#C81564` | Accent hover |
| `royal-500` | `#1D3A8A` | Structural blue |
| `royal-600` | `#162D6E` | Secondary buttons, deep sections |
| `royal-700` | `#10214F` | Statistics / promo bands |
| `royal-800` | `#0C173B` | Footer |
| `ink-900` | `#0B1430` | Headings / text (dark navy near-black) |
| `ink-500` | `#4A5578` | Muted body text |

**Balance rule:** Cream = identity background. White = card surfaces. Deep
blue = structural/authoritative bands. Magenta = accent (never the majority).

### School uniform rule (illustrations)

Pupils wear a **solid cream shirt** — body, collar, neck and sleeves all
cream. `uniform-100 #F7F1E3`, `uniform-200 #EFE6D0` (depth only). No blue
collars, no blue sleeves, no two-tone shirts.

## 3. Typography

- **Family:** "Plus Jakarta Sans" (Google Fonts, `display=swap`) with system
  fallbacks so offline rendering stays clean.
- **Headings:** extra-bold (`font-extrabold`), tight tracking, strong size
  scale (h1 up to `text-6xl` on the hero, h2 `text-3xl/4xl` in sections).
- **Body:** `text-base`/`text-sm`, comfortable line-height (`leading-relaxed`).
- **Eyebrow labels:** uppercase, tracked (`0.22em`), magenta, `text-xs`.
- Avoid decorative fonts; never sacrifice readability.

## 4. Layout & Spacing

- Page container: `container-page` (max-width `80rem` = 7xl, responsive
  padding `px-4 sm:px-6 lg:px-8`).
- Section rhythm: `py-16 sm:py-24` for major sections.
- Grids: 2-col at `sm`, 3-col at `lg` for card groups; 4-col stats at `lg`.
- Cards: `rounded-2xl`, `border-cream-300/70`, soft shadow
  `0 4px 24px -8px rgba(11,20,48,.12)`, hover lift.

## 5. Components

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `ui/Button` | Variants: `primary` (magenta), `secondary` (royal), `outline`, `cream`, `ghost-dark`. Renders `button`, `Link` (`to`) or `a` (`href`). |
| `Card` | `ui/Card` | Base white surface. |
| `Badge` | `ui/Badge` | Magenta pill eyebrow. |
| `SectionHeading` | `ui/SectionHeading` | eyebrow + h2 + description; `align` and `dark` variants. |
| `Container` | `ui/Container` | Centered page width. |
| `DynamicIcon` | `ui/DynamicIcon` | Maps string icon keys → lucide components. |
| `Logo` | `common/Logo` | Emblem (`/logo.svg`) + wordmark; `dark` variant for footer. |
| `Header` | `common/Header` | Sticky, cream blur, active magenta underline, mobile drawer. |
| `Footer` | `common/Footer` | Royal-800; links, contact, newsletter, legal. |
| `PageHero` | `common/PageHero` | Subpage banner: breadcrumb + eyebrow + title. |
| `Reveal` | `common/Reveal` | Subtle scroll-in; respects reduced motion. |
| `NewsCard` / `GalleryCard` | `common/` | Content cards reused on home + listing pages. |

## 6. Iconography

Lucide icons at `h-4/5/6/7` depending on context. Icons sit in tinted rounded
squares (`bg-magenta-500/10 text-magenta-600`) with a magenta hover fill on
interactive cards.

## 7. Imagery

- No external photo dependency: a cohesive SVG illustration system covers the
  hero, academic programmes, news, gallery and facilities.
- Illustration color tokens mirror the Tailwind theme; scenes share a
  400×300 artboard (`SceneFrame`) and `preserveAspectRatio="slice"`.
- The hero uses the arch/"curved image treatment" from the reference
  (`rounded-t-[11rem]`).

## 8. Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `footer`, `section`).
- One `h1` per page; logical heading hierarchy.
- Alt text / `aria-label` on meaningful images; decorative SVGs are
  `aria-hidden` (with the hero scene labelled).
- Visible focus indicators (magenta outline) on `:focus-visible`.
- Forms: proper `label`s, `aria-invalid`, `aria-describedby`, `role="alert"`
  errors, native `type` for inputs.
- Buttons announce state (`aria-expanded`, `aria-pressed`).
- Contrast checked against WCAG AA for text on cream/white/navy backgrounds.

## 9. Responsiveness

Designed from mobile up. Tested breakpoints: 320, 375, 390, 430, 768, 1024,
1280, 1440, 1920 px.

- Mobile nav is a drawer, not a squeezed menu bar.
- Stats go 2-col on mobile, 4-col on desktop.
- Admission steps become a vertical timeline on mobile, horizontal on desktop.
- Gallery/programme/news grids: 1 → 2 → 3 columns.
- No horizontal scrolling.

## 10. Motion

- Subtle `Reveal` fade/slide and count-up statistics only.
- `prefers-reduced-motion: reduce` globally disables transitions/animations.
