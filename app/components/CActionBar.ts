import { Component, Prop } from 'vue-property-decorator';
import BaseVueComponent from './BaseVueComponent';
import { actionBarHeight } from '~/variables';

@Component({})
export default class ActionBar extends BaseVueComponent {
    @Prop({
        default: null,
        type: String
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
            return gVars.isIOS ? 'mdi-chevron-left' : 'mdi-arrow-left';
        }
        return 'mdi-menu';
    }
    get menuIconVisible() {
        return this.modalWindow || this.canGoBack || this.showMenuIcon;
    }

    mounted() {
        setTimeout(() => {
            this.canGoBack = this.$getAppComponent().canGoBack();
        }, 0);
    }
    onMenuIcon() {
        this.$getAppComponent().onMenuIcon();
    }
}
