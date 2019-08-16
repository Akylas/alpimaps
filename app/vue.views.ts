import { installMixins } from 'nativescript-material-core';
installMixins();
import { Label as HTMLLabel } from 'nativescript-htmllabel'; // require first to get Font res loading override

import ActivityIndicatorPlugin from 'nativescript-material-activityindicator/vue';
import ButtonPlugin from 'nativescript-material-button/vue';
import CardViewPlugin from 'nativescript-material-cardview/vue';
import ProgressPlugin from 'nativescript-material-progress/vue';
import RipplePlugin from 'nativescript-material-ripple/vue';
import SliderPlugin from 'nativescript-material-slider/vue';
import TextFieldPlugin from 'nativescript-material-textfield/vue';
import BottomSheetPlugin from 'nativescript-material-bottomsheet/vue';
import CartoPlugin from 'nativescript-carto/vue';
import ImagePlugin from 'nativescript-image/vue';
import CollectionViewPlugin from 'nativescript-collectionview/vue';
import FabPlugin from 'nativescript-vue-fab';
import SystemUIPlugin from 'nativescript-systemui/vue';

import RadChart from 'nativescript-ui-chart/vue';
import AlpiMapsPage from './components/AlpiMapsPage';

// import MultiDrawer from 'nativescript-vue-multi-drawer';
const Plugin = {
    install(Vue) {
        Vue.component('AlpiMapsPage', AlpiMapsPage);
        Vue.use(ActivityIndicatorPlugin);
        Vue.use(ButtonPlugin);
        Vue.use(CardViewPlugin);
        Vue.use(ProgressPlugin);
        Vue.use(RipplePlugin);
        Vue.use(SliderPlugin);
        Vue.use(TextFieldPlugin);
        Vue.use(BottomSheetPlugin);
        Vue.use(CartoPlugin);
        Vue.use(FabPlugin);
        Vue.use(CollectionViewPlugin);
        Vue.use(RadChart);
        Vue.use(SystemUIPlugin);
        Vue.use(ImagePlugin);
        // Vue.use(MultiDrawer);

        Vue.registerElement('Label', () => HTMLLabel);
        // registerElement('SVGImage', () => require('@teammaestro/nativescript-svg').SVGImage);
    }
};

export default Plugin;
