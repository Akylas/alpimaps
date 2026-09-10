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

<gridlayout columns="*,auto" padding="6 16 0 16" rows="auto,auto" {...$$restProps}>
    <label colSpan={2} color={colorOnSurface} fontSize={16} text={title} />
    <slider col={0} maxValue={max * factor} minValue={min * factor} row={1} stepSize={step * factor} value={$store * factor} on:valueChange={onValueChange} />
    <label col={1} color={colorOnSurfaceVariant} fontSize={14} marginLeft={10} row={1} text={display($store)} verticalTextAlignment="center" width={70} on:tap={promptForValue} />
</gridlayout>
