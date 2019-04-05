import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from 'tns-core-modules/ui/page/page';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly geoHandler: GeoHandler;
    readonly loaded: boolean;
    updateNotifText(text: string);
    start()
}
