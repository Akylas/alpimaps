import { startSentry } from '~/utils/sentry';
import { install as installLogging } from '~/utils/logging';
startSentry();
installLogging();
import { setGeoLocationKeys } from '@nativescript-community/gps';
import { installMixins as installUIMixins } from '@nativescript-community/systemui';
import { overrideSpanAndFormattedString } from '@nativescript-community/text';
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import CollectionViewElement from '@nativescript-community/ui-collectionview/svelte';
import DrawerElement from '@nativescript-community/ui-drawer/svelte';
import { Label } from '@nativescript-community/ui-label';
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
import { SpeedDial, SpeedDialItem } from '@nativescript-community/ui-material-speeddial';
import { installMixins, themer } from '@nativescript-community/ui-material-core';
import { svelteNative } from 'svelte-native';
import { DomTraceCategory, registerNativeViewElement } from 'svelte-native/dom';
import { TNSFontIcon } from 'nativescript-akylas-fonticon';
import { CanvasLabel, Group, Span } from '@nativescript-community/ui-canvaslabel';
import { Img, initialize, shutDown } from '@nativescript-community/ui-image';
import { CanvasView } from '@nativescript-community/ui-canvas';
import { Line } from '@nativescript-community/ui-canvas/shapes';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { LineChart } from '@nativescript-community/ui-chart';
import { Slider } from '@nativescript-community/ui-material-slider';
import { Progress } from '@nativescript-community/ui-material-progress';
import { ActivityIndicator } from '@nativescript-community/ui-material-activityindicator';
import { Button } from '@nativescript-community/ui-material-button';
import { TextField } from '@nativescript-community/ui-material-textfield';
import { PersistentBottomSheet } from '@nativescript-community/ui-persistent-bottomsheet';
import { BgService } from './services/BgService';
import { Application, Trace } from '@nativescript/core';
import { networkService } from './services/NetworkService';
installMixins();
installBottomSheets();
installUIMixins();
overrideSpanAndFormattedString();

// we need to use lat lon
setMapPosKeys('lat', 'lon');
setGeoLocationKeys('lat', 'lon');

registerNativeViewElement('mdtextfield', () => TextField, null, {}, { override: true });
registerNativeViewElement('mdbutton', () => Button);
registerNativeViewElement('label', () => Label, null, {}, { override: true });
registerNativeViewElement('mdactivityindicator', () => ActivityIndicator);
registerNativeViewElement('mdprogress', () => Progress);
registerNativeViewElement('mdslider', () => Slider);
registerNativeViewElement('lineChart', () => LineChart);
registerNativeViewElement('cartomap', () => CartoMap);
registerNativeViewElement('canvas', () => CanvasView);
registerNativeViewElement('line', () => Line as any);
registerNativeViewElement('image', () => Img, null, {}, { override: true });
registerNativeViewElement('canvaslabel', () => CanvasLabel);
registerNativeViewElement('cspan', () => Span as any);
registerNativeViewElement('cgroup', () => Group as any);
registerNativeViewElement('mdspeeddial', () => SpeedDial);
registerNativeViewElement('mdspeeddialitem', () => SpeedDialItem);
registerNativeViewElement('bottomsheet', () => PersistentBottomSheet);
CollectionViewElement.register();
DrawerElement.register();

if (global.isIOS) {
    const variables = require('~/variables');
    const primaryColor = variables.primaryColor;
    themer.setPrimaryColor(primaryColor);
    themer.setAccentColor(primaryColor);
}

if (DEV_LOG) {
    Trace.addCategories(DomTraceCategory);
    // Trace.addCategories(CollectionViewTraceCategory);
    Trace.enable();
}

const bgService = new BgService();
Application.on(Application.launchEvent, () => {
    initialize({ isDownsampleEnabled: true });

    if (global.isAndroid) {
        bgService.start();
        networkService.start();
        // const receiverCallback = (androidContext, intent: android.content.Intent) => {
        //     console.log('receiverCallback', intent.getAction(), intent.getAction() === android.content.Intent.ACTION_SCREEN_ON);
        // (Vue.prototype.$getAppComponent() as App).$emit('screen', intent.getAction() === android.content.Intent.ACTION_SCREEN_ON);
        // };
        // application.android.registerBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON, receiverCallback);
        // application.android.registerBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF, receiverCallback);
    }
});
Application.on(Application.exitEvent, () => {
    shutDown();
    networkService.stop();
    // if (global.isAndroid) {
    // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON);
    // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF);
    // }
});
if (global.isIOS) {
    bgService.start();
    networkService.start();
}

TNSFontIcon.paths = {
    osm: './assets/osm.css'
};
TNSFontIcon.loadCssSync();

import Map from '~/components/Map.svelte';
svelteNative(Map, {});
