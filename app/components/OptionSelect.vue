<template>
    <Frame>
        <Page actionBarHidden ref="page">
            <StatusBar ios:barStyle="light" :barColor="darkColor" />
            <NavigationBar :barColor="darkColor" />
            <CollectionView row="1" :items="options" :height="height">
                <v-template>
                    <ListItem :title="item.name" :subtitle="item.data" showBottomLine @tap="onTap(item, $event)" />
                </v-template>
            </CollectionView>
        </Page>
    </Frame>
</template>
 <script lang="ts" src="./OptionSelect.ts"></script>