<script lang="ts">
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Utils } from '@nativescript/core';
    import { actionBarButtonHeight, mdiFontFamily, primaryColor, subtitleColor, textColor } from '~/variables';
    export let isVisible = true;
    export let white = false;
    export let isEnabled = true;
    export let small = false;
    export let gray = false;
    export let isSelected = false;
    export let text = null;
    export let selectedColor = white ? 'white' : primaryColor;
    export let color = !isEnabled || gray ? $subtitleColor : $textColor;
    export let onLongPress: Function = null;
    export let size = small ? 20 : actionBarButtonHeight;
    export let tooltip = null;
    export let rounded = true;
    // let actualColor = null;
    // $: actualColor = white ? 'white' : !isEnabled || gray ? $subtitleColor : color;

    $: actualLongPress =
        onLongPress || tooltip
            ? (event) => {
                  if (event.ios && event.ios.state !== 3) {
                      return;
                  }
                  if (onLongPress) {
                      onLongPress(event);
                  } else {
                      if (__ANDROID__) {
                          android.widget.Toast.makeText(Utils.ad.getApplicationContext(), tooltip, android.widget.Toast.LENGTH_SHORT).show();
                      } else {
                          showSnack({ message: tooltip });
                      }
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
     <cspan verticalAlignment="center" {text} />
</canvaslabel> -->
<mdbutton
    {isEnabled}
    {text}
    variant="text"
    shape={rounded ? 'round' : null}
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
    fontSize={small ? 16 : 24}
/>