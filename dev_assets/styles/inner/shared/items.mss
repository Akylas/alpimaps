@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;
@pedestrian_line_width: linear([view::zoom], (16, 2), (18, 2));
@bicycle_line_width: linear([view::zoom], (16, 2), (18, 2));

@itemColor: [color] ? [color] : #60A5F4;
@lineColor: [color] ? [color] : #287bda;
@editing_dash: 12, 8;
@non_editing_dash: none;
#items['mapnik::geometry_type'=2] {
    ['nuti::hide_unselected'=0] {
        when ([nuti::selected_id] !=[id]) {
            line-color: [color] ? [color] : #287bda;
            line-dasharray: [nuti::editing_id]=[id] ? @editing_dash : @non_editing_dash;
            line-join: round;
            line-cap: round;
            line-opacity: linear([view::zoom], (16, 1), (18, 0.3)) *([nuti::editing_id]=[id] ? 0.5 :1);
            line-width: @bicycle_line_width + 2;

            [class=pedestrian] {
                line-width: @pedestrian_line_width + 2;
            }
        }

    }

    when ([nuti::selected_id]=[id])::selected {
        back/line-color: white;
        back/line-width: @bicycle_line_width + 2+ 8;
        back/line-join: round;
        back/line-cap: round;
        back/line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
        line-join: miter;
        line-cap: round;
        line-color: [color] ? [color] : #287bda;
        line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
        line-width: @bicycle_line_width+ 4;

        [zoom>=14] {
            marker-placement: line;
            marker-type: arrow;
            marker-line-width: 1;
            marker-allow-overlap: true;
            marker-width: 14;
            marker-height: 9;
            marker-spacing: 50;
            marker-fill: white;
            marker-line-color: [color] ? [color] : #287bda;
        }

        // [class=pedestrian] {
        //     back/line-width: @pedestrian_line_width+ 8;
        //     line-width: @pedestrian_line_width+ 4;
        // }
    }
}

#items['mapnik::geometry_type'=1]['nuti::hide_unselected'=0] {
        text-fill: [color] ? [color] : #60A5F4;
        text-placement: [nuti::markers3d];
        text-name: [icon] ? [icon] : '';
        text-allow-overlap: true;
        text-clip: false;
        text-face-name: [mapFontFamily] ? [mapFontFamily] : 'osm';
        text-size: linear([view::zoom], (10, 10), (16, 10), (18, 12))+ ([iconSize] ? [iconSize]: 10);
        text-halo-fill: @standard-halo-fill;
        text-halo-radius: @standard-halo-radius;
        text-horizontal-alignment: [horizontalAlignment] ? [horizontalAlignment] : middle;
        text-vertical-alignment: [verticalAlignment] ? [verticalAlignment] : bottom;
        text-dx:[iconDx] ? [iconDx] :0;
        text-dy:[iconDy] ? [iconDy] :0;
        when ([nuti::selected_id]=[id]) {
            text-size: linear([view::zoom], (10, 10), (16, 10), (18, 12))+ ([iconSize] ? [iconSize]: 15)
        }

}