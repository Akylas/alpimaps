<template>
    <GridLayout class="actionBar" columns="auto,*, auto" rows="auto,auto">
        <StackLayout col="1" colSpan="3" verticalAlignment="center" :height="height">
            <Label class="actionBarTitle" v-if="title" textAlignment="left" :text="title | capitalize" />
            <Label :visibility="!!subtitle ? 'visible' : 'collapse'" textAlignment="left" class="actionBarSubtitle" :text="subtitle" />
        </StackLayout>
        <ContentView col="1" colSpan="2" :height="height">
            <slot name="title">
                <!-- <Label v-if="!!showLogo && !title" class="cairn" :fontSize="Math.min(height, 200)" color="white" :text="'cairn-full_logo' | fonticon" verticalAlignment="center" @tap="$emit('titleTap', $event)" /> -->
            </slot>
        </ContentView>

        <StackLayout orientation="horizontal" col="2" verticalAlignment="top" :height="height">
            <slot name="rightButtons" />
        </StackLayout>
        <ContentView col="0" verticalAlignment="top" :height="height">
            <MDButton rippleColor="white" variant="flat" v-show="menuIconVisible" class="icon-btn" :text="menuIcon | fonticon" @tap="onMenuIcon" />
        </ContentView>
        <!-- <StackLayout col="2" orientation="horizontal"> -->
        <!-- </StackLayout> -->
        <!-- <ContentView > -->
        <slot row="1" colSpan="3" name="subView" />
        <!-- </ContentView> -->
    </GridLayout>
</template>

 <script lang="ts" src="./CActionBar.ts"/>

