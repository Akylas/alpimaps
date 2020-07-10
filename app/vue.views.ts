import { installMixins } from 'nativescript-material-core';
installMixins();
import { installMixins as installUIMixins } from 'nativescript-systemui';
installUIMixins();
import { Label as HTMLLabel } from 'nativescript-htmllabel'; // require first to get Font res loading override

import ActivityIndicatorPlugin from 'nativescript-material-activityindicator/vue';
import ButtonPlugin from 'nativescript-material-button/vue';
import CardViewPlugin from 'nativescript-material-cardview/vue';
import ProgressPlugin from 'nativescript-material-progress/vue';
import SliderPlugin from 'nativescript-material-slider/vue';
import TextFieldPlugin from 'nativescript-material-textfield/vue';
import BottomSheetPlugin from 'nativescript-material-bottomsheet/vue';
import CartoPlugin from 'nativescript-carto/vue';
import ImagePlugin from 'nativescript-image/vue';
import CollectionViewPlugin from 'nativescript-collectionview/vue';
import FabPlugin from 'nativescript-vue-fab';
import SystemUIPlugin from 'nativescript-systemui/vue';
import CanvasLabelPlugin from 'nativescript-canvaslabel/vue';

import AlpiMapsPage from './components/AlpiMapsPage';
import ListItem from './components/ListItem';

// import MultiDrawer from 'nativescript-vue-multi-drawer';
const Plugin = {
    install(Vue) {
        Vue.component('AlpiMapsPage', AlpiMapsPage);
        Vue.component('ListItem', ListItem);
        Vue.use(ActivityIndicatorPlugin);
        Vue.use(ButtonPlugin);
        Vue.use(CardViewPlugin);
        Vue.use(ProgressPlugin);
        Vue.use(SliderPlugin);
        Vue.use(TextFieldPlugin);
        Vue.use(BottomSheetPlugin);
        Vue.use(CartoPlugin);
        Vue.use(FabPlugin);
        Vue.use(CollectionViewPlugin);
        Vue.use(SystemUIPlugin);
        Vue.use(ImagePlugin);
        Vue.use(CanvasLabelPlugin);
        // Vue.use(MultiDrawer);

        Vue.registerElement('LineChart', () => require('nativescript-chart/charts/LineChart').default);
        Vue.registerElement('Label', () => HTMLLabel);
        Vue.registerElement('AWebView', () => require('nativescript-webview-plus').AWebView);

        // registerElement('SVGImage', () => require('@teammaestro/nativescript-svg').SVGImage);
    }
};

export default Plugin;
