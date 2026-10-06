# shadcn plan: masthead, nav, footer and the pieces that live there

Written 2026-10-06, before step 3 of the redesign's shell pass (branch
`redesign`). For each interactive piece of the shell: which shadcn component
fits, what could go wrong, and whether this pass adopts it or keeps it
custom. The bar, from the brief: ids and data attributes kept, behavior and
keyboard use identical. Where a shadcn component can't match a piece
exactly, the piece stays custom (restyled with the design tokens) and the
reason is given here.

Already on shadcn before this pass: Button, Badge, Card, Input, InputGroup,
Label, Textarea, NativeSelect, Checkbox, Toggle and the segmented switch
(Toggle per option; ToggleGroup's roving focus would change Tab use).

## Summary

| Piece | Today | shadcn fit | Decision |
|---|---|---|---|
| Nav menu (Calculator modes) | `NavBar.tsx`: a tablist; the Calculator tab opens a Basic / Advanced / Stages menu on hover, goes to the last mode on click, opens on tap | DropdownMenu (Base UI Menu, `openOnHover`) | **Keep custom** |
| Tool picker (/tools) | `ToolPicker.tsx`: link cards in groups, icon hover animations | Card, or Item | **Keep custom** |
| Share menu | `ScenarioBar.tsx` → `usePopup()`: a small dialog with a list of choices and Cancel | DropdownMenu, or Dialog | **Adopt Dialog** (through Modal) |
| Dialogs: converter, growth rates, asset mix, guaranteed income, item editor, strategy guide, classic studies, backtest, the choice popup | `Modal.tsx`: portal, focus moved in and returned, Tab kept inside, Escape and a click outside close | Dialog (Base UI Dialog) | **Adopt** |
| Help tour (Tool Help, the Guide's coach) | `CoachPanel.tsx`: a panel docked under the tool, folds to one line, the page leaves room for it | Collapsible; Sheet / Drawer | **Keep custom** |
| Tooltips ("?" dots) | `Tooltips.tsx`: one listener for every dot; a box on hover or click with a mouse, a bottom sheet on a phone tap | Tooltip, Popover, Drawer | **Keep custom** |
| Toasts | `Toast.tsx`: one message at a time in `#toast`, replaced by the next, shown 3.5 to 7 s by length | Sonner | **Keep custom** |
| Select lists (in every dialog and panel) | `lib/select-menus.js`: our own list over each native select | Select | **Keep custom** (natives stay, as agreed) |

## Each piece

### Nav menu: keep custom

DropdownMenu would replace the Calculator tab's menu. It can't match it:

- With a mouse, a click on the Calculator tab goes to the mode last used and
  hover opens the menu; Menu's trigger toggles the menu on click instead.
- The tab is a `role="tab"` in a tablist with its own arrow keys (Left /
  Right between tabs, Down / Up into the menu). Menu.Trigger brings its own
  key handling and ARIA, which would fight the tablist's.
- Menu is modal by default (scroll lock, the rest of the page inert), adds
  typeahead, and places focus by its own rules; the menu today puts focus
  on the current mode, and Tab out of it closes it.
- On touch the menu opens over a scrim (`#calcScrim`) that a tap closes.

Restyled in step 3b instead: the hard-coded shadows and tints go, the menu
takes the float shadow and the tokens.

### Tool picker: keep custom

Card or Item would wrap each tool's link. Nothing to gain and two risks:
the cards are `ToolCardLink`s that prefetch and set the page transition's
direction, and the icon hover animations, which must stay exactly as they
are, hang off the card's own classes. The icons get their group colors in
step 4.

### Share menu: adopt Dialog, through Modal

The Share button opens the same choice popup as Save and the strategy
pickers (`usePopup()`), a centered dialog, so it moves with Modal.
DropdownMenu would fit a share menu, but it would anchor the choices under
the button (a layout change) and change its keyboard use (arrow keys and
typeahead in place of Tab between the choices). Risk: e2e steps click
`.popup .popbtn`; both classes are kept.

### Dialogs: adopt Dialog

Every dialog goes through `Modal`, so one change moves them all: Base UI's
Dialog, controlled (no trigger), rendered in a portal, with the existing
class on the popup (`popup`, `popup wide`, ...) and `role="dialog"`,
`aria-modal`. It provides what Modal does by hand: focus in on open (the
same element: `initialFocus`), Tab kept inside, Escape and a click outside
close, focus back to what opened it.

Risks and how they're handled:

- Scroll lock and page inertness: a modal Base UI dialog locks the page's
  scroll, which Modal never did. `modal="trap-focus"` keeps the focus trap
  without the scroll lock.
- Select lists: `select-menus.js` appends its list to `<body>`, outside the
  dialog. A Base UI dialog would read a press on it as a click outside and
  close, and could pull focus back from it. The list is put inside the open
  dialog instead (it's positioned in viewport coordinates, so it lands in
  the same place).
- The Escape bug (REDESIGN_NOTES.md): Escape in a select list inside a
  dialog closed both, because Modal listened in the capture phase, before
  the list. The list now stops its own Escape (and Tab) from reaching the
  dialog; Escape closes only the list, and a second Escape the dialog.
- Initial focus that also selects the field's text (the converter's
  amount): kept, done once the dialog has focused it.
- e2e: `.popup`, `.popbtn`, `[data-modal-x]` and every id inside are kept.

### Help tour: keep custom

CoachPanel is a non-modal panel docked at the bottom of the page that
folds to one line, and the page leaves room for it at its current height
(`--gdh`). Sheet and Drawer are modal overlays that cover the page, the
opposite of what it's for. Collapsible could own the fold, but the fold is
one button and a class; it would add a component without changing
behavior. Restyled with tokens only.

### Tooltips: keep custom

Tooltip would show on hover, but the "?" dots also toggle on a click and
open on a phone as a bottom sheet titled with the field's name, which is a Drawer, so
one dot would need two components switched by screen size. There are
hundreds of dots on some pages, each a lazily-loaded glossary entry served
by one delegated listener; a Base UI Tooltip per dot would mount hundreds
of floating roots. Tooltip also opens on keyboard focus and closes on a
click, where the dots open on hover or a click and close on the next one;
either way the behavior would change.

### Toasts: keep custom

Sonner stacks toasts, adds swipe to dismiss and its own region and
animation, and each `toast()` call adds one rather than replacing the
message showing. The site shows one message at a time in `#toast` (an
e2e check reads it), replaced by the next, for 3.5 to 7 seconds by its
length. Restyled with the float shadow and tokens.

### Select lists: keep custom

As agreed for selects: the fields stay native `<select>`s and our own list
opens over them. Only the change above (inside a dialog; Escape stays in
the list) touches it in this pass.
