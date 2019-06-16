<template>
    <GridLayout rows="auto,*,auto,2*" columns="*,auto,*" height="300" @loaded="onLoaded">
        <StackLayout row="0" colSpan="3" orientation="horizontal">
            <MDButton class="mdi" width="30" variant="text" fontSize="20" :text="'mdi-arrow-left' | fonticon" v-show="currentFolder.length > 0" @tap="onBackButton" />
            <Label padding="10" color="black" fontSize="20" fontWeight="bold" text="Download Packages" />
        </StackLayout>
        <ListView ref="listView" row="1" col="0" rowSpan="3" colSpan="3" rowHeight="49" :items="dataItems" @itemTap="onPackageClick" separatorColor="gray">
            <v-template>
                <!-- <StackLayout width="100%" height="100%" backgroundColor="red">
                        <Label :text="item.name"  backgroundColor="gray"/>
                    </StackLayout> -->
                <GridLayout rows="*,auto,auto" columns="*,auto,auto,auto" padding="0 0 0 15">
                    <Label row="0" :text="item.name.toUpperCase()" color="black" fontSize="13" fontWeight="bold" verticalAlignment="center" />
                    <Label row="1" :text="item.getStatusText()" color="#D0D0D0" fontSize="11" v-show="!item.isGroup()" verticalAlignment="center" />
                    </StackLayout>
                    <Label col="2" row="0" rowSpan="3" class="mdi" color="navyblue" :text="'mdi-chevron-right' | fonticon" fontSize="16" v-show="item.isGroup()" verticalAlignment="center" />
                    <MDButton col="1" row="0" rowSpan="3" variant="text" margin="0" padding="0" :text="item.getActionText('map')" verticalAlignment="center" v-show="!item.isGroup()" fontSize="12" @tap="handlePackageAction('map', item)" />
                    <MDButton col="2" row="0" rowSpan="3" variant="text" margin="0" padding="0" :text="item.getGeoActionText()" verticalAlignment="center" v-show="item.hasGeo()" fontSize="12" @tap="handlePackageAction('geo', item)" />
                    <MDButton col="3" row="0" rowSpan="3" variant="text" margin="0" padding="0" :text="item.getRoutingActionText()" verticalAlignment="center" v-show="item.hasRouting()" fontSize="12" @tap="handlePackageAction('routing', item)" />
                    <Progress row="2" col="0" colSpan="4" height="3" :value="item.getDownloadProgress()" v-show="!item.isGroup()" :visibility="item.isDownloading()?'visible':'hidden'" />
                </GridLayout>
            </v-template>
        </ListView>
        <ActivityIndicator v-show="loading" row="2" col="1" busy="true" class="activity-indicator" />
    </GridLayout>
</template>
<script lang="ts" src="./PackagesDownloadComponent.ts"/>
