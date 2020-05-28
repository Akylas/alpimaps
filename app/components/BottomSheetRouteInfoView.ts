import { Component, Prop, Watch } from 'vue-property-decorator';
import { Item } from '~/mapModules/ItemsModule';
import BaseVueComponent from './BaseVueComponent';
import { convertDistance, convertDuration, convertElevation, convertValueToUnit } from '~/helpers/formatter';
import { distanceToEnd, isLocationOnPath } from '~/utils/geo';
import { MapPos } from 'nativescript-carto/core';

function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const ret: any = {};
    keys.forEach(key => {
        ret[key] = obj[key];
    });
    return ret;
}
function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const ret: any = {};
    Object.keys(obj).forEach(key => {
        if (keys.indexOf(key as any) === -1) {
            ret[key] = obj[key];
        }
    });
    return ret;
}

@Component({})
export default class BottomSheetRouteInfoView extends BaseVueComponent {
    @Prop()
    routeItem: Item;

    mounted() {
        super.mounted();
        console.log('test', new Error().stack)
    }
    destroyed() {
        super.destroyed();
    }

    @Watch('routeItem')
    onRouteChanged() {
        if (this.currentLocation) {
            this.updateRouteItemWithPosition(this.currentLocation);
        }
    }

    remainingDistanceOnCurrentRoute = null;
    currentLocation: MapPos<LatLonKeys> = null;
    onNewLocation(e: any) {
        this.currentLocation = e.data;
        // this.log('onNewLocation', location);
        return this.updateRouteItemWithPosition(this.currentLocation);
    }

    updateRouteItemWithPosition(location) {
        if (this.routeItem) {
            const positions = this.routeItem.route.positions;
            const onPathIndex = isLocationOnPath(location, positions, false, true, 10);
            // this.log('onPathIndex', onPathIndex);
            if (onPathIndex >= 0) {
                const distance = distanceToEnd(onPathIndex, positions);
                this.remainingDistanceOnCurrentRoute = distance;
                // this.log('distance to end', distance);
            } else {
                this.remainingDistanceOnCurrentRoute = null;
            }
            return onPathIndex;
        } else {
            this.remainingDistanceOnCurrentRoute = null;
        }
        return -1;
    }
    get routeDistance() {
        if (!this.routeItem) {
            return null;
        }
        const route = this.routeItem.route;
        let result = `${convertValueToUnit(route.totalDistance, 'km').join(' ')}`;
        if (this.remainingDistanceOnCurrentRoute) {
            result += ` (${convertValueToUnit(this.remainingDistanceOnCurrentRoute, 'km').join(' ')})`;
        }
        return result;
    }
    get routeDuration() {
        if (!this.routeItem) {
            return null;
        }
        const route = this.routeItem.route;
        let result = `${convertDuration(route.totalTime * 1000)}`;
        if (this.remainingDistanceOnCurrentRoute) {
            result += ` (~ ${convertDuration(((route.totalTime * this.remainingDistanceOnCurrentRoute) / route.totalDistance) * 1000)})`;
        }
        return result;
    }
    get routeDplus() {
        if (!this.hasProfile) {
            return null;
        }
        const profile = this.routeItem.route.profile;

        return `${convertElevation(profile.dplus)}`;
    }
    get routeDmin() {
        if (!this.hasProfile) {
            return false;
        }
        const profile = this.routeItem.route.profile;

        return `${convertElevation(-profile.dmin)}`;
    }
    get hasProfile() {
        if (!this.routeItem) {
            return false;
        }
        const profile = this.routeItem.route.profile;
        return !!profile && !!profile.max;
    }
}
