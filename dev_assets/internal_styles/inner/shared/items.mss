@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;
@pedestrian_line_width: pow(2.0, linear([view::zoom], (12, -5), (15, -2), (18, 1.6))) + 0.5;
@bicycle_line_width: (pow(2.0, linear([view::zoom], (14, -2.8), (18, 3.2))) + 0.5) * linear([view::zoom], (14, 0), (14.01, 1));

#items['mapnik::geometry_type'=2] {
    when ([nuti::selected_id] !=[id]) {
        line-color: #60A5F4;
        line-join: round;
        line-cap: round;
        line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
        line-width: @bicycle_line_width + 2;

        [class=pedestrian] {
            line-width: @pedestrian_line_width + 2;
        }
    }

    when ([nuti::selected_id]=[id])::selected {
        back/line-color: white;
        back/line-width: @bicycle_line_width + 4;
        back/line-join: round;
        back/line-cap: round;
        back/line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
        line-join: round;
        line-cap: round;
        line-color: #60A5F4;
        line-opacity: linear([view::zoom], (16, 1), (18, 0.3));

        line-width: @bicycle_line_width+ 2;
        marker-placement: line;
        marker-type: arrow;
        marker-line-width: 0;
        marker-opacity: 0.6;
        marker-width: @bicycle_line_width;
        marker-height: @bicycle_line_width;
        marker-fill: #60A5F4;

        [class=pedestrian] {
            back/line-width: @pedestrian_line_width+ 4;
            line-width: @pedestrian_line_width+ 2;
            marker-width: @pedestrian_line_width;
            marker-height: @pedestrian_line_width;
        }
    }
}

#items['mapnik::geometry_type'=1] {
    marker-color: [color] ? [color] : #60A5F4;
    marker-placement: [nuti::markers3d];
    marker-file: url(symbols/pin.svg);
    marker-height: 30;
    marker-transform: translate (0, -15);
    marker-allow-overlap: true;
    marker-clip: false;
    when ([nuti::selected_id]=[id]) {
        marker-height: 34;
        marker-transform: translate (0, -17);
    }

}