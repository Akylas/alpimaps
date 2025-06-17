// @markerOverlap: [nuti::selected_id] = [id] ? false : true;

#items['mapnik::geometry_type'=2] {
    ['nuti::hide_unselected'=0] {
        when ([nuti::selected_id] !=[id]) {
            back/line-color: white;
            back/line-width: @bicycle_line_width + 2;
            back/line-join: round;
            back/line-cap: round;
            back/line-opacity: @itemBackLineOpacity;
            line-color: @lineColor;
            line-dasharray: [nuti::editing_id]=[id] ? @editing_dash : @non_editing_dash;
            line-join: round;
            line-cap: round;
            line-opacity: @itemLineOpacity;
            line-width: @bicycle_line_width;

            [class=pedestrian] {
                line-width: @pedestrian_line_width;
            }
        }

    }

    when ([nuti::selected_id]=[id])::selected {
        back/line-color: white;
        back/line-width: @bicycle_line_width + 5;
        back/line-join: round;
        back/line-cap: round;
        line-join: miter;
        line-cap: round;
        line-color: @lineColor;
        line-width: @bicycle_line_width + 2;
        ['nuti::hide_unselected'=1] {
            line-width: @bicycle_line_width + 7;
        }

        ['nuti::hide_unselected'=0] {
            back/line-opacity: @itemSelectedBackLineOpacity;
            line-opacity: @itemSelectedLineOpacity;

            [zoom>=13] {
                marker-placement: line;
                marker-type: arrow;
                marker-line-width: 1;
                marker-allow-overlap: true;
                marker-width: 14;
                marker-height: 9;
                marker-spacing: 50;
                marker-fill: white;
                marker-line-color: @lineColor;
            }
        }
        // [class=pedestrian] {
        //     back/line-width: @pedestrian_line_width+ 8;
        //     line-width: @pedestrian_line_width+ 4;
        // }
    }
}

#items['mapnik::geometry_type'=1]['nuti::hide_unselected'=0] {
        text-fill: [style.color] ? [style.color] : @itemColor;
        text-placement: nutibillboard;
        text-name: [style.icon] ? [style.icon] : '';
        text-allow-overlap: true;
        text-clip: false;
        text-face-name: [style.mapFontFamily] ? [style.mapFontFamily] : 'osm';
        text-size: (([style.iconSize] ? [style.iconSize]: @default_icon_size) + 5) * linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1));
        text-halo-fill: @itemContrastColor;
        text-halo-radius: @standard-halo-radius;
        text-horizontal-alignment: [style.horizontalAlignment] ? [style.horizontalAlignment] : middle;
        text-vertical-alignment: [style.verticalAlignment] ? [style.verticalAlignment] : bottom;
        text-dx:[style.iconDx] ? [style.iconDx] :@default_icon_dx;
        text-dy:[style.iconDy] ? [style.iconDy] :0;
        text-placement-priority: 27;
        when ([nuti::selected_id]=[id]) {
            text-size: ([style.iconSize] ? [style.iconSize]: @default_icon_size) + 10;
        }

}


#poi['mapnik::geometry_type'=1] {
    text-placement: nutibillboard;
		text-fill: @itemColor;
		text-allow-overlap: true;
		text-clip: false;
		text-name:'';
		text-face-name: 'osm';
		text-size: 30;
		text-halo-fill: @standard-halo-fill;
		text-halo-radius: @standard-halo-radius;
		text-horizontal-alignment : middle;
		text-vertical-alignment: bottom;
		text-dx:-3;

}

#steps['mapnik::geometry_type'=1]{
    text-placement: nutibillboard;
		text-fill: @itemColor;
		text-allow-overlap: true;
		text-clip: false;
		text-name:[distanceFromStart];
		text-face-name: @mont;
		text-size: 14;
		text-halo-fill: @standard-halo-fill;
		text-halo-radius: @standard-halo-radius;

}