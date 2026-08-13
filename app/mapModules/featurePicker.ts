import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem } from '~/models/Item';
import { clearTimeout, setTimeout } from '~/utils/utils';

/**
 * One tap can land on several overlapping features — a road carrying three hiking routes, a stop
 * served by four bus lines. Carto reports them one at a time, so a click is collected for a moment
 * before deciding, and only then is the user asked to choose.
 */
const COLLECT_DELAY = 10;

const pendingPickers = new Set<string>();

/**
 * Whether a picker is mid-collection or still showing its chooser.
 *
 * Lets one picker stand aside for another: a tap on a road that also carries transit belongs to the
 * road, so the transit layer bails while the route picker is busy.
 */
export function isPickerPending(id: string) {
    return pendingPickers.has(id);
}

export interface FeaturePickerOptions {
    /** Identifies this picker to `isPickerPending`. */
    id: string;
    /** Dedups the collected features — carto can report the same one more than once. */
    key: (item: IItem) => unknown;
    /** Row title in the chooser. */
    label: (item: IItem) => string;
    /** What to do once one feature is settled on, whether it was the only one or the chosen one. */
    select: (item: IItem) => void;
    sort?: (first: IItem, second: IItem) => number;
    /** Close whatever sheet is already open before showing the chooser. */
    closeOpenSheet?: boolean;
}

export class FeaturePicker {
    private items: IItem[] = null;
    private timer;

    constructor(private readonly options: FeaturePickerOptions) {}

    get pending() {
        return isPickerPending(this.options.id);
    }

    /**
     * Collects one feature, restarting the window.
     *
     * Returns true when the feature was not already collected, which is the caller's cue to swallow
     * the map click that follows — otherwise the tap would also be treated as a tap on the map.
     */
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
        return true;
    }

    /** Drops whatever was collected — the tap turned out to belong to something else. */
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
        // cleared only once the chooser is done, so this picker still counts as pending while it is
        // open and others keep standing aside — matches how the two hand-rolled versions behaved
        this.items = null;
        this.timer = null;
        pendingPickers.delete(id);
    }
}
