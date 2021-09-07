@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;
@pedestrian_line_width: pow(2.0, linear([view::zoom], (12, -5), (15, -2), (18, 1.6))) + 0.5;
@bicycle_line_width: (pow(2.0, linear([view::zoom], (14, -2.8), (18, 3.2))) + 0.5) * linear([view::zoom], (14,0), (14.01, 1));
#items {
	['mapnik::geometry_type'=2]{
        back/line-color: white;
        back/line-width: @bicycle_line_width + 3;
        // back/line-cap:round;
        // back/line-join:round;
        line-color: blue;
        // line-cap:round;
        // line-join:round;
        line-width: @bicycle_line_width+2;
        [class=pedestrian] {
            back/line-width: @pedestrian_line_width + 3;
            line-width: @pedestrian_line_width+2;
        }

         when (['nuti::selected_id']=[id])::selected {
            back/line-width: @bicycle_line_width + 4;
            line-color: #60A5F4;
            line-width: bicycle_line_width+ 2;
            marker-placement: line;
            marker-type:arrow;
            marker-line-width:0;
            marker-opacity:0.6;
            marker-width: @bicycle_line_width;
            marker-height: @bicycle_line_width;
            marker-fill: #B3CEFF;
            [class=pedestrian] {
                back/line-width: @pedestrian_line_width+ 4;
                marker-width: @pedestrian_line_width;
                marker-height: @pedestrian_line_width;
            }
        }
    }
}
