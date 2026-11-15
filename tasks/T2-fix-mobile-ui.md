# T2: Fix mobile UI layout issues

**Status:** todo

## Requirements
1. **Header wraps badly on narrow screens.**
   - The date ("Sunday, Nov 15") wraps onto two lines.
   - The "Sync issue" badge and the "+ Add" button crowd the right side.
   - The "+ Add" button text stacks ("+" above "Add").
   - Fix so the date fits cleanly and the button stays on one line (e.g. smaller or shorter date format, `whitespace-nowrap`, or a better flex layout).
2. **Settings > Birthday field overflows the screen on iPhone 14.**
   - The input extends past the viewport width.
   - Likely a native date input with intrinsic width. Constrain it (`w-full`, `min-width: 0`, `max-width: 100%`) and check the parent flex/grid.

## Notes
- The screenshot of the header (dark theme, "Sóc · 10 days") was shared in chat on 2026-11-15. It is not saved in the repo.
- Test at iPhone 14 width (390px).
