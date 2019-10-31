import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core/data/observable';
import { BgService as AndroidBgService } from '~/services/android/BgService';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly geoHandler: GeoHandler;
    readonly loaded: boolean;
    updateNotifText(text: string);
    start()
    bgService: WeakRef<AndroidBgService>;
}
