<template>
    <Frame ref="innerFrame">
        <Page ref="page" class="page" @loaded="onLoaded">
            <MultiDrawer ref="drawer" :options="drawerOptions">
                <GridLayout slot="left" rows="auto, *, auto" height="100%" backgroundColor="white">
                    <StackLayout row="2" width="100%" padding="10">
                        <StackLayout class="menuButtons" orientation="horizontal">
                            <MDButton col="0" variant="flat" :text="'mdi-email' | fonticon" @tap="onTap('sendFeedback')" />
                            <MDButton col="1" variant="flat" :text="'mdi-bug' | fonticon" @tap="onTap('sendBugReport')" />
                        </StackLayout>
                        <StackLayout class="menuInfos">
                            <Label :text="'App version: ' + (appVersion || '')" />
                        </StackLayout>
                    </StackLayout>
                </GridLayout>
                <GridLayout slot="right">
                    <MapRightMenu v-if="mapMounted" />
                </GridLayout>
                <Map :licenseRegistered="cartoLicenseRegistered" />
            </MultiDrawer>
        </Page>
    </Frame>
</template>

<script lang="ts" src="./App.ts"/>