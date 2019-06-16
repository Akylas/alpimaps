<template>
    <GridLayout :columns="computedLayout.grid.columns" :rows="computedLayout.grid.rows">
        <!-- Main Content (default slot) -->
        <ContentView :col="computedLayout.main.col">
            <slot />
        </ContentView>

        <Label v-show="backdropVisible" :col="computedLayout.main.col" ref="backDrop" iosOverflowSafeArea="true" opacity="0" :backgroundColor="optionsInternal.backdropColor" @pan="onBackDropPan" @tap="close()" />

        <template v-for="side in computedSidesEnabled" isPassThroughParentEnabled="true">
            <!-- Drawer Content -->
            <GridLayout @layoutChanged="onDrawerLayoutChange(side)" :col="computedLayout[side].col" :key="side" @tap="noop" @pan="onDrawerPan(side, $event)" :ref="`${side}Drawer`" :style="computedDrawerStyle(side)">
                <slot :name="side" />
            </GridLayout>
            <!-- Open Trigger -->
            <Label v-show="computedShowSwipeOpenTrigger(side)" v-bind="computedSwipeOpenTriggerProperties(side)" @pan="onOpenTriggerPan(side, $event)" 
                isPassThroughParentEnabled="true" :col="computedLayout[side].col" :key="`${side}Trigger`" v-if="!optionsInternal[side].fixed" />
        </template>
    </GridLayout>
</template>
<script src="./MultiDrawer.ts"/>
