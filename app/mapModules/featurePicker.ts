import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem } from '~/models/Item';
import { clearTimeout, setTimeout } from '~/utils/utils';

// carto reports overlapping features of one tap one at a time: collect them briefly (ms) before choosing
const COLLECT_DELAY = 10;

const pendingPickers = new Set<string>();

/** Mid-collection or still showing its chooser: lets another picker (e.g. transit) stand aside. */
export function isPickerPending(id: string) {
    return pendingPickers.has(id);
}

let ignoreNextMapClick = false;

/** Consumed on read: a feature tap must not also count as an empty-map tap, which would drop the selection. */
export function consumeIgnoreNextMapClick() {
    const ignore = ignoreNextMapClick;
    ignoreNextMapClick = false;
    return ignore;
}

export function clearIgnoreNextMapClick() {
    ignoreNextMapClick = false;
}

export interface FeaturePickerOptions {
    id: string;
    /** Carto can report the same feature more than once. */
    key: (item: IItem) => unknown;
    label: (item: IItem) => string;
    select: (item: IItem) => void;
    sort?: (first: IItem, second: IItem) => number;
    closeOpenSheet?: boolean;
}

export class FeaturePicker {
    private items: IItem[] = null;
    private timer;

    constructor(private readonly options: FeaturePickerOptions) {}

    get pending() {
        return isPickerPending(this.options.id);
    }

    add(item: IItem) {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        pendingPickers.add(this.options.id);
        this.items = this.items || [];
        this.timer = setTimeout(() => this.flush(), COLLECT_DELAY);
        const key = this.options.key(item);
        if (this.items.some((collected) => this.options.key(collected) === key)) {
            return false;
        }
        this.items.push(item);
        ignoreNextMapClick = true;
        return true;
    }

    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.items = null;
        pendingPickers.delete(this.options.id);
    }

    private async flush() {
        const { closeOpenSheet, id, label, select, sort } = this.options;
        const mapContext = getMapContext();
        mapContext.unFocusSearch();
        try {
            if (this.items?.length === 1) {
                select(this.items[0]);
            } else if (this.items?.length > 1) {
                if (closeOpenSheet) {
                    closeBottomSheet();
                }
                const RouteSelect = (await import('~/components/routes/RouteSelect.svelte')).default;
                const options = this.items.map((item) => ({ name: label(item), route: item }));
                if (sort) {
                    options.sort((first, second) => sort(first.route, second.route));
                }
                const results = await showBottomSheet({
                    parent: mapContext.getMainPage(),
                    view: RouteSelect,
                    skipCollapsedState: true,
                    props: { options }
                });
                const result = Array.isArray(results) ? results[0] : results;
                if (result) {
                    select(result.route);
                }
            }
        } catch (error) {
            console.error('FeaturePicker', id, error, error['stack']);
        }
        // cleared only once the chooser is done, so others keep standing aside while it is open
        this.items = null;
        this.timer = null;
        pendingPickers.delete(id);
    }
}
