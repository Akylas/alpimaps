<template>
    <GridLayout
        :columns="`${16 * sizeFactor},auto,*,auto,${16 * sizeFactor}`"
        :rows="`${16 * sizeFactor},auto,*,auto,${16 * sizeFactor}`"
        :rippleColor="themeColor"
        @tap="$emit('tap', $event)"
    >
        <Label
            v-show="!!leftIcon"
            col="1"
            row="0"
            rowSpan="5"
            :fontSize="24 * sizeFactor"
            :marginRight="16 * sizeFactor"
            textAlignment="left"
            :text="leftIcon"
            horizontalAlignment="left"
            verticalAlignment="center"
            color="#757575"
            class="mdi"
        />
        <NSImg
            v-show="showAvatar"
            col="1"
            row="1"
            rowSpan="3"
            :width="40 * sizeFactor"
            :height="40 * sizeFactor"
            :marginRight="16 * sizeFactor"
            :src="avatar"
            verticalAlignment="center"
        />
        <Label
            col="2"
            row="1"
            :fontSize="10 * sizeFactor"
            v-show="!!overText"
            :text="overText | uppercase"
            verticalAlignment="center"
            :color="overlineColor"
        />

        <Label col="2" row="2" :fontSize="17 * sizeFactor" :text="title" textWrap="true" verticalAlignment="bottom" />
        <Label
            v-show="!!subtitle"
            col="2"
            row="3"
            :fontSize="14 * sizeFactor"
            :text="subtitle"
            verticalAlignment="top"
            :color="subtitleColor"
            textWrap="true"
        />

        <Label col="3" row="1" :fontSize="14 * sizeFactor" v-show="!!date" :text="date" verticalAlignment="top" />
        <Label
            col="3"
            row="1"
            rowSpan="3"
            v-show="!!rightIcon"
            class="mdi"
            :fontSize="24 * sizeFactor"
            textAlignment="right"
            color="#757575"
            :text="rightIcon | fonticon"
            verticalAlignment="center"
        />
        <!-- <MDRipple rowSpan="5" colSpan="5" /> -->
        <MDButton
            variant="flat"
            col="3"
            row="1"
            rowSpan="3"
            v-show="!!rightButton"
            class="icon-themed-btn"
            :text="rightButton | fonticon"
            verticalAlignment="center"
            @tap="$emit('rightTap')"
        />
        <AbsoluteLayout
            v-show="!!showBottomLine"
            row="4"
            colSpan="5"
            marginLeft="20"
            backgroundColor="#44ffffff"
            height="1"
            verticalAlignment="bottom"
        />
    </GridLayout>
</template>

<script lang="ts" src="./ListItem.ts"></script>
