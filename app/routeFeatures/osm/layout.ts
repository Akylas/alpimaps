import { convertElevation, openingHoursText } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { type OSMDetailsState, canLookupOSMDetails } from '~/helpers/osmDetails';
import type { IItem } from '~/models/Item';

// the card is a fixed height, as the sheet snaps to it: these are what each part takes
export const CARD_PADDING_TOP = 10;
export const CARD_HEADER_HEIGHT = 34;
export const CARD_PADDING_BOTTOM = 8;
export const BANNER_HEIGHT = 52;
const CHIP_ROW_HEIGHT = 38;
const CONTACTS_HEIGHT = 52;
export const FACTS_HEIGHT = 34;
const MESSAGE_HEIGHT = 44;
const TABLE_ROW_PADDING = 6;
export const TABLE_PADDING = 8;

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
