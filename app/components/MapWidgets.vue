<template>
    <GridLayout rows="auto,*,auto" columns="auto,*,auto" width="100%" height="100%" isPassThroughParentEnabled>
        <transition name="scale" duration="200" mode="out-in">
            <MDButton v-show="currentMapRotation !== 0" col="2" @tap="resetBearing" class="small-floating-btn" :text="'mdi-navigation' | fonticon" :rotate="currentMapRotation" verticalAlignment="top" horizontalAligment="right"/>
        </transition>
        <!-- <transition name="scale" duration="200" mode="out-in">
            <MDButton @tap="startDirections" row="3" col="3" class="buttonthemed floating-btn" :text="'mdi-directions' | fonticon" v-show="selectedItemHasPosition" />
        </transition> -->
    </GridLayout>
</template>
<script lang="ts" src="./MapWidgets.ts"/>
