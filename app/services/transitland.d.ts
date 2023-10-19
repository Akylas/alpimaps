import { Line, Point } from 'geojson';

export interface TransitRoutes {
    routes: TransitRoute[];
}

export interface TransitRoute {
    agency: Agency;
    alerts?: any[];
    continuous_drop_off?: any;
    continuous_pickup?: any;
    feed_version: Feedversion;
    geometry?: Line;
    id: number;
    onestop_id?: string;
    route_color: string;
    route_desc: string;
    route_id: string;
    route_long_name: string;
    route_short_name: string;
    route_sort_order: number;
    route_stops?: Routestop[];
    route_text_color: string;
    route_type: number;
    route_url: string;
}

interface Feedversion {
    feed: Feed;
    fetched_at: string;
    id: number;
    sha1: string;
}

interface Feed {
    id: number;
    onestop_id: string;
}

interface Agency {
    agency_id: string;
    agency_name: string;
    alerts?: any[];
    id: number;
    onestop_id: string;
}

interface Routestop {
    stop: TransitStop;
}

export interface TransitStop {
    alerts?: any[];
    geometry: Point;
    id: number;
    stop_id: string;
    stop_name: string;
}
