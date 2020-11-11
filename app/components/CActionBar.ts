import { Component, Prop } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { actionBarHeight } from '~/variables';
import { Frame } from '@akylas/nativescript';

@Component({})
export default class ActionBar extends BaseVueComponent {
    @Prop({
        default: null,
        type: String,
    })
    public title: string;

    @Prop({ default: actionBarHeight, type: Number })
    public height: number;

    @Prop({ default: null, type: String })
    public subtitle: string;

    @Prop({ default: false, type: Boolean })
    public showMenuIcon: boolean;

    @Prop({ default: false, type: Boolean })
    public modalWindow: boolean;

    // @Prop({ default: false })
    public canGoBack = false;

    @Prop({ default: true, type: Boolean })
    public showLogo: boolean;

    get menuIcon() {
        if (this.modalWindow) {
            return 'mdi-close';
        }
        if (this.canGoBack) {
            return global.isIOS ? 'mdi-chevron-left' : 'mdi-arrow-left';
        }
        return 'mdi-menu';
    }
    get menuIconVisible() {
        return this.modalWindow || this.canGoBack || this.showMenuIcon;
    }

    mounted() {
        setTimeout(() => {
            this.canGoBack = Frame.topmost() && Frame.topmost().canGoBack();
        }, 0);
    }
    onMenuIcon() {
        const canGoBack = this.canGoBack;
        // const canGoBack = this.innerFrame && this.innerFrame.canGoBack();

        if (canGoBack) {
            return this.$navigateBack();
        } else {
            this.$emit('tapMenuIcon');
            // this.drawer.toggle();
        }
    }
}
