import { Component, Prop } from 'vue-property-decorator';
import Vue from 'nativescript-vue';

import { ItemEventData } from 'tns-core-modules/ui/list-view/list-view';
import { android as androidApp } from 'application';
import { clog } from '~/utils/logging';

@Component({})
export default class OptionSelect extends Vue {
    @Prop({})
    public options: Array<{ name: string; data: string }>;

    public height = androidApp ? 350 : '100%';
    @Prop({ default: 'available devices' })
    title: string;
    public constructor() {
        super();
    }

    public close(value?: { name: string; data: string }) {
        this.$modal.close(value);
        // this.indicator.hide();
    }

    mounted() {}

    public onItemTap(args: ItemEventData) {
        const result = this.options[args.index];
        if (result) {
            this.close(result);
            // this.bleService.once(BLEConnectedEvent, ()=>{
            //     this.close();
            // })
            // this.bleService.connect(device.UUID);
        }
    }
}
