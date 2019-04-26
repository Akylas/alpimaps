import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from 'tns-core-modules/data/observable';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly geoHandler: GeoHandler;
    readonly loaded: boolean;
    updateNotifText(text: string);
    start()
}
