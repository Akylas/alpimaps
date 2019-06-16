import * as Platform from 'platform';
import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
dayjs.extend(LocalizedFormat);
// const dayjs: (...args) => Dayjs = require('dayjs');

import humanUnit from 'human-unit';
const timePreset = {
    factors: [1000, 60, 60, 24],
    units: ['ms', 's', 'min', 'hour', 'day']
};
const distancePreset = {
    factors: [1000],
    units: ['m', 'km']
};

const supportedLanguages = ['en', 'fr'];

export function getCurrentDateLanguage() {
    const deviceLang = Platform.device.language;
    if (supportedLanguages.indexOf(deviceLang) !== -1) {
        return deviceLang;
    }
    return 'en-US';
}

export function convertTime(date, formatStr: string) {
    // clog('convertTime', date, formatStr);
    return dayjs(date).format(formatStr);
}

// function createDateAsUTC(date) {
//     return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
// }

export function convertDuration(milliseconds) {
    // clog('convertDuration', date, formatStr, test, result);
    return humanUnit(milliseconds, timePreset);
}
export function convertDistance(meters) {
    // clog('convertDuration', date, formatStr, test, result);
    return humanUnit(meters, distancePreset);
}

export function convertValueToUnit(value: any, unit, otherParam?) {
    if (value === undefined || value === null) {
        return ['', ''];
    }
    // clog('convertValueToUnit', value, unit, otherParam);
    switch (unit) {
        case 'duration':
            return [convertDuration(value), ''];

        case 'date':
            return [convertTime(value, 'M/d/yy h:mm a'), ''];

        case 'm':
            return [value.toFixed(), unit];
        case 'km':
            if (value < 1000) {
                return [value.toFixed(), 'm'];
            } else if (value > 100000) {
                return [(value / 1000).toFixed(0), unit];
            } else {
                return [(value / 1000).toFixed(1), unit];
            }
        case 'km/h':
            return [value.toFixed(), unit];
        case 'min/km':
            return [value === 0 ? value.toFixed() : (60 / value).toFixed(1), unit];
        default:
            return [value.toFixed(), unit];
    }
}

export function formatValueToUnit(value: any, unit, options?: { prefix?: string; otherParam? }) {
    let result = convertValueToUnit(value, unit, options ? options.otherParam : undefined).join('');
    if (options && options.prefix && result.length > 0) {
        result = options.prefix + result;
    }
    return result;
}


