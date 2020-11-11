<template>
    <Page ref="page">
        <StackLayout>
            <CActionBar :title="title" :showMenuIcon="showMenuIcon" :showGlassesIcon="showGlassesIcon" :connectedGlasses="connectedGlasses" :glassesBattery="glassesBattery" />
            <slot />
        </StackLayout>
    </Page>
</template>

<script lang="ts">
import BgServiceComponent from '~/components/BgServiceComponent';
import { BgService } from '~/services/BgService';
import { Component, Prop } from 'vue-property-decorator';

@Component({})
export default class BasePage extends BgServiceComponent {

    @Prop({})
    public title: string;

    @Prop({ default: true })
    public showMenuIcon: boolean;

    constructor() {
        super();
    }

    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }


    onServiceLoaded() {
        
    }
}
</script>
<style lang="scss" scoped>
</style>