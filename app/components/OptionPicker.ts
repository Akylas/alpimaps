import { Component, Prop } from 'vue-property-decorator';
import Vue from 'nativescript-vue';

import { ItemEventData } from 'tns-core-modules/ui/list-view/list-view';
import { android as androidApp } from 'application';
import { clog } from '~/utils/logging';

@Component({})
export default class OptionPicker extends Vue {
    @Prop({})
    public options: Array<{ name: string; checked: boolean }>;

    // public height = '100%';
    @Prop({ default: 'pick options' })
    title: string;
    public constructor() {
        super();
    }

}
