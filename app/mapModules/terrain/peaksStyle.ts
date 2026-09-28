import { reliefPalette } from '~/mapModules/terrain/reliefShaders';

/**
 * Its own inline style: only the compiled `osm.zip` is in this repo, so no parameter can be added to the
 * app's style. Every value is style TEXT, so a change means a new decoder.
 */
export interface PeaksStyleOptions {
    dark?: boolean;
    /** The map's font scale, so names match its labels. */
    fontScale?: number;
    minZoom?: number;
    textSize?: number;
    /** Rotation of the label text, degrees, off the leader line. */
    textAngle?: number;
    /** A name longer than this many pixels breaks onto a second line; 0 never wraps. */
    wrapWidth?: number;
    /** Highest the row may sit, fraction of screen height from the top; it drops to just above the highest summit. */
    band?: number;
    /** All labels in one row under the top edge instead of a band lower down. */
    pinTop?: boolean;
    /** Each name just above its OWN summit, following the skyline; `band` is ignored. */
    followSkyline?: boolean;
    /** How far below the top of the screen that row sits, as a fraction of the screen height. */
    topOffset?: number;
    /** How many rows labels may stack into when they collide. */
    maxRows?: number;
    /** Shortest gap between two labels, px. */
    minDistance?: number;
    /** Passes a placed name holds its row for once it stops fitting. */
    persistPasses?: number;
    /** Metres; 0 for no limit. */
    maxDistance?: number;
    /** Rank by apparent altitude, not height: at any bearing the name on the skyline wins. */
    horizonFirst?: boolean;
    /** The eye's absolute elevation, metres. Only read when `horizonFirst` is on. */
    eyeElevation?: number;
    /** Bold and this colour for the `selected_peak` style parameter (`name|ele`), a live write. Unset: nothing selectable. */
    selectedFill?: string;
}

/**
 * Callout labels: lifted to a row and joined to the summit by a leader line meeting the name's first letter;
 * a colliding label moves one row instead of being dropped.
 */
export function peaksStyle(options: PeaksStyleOptions = {}) {
    // minZoom 0: far tiles coarsen to ~z6/z7 with terrain up, and a zoom gate hid the summits on the horizon
    const {
        band = 0.25,
        dark = false,
        eyeElevation = 0,
        followSkyline = false,
        fontScale = 1,
        horizonFirst = true,
        maxDistance = 0,
        maxRows = 1,
        minDistance = 14,
        minZoom = 0,
        persistPasses = 2,
        pinTop = true,
        selectedFill,
        textAngle = 55,
        textSize = 16,
        topOffset = 0.03,
        wrapWidth = 0
    } = options;
    const palette = reliefPalette(dark);
    const scaledSize = textSize * fontScale;
    const rowStep = Math.max(26, Math.round(scaledSize * 6 * Math.sin((textAngle * Math.PI) / 180) + scaledSize * 0.4));
    // always bottom-left, as peakfinder.com: names read up and right from the leader line; `pinTop` only
    // decides where the row is
    const align = 'bottom-left';
    const selectable = !!selectedFill;
    return [
        selectable ? "Map { param-selected_peak: ''; }" : '',
        selectable ? "@selected: [name] + '|' + [ele] = [param::selected_peak];" : '',
        `#mountain_peak['class'='peak'][zoom>=${minZoom}] {`,
        '  text-name: [name];',
        // an empty face keeps the decoder's own
        selectable ? "  text-face-name: @selected ? 'Roboto Bold, Helvetica Neue Bold, Arial Bold' : '';" : '',
        // the elevation as a second run of text: same label, same plate, smaller font
        "  text-secondary-name: [ele]+'m';",
        // a tilted plate is as tall as it is long: wrapped, a long name stacks instead of being dropped
        wrapWidth > 0 ? `  text-wrap-width: ${wrapWidth};` : '',
        '  text-secondary-scale: 0.62;',
        `  text-secondary-fill: ${palette.labelSecondary};`,
        '  text-secondary-dx: 3;',
        '  text-secondary-dy: 0;',
        // the user's `_fontscale` preference by hand (the SDK already applies DPI): this inline style cannot
        // take the app style's parameter
        `  text-size: ${scaledSize.toFixed(1)};`,
        selectable ? `  text-fill: @selected ? ${selectedFill} : ${palette.ink};` : `  text-fill: ${palette.ink};`,
        `  text-halo-fill: ${palette.paper};`,
        '  text-halo-radius: 1.5;',
        // white plate on light palettes, the palette's paper on dark ones; the leader line takes `text-fill`
        `  text-background-fill: ${dark ? palette.paper : '#ffffff'};`,
        '  text-background-opacity: 0.85;',
        '  text-background-radius: 6;',
        '  text-background-padding-x: 5;',
        '  text-background-padding-y: 2;',
        '  text-placement: callout;',
        // the higher summit claims the row; 0 under `horizonFirst`, since the culler adds priority and rank
        // and a height term would swamp it. The selected one always wins.
        `  text-placement-priority: ${selectable ? '@selected ? 100000 : ' : ''}${horizonFirst ? 0 : '[ele]'};`,
        minDistance > 0 ? `  text-min-distance: ${minDistance};` : '',
        // apparent altitude, tan = (ele - eye) / distance: the name on the skyline wins. x1000 as far tangents
        // are hundredths; +1 avoids division by zero. `horizonFirst` off: by height, nearest first.
        horizonFirst ? `  text-rank: 1000 * ([ele] - ${Math.round(eyeElevation)}) / ([view::distance] + 1);` : '  text-rank: [ele] - [view::distance]/1000;',
        `  text-orientation: ${textAngle};`,
        '  text-callout-line-anchor: bottom-left;',
        `  text-callout-align: ${align};`,
        // no anchor (negative = no band, vt::Styles.h) puts each name above its own summit: two-dimensional
        // packing instead of one row of ~7 plates
        followSkyline ? '' : `  text-callout-screen-anchor: ${pinTop ? topOffset : band};`,
        // peakfinder.com's row: just above the highest summit on screen, `band` the highest it may go.
        // A row pinned at the top stays put.
        followSkyline || pinTop ? '' : '  text-callout-band-follow: true;',
        // Looking up at the sky, a name whose summit went under the bottom edge goes with it.
        '  text-callout-anchor-visible: true;',
        '  text-callout-offset: 10;',
        // must clear the rotated plate's vertical extent (W·sin T) or rows overlap; a name with its elevation
        // runs ~6x the text size. Down from a top row, up from a band.
        `  text-callout-step: ${pinTop ? rowStep : -rowStep};`,
        `  text-callout-max-rows: ${maxRows};`,
        // a placed name keeps its row while crowded instead of blinking (rectilinear projection spreads pairs
        // ~1.4x wider at the edge than the centre), but never overlaps a neighbour
        `  text-callout-persist: ${persistPasses};`,
        '  text-callout-line-width: 1;',
        maxDistance > 0 ? `  text-max-distance: ${maxDistance};` : '',
        '}'
    ]
        .filter(Boolean)
        .join('\n');
}
