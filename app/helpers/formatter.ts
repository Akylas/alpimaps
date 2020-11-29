import humanUnit from 'human-unit';
import { IItem } from '~/models/Item';
import { convertDuration, convertTime } from './locale';
export { convertDuration, convertTime } from './locale';
const timePreset = {
    factors: [1000, 60, 60, 24],
    units: ['ms', 's', 'min', 'hour', 'day']
};
const distancePreset = {
    factors: [1000],
    units: ['m', 'km']
};

const elevationPreset = {
    factors: [],
    units: ['m']
};

export function convertDistance(meters) {
    return humanUnit(meters, distancePreset);
}
export function convertElevation(meters) {
    return convertValueToUnit(meters, 'm').join(' ');
}

export function formatDuration(_time): string {
    if (_time < 0) {
        return '';
    }
    return convertDuration(_time);
}

export function convertValueToUnit(value: any, unit, otherParam?) {
    if (value === undefined || value === null) {
        return ['', ''];
    }
    const isString = typeof value === 'string';
    switch (unit) {
        case 'duration':
            return [convertDuration(value), ''];

        case 'date':
            return [convertTime(value, 'M/d/yy h:mm a'), ''];

        case 'm':
            return [isString ? value : value.toFixed(), unit];
        case 'km':
            if (isString) {
                return [value, unit];
            }
            if (value < 1000) {
                return [value.toFixed(), 'm'];
            } else if (value > 100000) {
                return [(value / 1000).toFixed(0), unit];
            } else {
                return [(value / 1000).toFixed(0), unit];
            }
        case 'km/h':
            if (isString) {
                return [value, unit];
            }
            return [value.toFixed(), unit];
        case 'min/km':
            if (isString) {
                return [value, unit];
            }
            return [value === 0 ? value.toFixed() : (60 / value).toFixed(1), unit];
        default:
            if (isString) {
                return [value, unit];
            }
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

export function formatAddress(item: IItem, part = 0) {
    const address = item.address;
    const properties = item.properties;
    let result = '';
    if ((properties.osm_value || properties.osm_key || properties.class) && address && address.houseNumber) {
        result += address.houseNumber + ' ';
    }
    if (address.road) {
        result += address.road + ' ';
    }

    if (part === 1 && result.length > 0) {
        return result;
    }
    if (part === 2) {
        if (result.length === 0) {
            return undefined;
        } else {
            result = '';
        }
    }
    if (address.postcode) {
        result += address.postcode + ' ';
    }
    if (address.county) {
        result += address.county + ' ';
    }
    // if (address.county) {
    //     result += address.county + ' ';
    // }
    if (address.region) {
        result += address.region + ' ';
    }
    return result.trimRight();
}
