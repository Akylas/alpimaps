<template>
    <Page ref="page">
        <GridLayout ref="page" class="page" @loaded="onLoaded">
            <Label :text="$t('loading_map')" color="black" backgroundColor="#E3E1D3" verticalTextAlignment="middle" textAlignment="center" />
            <MultiDrawer ref="drawer" :options="drawerOptions">
                <GridLayout slot="left" rows="auto, *, auto" height="100%">
                    <StackLayout row="2" width="100%" padding="10">
                        <StackLayout class="menuButtons" orientation="horizontal">
                            <MDButton col="0" variant="flat" text="mdi-email" @tap="onTap('sendFeedback')" />
                            <MDButton col="1" variant="flat" text="mdi-bug" @tap="onTap('sendBugReport')" v-if="!!$sentry" />
                        </StackLayout>
                        <StackLayout class="menuInfos">
                            <Label :text="'App version: ' + (appVersion || '')" />
                        </StackLayout>
                    </StackLayout>
                </GridLayout>
                <Frame ref="innerFrame">
                    <Map />
                </Frame>
            </MultiDrawer>
        </GridLayout>
    </Page>
</template>
 
<script lang="ts" src="./App.ts"/>