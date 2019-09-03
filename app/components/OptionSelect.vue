<template>
    <!-- <StackLayout :height="height" backgroundColor="#1E1E24">
        <GridLayout rows="auto,*,auto" margin="20 20 10 20">
            <Label row="0"  paddingBottom="15" fontWeight="800" :text="title | capitalize" verticalAlignment="center" textWrap /> -->
            <CollectionView row="1" :items="options" :height="height">
                <v-template>
                    <ListItem :title="item.name" :subtitle="item.data" showBottomLine @tap="onTap(item, $event)"/>
                </v-template>
            </CollectionView>
            <!-- <GridLayout rows="auto" columns="*,auto,auto" row="2" horizontalAlignment="right" orientation="horizontal" borderTopColor="#44ffffff" borderTopWidth="1" width="100%">
                <MDButton row="0" col="2" variant="text" :text="$t('cancel')" @tap="close()" />
            </GridLayout>
        </GridLayout>
    </StackLayout> -->
</template>
 <script lang="ts" src="./OptionSelect.ts"></script>