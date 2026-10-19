import type { BottomSheetDetent } from '@nativescript-community/ui-bottomsheet';

/** Height the transit sheets rest at. */
export const TRANSIT_SHEET_PEEK_HEIGHT = 420;

/** The rest of the height opens when the list is scrolled or the sheet pulled up. */
export const TRANSIT_SHEET_DETENTS: BottomSheetDetent[] = [TRANSIT_SHEET_PEEK_HEIGHT, 'large'];
