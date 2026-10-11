<script context="module" lang="ts">
    import { convertElevation, openingHoursText } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { type OSMDetailsState, canLookupOSMDetails } from '~/helpers/osmDetails';
    import type { IItem } from '~/models/Item';

    // the card is a fixed height, as the sheet snaps to it: these are what each part takes
    const CARD_PADDING_TOP = 10;
    const CARD_HEADER_HEIGHT = 34;
    const CARD_PADDING_BOTTOM = 8;
    const BANNER_HEIGHT = 52;
    const CHIP_ROW_HEIGHT = 38;
    const CONTACTS_HEIGHT = 52;
    const FACTS_HEIGHT = 34;
    const MESSAGE_HEIGHT = 44;
    const TABLE_ROW_PADDING = 6;
    const TABLE_PADDING = 8;

    export interface OSMContact {
        id: 'phone' | 'website' | 'email';
        icon: string;
        value: string;
    }

    export function osmContacts(item: IItem) {
        const properties = item?.properties;
        const result: OSMContact[] = [];
        if (!properties) {
            return result;
        }
        const phone = (properties['phone'] || properties['contact:phone'])?.split(';')[0].trim();
        if (phone) {
            result.push({ id: 'phone', icon: 'mdi-phone-outline', value: phone });
        }
        const website = (properties['website'] || properties['contact:website'])?.split(';')[0].trim();
        if (website) {
            result.push({ id: 'website', icon: 'mdi-web', value: website });
        }
        const email = (properties['email'] || properties['contact:email'])?.split(';')[0].trim();
        if (email) {
            result.push({ id: 'email', icon: 'mdi-email-outline', value: email });
        }
        return result;
    }

    export interface OSMFact {
        icon: string;
        text: string;
    }

    /** the useful tags the item info window used to list on top: population, wheelchair, cuisine... */
    export function osmFacts(item: IItem) {
        const properties = item?.properties;
        const result: OSMFact[] = [];
        if (!properties) {
            return result;
        }
        if (properties['population']) {
            result.push({ icon: 'mdi-account-group', text: `${String(properties['population']).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${lc('population')}` });
        }
        if (properties['ele'] && properties.class === 'natural') {
            result.push({ icon: 'mdi-triangle-outline', text: convertElevation(properties['ele']) });
        }
        if (properties['wheelchair'] && properties['wheelchair'] !== 'no') {
            result.push({ icon: 'mdi-wheelchair', text: lc('wheelchair') });
        }
        for (const cuisine of (properties['cuisine'] as string)?.split(/[,;]/) ?? []) {
            result.push({ icon: 'mdi-food', text: cuisine.trim().replace(/_/g, ' ').toLowerCase() });
        }
        const currency = properties['currency'] || properties['currency:XLT'];
        if (currency) {
            result.push({ icon: 'mdi-currency-eur', text: String(currency).toLowerCase() });
        }
        if (properties['operator']) {
            result.push({ icon: 'mdi-domain', text: properties['operator'] });
        }
        if (properties['network']) {
            result.push({ icon: 'mdi-train-car', text: properties['network'] });
        }
        return result;
    }

    /** what the card shows for an item: the sheet reads it for the card's height */
    export function osmCardLayout(item: IItem, online: boolean, details?: OSMDetailsState) {
        const hours = !!openingHoursText(item);
        const contacts = osmContacts(item).length > 0;
        const facts = osmFacts(item).length > 0;
        const hasData = details?.fetchedAt !== undefined;
        const lookup = canLookupOSMDetails(item);
        const message = hours || contacts || facts || !lookup ? null : !online && !hasData ? 'osm_offline_empty' : details?.loading ? null : 'osm_nothing_found';
        return { hours, contacts, facts, lookup, empty: lookup && !hours && !contacts && !facts, banner: lookup && !online && hasData, message };
    }

    /** the whole row, with the gap above it */
    export function osmCardHeight(layout: ReturnType<typeof osmCardLayout>, fontScale: number, gap: number) {
        const tableHeight = 7 * (Math.ceil(14 * 1.35 * fontScale) + TABLE_ROW_PADDING) + TABLE_PADDING;
        return (
            gap +
            CARD_PADDING_TOP +
            CARD_HEADER_HEIGHT +
            (layout.banner ? BANNER_HEIGHT : 0) +
            (layout.hours ? CHIP_ROW_HEIGHT + tableHeight : 0) +
            (layout.contacts ? CONTACTS_HEIGHT : 0) +
            (layout.facts ? FACTS_HEIGHT : 0) +
            (layout.empty ? MESSAGE_HEIGHT : 0) +
            CARD_PADDING_BOTTOM
        );
    }
</script>

<script lang="ts">
    // the OpenStreetMap lookup of the selected place: when it was read, its open state and weekly hours, and
    // the ways to reach it. Shown whatever the connection: offline it falls back on the copy saved on the device
    import { capitalize } from '@nativescript-community/l';
    import { openUrl } from '@nativescript/core/utils';
    import { compose } from '@nativescript/email';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { createEventDispatcher } from 'svelte';
    import { isEInk } from '~/helpers/theme';
    import { networkOnline, osmDetailsStates, osmItemKey } from '~/helpers/osmDetails';
    import { copyTextToClipboard, openURL } from '~/utils/ui/index.common';
    import { colors, fontScaleMaxed, fonts } from '~/variables';
    import Pill from '../common/Pill.svelte';
    import OpenStateChip from '../items/OpenStateChip.svelte';
    import OpeningHoursTable from '../items/OpeningHoursTable.svelte';

    export let item: IItem;

    const dispatch = createEventDispatcher<{ refresh: void }>();

    $: ({ colorAccentContainer, colorOnSurface, colorOnSurfaceVariant, colorOutlineSoft, colorPrimary } = $colors);

    $: details = $osmDetailsStates[osmItemKey(item)];
    $: layout = osmCardLayout(item, $networkOnline, details);
    $: hoursData = layout.hours ? openingHoursText(item) : null;
    $: contacts = osmContacts(item);
    $: facts = layout.facts ? osmFacts(item) : [];
    $: fetchedAt = details?.fetchedAt;
    $: statusText = details?.loading
        ? lc('osm_checking')
        : fetchedAt !== undefined
          ? capitalize(Date.now() - fetchedAt < 60000 ? lc('osm_updated_now') : lc('osm_updated', dayjs(fetchedAt).fromNow()))
          : $networkOnline
            ? lc('osm_look_up')
            : capitalize(lc('offline'));
    $: bannerText = fetchedAt !== undefined ? lc('osm_offline_saved', dayjs(fetchedAt).fromNow(true)) : null;

    function onStatusTap() {
        if ($networkOnline && !details?.loading) {
            dispatch('refresh');
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

<gridlayout class="panel" {...$$restProps}>
    <stacklayout padding={`${CARD_PADDING_TOP} 14 ${CARD_PADDING_BOTTOM} 14`}>
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
            <gridlayout
                backgroundColor={isEInk ? null : colorAccentContainer}
                borderColor={colorOnSurface}
                borderRadius={12}
                borderWidth={isEInk ? 1 : 0}
                columns="auto,*"
                height={BANNER_HEIGHT - 6}
                marginTop={6}
                padding="0 10">
                <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={18} marginRight={8} text="mdi-information-outline" verticalAlignment="middle" />
                <label col={1} color={colorOnSurface} fontSize={12 * $fontScaleMaxed} maxLines={2} text={bannerText} verticalAlignment="middle" />
            </gridlayout>
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
</gridlayout>
