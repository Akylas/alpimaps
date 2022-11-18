@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;
@pedestrian_line_width: linear([view::zoom], (16, 2), (18, 2));
@bicycle_line_width: linear([view::zoom], (16, 2), (18, 2));

@color: #287bda;

#items['mapnik::geometry_type'=2] {
    ['nuti::hide_unselected'=0] {
        when ([nuti::selected_id] !=[id]) {
            line-color: @color;
            line-join: round;
            line-cap: round;
            line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
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
        line-color: @color;
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
            marker-line-color: @color;
        }
        // [class=pedestrian] {
        //     back/line-width: @pedestrian_line_width+ 8;
        //     line-width: @pedestrian_line_width+ 4;
        // }
    }
}

#items['mapnik::geometry_type'=1]['nuti::hide_unselected'=0] {
    marker-color: [color] ? [color]: #60A5F4;
    marker-placement: [nuti::markers3d];
    marker-file: url(symbols/pin.svg);
    marker-width: 20;
    marker-allow-overlap: true;
    marker-clip: false;

    when ([nuti::selected_id]=[id]) {
        marker-width: 24;
    }

}