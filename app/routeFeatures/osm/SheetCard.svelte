<script lang="ts">
    // the OpenStreetMap lookup of the selected place: when it was read, its open state and weekly hours, and
    // the ways to reach it. Shown whatever the connection: offline it falls back on the copy saved on the device
    import { capitalize } from '@nativescript-community/l';
    import { openUrl } from '@nativescript/core/utils';
    import { compose } from '@nativescript/email';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { openingHoursText } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { networkOnline, osmDetailsStates, osmItemKey } from '~/helpers/osmDetails';
    import { copyTextToClipboard, openURL } from '~/utils/ui/index.common';
    import { colors, fontScaleMaxed, fonts } from '~/variables';
    import {
        BANNER_HEIGHT,
        CARD_HEADER_HEIGHT,
        CARD_PADDING_BOTTOM,
        CARD_PADDING_TOP,
        FACTS_HEIGHT,
        type OSMContact,
        TABLE_PADDING,
        osmCardLayout,
        osmContacts,
        osmFacts
    } from '~/routeFeatures/osm/layout';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem } from '~/models/Item';
    import Pill from '~/components/common/Pill.svelte';
    import OpenStateChip from '~/components/items/OpenStateChip.svelte';
    import OpeningHoursTable from '~/components/items/OpeningHoursTable.svelte';

    export let item: IItem;

    $: ({ colorAccentContainer, colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);

    $: details = $osmDetailsStates[osmItemKey(item)];
    $: layout = osmCardLayout(item, $networkOnline, details);
    $: hoursData = layout.hours ? openingHoursText(item) : null;
    $: contacts = osmContacts(item);
    $: facts = layout.facts ? osmFacts(item) : [];
    $: fetchedAt = details?.fetchedAt;
    $: statusText = osmStatusText(details?.loading, fetchedAt, $networkOnline);
    $: bannerText = fetchedAt !== undefined ? lc('osm_offline_saved', dayjs(fetchedAt).fromNow(true)) : null;

    function osmStatusText(loading: boolean, fetched: number | undefined, online: boolean) {
        if (loading) {
            return lc('osm_checking');
        }
        if (fetched !== undefined) {
            return capitalize(Date.now() - fetched < 60000 ? lc('osm_updated_now') : lc('osm_updated', dayjs(fetched).fromNow()));
        }
        return online ? lc('osm_look_up') : capitalize(lc('offline'));
    }

    async function refresh() {
        try {
            await getMapContext().mapModule('items').loadOSMDetails(item, true);
        } catch (error) {
            showError(error);
        }
    }
    function onStatusTap() {
        if ($networkOnline && !details?.loading) {
            refresh();
        }
    }

    async function onContactTap(contact: OSMContact) {
        try {
            switch (contact.id) {
                case 'phone':
                    openUrl('tel:' + contact.value);
                    break;
                case 'website':
                    await openURL(contact.value);
                    break;
                case 'email':
                    await compose({ to: [contact.value] });
                    break;
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<stacklayout class="panel" padding={`${CARD_PADDING_TOP} 14 ${CARD_PADDING_BOTTOM} 14`} {...$$restProps}>
    <gridlayout columns="*,auto" height={CARD_HEADER_HEIGHT}>
        <label color={colorOnSurface} fontSize={15 * $fontScaleMaxed} fontWeight="bold" lineBreak="end" maxLines={1} text={lc('osm_details')} verticalAlignment="middle" />
        <gridlayout
            borderColor={isEInk ? colorOnSurface : colorOutlineSoft}
            borderRadius={14}
            borderWidth={1}
            col={1}
            rippleColor={$networkOnline ? colorPrimary : 'transparent'}
            verticalAlignment="middle"
            visibility={layout.lookup ? 'visible' : 'collapse'}
            on:tap={onStatusTap}>
            <stacklayout orientation="horizontal" padding="4 10 4 8">
                {#if details?.loading}
                    <activityindicator busy={true} color={colorOnSurfaceVariant} height={14} marginRight={6} verticalAlignment="middle" width={14} />
                {:else}
                    <label
                        color={$networkOnline ? colorPrimary : colorOnSurfaceVariant}
                        fontFamily={$fonts.mdi}
                        fontSize={16 * $fontScaleMaxed}
                        marginRight={6}
                        text={$networkOnline ? 'mdi-refresh' : 'mdi-wifi-off'}
                        verticalAlignment="middle" />
                {/if}
                <label color={colorOnSurfaceVariant} fontSize={12 * $fontScaleMaxed} fontWeight="500" maxLines={1} text={statusText} verticalAlignment="middle" />
            </stacklayout>
        </gridlayout>
    </gridlayout>

    {#if layout.banner}
        <!-- always the same two spans -->
        <label
            backgroundColor={isEInk ? null : colorAccentContainer}
            borderColor={colorOnSurface}
            borderRadius={12}
            borderWidth={isEInk ? 1 : 0}
            color={colorOnSurface}
            fontSize={12 * $fontScaleMaxed}
            height={BANNER_HEIGHT - 6}
            marginTop={6}
            maxLines={2}
            padding="0 10"
            verticalTextAlignment="middle">
            <span color={colorPrimary} fontFamily={$fonts.mdi} fontSize={18} text="mdi-information-outline" />
            <span text={' ' + (bannerText ?? '')} />
        </label>
    {/if}

    {#if hoursData}
        <OpenStateChip checkable={false} {item} marginBottom={2} marginTop={8} />
        <OpeningHoursTable openingHours={hoursData.oh} padding={`${TABLE_PADDING} 0 0 0`} />
    {/if}
    {#if layout.message}
        <label color={colorOnSurfaceVariant} fontSize={13 * $fontScaleMaxed} marginTop={10} text={lc(layout.message)} textWrap={true} />
    {/if}
    {#if facts.length}
        <scrollview height={FACTS_HEIGHT} marginTop={4} orientation="horizontal" scrollBarIndicatorVisible={false}>
            <stacklayout orientation="horizontal" verticalAlignment="middle">
                {#each facts as fact}
                    <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={16 * $fontScaleMaxed} marginRight={4} text={fact.icon} verticalAlignment="middle" />
                    <label color={colorOnSurface} fontSize={13 * $fontScaleMaxed} marginRight={14} maxLines={1} text={fact.text} verticalAlignment="middle" />
                {/each}
            </stacklayout>
        </scrollview>
    {/if}
    {#if contacts.length}
        <scrollview marginTop={4} orientation="horizontal" scrollBarIndicatorVisible={false}>
            <stacklayout orientation="horizontal">
                {#each contacts as contact (contact.id)}
                    <Pill icon={contact.icon} on:longPress={() => copyTextToClipboard(contact.value)} on:tap={() => onContactTap(contact)} />
                {/each}
            </stacklayout>
        </scrollview>
    {/if}
</stacklayout>
