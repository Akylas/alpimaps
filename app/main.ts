// (com as any).tns.Runtime.getCurrentRuntime().enableVerboseLogging();
import { setGeoLocationKeys } from '@nativescript-community/gps';
import { installMixins as installUIMixins } from '@nativescript-community/systemui';
import { createNativeAttributedString, overrideSpanAndFormattedString } from '@nativescript-community/text';
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import CollectionViewElement from '@nativescript-community/ui-collectionview/svelte';
import PagerElement from '@nativescript-community/ui-pager/svelte';
import DrawerElement from '@nativescript-community/ui-drawer/svelte';
import { PagerItem } from '@nativescript-community/ui-pager';
import { initialize, shutDown } from '@nativescript-community/ui-image';
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
import { installMixins, themer } from '@nativescript-community/ui-material-core';
import { Application, Trace } from '@nativescript/core';
import { svelteNative } from 'svelte-native';
import { FrameElement, PageElement, registerElement, registerNativeViewElement } from 'svelte-native/dom';
import Map from '~/components/Map.svelte';
import { install as installLogging } from '~/utils/logging';
import { startSentry } from '~/utils/sentry';
import './app.scss';
import { BgService } from '~/services/BgService';
import { networkService } from '~/services/NetworkService';
import { ScrollView } from '@nativescript/core/ui';

startSentry();
installLogging();
installMixins();
installBottomSheets();
installUIMixins();
overrideSpanAndFormattedString();

// we need to use lat lon
setMapPosKeys('lat', 'lon');
setGeoLocationKeys('lat', 'lon');

class NestedScrollView extends ScrollView {
    createNativeView() {
        if (global.isAndroid) {
            return new androidx.core.widget.NestedScrollView(this._context);
        }
        return super.createNativeView();
    }
}
registerNativeViewElement('AbsoluteLayout', () => require('@nativescript/core').AbsoluteLayout);
registerElement('Frame', () => new FrameElement());
registerElement('Page', () => new PageElement());
registerNativeViewElement('GridLayout', () => require('@nativescript/core').GridLayout);
registerNativeViewElement('ScrollView', () => NestedScrollView as any);
registerNativeViewElement('StackLayout', () => require('@nativescript/core').StackLayout);
registerNativeViewElement('flexlayout', () => require('@nativescript/core').FlexboxLayout);
registerNativeViewElement('Switch', () => require('@nativescript/core').Switch);
registerNativeViewElement('TextField', () => require('@nativescript/core').TextField);

registerNativeViewElement('button', () => require('@nativescript-community/ui-material-button').Button, null, {}, { override: true });
registerNativeViewElement('label', () => require('@nativescript-community/ui-label').Label, null, {}, { override: true });
registerNativeViewElement('mdactivityindicator', () => require('@nativescript-community/ui-material-activityindicator').ActivityIndicator);
registerNativeViewElement('mdprogress', () => require('@nativescript-community/ui-material-progress').Progress);
registerNativeViewElement('mdcardview', () => require('@nativescript-community/ui-material-cardview').CardView);
registerNativeViewElement('slider', () => require('@nativescript-community/ui-material-slider').Slider, null, {}, { override: true });
registerNativeViewElement('lineChart', () => require('@nativescript-community/ui-chart').LineChart);
registerNativeViewElement('cartomap', () => require('@nativescript-community/ui-carto/ui').CartoMap);
registerNativeViewElement('canvas', () => require('@nativescript-community/ui-canvas').CanvasView);
registerNativeViewElement('line', () => require('@nativescript-community/ui-canvas/shapes').Line);
registerNativeViewElement('circle', () => require('@nativescript-community/ui-canvas/shapes').Circle);
registerNativeViewElement('text', () => require('@nativescript-community/ui-canvas/shapes').Text);
registerNativeViewElement('image', () => require('@nativescript-community/ui-image').Img, null, {}, { override: true });
registerNativeViewElement('canvaslabel', () => require('@nativescript-community/ui-canvaslabel').CanvasLabel);
registerNativeViewElement('cspan', () => require('@nativescript-community/ui-canvaslabel').Span);
registerNativeViewElement('cgroup', () => require('@nativescript-community/ui-canvaslabel').Group);
registerNativeViewElement('svgview', () => require('@nativescript-community/ui-svg').SVGView);
registerNativeViewElement('bottomsheet', () => require('@nativescript-community/ui-persistent-bottomsheet').PersistentBottomSheet);
registerNativeViewElement('symbolshape', () => require('~/components/SymbolShape').default);
registerNativeViewElement('awebview', () => require('@nativescript-community/ui-webview').AWebView);
registerNativeViewElement('checkbox', () => require('@akylas/nativescript-checkbox').CheckBox);
registerNativeViewElement('pageritem', () => PagerItem);
CollectionViewElement.register();
PagerElement.register();
DrawerElement.register();
// (com as any).swmansion.gesturehandler.GestureHandler.debug = true;

// Trace.addCategories(CollectionViewTraceCategory);
// Trace.enable();
import { start } from '~/helpers/theme';
import { CollectionViewTraceCategory } from '@nativescript-community/ui-collectionview';
// on startup we need to ensure theme is loaded because of a mixin
// on startup we need to say what we are using
start();

if (global.isIOS) {
    const variables = require('~/variables');
    const primaryColor = variables.primaryColor;
    themer.setPrimaryColor(primaryColor);
    themer.setAccentColor(primaryColor);
}
themer.createShape('round', {
    cornerFamily: 'rounded' as any,
    cornerSize: {
        value: 0.5,
        unit: '%'
    }
});

// we need to instantiate it to "start" it
const bgService = new BgService();
Application.on(Application.launchEvent, () => {
    initialize({ isDownsampleEnabled: true });

    networkService.start();
    // const receiverCallback = (androidContext, intent: android.content.Intent) => {
    //     console.log('receiverCallback', intent.getAction(), intent.getAction() === android.content.Intent.ACTION_SCREEN_ON);
    // (Vue.prototype.$getAppComponent() as App).$emit('screen', intent.getAction() === android.content.Intent.ACTION_SCREEN_ON);
    // };
    // application.android.registerBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON, receiverCallback);
    // application.android.registerBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF, receiverCallback);
    // }
});
Application.on(Application.exitEvent, () => {
    shutDown();
    networkService.stop();
    // if (global.isAndroid) {
    // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON);
    // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF);
    // }
});
svelteNative(Map, {});
