<script lang="ts">
    // The native slider works in whole steps, so a fractional `step` is carried by scaling the
    // whole range by a factor.
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { showError } from '@shared/utils/showError';
    import type { Writable } from 'svelte/store';
    import { colors } from '~/variables';

    export let title: string;
    export let description: string = null;
    export let store: Writable<number> & { reset?: () => void };
    export let min: number;
    export let max: number;
    export let step = 1;
    export let format: (value: number) => string = null;

    $: ({ colorOnSurface, colorOnSurfaceVariant } = $colors);

    $: factor = step >= 1 ? 1 : Math.round(1 / step);
    $: decimals = factor === 1 ? 0 : String(factor).length - 1;

    // Material's BaseSlider throws on an off-grid value (stale stored value, or a recycled row whose
    // min/max/step lag behind), so snap+clamp here. The store is left alone on purpose.
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
        if (value !== $store) {
            store.set(value);
        }
    }

    // a store without `reset` has no default to go back to
    function resetValue() {
        store.reset?.();
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
    <label colSpan={2} color={colorOnSurface} fontSize={16} text={title} on:longPress={resetValue} />
    {#if description}
        <label colSpan={2} color={colorOnSurfaceVariant} fontSize={13} row={1} text={description} textWrap={true} on:longPress={resetValue} />
    {/if}
    <slider col={0} maxValue={scaledMax} minValue={scaledMin} row={2} stepSize={scaledStep} value={sliderValue} on:valueChange={onValueChange} />
    <label
        col={1}
        color={colorOnSurfaceVariant}
        fontSize={14}
        marginLeft={10}
        row={2}
        text={display($store)}
        verticalTextAlignment="center"
        width={70}
        on:longPress={resetValue}
        on:tap={promptForValue} />
</gridlayout>
