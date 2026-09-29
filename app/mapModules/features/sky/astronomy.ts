/**
 * Low-precision star/planet series (a few arcminutes); sun and moon stay on suncalc. Pure, no NativeScript
 * import. Degrees, azimuth clockwise from north; `n` is days since J2000.0 (2000-01-01 12:00 UTC).
 */

const TO_DEGREES = 180 / Math.PI;
const TO_RADIANS = Math.PI / 180;
const MS_PER_DAY = 86400000;
// J2000.0 is JD 2451545.0, the Unix epoch JD 2440587.5.
const UNIX_EPOCH_SINCE_J2000_DAYS = 2440587.5 - 2451545.0;

export interface Horizontal {
    azimuth: number;
    altitude: number;
}

export function normalizeDegrees(degrees: number) {
    const result = degrees % 360;
    return result < 0 ? result + 360 : result;
}

function clamp(value: number) {
    return Math.max(-1, Math.min(1, value));
}

export function daysSinceJ2000(time: number) {
    return time / MS_PER_DAY + UNIX_EPOCH_SINCE_J2000_DAYS;
}

/** Greenwich mean sidereal time, degrees. */
export function gmstDegrees(n: number) {
    return normalizeDegrees((18.697374558 + 24.06570982441908 * n) * 15);
}

/** Mean obliquity of the ecliptic, degrees. */
function obliquity(n: number) {
    return 23.4392911 - 3.563e-7 * n;
}

export function toHorizon(rightAscensionDegrees: number, declination: number, n: number, lat: number, lon: number): Horizontal {
    const hourAngle = (gmstDegrees(n) + lon - rightAscensionDegrees) * TO_RADIANS;
    const decl = declination * TO_RADIANS;
    const latitude = lat * TO_RADIANS;
    const sinAlt = Math.sin(latitude) * Math.sin(decl) + Math.cos(latitude) * Math.cos(decl) * Math.cos(hourAngle);
    const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(decl) * Math.cos(latitude));
    return { azimuth: normalizeDegrees(azimuth * TO_DEGREES + 180), altitude: Math.asin(clamp(sinAlt)) * TO_DEGREES };
}

/** Ecliptic longitude/latitude to right ascension and declination, all degrees. */
function eclipticToEquatorial(eclipticLong: number, eclipticLat: number, n: number) {
    const lambda = eclipticLong * TO_RADIANS;
    const beta = eclipticLat * TO_RADIANS;
    const eps = obliquity(n) * TO_RADIANS;
    const rightAscension = Math.atan2(Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lambda));
    const declination = Math.asin(clamp(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda)));
    return { rightAscension: normalizeDegrees(rightAscension * TO_DEGREES), declination: declination * TO_DEGREES };
}

/**
 * JPL approximate Keplerian elements (valid 1800-2050): a (au), e, I, L, long. of perihelion, long. of
 * ascending node, then each rate per Julian century. Same order as the catalogue's `PLANETS`, Earth last.
 */
const PLANET_ELEMENTS = [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]
];
const EARTH = PLANET_ELEMENTS.length - 1;

/** Heliocentric ecliptic rectangular coordinates (au) of one body of PLANET_ELEMENTS. */
function heliocentric(planet: number, n: number): [number, number, number] {
    const elements = PLANET_ELEMENTS[planet];
    const centuries = n / 36525;
    const semiMajorAxis = elements[0] + elements[6] * centuries;
    const eccentricity = elements[1] + elements[7] * centuries;
    const inclination = (elements[2] + elements[8] * centuries) * TO_RADIANS;
    const meanLongitude = elements[3] + elements[9] * centuries;
    const perihelionLongitude = elements[4] + elements[10] * centuries;
    const nodeLongitudeDegrees = elements[5] + elements[11] * centuries;
    const nodeLongitude = nodeLongitudeDegrees * TO_RADIANS;
    const perihelionArgument = (perihelionLongitude - nodeLongitudeDegrees) * TO_RADIANS;

    // Mean anomaly folded into -180..180, as the Kepler iteration expects.
    const meanAnomaly = (normalizeDegrees(meanLongitude - perihelionLongitude + 180) - 180) * TO_RADIANS;
    let eccentricAnomaly = meanAnomaly;
    for (let iteration = 0; iteration < 12; iteration++) {
        const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - eccentricity * Math.cos(eccentricAnomaly));
        eccentricAnomaly -= delta;
        if (Math.abs(delta) < 1e-10) {
            break;
        }
    }

    const xOrbit = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);
    const yOrbit = semiMajorAxis * Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
    const cosPerihelion = Math.cos(perihelionArgument);
    const sinPerihelion = Math.sin(perihelionArgument);
    const cosNode = Math.cos(nodeLongitude);
    const sinNode = Math.sin(nodeLongitude);
    const cosInclination = Math.cos(inclination);
    const xPlane = xOrbit * cosPerihelion - yOrbit * sinPerihelion;
    const yPlane = xOrbit * sinPerihelion + yOrbit * cosPerihelion;
    return [xPlane * cosNode - yPlane * cosInclination * sinNode, xPlane * sinNode + yPlane * cosInclination * cosNode, yPlane * Math.sin(inclination)];
}

/** A planet, by its index in the catalogue's `PLANETS`, as seen from Earth; `distance` in au. Light time and aberration ignored. */
export function planetEquatorial(planet: number, n: number) {
    const body = heliocentric(planet, n);
    const earth = heliocentric(EARTH, n);
    const x = body[0] - earth[0];
    const y = body[1] - earth[1];
    const z = body[2] - earth[2];
    return { ...eclipticToEquatorial(Math.atan2(y, x) * TO_DEGREES, Math.atan2(z, Math.hypot(x, y)) * TO_DEGREES, n), distance: Math.hypot(x, y, z) };
}

export function planetHorizon(planet: number, n: number, lat: number, lon: number): Horizontal {
    const { declination, rightAscension } = planetEquatorial(planet, n);
    return toHorizon(rightAscension, declination, n, lat, lon);
}

// A point's rise and set: the horizon lifted by refraction.
const RISE_ALTITUDE = -0.5667;
const SIDEREAL_DEGREES_PER_DAY = 360.98564736629;

/** ms since the epoch; 'always' and 'never' when it does not cross the horizon that day. */
export type Pass = { rise: number; set: number } | 'always' | 'never';

/** The rise and set of the pass under way at `time`, else of the next one. */
export function fixedPass(rightAscensionDegrees: number, declination: number, time: number, lat: number, lon: number): Pass {
    const latitude = lat * TO_RADIANS;
    const decl = declination * TO_RADIANS;
    const cosHalfArc = (Math.sin(RISE_ALTITUDE * TO_RADIANS) - Math.sin(latitude) * Math.sin(decl)) / (Math.cos(latitude) * Math.cos(decl));
    if (cosHalfArc < -1) {
        return 'always';
    }
    if (cosHalfArc > 1) {
        return 'never';
    }
    const halfArc = Math.acos(cosHalfArc) * TO_DEGREES;
    const msPerDegree = MS_PER_DAY / SIDEREAL_DEGREES_PER_DAY;
    // Hour angle turned since it rose: up while under the arc.
    const sinceRise = normalizeDegrees(gmstDegrees(daysSinceJ2000(time)) + lon - rightAscensionDegrees + halfArc);
    const rise = sinceRise < 2 * halfArc ? time - sinceRise * msPerDegree : time + (360 - sinceRise) * msPerDegree;
    return { rise, set: rise + 2 * halfArc * msPerDegree };
}

/** As `fixedPass`, each end re-solved where the planet is by then. */
export function planetPass(planet: number, time: number, lat: number, lon: number): Pass {
    const passAt = (moment: number) => {
        const { declination, rightAscension } = planetEquatorial(planet, daysSinceJ2000(moment));
        return fixedPass(rightAscension, declination, time, lat, lon);
    };
    let pass = passAt(time);
    for (let iteration = 0; iteration < 2 && typeof pass === 'object'; iteration++) {
        const atRise = passAt(pass.rise);
        const atSet = passAt(pass.set);
        if (typeof atRise !== 'object' || typeof atSet !== 'object') {
            break;
        }
        pass = { rise: atRise.rise, set: atSet.set };
    }
    return pass;
}

/** East, north, up. */
export function direction(azimuth: number, altitude: number): [number, number, number] {
    const alt = altitude * TO_RADIANS;
    const az = azimuth * TO_RADIANS;
    return [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
}

/**
 * The mean direction of a set of `[az, alt, az, alt, …]`, averaged as vectors: averaging azimuths
 * would put a figure straddling north somewhere near south. Null when they cancel out.
 */
export function meanDirection(directions: number[]): Horizontal | null {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let index = 0; index + 1 < directions.length; index += 2) {
        const [east, north, up] = direction(directions[index], directions[index + 1]);
        x += east;
        y += north;
        z += up;
    }
    const length = Math.hypot(x, y, z);
    if (length === 0) {
        return null;
    }
    return { azimuth: normalizeDegrees(Math.atan2(x, y) * TO_DEGREES), altitude: Math.asin(z / length) * TO_DEGREES };
}
