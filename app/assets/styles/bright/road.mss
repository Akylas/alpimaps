// Basic color palette, from which variations will be derived.
@motorway:          #fc8;
@main:              #fea;
@street:            #fff;
@street_limited:    #f3f3f3;

// ---------------------------------------------------------------------

// Roads are split across 3 layers: #road, #bridge, and #tunnel. Each
// road segment will only exist in one of the three layers. The
// #bridge layer makes use of Mapnik's group-by rendering mode;
// attachments in this layer will be grouped by layer for appropriate
// rendering of multi-level overpasses.

// The main road style is for all 3 road layers and divided into 2 main
// attachments. The 'case' attachment is 

#transportation {
  
  // fill/inlines
  ::fill[zoom>=6]['mapnik::geometry_type'=2] {
    [class='motorway'][zoom>=8] {
      line-join:round;
      line-cap:round;
      line-color:@motorway;
      [brunnel='tunnel'] { line-color:lighten(@motorway,4); }
      [zoom>=8] { line-width:0.5; }
      [zoom>=10] { line-width:1; }
      [zoom>=13] { line-width:2; }
      [zoom>=14] { line-width:3.5; }
      [zoom>=15] { line-width:5; }
      [zoom>=16] { line-width:7; }
    }
    [class='motorway'][ramp=1][zoom>=14] {
      line-join:round;
      line-cap: round;
      line-color:@motorway;
      [brunnel='tunnel'] {  line-color:lighten(@motorway,4); }
      [zoom>=14] { line-width:1.5; }
      [zoom>=15] { line-width:3; }
      [zoom>=16] { line-width:4.5; }
    }
    [class=~'primary|secondary|tertiary|trunk'][zoom>=8] {
      line-join:round;
      #road, #bridge { line-cap: round; }
      line-color:@land;
      [brunnel='tunnel'] { line-color:lighten(@main,4); }
      [zoom>=8] { line-width:0.5; }
      [zoom>=10] { line-width:1; }
      [zoom>=13] { line-width:1.5; }
      [zoom>=14] { line-width:2.5; }
      [zoom>=15] { line-width:3.5; }
      [zoom>=16] { line-width:6; }
    }
    [class='minor'][zoom>=15], {
      line-join:round;
      line-cap: round;
      [zoom>=15] { line-width:2.5; line-color:#fff; }
      [zoom>=16] { line-width:4; }
    }
    [class='service'][zoom>=16], {
      line-join:round;
      line-cap: round;
      [zoom>=16] { line-width:2; line-color:#fff; }
    }
    [class='major_rail'] {
      line-width: 0.4;
      line-color: #bbb;
      [zoom>=16] {
        line-width: 0.75;
      	// Hatching
      	h/line-width: 3;
      	h/line-color: #bbb;
      	h/line-dasharray: 1,31;
      }
    }
  }
}
