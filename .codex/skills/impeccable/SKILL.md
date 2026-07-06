--- name: impeccable
description: Create distinctive, production-grade frontend interfaces with high design quality. Generates creative, polished code that avoids generic AI aesthetics. Use when the user asks to build web components, pages, artifacts, posters, or applications, or when design skill guidance is needed.
version: 2.1.1
argument-hint: "[craft|teach|extract]"
license: Apache 2.0
---

## One-Time Cleanup
If this skill was updated, first clean up deprecated skill files before doing any design work.

Tell the user:
> **Impeccable was updated.** A few skills were renamed or merged in this version. I’ll clean up the old skill files so they don’t clutter your project.

Then run:

```bash
node .codex/skills/impeccable/scripts/cleanup-deprecated.mjs
```

If it removes files, briefly confirm what was cleaned up. If nothing was found, continue silently.

## Core Rule
Do not do design work without confirmed design context.

Required context:
- Target audience
- Use cases
- Brand personality or tone

Gather context in this order:
1. Check current instructions for a Design Context section.
2. Check `.impeccable.md` in the project root.
3. If neither exists, run `$impeccable teach`.

Do not infer this context from the codebase.

## Design Direction
Commit to a clear, bold aesthetic direction. Pick an intentional lane such as brutalist, editorial, luxury, playful, retro-futuristic, or organic. Then execute it consistently.

## Typography
- Use distinctive fonts, not the usual defaults.
- Prefer a small modular type scale with strong contrast.
- Keep body text readable with sensible line length and line height.
- Vary font choices across projects.

See [reference/typography.md](reference/typography.md).

## Color
- Use OKLCH instead of HSL.
- Tint neutrals toward the brand hue.
- Use a coherent palette with strong accent discipline.
- Avoid pure black, pure white, gray-on-color, and default AI palettes.

See [reference/color-and-contrast.md](reference/color-and-contrast.md).

## Layout
- Use a 4pt spacing scale.
- Use `gap` for sibling spacing.
- Break the grid intentionally when it improves hierarchy.
- Avoid card soup, nested cards, and identical repeated blocks.

See [reference/spatial-design.md](reference/spatial-design.md).

## Motion
- Use motion sparingly and purposefully.
- Prefer transform and opacity.
- Avoid bounce, elastic easing, and layout thrash.

See [reference/motion-design.md](reference/motion-design.md).

## Interaction
- Design all states: default, hover, focus, active, disabled, loading, error, success.
- Keep focus visible.
- Prefer undo over confirmation when possible.
- Use progressive disclosure.

See [reference/interaction-design.md](reference/interaction-design.md).

## Responsive
- Start mobile-first.
- Use container queries where they help components adapt.
- Test real input modes, not just viewport width.

See [reference/responsive-design.md](reference/responsive-design.md).

## Writing
- Use clear labels and specific verbs.
- Avoid vague copy.
- Make empty and error states useful.

See [reference/ux-writing.md](reference/ux-writing.md).

## Workflow
Use the right command for the task:
- `craft` for shape-then-build
- `teach` for design context setup
- `extract` to pull reusable components and tokens into the design system

## Anti-Patterns
- Generic AI aesthetics
- Overused default fonts
- Flat hierarchy
- Border accent stripes
- Gradient text
- Decorative glassmorphism everywhere
- Bouncey motion
- Modals when a better pattern exists

## Goal
Make the interface feel intentional, memorable, and production-grade.
