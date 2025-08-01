// (com as any).tns.Runtime.getCurrentRuntime().enableVerboseLogging();
import { GestureRootView, install as installGestures } from '@nativescript-community/gesturehandler';
import { setGeoLocationKeys } from '@nativescript-community/gps';
import { installMixins as installUIMixins } from '@nativescript-community/systemui';
import { overrideSpanAndFormattedString } from '@nativescript-community/text';
import { setMapPosKeys } from '@nativescript-community/ui-carto/core';
import SwipeMenuElement from '@nativescript-community/ui-collectionview-swipemenu/svelte';
import CollectionViewElement from '@nativescript-community/ui-collectionview/svelte';
import { initialize } from '@nativescript-community/ui-image';
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
import { installMixins, themer } from '@nativescript-community/ui-material-core';
import PagerElement from '@nativescript-community/ui-pager/svelte';
import installWebRTC from '@nativescript-community/ui-webview-rtc';
import { Application } from '@nativescript/core';
import { Frame, NavigatedData, Page } from '@nativescript/core/ui';
import { svelteNative } from 'svelte-native';
import { FrameElement, PageElement, registerElement, registerNativeViewElement } from 'svelte-native/dom';
import Map from '~/components/map/Map.svelte';
import { getBGServiceInstance } from '~/services/BgService';
import { networkService } from '~/services/NetworkService';
import { startSentry } from '@shared/utils/sentry';
import { NestedScrollView } from './NestedScrollView';
// import './app.scss';

try {
    startSentry();
    installGestures(true);
    installMixins();
    installBottomSheets();
    installUIMixins();
    overrideSpanAndFormattedString();
    installWebRTC();
    initialize();

    // we need to use lat lon
    setMapPosKeys('lat', 'lon');
    setGeoLocationKeys('lat', 'lon');

    registerNativeViewElement('absolutelayout', () => require('@nativescript/core').AbsoluteLayout);
    registerElement('frame', () => new FrameElement());
    registerElement('page', () => new PageElement());
    registerNativeViewElement('gridlayout', () => require('@nativescript/core').GridLayout);
    registerNativeViewElement('scrollview', () => NestedScrollView);
    registerNativeViewElement('stacklayout', () => require('@nativescript/core').StackLayout);
    registerNativeViewElement('wraplayout', () => require('@nativescript/core').WrapLayout);
    registerNativeViewElement('image', () => require('@nativescript-community/ui-image').Img);
    registerNativeViewElement('flexlayout', () => require('@nativescript/core').FlexboxLayout);
 //    registerNativeViewElement('ctextfield', () => require('@nativescript/core').TextField);
    // registerNativeViewElement('image', () => require('@nativescript/core').Image);
    registerNativeViewElement('span', () => require('@nativescript/core').Span);
    registerNativeViewElement('button', () => require('@nativescript/core').Button);

    registerNativeViewElement('mdbutton', () => require('@nativescript-community/ui-material-button').Button, null, {}, { override: true });
    registerNativeViewElement('label', () => require('@nativescript-community/ui-label').Label, null, {}, { override: true });
    registerNativeViewElement('activityindicator', () => require('@nativescript-community/ui-material-activityindicator').ActivityIndicator);
    registerNativeViewElement('progress', () => require('@nativescript-community/ui-material-progress').Progress);
    registerNativeViewElement('mdcardview', () => require('@nativescript-community/ui-material-cardview').CardView);
    registerNativeViewElement('slider', () => require('@nativescript-community/ui-material-slider').Slider, null, {}, { override: true });
    registerNativeViewElement('switch', () => require('@nativescript-community/ui-material-switch').Switch, null, {}, { override: true });
    registerNativeViewElement('textfield', () => require('@nativescript-community/ui-material-textfield').TextField, null, {}, { override: true });
    registerNativeViewElement('textview', () => require('@nativescript-community/ui-material-textview').TextView, null, {}, { override: true });
    registerNativeViewElement('lineChart', () => require('@nativescript-community/ui-chart').LineChart);
    registerNativeViewElement('cartomap', () => require('@nativescript-community/ui-carto/ui').CartoMap);
    registerNativeViewElement('canvasview', () => require('@nativescript-community/ui-canvas').CanvasView);
    registerNativeViewElement('line', () => require('@nativescript-community/ui-canvas/shapes').Line);
    registerNativeViewElement('circle', () => require('@nativescript-community/ui-canvas/shapes').Circle);
    registerNativeViewElement('rectangle', () => require('@nativescript-community/ui-canvas/shapes').Rectangle);
    registerNativeViewElement('text', () => require('@nativescript-community/ui-canvas/shapes').Text);
    registerNativeViewElement('canvaslabel', () => require('@nativescript-community/ui-canvaslabel').CanvasLabel);
    registerNativeViewElement('cspan', () => require('@nativescript-community/ui-canvaslabel').Span);
    registerNativeViewElement('cgroup', () => require('@nativescript-community/ui-canvaslabel').Group);
    // registerNativeViewElement('svgview', () => require('@nativescript-community/ui-svg').SVGView);
    // registerNativeViewElement('svg', () => require('@nativescript-community/ui-svg').SVG);
    registerNativeViewElement('bottomsheet', () => require('@nativescript-community/ui-persistent-bottomsheet').PersistentBottomSheet);
    registerNativeViewElement('gesturerootview', () => require('@nativescript-community/gesturehandler').GestureRootView);
    registerNativeViewElement('symbolshape', () => require('~/components/common/SymbolShape').default);
    registerNativeViewElement('awebview', () => require('@nativescript-community/ui-webview').AWebView);
    registerNativeViewElement('checkbox', () => require('@nativescript-community/ui-checkbox').CheckBox);
    registerNativeViewElement('lottie', () => require('@nativescript-community/ui-lottie').LottieView);
    CollectionViewElement.register();
    SwipeMenuElement.register();
    PagerElement.register();
    if (PLAY_STORE_BUILD) {
        import('@shared/utils/inapp-purchase').then((r) => r.init());
    }

    // DrawerElement.register();

    // Trace.addCategories(Trace.categories.NativeLifecycle);
    // Trace.addCategories(Trace.categories.Transition);
    // Trace.addCategories(Trace.categories.Animation);
    // Trace.addCategories(ChartTraceCategory);
    // Trace.enable();

    themer.createShape('round', {
        cornerFamily: 'rounded' as any,
        cornerSize: {
            value: 0.5,
            unit: '%'
        }
    });
    themer.createShape('none', {
        cornerFamily: 'rounded' as any,
        cornerSize: {
            value: 0,
            unit: '%'
        }
    });
    themer.createShape('medium', {
        cornerFamily: 'rounded' as any,
        cornerSize: 12
    });

    // we need to instantiate it to "start" it
    const bgService = getBGServiceInstance();
    Application.on(Application.launchEvent, () => {
        networkService.start();
        bgService.start();
    });
    Application.on(Application.exitEvent, () => {
        networkService.stop();
        bgService.stop();
    });

    if (!PRODUCTION && DEV_LOG) {
        Page.on('navigatingTo', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'to', event.object, event.isBackNavigation);
        });
        Page.on('showingModally', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'MODAL', event.object, event.isBackNavigation);
        });
        Frame.on('showingModally', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'MODAL', event.object, event.isBackNavigation);
        });
        Frame.on('closingModally', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'CLOSING MODAL', event.object, event.isBackNavigation);
        });
        Page.on('closingModally', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'CLOSING MODAL', event.object, event.isBackNavigation);
        });
        GestureRootView.on('shownInBottomSheet', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'BOTTOMSHEET', event.object, event.isBackNavigation);
        });
        GestureRootView.on('closedBottomSheet', (event: NavigatedData) => {
            DEV_LOG && console.info('NAVIGATION', 'CLOSING BOTTOMSHEET', event.object, event.isBackNavigation);
        });
    }

    svelteNative(Map, {});
} catch (error) {
    console.error(error, error.stack);
}
