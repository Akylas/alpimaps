import { getDistance, getDistanceSimple } from '~/helpers/geolib';

export function join_em(src_segments: GeoJSON.Position[][], tolerance = 0.0001, haversine_distance = false, combine = true) {
    // Read a shapefile containing a bunch of linestrings,
    // try and match up the ends and create one long linestring
    // const src_segments: GeoJSON.LineString[] = [];
    // geojson.features.forEach((f) => src_segments.push(f.geometry));
    console.log('join_em', src_segments.length, JSON.stringify(src_segments));
    let seg = src_segments.pop();
    let segments_in_order = [seg];
    let flipped = false;
    while (src_segments.length > 0) {
        const start = seg[0];
        const end = seg[seg.length - 1];
        //look for a segment adjact to the end point
        let res = find_closest(end, src_segments);
        // console.log('find_closest:', end, res);
        if (res.closest_segment && res.closest_distance < tolerance) {
            console.log('Found segment adjacent to end, distance:', res.closest_distance, res.closest_location);
            src_segments.splice(src_segments.indexOf(res.closest_segment), 1);
            if (res.closest_location === 'end') {
                console.log('Flipping segment');
                res.closest_segment = res.closest_segment.reverse();
            }
            segments_in_order.push(res.closest_segment);
            seg = res.closest_segment;
            flipped = false;
        } else {
            // Look for a segment adjactent to the start point
            const end_distance = res.closest_distance;
            res = find_closest(start, src_segments);
            if (res.closest_segment && res.closest_distance < tolerance) {
                console.log('Found segment adjacent to start, distance:%f to %s', res.closest_distance, res.closest_location);
                src_segments.splice(src_segments.indexOf(res.closest_segment), 1);
                if (res.closest_location === 'start') {
                    console.log('Flipping segment');
                    res.closest_segment = res.closest_segment.reverse();
                }
                segments_in_order.unshift(res.closest_segment);
                seg = res.closest_segment;
                flipped = false;
            } else {
                console.error("Can't find a segment adjacent. Closest distance to start:%f to end:%f", res.closest_distance, end_distance, flipped);
                if (flipped) {
                    console.error("Can't find a segment adjacent to start or end segment, giving up");
                    break;
                } else {
                    flipped = true;
                    segments_in_order = segments_in_order.map((s) => s.reverse()).reverse();
                    // for (const s of segments_in_order) {
                    //     s.reverse();
                    // }

                    seg = segments_in_order[segments_in_order.length - 1];
                }
            }
        }
    }
    console.log(`finished, segments in order:${segments_in_order.length} remaining segments:${src_segments.length}`);

    if (combine) {
        console.log('Concatenating list of points');
        const all_coords = [];
        for (const seg of segments_in_order) {
            all_coords.push(...seg);
        }
        const schema = all_coords;
        return schema;
    } else {
        return seg;
    }
}

function find_closest(point: GeoJSON.Position, segments: GeoJSON.Position[][], haversine_distance = false) {
    //Find the linestring in segments that has a start or end point closest to point.
    //return (segment, start or end, distance)
    console.log('find_closest', point);
    let closest_segment: GeoJSON.Position[] = null;
    let closest_distance = 0;
    let closest_location = null;
    let start_distance: number, end_distance: number;
    for (const seg of segments) {
        const start = seg[0];
        const end = seg[seg.length - 1];
        if (haversine_distance) {
            start_distance = getDistance([start[1], start[0]], [point[1], point[0]]);
            end_distance = getDistance([end[1], end[0]], [point[1], point[0]]);
        } else {
            start_distance = getDistanceSimple([start[1], start[0]], [point[1], point[0]]);
            end_distance = getDistanceSimple([end[1], end[0]], [point[1], point[0]]);
        }
        if (closest_segment === null || start_distance < closest_distance) {
            closest_distance = start_distance;
            closest_segment = seg;
            closest_location = 'start';
        }
        if (end_distance < closest_distance) {
            closest_distance = end_distance;
            closest_segment = seg;
            closest_location = 'end';
        }
    }
    return { closest_segment, closest_location, closest_distance };
}
