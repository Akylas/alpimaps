import { Component, Prop, Watch } from 'vue-property-decorator';
import { Address, IItem as Item } from '~/models/Item';
import BaseVueComponent from './BaseVueComponent';
import { convertDistance, convertDuration, convertElevation, convertValueToUnit } from '~/helpers/formatter';
// import { distanceToEnd, isLocationOnPath } from '~/utils/geo';
import { MapPos } from '@nativescript-community/ui-carto/core';
import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
import { RouteInstruction } from './DirectionsPanel';

function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const ret: any = {};
    keys.forEach((key) => {
        ret[key] = obj[key];
    });
    return ret;
}
function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const ret: any = {};
    Object.keys(obj).forEach((key) => {
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
        // console.log('test', new Error().stack)
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
    routeInstruction: RouteInstruction = null;
    currentLocation: MapPos<LatLonKeys> = null;
    onNewLocation(e: any) {
        this.currentLocation = e.data;
        // this.log('onNewLocation', location);
        return this.updateRouteItemWithPosition(this.currentLocation);
    }

    updateRouteItemWithPosition(location) {
        const routeItem = this.routeItem;
        if (routeItem) {
            const route = routeItem.route;
            const positions = route.positions;
            const onPathIndex = isLocationOnPath(location, positions, false, true, 10);
            this.log('onPathIndex', onPathIndex);
            if (onPathIndex >= 0) {
                const distance = distanceToEnd(onPathIndex, positions);
                this.remainingDistanceOnCurrentRoute = distance;
                this.routeInstruction = null;
                for (let index = route.instructions.length - 1; index >= 0; index--) {
                    const element = route.instructions[index];
                    if (element.pointIndex <= onPathIndex) {
                        this.routeInstruction = element;
                        break;
                    }
                }
                this.log('instruction', this.routeInstruction);
            } else {
                this.routeInstruction = null;
                this.remainingDistanceOnCurrentRoute = null;
            }
            return onPathIndex;
        } else {
            this.remainingDistanceOnCurrentRoute = null;
            this.routeInstruction = null;
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
            result += ` (~ ${convertDuration(
                ((route.totalTime * this.remainingDistanceOnCurrentRoute) / route.totalDistance) * 1000
            )})`;
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
