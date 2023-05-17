<script lang="ts">
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Utils } from '@nativescript/core';
    import { showToolTip } from '~/utils/utils';
    import { actionBarButtonHeight, mdiFontFamily, primaryColor, subtitleColor, textColor } from '~/variables';
    export let isVisible = true;
    export let white = false;
    export let isEnabled = true;
    export let small = false;
    export let gray = false;
    export let isSelected = false;
    export let text = null;
    export let fontFamily = mdiFontFamily;
    export let selectedColor = white ? 'white' : primaryColor;
    export let color = null;
    export let onLongPress: Function = null;
    export let fontSize = 0;
    export let size:any = small ? 30 : actionBarButtonHeight;
    export let tooltip = null;
    export let rounded = true;
    export let shape = null;
    export let height = null;
    export let width = null;
    
    // let actualColor = null;
    // $: actualColor = white ? 'white' : !isEnabled || gray ? $subtitleColor : color;
    $: actualColor = color || (!isEnabled || gray ? $subtitleColor : $textColor);
    $: actualLongPress =
        onLongPress || tooltip
            ? (event) => {
                  if (event.ios && event.ios.state !== 3) {
                      return;
                  }
                  if (onLongPress) {
                      onLongPress(event);
                  } else {
                      showToolTip(tooltip);
                  }
              }
            : null;
</script>

<!-- <canvaslabel
    {isEnabled}
    textAlignment="center"
    borderRadius={rounded ? size / 2 : null}
    disableCss={true}
    rippleColor={color}
    fontFamily={mdiFontFamily}
    visibility={isVisible ? 'visible' : 'collapsed'}
    color={isSelected ? selectedColor : color}
    {...$$restProps}
    on:tap
    on:longPress={actualLongPress}
    width={size}
    height={size}
    fontSize={small ? 20 : 28}
>
     <cspan verticalAlignment="middle" {text} />
</canvaslabel> -->
<mdbutton
    {isEnabled}
    {text}
    variant="text"
    shape={shape || (rounded ? 'round' : null)}
    disableCss={true}
    rippleColor={actualColor}
    {fontFamily}
    visibility={isVisible ? 'visible' : 'collapsed'}
    color={isSelected ? selectedColor : actualColor}
    {...$$restProps}
    on:tap
    on:longPress={actualLongPress}
    width={width || size}
    height={height || size}
    fontSize={fontSize ? fontSize : small ? 16 : 24}
/>
