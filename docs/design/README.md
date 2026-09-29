# Alpi Maps design chart

The app-wide look taken from the peak finder celestial panels. Open [`mockups.html`](mockups.html) in a
browser for the reference screens (light and dark). Keep both files up to date when a decision changes.

## Principles

- **The theme colour is the accent.** Yellow stays for the celestial views only.
- **Neutral surfaces.** Panels, sheets and the action bar use the surface colour with a hairline, no tint.
- **No elevation on the map.** Map buttons are round, semi-transparent, hairline outlined.
- **Touch targets** follow the platform guides: 48dp minimum (Android), 44pt (iOS).
- **E-ink keeps working.** Every token has a solid black/white variant; colour is never the only signal
  (grades as hatching, selected pills with a thicker outline).

## Tokens

Computed in `app/variables.ts`, exposed as CSS variables `--<name>`.

| Token | Light / dark | Use |
| --- | --- | --- |
| `colorPanel` | surface, alpha 247 | panels and sheets |
| `colorMapControl` | surface, alpha 200 | buttons floating over the map |
| `colorHairline` | onSurface, alpha 31 | panel borders, row separators |
| `colorOutlineSoft` | onSurface, alpha 64 | pill outlines |
| `colorSurfaceFill` | onSurface, alpha 8 | fields, stat tiles |
| `colorAccentContainer` | primary, alpha 31 / 41 | icon tiles, selected pills |
| `colorAccentContainerSolid` | same, opaque | the same over the map |
| `colorCanvas` / `colorCard` | dimmed page, white cards / page, lighter cards | grouped lists |

## Components

| Piece | Where | Spec |
| --- | --- | --- |
| Panel header | `components/common/PanelHeader.svelte` | 40dp icon tile (radius 12, accent), bold 17 title, muted subtitle |
| Pill | `components/common/Pill.svelte`, `.chip` | 40dp high, min 48 wide, radius 20; selected = accent tint, primary = filled |
| Panel popover | `components/common/PanelPopover.svelte` | radius 24 (Android shape `ShapeAppearance.App.Panel`), hairline |
| Grouped rows | `components/settings/groupedRows.ts` | cards inset 12, radius 16, rows padded 16, separators from the text |
| Map control | `.mapControl`, `.floating-btn` | round, `colorMapControl`, hairline, elevation 0 |
| Section header | `.sectionHeader` | 13 bold, accent |

## Decisions

- **Item sheet steps follow the item.** A marker header is 86dp, a route header 86dp plus a 48dp row of
  stat tiles. This needs the persistent bottom sheet to retarget a running animation when its steps change
  (ui-persistent-bottomsheet fix, after 0.1.13).
- **Route header**: title band like a marker (option icons top right), then four compact stat tiles
  (icon + value). On the route each tile adds a second accent line behind the finish flag: what is left
  to the end.
- **Stat tiles** are the shared idiom for figures: route header, location info (speed, altitude), astronomy.
- **Sheets for tools** (compass, satellites, astronomy) open with a panel header; toggles are pills;
  warnings are an outlined danger label, not a filled colour block. The dial is hairline, accent cardinals.
- **Elevation strip** shows only while a point is selected (tap, or the location on the route). Each
  figure is an icon above its value; tapping the strip clears the selection. Grade is not coloured there.
- **Way types / surfaces**: small caption with chevrons, 10dp rounded stacked bar with 2dp gaps, a two
  column legend (dot, name, bold value on the right).
- **Map menu**: only dark mode and offline mode as top toggles, then the views, then import and settings.
- **Items list**: route rows show distance; markers do not. Groups and items can be hidden (eye / ⋮).
- **Settings**: grouped cards on a dimmer page, each row with an accent icon tile.
