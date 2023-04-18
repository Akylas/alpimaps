import { GeoHandler } from '~/handlers/GeoHandler';
import { Observable } from '@nativescript/core';

export const BgServiceLoadedEvent: string;

export class BgService extends Observable {
    readonly geoHandler: GeoHandler;
    readonly loaded: boolean;
    readonly started: boolean;
    start();
    stop();

    // android
    showForeground(force?: boolean);
    removeForeground();
}
export function getBGServiceInstance(): BgService;
