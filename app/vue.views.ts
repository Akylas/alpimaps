import { Label as HTMLLabel } from '@nativescript-community/ui-label'; // require first to get Font res loading override
import { installMixins } from '@nativescript-community/ui-material-core';
installMixins();
import { installMixins as installUIMixins } from '@nativescript-community/systemui';
installUIMixins();
import { install as installBottomSheets } from '@nativescript-community/ui-material-bottomsheet';
installBottomSheets();
import { install as installGestures } from '@nativescript-community/gesturehandler';
installGestures();

import ActivityIndicatorPlugin from '@nativescript-community/ui-material-activityindicator/vue';
import ButtonPlugin from '@nativescript-community/ui-material-button/vue';
// import CardViewPlugin from '@nativescript-community/ui-material-cardview/vue';
import ProgressPlugin from '@nativescript-community/ui-material-progress/vue';
import SliderPlugin from '@nativescript-community/ui-material-slider/vue';
import TextFieldPlugin from '@nativescript-community/ui-material-textfield/vue';
import BottomSheetPlugin from '@nativescript-community/ui-material-bottomsheet/vue';
import SpeedDialPlugin from '@nativescript-community/ui-material-speeddial/vue';
import CartoPlugin from '@nativescript-community/ui-carto/vue';
import PBSPlugin from '@nativescript-community/ui-persistent-bottomsheet/vue';
import ImagePlugin from '@nativescript-community/ui-image/vue';
import CollectionViewPlugin from '@nativescript-community/ui-collectionview/vue';
import SystemUIPlugin from '@nativescript-community/systemui/vue';
import CanvasLabelPlugin from '@nativescript-community/ui-canvaslabel/vue';
import DrawerPlugin from '@nativescript-community/ui-drawer/vue';

import AlpiMapsPage from './components/AlpiMapsPage';
import ListItem from './components/ListItem';
import { LineChart } from '@nativescript-community/ui-chart/charts';

const Plugin = {
    install(Vue) {
        Vue.component('AlpiMapsPage', AlpiMapsPage);
        Vue.component('ListItem', ListItem);
        Vue.use(ActivityIndicatorPlugin);
        Vue.use(ButtonPlugin);
        // Vue.use(CardViewPlugin);
        Vue.use(ProgressPlugin);
        Vue.use(SliderPlugin);
        Vue.use(TextFieldPlugin);
        Vue.use(BottomSheetPlugin);
        Vue.use(CartoPlugin);
        Vue.use(CollectionViewPlugin);
        Vue.use(SystemUIPlugin);
        Vue.use(ImagePlugin);
        Vue.use(CanvasLabelPlugin);
        Vue.use(DrawerPlugin);
        Vue.use(SpeedDialPlugin);
        Vue.use(PBSPlugin);

        Vue.registerElement('LineChart', () => LineChart);
        Vue.registerElement('Label', () => HTMLLabel);
        // Vue.registerElement('AWebView', () => require('@nativescript-community/ui-webview').AWebView);
    },
};

export default Plugin;
