<template>
    <AbsoluteLayout @layoutChanged="onLayoutChange" isPassThroughParentEnabled>
        <!-- <AbsoluteLayout isPassThroughParentEnabled> -->
        <StackLayout ref="scrollingView"  width="100%" :marginTop="currentViewHeight" :height="translationMaxOffset" isPassThroughParentEnabled="false" backgroundColor="#bb000000" v-show="viewHeight !== 0">
            <slot name="bottomSheet" />
        </StackLayout>
        <!-- </AbsoluteLayout> -->
    </AbsoluteLayout>
</template>
<script lang="ts" src="./BottomSheetHolder.ts"/>
