import addressFormatter from '@akylas/address-formatter';
// import getIsOpenNow from '@wojtekmaj/opening-hours-utils/src/get_is_open_now';
// import getNextClosedAt from '@wojtekmaj/opening-hours-utils/src/get_next_closed_at';
// import getNextOpenAt from '@wojtekmaj/opening-hours-utils/src/get_next_open_at';
// import * as opening_hours from 'opening_hours';
import SimpleOpeningHours from '~/helpers/SimpleOpeningHours';
import dayjs from 'dayjs';
import humanUnit, { sizePreset } from 'human-unit';
import { get } from 'svelte/store';
import { formatDate, formatTime, langStore, lc } from '~/helpers/locale';
import { IItem } from '~/models/Item';
export { convertDurationSeconds, formatDate } from '~/helpers/locale';
const timePreset = {
    factors: [1000, 60, 60, 24],
    units: ['ms', 's', 'min', 'hour', 'day']
};
const distancePreset = {
    factors: [1000],
    units: ['m', 'km']
};

// const elevationPreset = {
//     factors: [],
//     units: ['m']
// };

export const osmIcons = require('~/osm_icons.json');
export function osmicon(values: string[] | string, canReturnUndefined = true) {
    if (!values) {
        return undefined;
    }
    if (!Array.isArray(values)) {
        values = [values];
    }
    let value, result;
    for (let index = 0; index < values.length; index++) {
        value = values[index];
        result = osmIcons[value];
        if (result) {
            return result;
        }
    }
 //   return values[0];
    return canReturnUndefined ? undefined : values[0];
}

export function formatSize(diskSize) {
    const data = humanUnit(diskSize, sizePreset);

    return `${data.value.toFixed(1)} ${data.unit} `;
}

export function convertDistance(meters) {
    if (meters === undefined) {
        return undefined;
    }
    return humanUnit(meters, distancePreset);
}

export function formatDistance(meters) {
    return convertValueToUnit(meters, UNITS.DistanceKm).join(' ');
}
export function convertElevation(meters) {
    return convertValueToUnit(meters, UNITS.Distance).join(' ');
}

export enum UNITS {
    InchHg = 'InchHg',
    MMHg = 'MMHg',
    kPa = 'kPa',
    hPa = 'hPa',
    Inch = 'inch',
    MM = 'mm',
    Celcius = 'celcius',
    Farenheit = 'farenheit',
    Duration = 'duration',
    Date = 'date',
    Distance = 'm',
    DistanceKm = 'km',
    Speed = 'km/h'
}
export function kelvinToCelsius(kelvinTemp) {
    return kelvinTemp - 273.15;
}

function celciusToFahrenheit(kelvinTemp) {
    return (9 * kelvinTemp) / 5 + 32;
}

export function convertValueToUnit(value: any, unit: UNITS, otherParam?): [string | number, string] {
    if (value === undefined || value === null) {
        return ['', ''];
    }
    switch (unit) {
        case UNITS.kPa:
            return [(value / 10).toFixed(), 'kPa'];
        case UNITS.hPa:
            return [value.toFixed(), 'hPa'];
        case UNITS.MMHg:
            return [(value * 0.750061561303).toFixed(), 'mm Hg'];
        case UNITS.InchHg:
            return [(value * 0.0295299830714).toFixed(), 'in Hg'];
        case UNITS.MM:
            return [value.toFixed(1), 'mm'];
        case UNITS.Celcius:
            return [Math.round(value * 10) / 10, ''];
        case UNITS.Farenheit:
            return [celciusToFahrenheit(value).toFixed(1), '°'];
        case UNITS.Date:
            return [formatDate(value, 'M/d/yy h:mm a'), ''];
        case UNITS.Distance:
            return [value.toFixed(), unit];
        case UNITS.DistanceKm:
            if (value < 1000) {
                return [value.toFixed(), 'm'];
            } else if (value > 100000) {
                return [(value / 1000).toFixed(0), unit];
            } else {
                return [(value / 1000).toFixed(1), unit];
            }
        case UNITS.Speed:
            return [value.toFixed(0), unit];
        default:
            return [value.toFixed(), unit];
    }
}

export function formatValueToUnit(value: any, unit, options?: { prefix?: string; otherParam?; join?: string; unitScale?: number }) {
    options = options || {};
    if (unit === UNITS.Celcius) {
        options.join = options.join || '';
    } else {
        options.join = options.join || ' ';
    }
    const array = convertValueToUnit(value, unit, options?.otherParam);
    if (options.unitScale) {
        for (let index = 0; index < options.unitScale; index++) {
            array[1] = `<small>${array[1]}</small>`;
        }
    }
    let result = array.join(options?.join);
    if (options && options.prefix && result.length > 0) {
        result = options.prefix + result;
    }
    return result;
}

function langToCountryCode(lang) {
    switch (lang) {
        case 'en':
            return 'us';
        default:
            return lang;
    }
}

export function getAddress(item: IItem, startIndex = -1, endIndex = -1) {
    const address = item.properties.address;
    // if (!address.name) {
    //     address.name = item.properties.name;
    // }
    if (!address.country_code && address.country) {
        const array = address.country.split(/(?:,| |-|_)+/);
        if (array.length > 1) {
            address.country_code = array
                .map((s) => s[0])
                .join('')
                .toUpperCase();
        } else {
            address.country_code = address.country.slice(0, 2).toUpperCase();
        }
    }
    const result = addressFormatter.format(address, {
        // fallbackCountryCode: langToCountryCode(get(langStore))
    });
    if (startIndex >= 0 || endIndex >= 0) {
        return result.split('\n').slice(startIndex, endIndex);
    }
    return result.split('\n');
}

export function formatAddress(item: IItem, startIndex = -1, endIndex = -1) {
    // if (!address.name) {
    //     address.name = item.properties.name;
    // }
    const result = getAddress(item, startIndex, endIndex);
    return result.join(' ');
    // const properties = item.properties;
    // const address = properties.address;
    // let result = '';
    // // if ((properties.layer === 'housenumber' || properties.name || properties.osm_value || properties.osm_key || properties.class) && address && address.houseNumber) {
    // if (address && address.houseNumber) {
    //     result += address.houseNumber + ' ';
    // }
    // if (address.street) {
    //     result += address.street + ' ';
    // }

    // if (part === 1 && result.length > 0) {
    //     return result;
    // }
    // if (part === 2) {
    //     if (result.length === 0) {
    //         return undefined;
    //     } else {
    //         result = '';
    //     }
    // }
    // if (address.postcode) {
    //     result += address.postcode + ' ';
    // }
    // if (address.city) {
    //     result += address.city;
    //     if (address.county && address.county !== address.city) {
    //         result += '(' + address.county + ')';
    //     }
    //     result += ' ';
    // }
    // if (address.county) {
    //     result += address.county + ' ';
    // }
    // if (address.state) {
    //     result += address.state + ' ';
    // }
    // return result.trim();
}

export function openingHoursText(item: IItem) {
    const openingHours = item.properties['opening_hours'];
    if (!openingHours) {
        return null;
    }
    const oh = new SimpleOpeningHours(openingHours);
    const isOpened = oh.isOpen();
    let text = isOpened ? lc('open') : lc('closed');
    const nextTime = oh.nextTime();
    if (nextTime && (isOpened || nextTime.getDate() === new Date().getDate())) {
        text += ' - ' + (isOpened ? lc('until') : lc('opening_at')) + ' ' + formatTime(nextTime, 'LT');
    }
    return { text, isOpened, color: isOpened ? '#4ba787' : '#f90000', oh };
}
