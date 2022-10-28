// (com as any).tns.Runtime.getCurrentRuntime().enableVerboseLogging();
import { install as installGestures } from '@nativescript-community/gesturehandler';
import { setGeoLocationKeys } from '@nativescript-community/gps';
import { installMixins as installUIMixins } from '@nativescript-community/systemui';
import { overrideSpanAndFormattedString } from '@nativescript-community/text';
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import CollectionViewElement from '@nativescript-community/ui-collectionview/svelte';
// import DrawerElement from '@nativescript-community/ui-drawer/svelte';
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
import { installMixins, themer } from '@nativescript-community/ui-material-core';
import PagerElement from '@nativescript-community/ui-pager/svelte';
import installWebRTC from '@nativescript-community/ui-webview-rtc';
import { Application, Trace } from '@nativescript/core';
import { ScrollView } from '@nativescript/core/ui';
import { svelteNative } from 'svelte-native';
import { FrameElement, PageElement, registerElement, registerNativeViewElement } from 'svelte-native/dom';
import { start as startThemeHelper } from '~/helpers/theme';
import { BgService } from '~/services/BgService';
import { networkService } from '~/services/NetworkService';
import { startSentry } from '~/utils/sentry';
import './app.scss';
import Map from '~/components/Map.svelte';

startSentry();
installGestures(true);
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
        if (__ANDROID__) {
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
registerNativeViewElement('Span', () => require('@nativescript/core').Span);
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
registerNativeViewElement('svg', () => require('@nativescript-community/ui-svg').SVG);
registerNativeViewElement('bottomsheet', () => require('@nativescript-community/ui-persistent-bottomsheet').PersistentBottomSheet);
registerNativeViewElement('gesturerootview', () => require('@nativescript-community/gesturehandler').GestureRootView);
registerNativeViewElement('symbolshape', () => require('~/components/SymbolShape').default);
registerNativeViewElement('awebview', () => require('@nativescript-community/ui-webview').AWebView);
registerNativeViewElement('checkbox', () => require('@nativescript-community/ui-checkbox').CheckBox);
CollectionViewElement.register();
PagerElement.register();
// DrawerElement.register();

// Trace.addCategories(Trace.categories.NativeLifecycle);
// Trace.addCategories(Trace.categories.Transition);
// Trace.addCategories(Trace.categories.Animation);
// Trace.addCategories(Trace.categories.All);
// Trace.enable();

startThemeHelper();

if (__IOS__) {
    const variables = require('~/variables');
    const primaryColor = variables.primaryColor;
    themer.setPrimaryColor(primaryColor);
    themer.setAccentColor(primaryColor);
}
// if (!global.window) {
//     window = global.window = {
//         requestAnimationFrame,
//         cancelAnimationFrame,
//         performance: {
//             now: time
//         } as any
//     } as any;
// } else if (!global.window.requestAnimationFrame) {
//     global.window.requestAnimationFrame = requestAnimationFrame;
//     global.window.cancelAnimationFrame = cancelAnimationFrame;
//     if (!global.window.performance) {
//         global.window.performance = {
//             now: time
//         } as any;
//     }
// }
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
});
Application.on(Application.exitEvent, () => {
    networkService.stop();
});
//@ts-ignore
svelteNative(Map, {});
