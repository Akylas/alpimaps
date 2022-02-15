// (com as any).tns.Runtime.getCurrentRuntime().enableVerboseLogging();
import { setGeoLocationKeys } from '@nativescript-community/gps';
import { installMixins as installUIMixins } from '@nativescript-community/systemui';
import { overrideSpanAndFormattedString } from '@nativescript-community/text';
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import CollectionViewElement from '@nativescript-community/ui-collectionview/svelte';
import DrawerElement from '@nativescript-community/ui-drawer/svelte';
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
import { installMixins, themer } from '@nativescript-community/ui-material-core';
import PagerElement from '@nativescript-community/ui-pager/svelte';
import installWebRTC from '@nativescript-community/ui-webview-rtc';
import { Application } from '@nativescript/core';
import { ScrollView } from '@nativescript/core/ui';
import { svelteNative } from 'svelte-native';
import { FrameElement, PageElement, registerElement, registerNativeViewElement } from 'svelte-native/dom';
import Map from '~/components/Map.svelte';
// import { CollectionViewTraceCategory } from '@nativescript-community/ui-collectionview';
// Trace.addCategories(Trace.categories.ViewHierarchy);
// Trace.addCategories(CollectionViewTraceCategory);
// Trace.enable();
import { start as startThemeHelper } from '~/helpers/theme';
import { BgService } from '~/services/BgService';
import { networkService } from '~/services/NetworkService';
import { install as installLogging } from '~/utils/logging';
import { startSentry } from '~/utils/sentry';
import './app.scss';

// startSentry();
installLogging();
installMixins();
installBottomSheets();
installUIMixins();
overrideSpanAndFormattedString();
installWebRTC();

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
// registerNativeViewElement('TextField', () => require('@nativescript/core').TextField);
registerNativeViewElement('Span', () => require('@nativescript/core').Span);
// registerNativeViewElement('WebView', () => require('@nativescript/core').WebView);

registerNativeViewElement('textfield', () => require('@nativescript-community/ui-material-textfield').TextField, null, {}, { override: true });
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
registerNativeViewElement('rectangle', () => require('@nativescript-community/ui-canvas/shapes').Rectangle);
registerNativeViewElement('text', () => require('@nativescript-community/ui-canvas/shapes').Text);
registerNativeViewElement('canvaslabel', () => require('@nativescript-community/ui-canvaslabel').CanvasLabel);
registerNativeViewElement('cspan', () => require('@nativescript-community/ui-canvaslabel').Span);
registerNativeViewElement('cgroup', () => require('@nativescript-community/ui-canvaslabel').Group);
registerNativeViewElement('svgview', () => require('@nativescript-community/ui-svg').SVGView);
registerNativeViewElement('bottomsheet', () => require('@nativescript-community/ui-persistent-bottomsheet').PersistentBottomSheet);
registerNativeViewElement('symbolshape', () => require('~/components/SymbolShape').default);
registerNativeViewElement('awebview', () => require('@nativescript-community/ui-webview').AWebView);
registerNativeViewElement('checkbox', () => require('@akylas/nativescript-checkbox').CheckBox);
CollectionViewElement.register();
PagerElement.register();
DrawerElement.register();

startThemeHelper();

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
    networkService.stop();
    // if (global.isAndroid) {
    // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_ON);
    // application.android.unregisterBroadcastReceiver(android.content.Intent.ACTION_SCREEN_OFF);
    // }
});
//@ts-ignore
svelteNative(Map, {});
