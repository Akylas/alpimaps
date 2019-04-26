<template>
    <MDCardView>
        <GridLayout :rows="`${actionBarHeight}`" width="100%" :visibility="opened ? 'visible' : 'collapse'">
            <StackLayout ref="bottomSheet" row="1" backgroundColor="white" orientation="horizontal">
                <SVGImage :src="selectedSVGSrc" height="80%" width="30" v-show="!!selectedSVGSrc" />
                <StackLayout>
                    <Label :text="selectedTitle" color="black" fontSize="15" fontWeight="bold" />
                    <Label :text="selectedSubtitle" color="#D0D0D0" fontSize="13" />
                </StackLayout>
            </StackLayout>
        </GridLayout>
    </MDCardView>
</template>

<script lang="ts" src="./bottomSheet.ts">
</script>
