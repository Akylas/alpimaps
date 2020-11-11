import { Component, Prop, Watch } from 'vue-property-decorator';
import BaseVueComponent from '~/components/BaseVueComponent';

@Component({
    inheritAttrs: false,
})
export default class ListItem extends BaseVueComponent {
    @Prop({ type: String })
    title: string;
    @Prop({ default: 1, type: Number })
    sizeFactor: number;
    @Prop({ type: String })
    subtitle: string;
    @Prop({ type: String })
    overText: string;
    @Prop({ type: String })
    date: string;
    @Prop({ type: String })
    rightIcon: string;
    @Prop({ type: String })
    rightButton: string;
    @Prop({ type: String })
    leftIcon: string;
    @Prop({ type: String })
    avatar: string;
    @Prop({ default: true, type: Boolean })
    showBottomLine: boolean;

    @Prop({ default: '#5C5C5C', type: String })
    overlineColor: string;
    @Prop({ default: '#676767', type: String })
    subtitleColor: string;

    @Watch('avatar')
    onAvatar(value, oldValue) {
        // console.log('onAvatar', value, oldValue, new Error().stack);
        this.nativeView && this.nativeView.requestLayout();
    }

    get showAvatar() {
        // console.log('showAvatar', !!this.avatar);
        return !!this.avatar;
    }

    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

    // get height() {
    //     if (this.leftIcon) {
    //         return 72;
    //     }
    // }
}
