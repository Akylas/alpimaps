/** The colours of what the sun and the moon say of a ride, one place for the chips, the profile and the page. Pure: nothing here may import NativeScript. */

export const SUN_COLORS = {
    // the colours oss-weather gives the sun's rise and set and the moon
    sunrise: '#EF9F27',
    sunset: '#D85A30',
    moon: '#7F77DD',
    // the end of civil twilight, as the lens draws the twilight
    dusk: '#7E57C2',
    // light enough to read as text on a dark card too
    dark: '#5A6BC8',
    glare: '#E5484D',
    shade: '#5F7D95'
};

/** What each event or figure of the sun is drawn with: its mdi icon name, its code point where it is painted as text (the profile), its colour. */
export const SUN_EVENTS = {
    sunrise: { icon: 'mdi-weather-sunset-up', glyph: String.fromCodePoint(0xf059c), color: SUN_COLORS.sunrise },
    sunset: { icon: 'mdi-weather-sunset-down', glyph: String.fromCodePoint(0xf059b), color: SUN_COLORS.sunset },
    dusk: { icon: 'mdi-weather-sunset', color: SUN_COLORS.dusk },
    moonrise: { icon: 'mdi-moon-waxing-crescent', glyph: String.fromCodePoint(0xf0f67), color: SUN_COLORS.moon },
    moonset: { icon: 'mdi-moon-waning-crescent', glyph: String.fromCodePoint(0xf0f65), color: SUN_COLORS.moon },
    dark: { icon: 'mdi-weather-night', color: SUN_COLORS.dark },
    moonlit: { icon: 'mdi-moon-waning-crescent', color: SUN_COLORS.moon },
    // the glare is no colour: it is an alert
    glare: { icon: 'mdi-white-balance-sunny', color: undefined }
};
