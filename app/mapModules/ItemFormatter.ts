import { formatAddress } from '~/helpers/formatter';
import { IItem as Item } from '~/models/Item';
import MapModule, { getMapContext } from './MapModule';
const mapContext = getMapContext();

export default class ItemFormatter {
    geItemIcon(item: Item) {
        const result: string[] = [];
        if (!item) {
            return result;
        }
        if (item.route) {
            return result;
        }
        const properties = item.properties;
        if (properties) {
            if (properties.osm_value) {
                result.push(properties.osm_value);
            }
            if (properties.osm_key) {
                result.push(properties.osm_key);
            }
            if (properties.class) {
                result.push(properties.class);
            }
            if (properties.subclass) {
                result.push(properties.subclass);
            }
            if (properties.layer && properties.layer !== 'housenumber') {
                result.push(properties.layer);
            }
        }
        if (item.categories) {
            result.push(item.categories[0]);
        }
        if (result.length === 0 && item.address && item.address.houseNumber) {
            result.push(item.address.houseNumber);
        }
        result.push('office');
        return result;
    }

    getItemName(item: Item) {
        const properties = item.properties || {};
        return (
            properties[`name_${mapContext.getCurrentLanguage()}`] ||
            properties.name ||
            properties.name_int ||
            (item.address && item.address.name)
        );
    }
    getItemPositionToString(item: Item) {
        const position = item.position;
        if (position) {
            return `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`;
        }
        return '';
    }
    getItemAddress(item: Item, part = 0) {
        const address = item.address;
        if (address) {
            return formatAddress(item, part);
            // const houseNumber = address.houseNumber;
            // if (houseNumber > 0) {
            //     result = houseNumber + ', ';
            // }
            // const street = address.street;
            // if (street && street !== this.getItemName(item)) {
            //     result += street;
            // }
            // // const city = address.locality;
            // // if (city) {
            // //     result = (result ? result + ', ' : '') + city;
            // // }
            // const county = address.county;
            // if (county) {
            //     result = (result ? result + ' ' : '') + county;
            // }
            // const postcode = address.postcode;
            // if (postcode) {
            //     result = (result ? result + ' ' : '') + postcode;
            // }
            // // const country = address.country;
            // // if (country) {
            // //     result = (result ? result + ' ' : '') + country;
            // // }
            // return result;
        }
    }
    getItemTitle(item: Item) {
        // console.log('getItemTitle', item);
        if (item) {
            // if (item.route) {
            //     const route = item.route;
            //     const dataT = convertDuration(route.totalTime * 1000);
            //     const dataD = convertDistance(route.totalDistance);
            //     return `<>${dataT} ${dataD.value.toFixed(1)} ${dataD.unit}`;
            // }
            return (
                this.getItemName(item) ||
                this.getItemAddress(item, 1) ||
                `${item.position.lat.toFixed(4)}, ${item.position.lon.toFixed(4)}`
            );
        }
        return '';
    }
    getItemSubtitle(item: Item) {
        // console.log('getItemSubtitle', item);
        if (item) {
            if (item.properties && item.properties.ref) {
                return item.properties.ref;
            }
            // console.log('getItemSubtitle', item);
            if (this.getItemName(item)) {
                return this.getItemAddress(item);
            } else {
                return this.getItemAddress(item, 2);
            }
        }
    }
}
export const formatter = new ItemFormatter();
