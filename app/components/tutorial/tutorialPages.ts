import { convertElevation, formatDistance, formatDuration } from '~/helpers/formatter';

export type GestureKind = 'longPress' | 'swipe' | 'drag';

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type TutorialPart =
    | (Box & { kind: 'card'; radius?: number })
    | (Box & { kind: 'pill'; icon?: string; labelKey?: string; selected?: boolean; primary?: boolean })
    | (Box & { kind: 'fab'; icon: string; primary?: boolean })
    | (Box & { kind: 'block'; icon: string })
    | (Box & { kind: 'icon'; icon: string })
    | (Box & { kind: 'text'; textKey?: string; textFn?: () => string; text?: string; bold?: boolean; muted?: boolean; size?: number })
    | (Box & { kind: 'divider' })
    | (Box & { kind: 'bars'; values: number[] })
    | (Box & { kind: 'meter'; value: number })
    | (Box & { kind: 'road'; angle: number });

/** Strings: `gesture_<id>_title` and `gesture_<id>_desc`. */
export interface TutorialZone extends Box {
    id: string;
    gesture: GestureKind;
    /** the zone is left out when it returns false */
    enabled?: () => boolean;
}

/** Strings: `tutorial_page_<id>`. Coordinates are in a 300x430 schematic screen. */
export interface TutorialPage {
    id: string;
    parts: TutorialPart[];
    zones: TutorialZone[];
}

export const SCREEN_WIDTH = 300;
export const SCREEN_HEIGHT = 430;

const card = (x: number, y: number, width: number, height: number, radius?: number): TutorialPart => ({ kind: 'card', x, y, width, height, radius });
const pill = (x: number, y: number, width: number, height: number, options: { icon?: string; labelKey?: string; selected?: boolean; primary?: boolean } = {}): TutorialPart => ({
    kind: 'pill',
    x,
    y,
    width,
    height,
    ...options
});
const fab = (x: number, y: number, icon: string, primary = false, size = 36): TutorialPart => ({ kind: 'fab', x, y, width: size, height: size, icon, primary });
const icon = (x: number, y: number, name: string, size = 22): TutorialPart => ({ kind: 'icon', x, y, width: size, height: size, icon: name });
const text = (x: number, y: number, width: number, value: string | (() => string), options: { bold?: boolean; muted?: boolean; key?: boolean; size?: number } = {}): TutorialPart => ({
    kind: 'text',
    x,
    y,
    width,
    height: (options.size ?? 12) + 8,
    bold: options.bold,
    muted: options.muted,
    size: options.size,
    ...(typeof value === 'function' ? { textFn: value } : options.key ? { textKey: value } : { text: value })
});
const block = (x: number, y: number, size: number, name: string): TutorialPart => ({ kind: 'block', x, y, width: size, height: size, icon: name });
const divider = (x: number, y: number, width: number): TutorialPart => ({ kind: 'divider', x, y, width, height: 1 });
const road = (x: number, y: number, width: number, angle: number): TutorialPart => ({ kind: 'road', x, y, width, height: 5, angle });
const zone = (id: string, gesture: GestureKind, x: number, y: number, width: number, height: number, enabled?: () => boolean): TutorialZone => ({ id, gesture, x, y, width, height, enabled });

const mapBackground = [road(-20, 150, 340, 10), road(60, 230, 300, -35), road(100, 40, 260, 70)];

// cards stay clear of the screen's rounded corners: the frame does not clip its children to them
export const tutorialPages: TutorialPage[] = [
    {
        id: 'map',
        parts: [
            ...mapBackground,
            card(10, 10, 280, 38, 19),
            icon(22, 18, 'mdi-magnify'),
            text(50, 19, 150, 'search', { key: true, muted: true }),
            icon(258, 18, 'mdi-dots-vertical'),
            card(10, 58, 36, 144, 18),
            icon(17, 66, 'mdi-fullscreen', 24),
            icon(17, 100, 'mdi-video-3d', 24),
            icon(17, 134, 'mdi-chart-line', 24),
            icon(17, 168, 'mdi-routes', 24),
            fab(10, 300, 'mdi-format-list-checkbox'),
            fab(10, 342, 'mdi-layers'),
            fab(254, 342, 'mdi-crosshairs-gps'),
            card(60, 372, 180, 44, 14),
            icon(72, 384, 'mdi-speedometer', 20),
            text(96, 386, 60, 'speed', { key: true, muted: true }),
            icon(158, 384, 'mdi-terrain', 20),
            text(182, 386, 54, 'altitude', { key: true, muted: true })
        ],
        zones: [
            zone('menu', 'longPress', 248, 8, 44, 42),
            zone('side_buttons', 'longPress', 6, 54, 44, 152),
            zone('follow', 'longPress', 250, 338, 44, 44),
            zone('style', 'longPress', 6, 338, 44, 44),
            zone('speed_panel', 'swipe', 56, 368, 188, 52)
        ]
    },
    {
        id: 'layers',
        parts: [
            ...mapBackground,
            card(4, 110, 292, 316, 20),
            text(16, 122, 200, 'layers', { key: true, bold: true }),
            pill(16, 152, 88, 28, { icon: 'mdi-chart-line', labelKey: 'contours', selected: true }),
            pill(110, 152, 94, 28, { icon: 'mdi-home-city', labelKey: 'buildings' }),
            pill(210, 152, 74, 28, { icon: 'mdi-rotate-orbit', labelKey: 'pitch' }),
            card(10, 196, 280, 72),
            icon(16, 220, 'mdi-drag-vertical', 24),
            text(50, 208, 150, 'hillshade_strength', { key: true, bold: true }),
            { kind: 'meter', x: 50, y: 244, width: 130, height: 6, value: 0.7 },
            icon(210, 222, 'mdi-eye', 24),
            icon(250, 222, 'mdi-dots-vertical', 24),
            card(10, 278, 280, 72),
            icon(16, 302, 'mdi-drag-vertical', 24),
            text(50, 290, 150, 'hybrid_imagery', { key: true, bold: true }),
            { kind: 'meter', x: 50, y: 326, width: 130, height: 6, value: 0.4 },
            icon(210, 304, 'mdi-eye', 24),
            icon(250, 304, 'mdi-dots-vertical', 24)
        ],
        zones: [zone('map_options', 'longPress', 10, 148, 278, 36), zone('reorder', 'drag', 12, 206, 40, 52, () => __ANDROID__), zone('layer_swipe', 'swipe', 10, 278, 280, 72)]
    },
    {
        id: 'place',
        parts: [
            ...mapBackground,
            card(4, 170, 292, 256, 20),
            card(12, 180, 276, 52),
            text(24, 186, 200, 'peak', { key: true, bold: true }),
            text(24, 208, 200, () => convertElevation(2642), { muted: true }),
            pill(12, 240, 41, 40, { icon: 'mdi-information-outline' }),
            pill(59, 240, 41, 40, { icon: 'mdi-bookmark' }),
            pill(106, 240, 41, 40, { icon: 'mdi-navigation', primary: true }),
            pill(153, 240, 41, 40, { icon: 'mdi-chart-line' }),
            pill(200, 240, 41, 40, { icon: 'mdi-web' }),
            pill(247, 240, 41, 40, { icon: 'mdi-cloud' }),
            card(12, 292, 276, 126),
            { kind: 'bars', x: 24, y: 304, width: 252, height: 100, values: [20, 28, 26, 40, 52, 48, 60, 72, 66, 80, 92, 84, 70, 62, 54, 60, 48, 36, 30, 24] }
        ],
        zones: [
            zone('place_swipe', 'swipe', 10, 178, 280, 56),
            zone('info', 'longPress', 10, 238, 45, 44),
            zone('elevation', 'longPress', 151, 238, 45, 44),
            zone('web', 'longPress', 198, 238, 45, 44),
            zone('weather', 'longPress', 245, 238, 45, 44, () => __ANDROID__),
            zone('chart', 'drag', 10, 290, 280, 130)
        ]
    },
    {
        id: 'routes',
        parts: [
            ...mapBackground,
            card(4, 4, 292, 166, 18),
            icon(14, 12, 'mdi-arrow-left', 24),
            pill(56, 10, 40, 28, { icon: 'mdi-walk', selected: true }),
            pill(100, 10, 40, 28, { icon: 'mdi-bike' }),
            pill(144, 10, 40, 28, { icon: 'mdi-car' }),
            pill(10, 52, 64, 28, { icon: 'mdi-terrain', selected: true }),
            pill(80, 52, 64, 28, { icon: 'mdi-road-variant' }),
            pill(150, 52, 64, 28, { icon: 'mdi-cash' }),
            pill(220, 52, 64, 28, { icon: 'mdi-weight' }),
            pill(10, 124, 200, 34, { labelKey: 'get_route', primary: true }),
            pill(220, 124, 34, 34, { icon: 'mdi-dots-vertical' }),
            icon(62, 322, 'mdi-map-marker', 28),
            icon(240, 212, 'mdi-flag-checkered', 28)
        ],
        zones: [
            zone('profile', 'longPress', 52, 6, 136, 36),
            zone('route_options', 'longPress', 6, 48, 284, 36),
            zone('recompute', 'longPress', 6, 120, 208, 42),
            zone('waypoint', 'longPress', 100, 250, 120, 80)
        ]
    },
    {
        id: 'navigation',
        parts: [
            ...mapBackground,
            card(8, 8, 284, 96),
            block(18, 16, 52, 'mdi-arrow-top-right'),
            text(82, 20, 120, () => formatDistance(200), { bold: true, size: 20 }),
            text(82, 46, 120, 'navigation_then', { key: true, muted: true }),
            text(222, 18, 60, '4.2', { bold: true, size: 20 }),
            text(222, 42, 60, 'speed', { key: true, muted: true, size: 11 }),
            divider(8, 72, 284),
            text(18, 80, 40, 'navigation_then', { key: true, muted: true, size: 11 }),
            icon(60, 79, 'mdi-arrow-left-top', 16),
            text(82, 80, 100, () => formatDistance(450), { bold: true, size: 11 }),
            fab(250, 116, 'mdi-navigation', false, 40),
            fab(250, 164, 'mdi-crosshairs-gps', false, 40),
            fab(250, 212, 'mdi-dots-vertical', false, 40),
            card(8, 314, 284, 108),
            { kind: 'meter', x: 134, y: 322, width: 32, height: 4, value: 1 },
            text(22, 334, 100, 'remaining_distance', { key: true, muted: true, size: 11 }),
            text(22, 352, 100, () => formatDistance(8400), { bold: true, size: 20 }),
            text(122, 334, 90, 'remaining_ascent', { key: true, muted: true, size: 11 }),
            text(122, 352, 90, () => `+${convertElevation(320)}`, { bold: true, size: 20 }),
            fab(228, 338, 'mdi-pause', true, 52),
            divider(8, 392, 284),
            text(22, 398, 70, 'navigation_arrival', { key: true, muted: true, size: 11 }),
            text(80, 398, 60, '14:32', { bold: true, size: 11 })
        ],
        zones: [zone('end_navigation', 'longPress', 222, 332, 64, 64)]
    },
    {
        id: 'lists',
        parts: [
            pill(10, 12, 136, 34, { labelKey: 'routes', selected: true }),
            pill(154, 12, 136, 34, { labelKey: 'markers' }),
            ...[12000, 8000, 21000].flatMap((meters, index): TutorialPart[] => [
                card(10, 58 + index * 56, 280, 48),
                icon(22, 71 + index * 56, 'mdi-routes', 22),
                text(56, 64 + index * 56, 220, () => formatDistance(meters), { bold: true }),
                text(56, 84 + index * 56, 220, () => formatDuration(meters / 1.2), { muted: true })
            ]),
            text(10, 236, 200, 'settings', { key: true, bold: true }),
            card(10, 264, 280, 48),
            text(22, 270, 250, 'items_data_path', { key: true }),
            text(22, 290, 250, '/AlpiMaps', { muted: true }),
            card(10, 340, 280, 44),
            icon(22, 352, 'mdi-server', 22),
            text(56, 352, 220, 'start_tile_server', { key: true })
        ],
        zones: [
            zone('tabs', 'swipe', 6, 6, 288, 46),
            zone('select', 'longPress', 6, 56, 288, 52),
            zone('data_folder', 'longPress', 6, 260, 288, 56),
            zone('tile_server', 'longPress', 6, 336, 288, 52, () => __ANDROID__)
        ]
    }
];
