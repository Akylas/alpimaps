<script lang="ts">
    import { Color, CoreTypes, type EventData, View } from '@nativescript/core';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { onDestroy, onMount } from 'svelte';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { type GestureKind, SCREEN_HEIGHT, SCREEN_WIDTH, type TutorialPage, type TutorialPart, type TutorialZone } from '~/components/tutorial/tutorialPages';
    import { colors } from '~/variables';

    /** a schematic of one app screen, with the zones where a hidden gesture lives */
    export let page: TutorialPage;
    /** `<page id>.<zone id>` of the zones already opened */
    export let seen: string[] = [];
    export let selected: string = null;
    export let onZone: (zone: TutorialZone, view: View) => void;

    const GESTURE_ICONS: Record<GestureKind, string> = {
        longPress: 'mdi-gesture-tap-hold',
        swipe: 'mdi-gesture-swipe-horizontal',
        drag: 'mdi-cursor-move'
    };

    $: ({ colorAccentContainer, colorCard, colorOnPrimary, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorOutlineSoft, colorPrimary, colorSurfaceContainerLow } = $colors);
    $: zoneStates = page.zones.filter((zone) => !zone.enabled || zone.enabled()).map((zone) => ({ zone, opened: seen.includes(`${page.id}.${zone.id}`) }));
    $: selectedFill = new Color(colorPrimary).setAlpha(40).hex;

    const partText = (part: Extract<TutorialPart, { kind: 'text' }>) => (part.textKey ? lc(part.textKey) : part.textFn ? part.textFn() : part.text);

    function pillColor(part: Extract<TutorialPart, { kind: 'pill' }>) {
        if (part.primary) {
            return colorOnPrimary;
        }
        return part.selected ? colorPrimary : colorOnSurface;
    }

    const PULSE_GROWTH = 18;
    const pulseStops = new Map<View, () => void>();

    const PULSE_DURATION = 1300;
    const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

    // a ring that grows and fades out of the zone's border; none on e-ink, where motion does not read
    function startPulse(view: View, zone: TutorialZone) {
        if (pulseStops.has(view)) {
            return;
        }
        DEV_LOG && console.log('pulse start', zone.id);
        let running = true;
        pulseStops.set(view, () => {
            running = false;
            view.cancelAllAnimations();
        });
        const growX = (zone.width + PULSE_GROWTH) / zone.width;
        const growY = (zone.height + PULSE_GROWTH) / zone.height;
        (async () => {
            while (running) {
                const started = Date.now();
                view.scaleX = 1;
                view.scaleY = 1;
                view.opacity = 0.9;
                try {
                    await view.animate({ scale: { x: growX, y: growY }, opacity: 0, duration: PULSE_DURATION, curve: CoreTypes.AnimationCurve.easeOut });
                } catch (error) {
                    DEV_LOG && console.log('pulse animation failed', zone.id, error);
                }
                // an animation that ends at once (the view is not laid out yet) must not spin
                if (running && Date.now() - started < PULSE_DURATION / 2) {
                    await wait(PULSE_DURATION / 2);
                }
            }
        })();
    }
    function stopPulse(event: EventData) {
        const view = event.object;
        if (view instanceof View) {
            pulseStops.get(view)?.();
            pulseStops.delete(view);
        }
    }
    const rings: Record<string, NativeViewElementNode<View>> = {};

    // `loaded` alone is not enough: it did not fire for the zones of a page swapped in after the first
    onMount(() => {
        setTimeout(() => {
            for (const { opened, zone } of zoneStates) {
                const ring = rings[zone.id]?.nativeView;
                if (!opened && ring && !isEInk) {
                    startPulse(ring, zone);
                }
            }
        }, 150);
    });
    onDestroy(() => {
        for (const stop of pulseStops.values()) {
            stop();
        }
        pulseStops.clear();
    });

    function onZoneTap(event: EventData, zone: TutorialZone) {
        DEV_LOG && console.log('zone tap', zone.id, event.object instanceof View);
        if (event.object instanceof View) {
            onZone(zone, event.object);
        }
    }
</script>

<absolutelayout
    backgroundColor={colorSurfaceContainerLow}
    borderColor={colorOutline}
    borderRadius={20}
    borderWidth={1}
    clipToBounds={true}
    height={SCREEN_HEIGHT}
    horizontalAlignment="center"
    verticalAlignment="middle"
    width={SCREEN_WIDTH}
    {...$$restProps}>
    {#each page.parts as part}
        {#if part.kind === 'road'}
            <gridlayout backgroundColor={colorOutlineSoft} borderRadius={part.height / 2} height={part.height} left={part.x} rotate={part.angle} top={part.y} width={part.width} />
        {:else if part.kind === 'card'}
            <gridlayout backgroundColor={colorCard} borderColor={colorOutline} borderRadius={part.radius ?? 12} borderWidth={1} height={part.height} left={part.x} top={part.y} width={part.width} />
        {:else if part.kind === 'pill'}
            <gridlayout
                backgroundColor={part.primary ? colorPrimary : part.selected ? colorAccentContainer : colorCard}
                borderColor={part.selected ? colorPrimary : colorOutline}
                borderRadius={part.height / 2}
                borderWidth={part.primary ? 0 : 1}
                height={part.height}
                left={part.x}
                top={part.y}
                width={part.width}>
                <stacklayout horizontalAlignment="center" orientation="horizontal" verticalAlignment="middle">
                    {#if part.icon}
                        <label class="mdi" color={pillColor(part)} fontSize={16} text={part.icon} verticalAlignment="middle" />
                    {/if}
                    {#if part.labelKey}
                        <label color={pillColor(part)} fontSize={11} marginLeft={part.icon ? 4 : 0} text={lc(part.labelKey)} verticalAlignment="middle" />
                    {/if}
                </stacklayout>
            </gridlayout>
        {:else if part.kind === 'fab'}
            <gridlayout
                backgroundColor={part.primary ? colorPrimary : colorCard}
                borderColor={colorOutline}
                borderRadius={part.width / 2}
                borderWidth={part.primary ? 0 : 1}
                height={part.height}
                left={part.x}
                top={part.y}
                width={part.width}>
                <label class="mdi" color={part.primary ? colorOnPrimary : colorOnSurface} fontSize={part.width / 2} horizontalAlignment="center" text={part.icon} verticalAlignment="middle" />
            </gridlayout>
        {:else if part.kind === 'block'}
            <gridlayout backgroundColor={colorPrimary} borderRadius={14} height={part.height} left={part.x} top={part.y} width={part.width}>
                <label class="mdi" color={colorOnPrimary} fontSize={part.width * 0.7} horizontalAlignment="center" text={part.icon} verticalAlignment="middle" />
            </gridlayout>
        {:else if part.kind === 'divider'}
            <gridlayout backgroundColor={colorOutline} height={part.height} left={part.x} top={part.y} width={part.width} />
        {:else if part.kind === 'icon'}
            <label class="mdi" color={colorOnSurface} fontSize={part.width} height={part.height} left={part.x} text={part.icon} top={part.y} width={part.width} />
        {:else if part.kind === 'text'}
            <label
                color={part.muted ? colorOnSurfaceVariant : colorOnSurface}
                fontSize={part.size ?? 12}
                fontWeight={part.bold ? 'bold' : 'normal'}
                height={part.height}
                left={part.x}
                maxLines={1}
                text={partText(part)}
                top={part.y}
                width={part.width} />
        {:else if part.kind === 'meter'}
            <gridlayout backgroundColor={colorOutline} borderRadius={part.height / 2} height={part.height} left={part.x} top={part.y} width={part.width}>
                <gridlayout backgroundColor={colorPrimary} borderRadius={part.height / 2} horizontalAlignment="left" width={part.width * part.value} />
            </gridlayout>
        {:else if part.kind === 'bars'}
            <gridlayout columns={part.values.map(() => '*').join(',')} height={part.height} left={part.x} top={part.y} width={part.width}>
                {#each part.values as value, index}
                    <gridlayout backgroundColor={colorPrimary} col={index} height={(part.height * value) / 100} margin="0 1" opacity={0.55} verticalAlignment="bottom" />
                {/each}
            </gridlayout>
        {/if}
    {/each}
    {#each zoneStates as { opened, zone } (zone.id)}
        {#if !isEInk && !opened}
            <gridlayout
                bind:this={rings[zone.id]}
                borderColor={colorPrimary}
                borderRadius={10}
                borderWidth={2}
                height={zone.height}
                isUserInteractionEnabled={false}
                left={zone.x}
                top={zone.y}
                width={zone.width}
                on:loaded={(event) => event.object instanceof View && startPulse(event.object, zone)}
                on:unloaded={stopPulse} />
        {/if}
        <gridlayout
            backgroundColor={selected === zone.id ? selectedFill : 'transparent'}
            borderColor={opened ? colorOutline : colorPrimary}
            borderRadius={10}
            borderWidth={opened && !isEInk ? 1 : 2}
            height={zone.height}
            left={zone.x}
            top={zone.y}
            width={zone.width}
            on:tap={(event) => onZoneTap(event, zone)} />
        <gridlayout backgroundColor={opened ? colorOutline : colorPrimary} borderRadius={10} height={20} isUserInteractionEnabled={false} left={zone.x + zone.width - 12} top={zone.y - 10} width={20}>
            <label class="mdi" color={colorOnPrimary} fontSize={12} horizontalAlignment="center" text={GESTURE_ICONS[zone.gesture]} verticalAlignment="middle" />
        </gridlayout>
    {/each}
</absolutelayout>
