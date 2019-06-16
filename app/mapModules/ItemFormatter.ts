import { CartoMap } from 'nativescript-carto/ui/ui';

import Map from '~/components/Map';
import MapModule from './MapModule';
import { Item } from './ItemsModule';
import { convertDistance, convertDuration } from '~/helpers/formatter';

const addressFormatter = require('@fragaria/address-formatter'); // const OPEN_DURATION = 200;

export default class ItemFormatter extends MapModule {
    onMapReady(mapComp: Map, mapView: CartoMap) {
        super.onMapReady(mapComp, mapView);
        this.log('onMapReady');
    }

    geItemIcon(item: Item) {
        const result = [];
        if (!item) {
            return result;
        }
        if (item.route) {
            return result;
        }
        const properties = item.properties;
        if (properties.osm_value) {
            result.push('maki-' + properties.osm_value);
        }
        if (properties.osm_key) {
            result.push('maki-' + properties.osm_key);
        }
        if (properties.class) {
            result.push('maki-' + properties.class);
        }
        if (properties.layer) {
            result.push('maki-' + properties.layer);
        }
        // console.log('itemIcon', result);
        return result;
    }

    getItemName(item: Item) {
        const properties = item.properties || {};
        return (this.mapComp && properties[`name_${this.mapComp.currentLanguage}`]) || properties.name || (item.address && item.address.name);
    }
    getItemPositionToString(item: Item) {
        const position = item.position;
        return `${position.lat.toFixed(3)}, ${position.lon.toFixed(3)}`;
    }
    getItemAddress(item: Item) {
        const address = item.address;
        if (address) {
            // console.log('getItemAddress', address, getCode(address.country), this.$getMapComponent().currentLanguage.toUpperCase());
            return addressFormatter.format(address, {
                countryCode: 'FR',
                appendCountry: false
            });
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
        if (item) {
            if (item.route) {
                const route = item.route;
                const dataT = convertDuration(route.totalTime * 1000);
                const dataD = convertDistance(route.totalDistance);
                return `${dataT.value.toFixed()} ${dataT.unit} ${dataD.value.toFixed()} ${dataD.unit}`;
            }
            return this.getItemName(item) || this.getItemAddress(item);
        }
        return '';
    }
    getItemSubtitle(item: Item) {
        if (item) {
            if (this.getItemName(item)) {
                return this.getItemAddress(item) || this.getItemPositionToString(item);
            }
        }
    }
}
