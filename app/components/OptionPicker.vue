<template>
    <Frame>
        <Page actionBarHidden ref="page">
            <StatusBar ios:barStyle="light" :barColor="darkColor" />
            <NavigationBar :barColor="darkColor" />
            <ListView for="item in options" rowHeight="50" height="200">
                <v-template>
                    <GridLayout columns="*, auto" class="list-group-item" orientation="horizontal" padding="10">
                        <Label fontSize="18" :text="item.name | L" col="0" verticalAlignment="center" />
                        <Switch col="1" ios:backgroundColor="#f27743" v-model="item.checked" verticalAlignment="center" />
                    </GridLayout>
                </v-template>
            </ListView>
        </Page>
    </Frame>
</template>
 <script lang="ts" src="./OptionPicker.ts"></script>