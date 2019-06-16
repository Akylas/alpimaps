<template>
    <GridLayout @layoutChanged="onLayoutChange">
        <slot />
        <AbsoluteLayout isPassThroughParentEnabled="true">
            <StackLayout ref="scrollingView" :marginTop="currentViewHeight" width="100%" :height="translationMaxOffset">
                <slot name="bottomSheet"/>
            </StackLayout>
        </AbsoluteLayout>
    </GridLayout>
</template>
<script lang="ts" src="./BottomSheetHolder.ts"/>
