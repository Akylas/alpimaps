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
            result.push(...item.categories.reverse());
        }
        if (result.length === 0 && item.address && item.address.houseNumber) {
            result.push(item.address.houseNumber);
        }
        result.push('office');
        return result;
    }

    getItemName(item: Item) {
        const properties = item.properties || {};
        return properties[`name_${mapContext.getCurrentLanguage()}`] || properties.name || properties.name_int || (item.address && item.address.name);
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
        }
    }
    getItemTitle(item: Item) {
        if (item) {
            return this.getItemName(item) || this.getItemAddress(item, 1) || `${item.position.lat.toFixed(4)}, ${item.position.lon.toFixed(4)}`;
        }
        return '';
    }
    getItemSubtitle(item: Item) {
        if (item) {
            if (item.properties && item.properties.ref) {
                return item.properties.ref;
            }
            if (this.getItemName(item)) {
                return this.getItemAddress(item);
            } else {
                return this.getItemAddress(item, 2);
            }
        }
    }
}
export const formatter = new ItemFormatter();
