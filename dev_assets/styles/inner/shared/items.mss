// @markerOverlap: [nuti::selected_id] = [id] ? false : true;

@osm_icon: [nuti::osm-[subclass]] ?? [nuti::osm-[class]] ??'';
@stepId: 173716 + [distFromStartStr];
@waypointId: 'wp-' +[id];

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
        text-fill: [style.color] ?? @itemColor;
        text-placement: nutibillboard;
        text-name: [style.icon] ?? '';
        text-allow-overlap: true;
        text-clip: false;
        text-face-name: [style.mapFontFamily] ?? 'osm';
        text-size: (([style.iconSize] ? [style.iconSize]: @default_icon_size) + 5) * linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1));
        text-halo-fill: @itemContrastColor;
        text-halo-radius: @standard-halo-radius;
        text-horizontal-alignment: [style.horizontalAlignment] ??middle;
        text-vertical-alignment: [style.verticalAlignment] ? [style.verticalAlignment] : bottom;
        text-dx:[style.iconDx] ?? @default_icon_dx;
        text-dy:[style.iconDy] ?? 0;
        text-placement-priority: 27;
        when ([nuti::selected_id]=[id]) {
            text-size: ([style.iconSize] ?? @default_icon_size) + 10;
        }

}


#poi {

    ['nuti::items_show_km_shields'=1][class=step][zoom<16] {
        [zoom>=6][level<=1],
        [zoom>=7][level<=2],
        [zoom>=9][level<=3],
        [zoom>=10][level<=4]
        [zoom>=11] {  
            text-name: [distFromStartStr];
            text-placement-priority: 9;
            text-face-name: @mont_bd;
            text-placement: nutibillboard;
            text-size: 8 * linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1));      
            text-fill: #ffffff;
            text-halo-fill: #000000;
            text-halo-radius: @standard-halo-radius;  
        }
    }
        [class=waypoint] {
          ::label {
            text-name:  [style.icon] ?? [icon] ?? @osm_icon;
      text-size:([iconSize]?? 14) * linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1)); 
      text-face-name: [style.mapFontFamily] ?? 'osm';
      text-dx:[style.iconDx] ?? [iconDx] ?? 0;
      text-dy:[style.iconDy] ?? [iconDy] ?? 0;
            text-feature-id: @waypointId;
            text-placement-priority: 9;
            text-placement: nutibillboard;   
            text-fill: #ffffff;
            text-allow-overlap: true;
            text-same-feature-id-dependent: true;
            text-clip: false;
          //  text-allow-overlap-same-feature-id: true;
          }     
          ::icon {
            text-placement: nutibillboard;
            text-placement-priority: 10;
            text-name: [nuti::osm-circle];
            text-feature-id: @waypointId;
            text-size: 20* linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1));
            text-face-name: @osm;
            text-halo-fill: @standard-halo-fill;
            text-halo-radius: @standard-halo-radius;
            text-fill: @itemColor;
          //  text-allow-overlap-same-feature-id: true;
            text-allow-overlap: true;
            text-clip: false;
          }
        
    }
}