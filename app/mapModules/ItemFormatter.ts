import { formatAddress } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem as Item } from '~/models/Item';
const mapContext = getMapContext();

export default class ItemFormatter {
    geItemIcon(item: Item) {
        const result: string[] = [];
        if (!item) {
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
            if (properties.subclass) {
                result.push(...properties.subclass.split(';'));
            }
            if (properties.class) {
                result.push(properties.class);
            }
            if (properties.layer && properties.layer !== 'housenumber') {
                result.push(properties.layer);
            }
        }
        if (properties.categories) {
            result.push(...properties.categories);
        }
        if (result.length === 0 && properties.address && properties.address.houseNumber) {
            result.push(properties.address.houseNumber);
        }
        result.push('office');
        return result;
    }

    getItemName(item: Item, lang = mapContext.getCurrentLanguage()) {
        const properties = item.properties || {};
        let name = properties[`name:${lang}`] ||
            properties['name:en'] ||
            properties['name_latin'] ||
            properties.name_int ||
            properties.int_name ||
            properties.name;
        if (name && properties.name && name !== properties.name) {
            name = name + ` (${properties.name})`;
        }
        return (
            name ||
            (properties.address && properties.address.name) ||
            (properties.subclass && lc(properties.subclass.replace(/-/g, '_'))) ||
            (properties.class && lc(properties.class.replace(/-/g, '_')))
        );
    }
    getItemPositionToString(item: Item) {
        if (item.geometry?.type === 'Point') {
            return `${item.geometry.coordinates[1].toFixed(3)}, ${item.geometry.coordinates[0].toFixed(3)}`;
        }
        return '';
    }
    getItemAddress(item: Item, startIndex?, endIndex?) {
        if (item.properties?.address) {
            return formatAddress(item, startIndex, endIndex);
        }
    }
    getItemTitle(item: Item, lang?: string) {
        if (item) {
            return this.getItemName(item, lang) || this.getItemAddress(item, 0, 1) || this.getItemPositionToString(item);
        }
        return '';
    }
    getItemSubtitle(item: Item, itemTile?: string) {
        if (item) {
            const properties = item.properties;
            if (properties?.subtitle) {
                return properties.subtitle;
            }
            if (properties?.ref) {
                return properties.ref;
            }
            if (itemTile) {
                return this.getItemAddress(item);
            } else {
                return this.getItemAddress(item, 1);
            }
            
        }
    }
    getSymbol(itemProps) {
        if (!itemProps) {
            return null;
        }
        if (itemProps.symbol) {
            return itemProps.symbol;
        } else {
            if (itemProps.class === 'hiking') {
                switch (itemProps.network) {
                    case 4:
                        return 'yellow:yellow:green_lower';
                    case 3:
                        return 'yellow:white:yellow_lower';
                    default:
                        return 'red:white:red_lower:50:black';
                }
            } else if (itemProps.class === 'bicycle') {
                switch (itemProps.network) {
                    case 1:
                        return '#c70000:white:#c70000_bar';
                    default:
                        return '#6000eb:white:#6000eb_bar';
                }
            }
            return `blue:white:${itemProps.color || 'blue'}_bar`;
        }
    }

    getRouteIcon(type, subtype) {
        if (type === 'pedestrian') {
            switch (subtype) {
                case 'mountainairing':
                    return 'alpimaps-mountainairing';
                case 'running':
                    return 'alpimaps-running';
                default:
                    return 'alpimaps-directions_walk';
            }
        }
        if (type === 'bicycle') {
            switch (subtype) {
                case 'enduro':
                    return 'alpimaps-enduro';
                case 'gravel':
                    return 'alpimaps-gravel';
                case 'road':
                    return 'alpimaps-road-cycling';
                case 'mountain':
                    return 'alpimaps-mountain-biking';
                default:
                    return 'alpimaps-touring';
            }
        }
    }
}
export const formatter = new ItemFormatter();
