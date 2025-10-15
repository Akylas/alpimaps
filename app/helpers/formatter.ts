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
import { UNITS, UNIT_FAMILIES } from './units';
import { imperialUnits } from '~/variables';

export { UNITS };

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

export function formatDistance(meters) {
    return formatValue(meters, meters < 1000 ? UNITS.Meters:UNITS.Kilometers);
}
export function convertElevation(meters) {
    return formatValue(meters, UNITS.Meters);
}

export function kelvinToCelsius(kelvinTemp) {
    return kelvinTemp - 273.15;
}

function celciusToFahrenheit(kelvinTemp) {
    return (9 * kelvinTemp) / 5 + 32;
}

export function toImperialUnit(unit: UNITS, imperial = imperialUnits) {
    if (imperial === false) {
        return unit;
    }
    switch (unit) {
        case UNITS.MM:
        case UNITS.CM:
            return 'in';
        case UNITS.Meters:
            return 'ft';
        case UNITS.Kilometers:
            return 'm';
        case UNITS.SpeedKm:
            return 'mph';
        case UNITS.SpeedM:
            return 'ft/h';
        default:
            return unit;
    }
}
export function convertValueToUnit(value: any, unit: UNITS, defaultUnit: UNITS = defaultUnitForUnit(unit), options: { round?: boolean; roundedTo05?: boolean } = {}): [number, string] {
    if (value === undefined || value === null) {
        return [null, unit];
    }
    const round = options.round ?? true;
    let digits = 1;
    let shouldRound = round;
    switch (defaultUnit) {
        case UNITS.MM:
            digits = 10;
            if (unit === UNITS.Inch) {
                digits = 100;
                value *= 0.03937008;
            } else if (unit === UNITS.CM) {
                if (value < 1) {
                    // if (unitCMToMM) {
                    // unit = UNITS.MM;
                    // } else {
                    value /= 10;
                    digits = 100;
                    // }
                } else {
                    digits = 100;
                    value /= 10;
                }
            }
            break;
        case UNITS.CM:
            digits = 10;
            value /= 10;
            if (unit === UNITS.CM && value < 1) {
                // if (unitCMToMM) {
                //     unit = UNITS.MM;
                //     value *= 10;
                // } else {
                digits = 100;
                // }
            }
            //     if (unit === UNITS.Inch) {
            //         digits = 10;
            //         value *= 0.3937008;
            //     } else if (unit === UNITS.MM) {
            //         value *= 10;
            //     }
            break;
        case UNITS.Meters:
            shouldRound = true;
            if (unit === UNITS.Feet) {
                value *= 3.28084;
                digits = 100;
            } else if (unit === UNITS.Inch) {
                digits = 100;
                value *= 39.3701;
            } else if (unit === UNITS.Miles) {
                digits = 10;
                value *= 0.000621371;
            } else if (unit === UNITS.Kilometers) {
                value /= 1000;
                digits = 10;
            }
            break;
        case UNITS.PressureHpa:
            shouldRound = true;
            digits = 10;
            if (unit === UNITS.kPa) {
                value /= 10;
            } else if (unit === UNITS.MMHg) {
                value *= 0.750061561303;
            } else if (unit === UNITS.InchHg) {
                value *= 0.0295299830714;
            }
            break;
        case UNITS.SpeedKm:
            shouldRound = true;
            if (unit === UNITS.MPH) {
                value *= 0.6213712;
            } else if (unit === UNITS.FPH) {
                value *= 3280.84;
            } else if (unit === UNITS.SpeedM) {
                value *= 1000;
            } else if (unit === UNITS.Knot) {
                value /= 1.852;
            }
            break;
        case UNITS.Date:
            return [formatDate(value, 'L LT'), ''];
        default:
    }

    if (options.roundedTo05 === true) {
        value = ((Math.round(value * 2) / 2) * 10) / 10;
    }
    // DEV_LOG && console.log('convertValueToUnit', value, unit, defaultUnit, shouldRound, digits);
    return [shouldRound ? Math.round(value * digits) / digits : value, unit];
    // switch (unit) {
    //     case UNITS.Percent:
    //     case UNITS.UV:
    //         return [round ? Math.round(value) : value, unit];
    //     case UNITS.CM:
    //     case UNITS.MM:
    //         let digits = 10;
    //         if (imperialUnits) {
    //             digits = 100;
    //             value *= 0.03937008; // to in
    //         } else if (unit === UNITS.CM) {
    //             value /= 10;
    //             if (value < 0.1) {
    //                 unit = UNITS.MM;
    //                 value *= 10;
    //             }
    //         }
    //         return [round ? Math.round(value * digits) / digits : value, toImperialUnit(unit, imperialUnits)];
    //     case UNITS.Celcius:
    //         if (imperialUnits) {
    //             value = celciusToFahrenheit(value);
    //         }
    //         return [metricDecimalTemp ? Math.round(value * 10) / 10 : round ? Math.round(value) : value, unit];
    //     case UNITS.Celcius:
    //         if (imperialUnits) {
    //             value = celciusToFahrenheit(value);
    //         }
    //         return [metricDecimalTemp ? Math.round(value * 10) / 10 : round ? Math.round(value) : value, unit];
    //     case UNITS.Date:
    //         return [formatDate(value, 'L LT'), ''];

    //     case UNITS.SpeedM:
    //     case UNITS.Meters:
    //         if (imperialUnits) {
    //             value *= 3.28084; // to feet
    //         }
    //         return [Math.round(value), toImperialUnit(unit, imperialUnits)];
    //     case UNITS.Kilometers:
    //         if (imperialUnits) {
    //             value *= 3.28084; // to feet
    //             if (value < 5280) {
    //                 return [round ? Math.round(value) : value, toImperialUnit(UNITS.Meters, imperialUnits)];
    //             } else if (value > 528000) {
    //                 value /= 5280;
    //                 return [round ? Math.round(value) : value, toImperialUnit(unit, imperialUnits)];
    //             } else {
    //                 value /= 5280;
    //                 return [round ? Math.round(value * 10) / 10 : value, toImperialUnit(unit, imperialUnits)];
    //             }
    //         } else {
    //             if (value < 1000) {
    //                 return [round ? Math.round(value) : value, UNITS.Meters];
    //             } else if (value > 100000) {
    //                 value /= 1000;
    //                 return [round ? Math.round(value) : value, unit];
    //             } else {
    //                 value /= 1000;
    //                 return [round ? Math.round(value * 10) / 10 : value, unit];
    //             }
    //         }

    //     case UNITS.SpeedKm:
    //         if (imperialUnits) {
    //             value *= 0.6213712; // to mph
    //         }
    //         // if (value < 100) {
    //         //     return [value.toFixed(1), unit];
    //         // } else {
    //         // if > 100 we still need to send a . at the end...
    //         if (options.roundedTo05 === true) {
    //             return [((Math.round(value * 2) / 2) * 10) / 10, toImperialUnit(unit, imperialUnits)];
    //         }
    //         return [round ? Math.round(value) : value, toImperialUnit(unit, imperialUnits)];
    //     // }
    //     default:
    //         return [round ? Math.round(value) : value, toImperialUnit(unit, imperialUnits)];
    // }
}

export function formatValueToUnit(value: any, unit: UNITS, defaultUnit: UNITS, options: { prefix?: string; join?: string; unitScale?: number; roundedTo05?: boolean } = {}) {
    // if (unit === UNITS.Celcius) {
    //     options.join ??= '';
    // } else {
    options.join ??= ' ';
    // }
    const array = convertValueToUnit(value, unit, defaultUnit, options);
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

export function defaultUnitForUnit(unit: UNITS) {
    switch (unit) {
        case UNITS.Knot:
        case UNITS.MPH:
        case UNITS.FPH:
        case UNITS.SpeedKm:
        case UNITS.SpeedM:
            return UNITS.SpeedKm;
        case UNITS.PressureHpa:
        case UNITS.InchHg:
        case UNITS.kPa:
            return UNITS.PressureHpa;
        case UNITS.Meters:
        case UNITS.Feet:
        case UNITS.Inch:
        case UNITS.Kilometers:
        case UNITS.Miles:
            return UNITS.Meters;
        case UNITS.Percent:
            return UNITS.Percent;
        case UNITS.CM:
        case UNITS.MM:
            return UNITS.CM;
        default:
            break;
    }
}
export function formatValue(value, unit: UNITS, options?: { prefix?: string; join?: string; unitScale?: number; roundedTo05?: boolean; canForcePrecipUnit?: boolean; defaultUnit?: UNITS }) {
    return formatValueToUnit(value, unit, options?.defaultUnit ?? defaultUnitForUnit(unit), options);
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
