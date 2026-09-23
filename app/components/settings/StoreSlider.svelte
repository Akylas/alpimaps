<script lang="ts">
    /**
     * A slider row bound straight to a store, with the value tappable to type an exact one.
     *
     * NativeScript's slider works in whole steps, so a fractional `step` is carried by scaling the
     * whole range by a factor — the same trick the WebView peak finder's settings list used, kept
     * because it is the only way to get a 0.05 step out of the native control.
     */
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { showError } from '@shared/utils/showError';
    import type { Writable } from 'svelte/store';
    import { colors } from '~/variables';

    export let title: string;
    export let description: string = null;
    export let store: Writable<number>;
    export let min: number;
    export let max: number;
    export let step = 1;
    /** How the value reads. Defaults to the number itself, trimmed to the step's precision. */
    export let format: (value: number) => string = null;

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    // A whole-number step needs no scaling; 0.05 needs 20.
    $: factor = step >= 1 ? 1 : Math.round(1 / step);
    $: decimals = factor === 1 ? 0 : String(factor).length - 1;

    // The native control REJECTS a value that is not on its own grid — Material's BaseSlider throws
    // "Value(3.6) must be equal to valueFrom(0.0) plus a multiple of stepSize(1.0)" and takes the
    // whole page down with it. Two ways a row gets one:
    //
    //  - a value stored when the slider had a different step or range, which then never matches the
    //    new grid (a stored 3.6 against a 0.5 step is exactly this);
    //  - CollectionView RECYCLING, where a row keeps the previous row's value for the moment between
    //    being rebound and its min/max/step catching up.
    //
    // Snapping and clamping here means neither can reach the control. The STORE is left alone: the
    // off-grid value is still the user's until they move the slider, and nothing silently rewrites a
    // setting just because a list scrolled.
    $: scaledStep = Math.max(step * factor, 1);
    $: scaledMin = min * factor;
    $: scaledMax = max * factor;
    $: sliderValue = Math.min(scaledMax, Math.max(scaledMin, scaledMin + Math.round(($store * factor - scaledMin) / scaledStep) * scaledStep));

    function display(value: number) {
        if (format) {
            return format(value);
        }
        return value.toFixed(decimals);
    }

    function onValueChange(event) {
        const value = event.value / factor;
        // The native slider fires while dragging, so this is written on every frame of the drag — which
        // is what makes the map follow the finger. Each store write is one property write on the map.
        if (value !== $store) {
            store.set(value);
        }
    }

    async function promptForValue() {
        try {
            const result = await prompt({
                title,
                defaultText: String($store),
                capitalizationType: 'none',
                textFieldProperties: { keyboardType: 'number' }
            });
            if (result?.result && result.text?.length) {
                const value = parseFloat(result.text);
                if (!isNaN(value)) {
                    store.set(Math.max(min, Math.min(max, value)));
                }
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<gridlayout columns="*,auto" padding="6 16 0 16" rows="auto,auto,auto" {...$$restProps}>
    <label colSpan={2} color={colorOnSurface} fontSize={16} text={title} />
    {#if description}
        <label colSpan={2} color={colorOnSurfaceVariant} fontSize={13} row={1} text={description} textWrap={true} />
    {/if}
    <slider col={0} maxValue={scaledMax} minValue={scaledMin} row={2} stepSize={scaledStep} value={sliderValue} on:valueChange={onValueChange} />
    <label col={1} color={colorOnSurfaceVariant} fontSize={14} marginLeft={10} row={2} text={display($store)} verticalTextAlignment="center" width={70} on:tap={promptForValue} />
</gridlayout>
