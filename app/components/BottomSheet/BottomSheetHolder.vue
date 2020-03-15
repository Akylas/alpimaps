<template>
    <AbsoluteLayout @layoutChanged="onLayoutChange" isPassThroughParentEnabled>
        <!-- <AbsoluteLayout isPassThroughParentEnabled> -->
        <StackLayout ref="scrollingView"  width="100%" :marginTop="currentViewHeight" :height="translationMaxOffset" isPassThroughParentEnabled="false" backgroundColor="#99000000">
            <slot name="bottomSheet" />
        </StackLayout>
        <!-- </AbsoluteLayout> -->
    </AbsoluteLayout>
</template>
<script lang="ts" src="./BottomSheetHolder.ts"/>
