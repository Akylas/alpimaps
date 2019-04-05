import { registerElement } from 'nativescript-vue';
import ActivityIndicatorPlugin from 'nativescript-material-activityindicator/vue';
import ButtonPlugin from 'nativescript-material-button/vue';
import CardViewPlugin from 'nativescript-material-cardview/vue';
import ProgressPlugin from 'nativescript-material-progress/vue';
import RipplePlugin from 'nativescript-material-ripple/vue';
import SliderPlugin from 'nativescript-material-slider/vue';
import TextFieldPlugin from 'nativescript-material-textfield/vue';
import BottomSheetPlugin from 'nativescript-material-bottomsheet/vue';
import CartoPlugin from 'nativescript-carto/vue';
// import MultiDrawer from 'nativescript-vue-multi-drawer';
const Plugin = {
    install(Vue) {
        Vue.use(ActivityIndicatorPlugin);
        Vue.use(ButtonPlugin);
        Vue.use(CardViewPlugin);
        Vue.use(ProgressPlugin);
        Vue.use(RipplePlugin);
        Vue.use(SliderPlugin);
        Vue.use(TextFieldPlugin);
        Vue.use(BottomSheetPlugin);
        Vue.use(CartoPlugin);
        // Vue.use(MultiDrawer);

        registerElement('HTMLLabel', () => require('nativescript-htmllabel').Label);
        registerElement('SVGImage', () => require('@teammaestro/nativescript-svg').SVGImage);
    }
};

export default Plugin;
