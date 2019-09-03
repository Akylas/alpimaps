import { android as androidApp } from 'application';
import Vue from 'nativescript-vue';
import { View } from 'tns-core-modules/ui/core/view';
import { ItemEventData } from 'tns-core-modules/ui/list-view';
import { Component, Prop } from 'vue-property-decorator';

export interface OptionType {
    name: string;
    data?: string;
}

@Component({})
export default class OptionSelect extends Vue {
    @Prop({})
    public options: OptionType[];

    @Prop({ default: 350 }) height: number;
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

    // public onItemTap(args: ItemEventData) {
    //     const result = this.options[args.index];
    //     if (result) {
    //         this.close(result);
    //         // this.bleService.once(BLEConnectedEvent, ()=>{
    //         //     this.close();
    //         // })
    //         // this.bleService.connect(device.UUID);
    //     }
    // }
    public onTap(item: OptionType, args) {
        const bindingContext = this.nativeView.bindingContext;
        console.log('onTap', item, !!bindingContext.closeCallback);
        bindingContext.closeCallback(item);
    }
}
