import type { MapPos } from '~/utils/geo';
import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';

/** Mac Catalyst mouse and trackpad on the map, like the web version. Returns the uninstall. */
export function installMacMouse(mapView: MassifMapView, onSecondaryClick: (point: { x: number; y: number }, position: MapPos) => void): () => void;
