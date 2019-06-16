<template>
    <AbsoluteLayout width="100%" isPassThroughParentEnabled="true" @layoutChanged="onLayoutChange">
        <!-- <StackLayout ref="scrollView" width="100%" isPassThroughParentEnabled="true" :top="currentViewTop"> -->
            <DirectionsPanel ref="topSheet"  width="100%" :top="currentViewTop"/>
        <!-- </StackLayout> -->
        <StackLayout ref="slotView" width="100%" :height="viewHeight" isPassThroughParentEnabled="true" :paddingTop="currentSlotTop">
            <slot />
        </StackLayout>
    </AbsoluteLayout>
</template>
<script lang="ts" src="./TopSheetHolder.ts"/>
