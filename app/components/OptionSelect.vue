<template>
    <StackLayout class="page" :height="height">
        <GridLayout rows="auto,*,auto" margin="12 20 0 20">
            <Label row="0"  paddingBottom="15" class="h4" fontWeight="800" :text="title | capitalize" verticalAlignment="center" textWrap />
            <ListView row="1" for="item in options" class="list-group" @itemTap="onItemTap">
                <v-template>
                    <GridLayout columns="*" class="list-group-item" orientation="horizontal" paddingBottom="4">
                        <StackLayout col="0">
                            <Label fontWeight="500" :text="item.name | L" class="list-group-item-heading" />
                            <Label class="list-group-item-text" :text="item.data" />
                        </StackLayout>
                        <!-- <StackLayout col="1" class="thumb img-circle" width="40" height="40" backgroundColor="#0086D6"/> -->
                        <!-- <Label col="1" fontWeight="800" :text="device.RSSI" color="white" horizontalAlignment="center" verticalAlignment="center" textWrap="false"/> -->
                    </GridLayout>
                </v-template>
            </ListView>
            <GridLayout rows="auto" columns="*,auto,auto" row="2" horizontalAlignment="right" orientation="horizontal" borderTopColor="#EEEEEE" borderTopWidth="1" width="100%">
                <MDButton row="0" col="2" variant="text" class="buttontext" :text="$t('cancel') @tap="close()" />
            </GridLayout>
        </GridLayout>
    </StackLayout>
</template>
 <script lang="ts" src="./OptionSelect.ts"></script>