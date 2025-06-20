// @markerOverlap: [nuti::selected_id] = [id] ? false : true;

@osm_icon: [nuti::osm-[subclass]] ?? [nuti::osm-[class]] ??'';

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
    [class=waypoint] {     
   //   shield-placement: nutibillboard;
      shield-name:  [style.icon] ?? [icon] ?? @osm_icon;
      shield-size: 10  * linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1));
      shield-face-name: [style.mapFontFamily] ?? 'osm';
      shield-dx:[style.iconDx] ?? [iconDx] ?? -1;
      shield-dy:[style.iconDy] ?? [iconDy] ??0;
      shield-file: 'shields/poi_shield.svg';
      shield-fill: #ffffff;
      shield-allow-overlap: true;
      shield-placement-priority: 26;
        shield-clip: false;
    }
    ['nuti::items_show_km_shields'=1][class=step][zoom<16] {
    [zoom>=6][level<=1],
    [zoom>=7][level<=2],
    [zoom>=9][level<=3],
    [zoom>=10][level<=4]
    [zoom>=11] {
     // shield-placement: nutibillboard;
      shield-name: [distFromStartStr];
      shield-size: 8  * linear([view::zoom], (4, 0.2), (6, 0.5), (8, 1));
      shield-face-name: @mont_bd;
      shield-file: 'shields/poi_shield.svg';
      shield-fill: #ffffff;
      shield-allow-overlap: true;
        shield-clip: false;
        shield-placement-priority: 25;
        }
    }
}