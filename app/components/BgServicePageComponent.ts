import { BgServiceLoadedEvent } from '~/services/BgService';
import { GeoHandler } from '~/handlers/GeoHandler';
import BaseVueComponent from './BaseVueComponent';
import PageComponent from './PageComponent';

export default abstract class BgServicePageComponent extends PageComponent {
    constructor() {
        super();
    }
    mounted() {
        super.mounted();
        if (!this.$bgService) {
            return;
        }
        if (this.$bgService.loaded) {
            this.callOnServiceLoaded();
        } else {
            this.$bgService.once(BgServiceLoadedEvent, this.callOnServiceLoaded);
        }
    }
    destroyed() {
        super.destroyed();
        // clog('BgServiceComponent', 'destroyed');
        this.unloadService();
    }
    callOnServiceLoaded = () => {
        this.onServiceLoaded.call(this, this.$bgService.geoHandler);
    }
    unloadService() {
        if (!this.$bgService) {
            return;
        }
        const geoHandler = this.$bgService.geoHandler;
        this.geoHandlerListeners.forEach(r => {
            geoHandler.off(r[0], r[1], r[2] || this);
        });
        this.geoHandlerListeners = [];
        this.onServiceUnloaded.call(this, geoHandler);
    }
    geoHandlerListeners: any[] = [];
    geoHandlerOn(event, listener, context?) {
        this.geoHandlerListeners.push([event, listener]);
        this.geoHandler.on(event, listener, context || this);
        return this;
    }

    get geoHandler() {
        return this.$bgService && this.$bgService.geoHandler;
    }
    abstract onServiceLoaded(geoHandler: GeoHandler);
    onServiceUnloaded(geoHandler: GeoHandler) {}
}
