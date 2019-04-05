<template>
    <Page ref="page" class="page" @navigatingTo="onNavigatingTo">
        <!-- <RadSideDrawer ref="drawer" @gesturesEnabled="gesturesEnabled">
            <GridLayout ~drawerContent rows="auto, *, auto" height="100%" backgroundColor="white">
                <GridLayout paddingLeft="20" paddingRight="20" height="100" rows="auto, *" columns="auto, *" visibility="hidden" borderBottomWidth="1" borderBottomColor="#EEEEEE"></GridLayout>
                <ScrollView row="1" paddingTop="10">
                    <StackLayout ref="menu">
                        <GridLayout v-for="(item) in menuItems" :key="item.url" height="50" columns="70, *" class="menu" @tap="onNavItemTap(item.url)" :active="isActiveUrl(item.url)">
                            <MDRipple col="0" colSpan="2" />
                            <Label col="0" class="menuIcon" :text="('mdi-' + item.icon) | fonticon" verticalAlignment="center" />
                            <Label col="1" class="menuText" :text="item.title | uppercase" verticalAlignment="center" :active="activatedUrl  === item.url" />
                        </GridLayout>
                    </StackLayout>
                </ScrollView>
                <StackLayout row="2" width="100%" padding="10">
                    <Label width="100%" fontSize="14" textAlignment="center" :text="'App version: ' + (appVersion || '')"></Label>
                    
                </StackLayout>
            </GridLayout> -->
        <StackLayout class="page">
            <Frame ref="innerFrame">
                <Map :licenseRegistered="cartoLicenseRegistered" />
            </Frame>
        </StackLayout>
        <!-- </RadSideDrawer> -->
    </Page>
</template>

<script lang="ts" src="./App.ts">
</script>