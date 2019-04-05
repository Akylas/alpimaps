// ---------------------------------------------------------------------
// Common Colors

// You don't need to set up @variables for every color, but it's a good
// idea for colors you might be using in multiple places or as a base
// color for a variety of tints.
// Eg. @water is used in the #water and #waterway layers directly, but
// also in the #water_label and #waterway_label layers inside a color
// manipulation function to get a darker shade of the same hue.
@land: #f8f4f0;
@water: #a0c8f0;

@state_text:        #765;
@state_halo:        @place_halo;


//Moutain peaks
@peak: desaturate(#a4e7a0,26%);
@peak_label:darken(@peak, 30%);
@peak_halo: lighten(@peak, 15%);

// ---------------------------------------------------------------------
// Fonts

// All fontsets should have a good fallback that covers as many glyphs
// as possible.
@sans: "Montserrat Regular";
@sans_md: "Montserrat Medium";
@sans_bd: "Montserrat SemiBold";
@sans_it: "Montserrat Italic";
@sans_lt_italic: "Montserrat Italic";
@sans_lt: 'Montserrat Medium';

// Languages

// There are 5 language options in the MapBox Streets vector tiles:
// - Local/default: '[name]'
// - English: '[name_en]'
// - French: '[name_fr]'
// - Spanish: '[name_es]'
// - German: '[name_de]'
@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
@text3d: [nuti::texts3d] ? [nuti::texts3d] : nutibillboard;
Map {
  background-color:@land;
  font-directory: url(fonts/);
}

// ---------------------------------------------------------------------
// Political boundaries

#boundary {
  opacity: 0.5;
  line-join: round;
  line-color: #446;
  // Countries
  [admin_level=2] {
    line-width: 0.8;
    line-cap: round;
    [zoom>=4] { line-width: 1.2; }
    [zoom>=6] { line-width: 2; }
    [zoom>=8] { line-width: 4; }
    [disputed=1] { line-dasharray: 4,4; }
  }
}
  // States / Provices / Subregions
#place[class='state'][zoom>=4][zoom<=10] {
  text-name: @name;
  text-face-name: @sans_lt;
  text-placement: @text3d;
  text-fill: @state_text;
  text-halo-fill: fadeout(lighten(@land,5%),50%);
  text-halo-radius: 1;
  text-halo-rasterizer: fast;
  text-size: 9;
  [zoom>=5][zoom<=6] {
    text-size: 12;
    text-wrap-width: 40;
  }
  [zoom>=7][zoom<=8] {
    text-size: 14;
    text-wrap-width: 60;
  }
  [zoom>=9][zoom<=10] {
    text-halo-radius: 2;
    text-size: 16;
    text-character-spacing: 2;
    text-wrap-width: 100;
  }
}

// ---------------------------------------------------------------------
// Water Features 

#water {
  polygon-fill: @water - #111;
  // Map tiles are 256 pixels by 256 pixels wide, so the height 
  // and width of tiling pattern images must be factors of 256. 
  polygon-pattern-file: url(pattern/wave.png);
  [zoom<=5] {
    // Below zoom level 5 we use Natural Earth data for water,
    // which has more obvious seams that need to be hidden.
    //polygon-gamma: 0.4;
  }
  ::blur {
    // This attachment creates a shadow effect by creating a
    // light overlay that is offset slightly south. It also
    // create a slight highlight of the land along the
    // southern edge of any water body.
    polygon-fill: #f0f0ff;
    comp-op: soft-light;
    image-filters: agg-stack-blur(1,1);
    image-filters-inflate: true;
    polygon-geometry-transform: translate(0,1);
    //polygon-clip: false;
  }
}

#waterway {
  line-color: @water * 0.9;
  line-cap: round;
  line-width: 0.5;
  [class='river'] {
    [zoom>=12] { line-width: 1; }
    [zoom>=14] { line-width: 2; }
    [zoom>=16] { line-width: 3; }
  }
  [class='stream'],
  [class='stream_intermittent'],
  [class='canal'] {
    [zoom>=14] { line-width: 1; }
    [zoom>=16] { line-width: 2; }
    [zoom>=18] { line-width: 3; }
  }
  [class='stream_intermittent'] { line-dasharray: 6,2,2,2; }
}

// ---------------------------------------------------------------------
// Landuse areas 

#landcover {
  [class='grass'] { polygon-fill: #d8e8c8; }
  ::overlay {
    // Landuse classes look better as a transparent overlay.
    opacity: 0.1;
    [class='wood'] { 
      polygon-fill: #6a4; 
    //polygon-gamma: 0.5; 
    }
  }
}

#landuse {
  // Land-use and land-cover are not well-separated concepts in
  // OpenStreetMap, so this layer includes both. The 'class' field
  // is a highly opinionated simplification of the myriad LULC
  // tag combinations into a limited set of general classes.
  [class='cemetery'] { polygon-fill: mix(#d8e8c8, #ddd, 25%); }
  [class='hospital'] { polygon-fill: #fde; }
  [class='school'] { polygon-fill: #f0e8f8; }
}

// ---------------------------------------------------------------------
// Buildings 

#building [zoom<=17]{
  // At zoom level 13, only large buildings are included in the
  // vector tiles. At zoom level 14+, all buildings are included.
  polygon-fill: darken(@land, 50%);
  opacity: 0.1;
}
// Seperate attachments are used to draw buildings with depth
// to make them more prominent at high zoom levels
#building [zoom>=18]{
::wall { polygon-fill:mix(@land, #000, 85); }
::roof {
  polygon-fill: darken(@land, 5%);
  polygon-geometry-transform:translate(-1,-1.5);
  //polygon-clip:false;  
  line-width: 0.5;
  line-color: mix(@land, #000, 85);
  line-geometry-transform:translate(-1,-1.5);
  //line-clip:false;
 }
}

// ---------------------------------------------------------------------
// Aeroways 

#aeroway [zoom>=12] {
  ['mapnik::geometry_type'=2] {
    line-color: @land * 0.96;
    [class='runway'] { line-width: 5; }    
    [class='taxiway'] {  
      line-width: 1;
      [zoom>=15] { line-width: 2; }
    }
  }    
  ['mapnik::geometry_type'=3] {
    polygon-fill: @land * 0.96;
    [class='apron'] {
      polygon-fill: @land * 0.98;  
    }  
  }
}



// ---------------------------------------------------------------------
// Roads

#transportation_name::shield-pt[class='motorway'][zoom>=7][zoom<=10][ref_length<=6],
#transportation_name::shield-pt[class='motorway'][zoom>=9][zoom<=10][ref_length<=6],
#transportation_name::shield-ln[zoom>=11][ref_length<=6] {
  shield-name: [ref];
  shield-size: 9;
  shield-line-spacing: -4;
  shield-placement: @text3d;
  shield-file: url(shield/default-[ref_length].svg);
  shield-face-name: @sans;
  shield-fill: #333;
  [zoom>=14] {
    //shield-transform: scale(1.25,1.25);
    shield-size: 11;
  }
}
#transportation_name::shield-pt[class='motorway'][zoom>=7][zoom<=10][ref_length<=6],
#transportation_name::shield-pt[class='motorway'][zoom>=9][zoom<=10][ref_length<=6] {
  shield-placement: @text3d;
  shield-avoid-edges: false;
}
#transportation_name::shield-ln[zoom>=11][ref_length<=6] {
  shield-placement: line;
  shield-spacing: 400;
  shield-min-distance: 100;
  shield-avoid-edges: true;
}

#transportation_name {
  text-name: [name];
  text-placement: line;  // text follows line path
  text-face-name: @sans;
  text-fill: #765;
  text-halo-fill: fadeout(#fff, 50%);
  text-halo-radius: 1;
  text-halo-rasterizer: fast;
  text-size: 12;
  text-avoid-edges: true;  // prevents clipped labels at tile edges
  [zoom>=15] { text-size: 13; }
}


// ---------------------------------------------------------------------
// Water

#water_name {
  [zoom<=13],  // automatic area filtering @ low zooms
  [zoom>=14][area>500000],
  [zoom>=16][area>10000],
  [zoom>=17] {
    text-name: @name;
    text-face-name: @sans_it;
    text-fill: darken(@water, 15);
    text-size: 12;
    text-wrap-width: 100;
    text-wrap-before: true;
    text-halo-fill: fadeout(#fff, 75%);
    text-halo-radius: 1.5;
  }
}


// ---------------------------------------------------------------------
// House numbers

#housenumber[zoom>=18] {
  text-name: [housenumber];
  text-face-name: @sans_it;
  text-fill: #cba;
  text-size: 8;
  [zoom=19] { text-size: 10; }
  [zoom>=20] { text-size: 12; }
}

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
  // casing/outlines & single lines
  ::case[zoom>=6]['mapnik::geometry_type'=2] {
    [class='motorway'] {
      line-join:round;
      line-color: mix(@motorway, #800, 75);
      #road { line-cap: round; }
      #tunnel { line-dasharray:3,2; }
      [zoom>=6]  { line-width:0.4; }
      [zoom>=7]  { line-width:0.6; }
      [zoom>=8] { line-width:1.5; }
      [zoom>=10]  { line-width:3; }
      [zoom>=13] { line-width:3.5;  }
      [zoom>=14] { line-width:5; }
      [zoom>=15] { line-width:7; }
      [zoom>=16] { line-width:9; }
    }
    [class='motorway'][ramp=1][zoom>=13] {
      line-join:round;
      line-color: mix(@motorway, #800, 75);
      #road { line-cap: round; }
      #tunnel { line-dasharray:3,2; }
      [zoom>=13] { line-width:1; }
      [zoom>=14] { line-width:3; }
      [zoom>=15] { line-width:5; }
      [zoom>=16] { line-width:6.5; }
    }
    [class='primary'],[class='secondary'],[class='tertiary'],[class='trunk'] {
      line-join:round;
      line-cap: round;
      line-color: mix(@main, #800, 75);
      [brunnel='tunnel'] { line-dasharray:3,2; }
      [zoom>=6] { line-width:0.2; }
      [zoom>=7] { line-width:0.4; }
      [zoom>=8] { line-width:1.5; }
      [zoom>=10] { line-width:2.4; }
      [zoom>=13] { line-width:2.5; }
      [zoom>=14] { line-width:4; }
      [zoom>=15] { line-width:5; }
      [zoom>=16] { line-width:8; }
    }
    [class='minor'][zoom>=12] {
      line-join:round;
      line-cap: round;
      [brunnel='tunnel'] { line-dasharray:3,2; }
      line-color: @land;
      [zoom>=12] { line-width:0.5; }
      [zoom>=14] { line-width:1; }
      [zoom>=15] { line-width:4; }
      [zoom>=16] { line-width:6.5; }
    }
    [class='service'][zoom>=15] {
      line-join:round;
      line-cap: round;
      [brunnel='tunnel'] { line-dasharray:3,2; }
      line-color: @land;
      [zoom>=15] { line-width:1; }
      [zoom>=16] { line-width:4; }
    }
    [class='path'][zoom>=15] {
      line-color: #cba;
      line-dasharray: 2,1;
      [zoom>=16] { line-width: 1.2; }
      [zoom>=17] { line-width: 1.5; }
    }
  }
  
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
    [class='minor'] {
      line-join:round;
      line-cap: round;
      line-color:@street;
      [zoom>=15] { line-width:2.5;  }
      [zoom>=16] { line-width:4; }
    }
    [class='service'] {
      line-join:round;
      line-cap: round;
      line-color:@street;
      [zoom>=16] { line-width:2;  }
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
#hillshade[zoom<=18] {
  [class='shadow'] {
    polygon-fill: black;
    polygon-opacity: 0.05;
    //[level=89] { polygon-opacity: 0.02; }
    //[level=78] { polygon-opacity: 0.04; }
    //[level=67] { polygon-opacity: 0.06; }
   // [level=56] { polygon-opacity: 0.08; }
    polygon-opacity: linear([level], (56, 0.08), (89, 0.02));
  }
  [class='highlight'] {
    polygon-fill: white;
    polygon-opacity: 0.10;
  }
}

#contour
  [zoom>=12][height>300],
  [zoom>=14][height>200],
  [zoom>=16][height>0] {
    line-cap: butt;
    line-width: 0.68;
    line-color: #387127;
    line-opacity: 0.3;
  [nth_line=5][zoom>=14],
  [nth_line=10] {
    line-opacity: 0.5; 
    line-width: 0.96; 
    text-name: [height]+' m';
    text-face-name: @sans_lt;
    text-fill: #387127;
    text-halo-fill: rgba(255,255,255,1.0);
    text-halo-radius: 1;
    text-avoid-edges: true;
    text-allow-overlap: false;
    text-halo-rasterizer: fast;
    text-placement: line;
    text-size: linear([view::zoom], (15, 8), (20, 12.0));
  }
}

#contour
  [zoom>=12][ele>300],
  [zoom>=14][ele>200],
  [zoom>=16][ele>0] {
    line-cap: butt;
    line-width: 0.68;
    line-color: #387127;
    line-opacity: 0.3;
  [index=5][zoom>=14],
  [index=10] {
    line-opacity: 0.5; 
    line-width: 0.96; 
    text-name: [ele]+' m';
    text-face-name: @sans_lt;
    text-fill: #387127;
    text-halo-fill: rgba(255,255,255,1.0);
    text-halo-radius: 1;
    text-avoid-edges: true;
    text-allow-overlap: false;
    text-halo-rasterizer: fast;
    text-placement: line;
    text-size: linear([view::zoom], (15, 8), (20, 12.0));
  }
}



#offlinepackages {
    polygon-fill: #374C70;
    polygon-opacity: 0.9;
    //polygon-gamma: 0.5;
    ::outline { 
        line-color: #FFF;
    }
}
#offlinepackages::labels {
    text-name: [package_id];
    text-face-name: @sans;
    text-size: 10;
    text-fill: #130505;
    //text-label-position-tolerance: 0;
    text-halo-radius: 1;
    text-halo-fill: #dee3e7;
    text-dy: -10;
    text-allow-overlap: false;
    text-placement: @text3d;
    //text-placement-type: dummy;
}
// =====================================================================
// LABELS

// General notes:
// - `text-halo-rasterizer: fast;` gives a noticeable performance
//    boost to render times and is recommended for *all* halos.

// ---------------------------------------------------------------------


@place_halo:        #fff;
@country_text:      @land * 0.2;
@country_halo:      @place_halo;


// ---------------------------------------------------------------------
// Countries

// The country labels in MapBox Streets vector tiles are placed by hand,
// optimizing the arrangement to fit as many as possible in densely-
// labeled areas.
#place[class='country'][zoom>=2][zoom<=10] {
  text-name: @name;
  text-face-name: @sans_bd;
  [zoom=2] { text-face-name: @sans; }
  text-placement: @text3d;
  text-size: 9;
  text-fill: @country_text;
  text-halo-fill: @country_halo;
  text-halo-radius: 1;
  text-halo-rasterizer: fast;
  text-wrap-width: 20;
  text-wrap-before: true;
  text-line-spacing: -3;
  [rank=1] {
    [zoom=3]  { text-size: 12; text-wrap-width: 60; }
    [zoom=4]  { text-size: 14; text-wrap-width: 90; }
    [zoom=5]  { text-size: 20; text-wrap-width: 120; }
    [zoom>=6] { text-size: 20; text-wrap-width: 120; }
  }
  [rank=2] {
    [zoom=2]  { text-name: [code]; }
    [zoom=3]  { text-size: 11; }
    [zoom=4]  { text-size: 13; }
    [zoom=5]  { text-size: 17; }
    [zoom>=6] { text-size: 20; }
  }
  [rank=3] {
    [zoom=3]  { text-name: [code]; }
    [zoom=4]  { text-size: 11; }
    [zoom=5]  { text-size: 15; }
    [zoom=6]  { text-size: 17; }
    [zoom=7]  { text-size: 18; text-wrap-width: 60; }
    [zoom>=8] { text-size: 20; text-wrap-width: 120; }
  }
  [rank=4] {
    [zoom=5] { text-size: 13; }
    [zoom=6] { text-size: 15; text-wrap-width: 60  }
    [zoom=7] { text-size: 16; text-wrap-width: 90; }
    [zoom=8] { text-size: 18; text-wrap-width: 120; }
    [zoom>=9] { text-size: 20; text-wrap-width: 120; }
  }
  [rank=5] {
    [zoom=5] { text-size: 11; }
    [zoom=6] { text-size: 13; }
    [zoom=7] { text-size: 14; text-wrap-width: 60; }
    [zoom=8] { text-size: 16; text-wrap-width: 90; }
    [zoom>=9] { text-size: 18; text-wrap-width: 120; }
  }
  [rank>=6] {
    [zoom=7] { text-size: 12; }
    [zoom=8] { text-size: 14; }
    [zoom>=9] { text-size: 16; }
  }
}


// ---------------------------------------------------------------------
// Cities, towns, villages, etc

// City labels with dots for low zoom levels.
// The separate attachment keeps the size of the XML down.
#place::citydots[class='city'][zoom>=4][zoom<=7] {
  // explicitly defining all the `ldir` values wer'e going
  // to use shaves a bit off the final project.xml size
    shield-file: url(shield/dot.svg);
    shield-unlock-image: true;
    shield-name: @name;
    shield-size: 12;
    shield-face-name: @sans;
    shield-placement: @text3d;
    shield-fill: #333;
    shield-halo-fill: fadeout(#fff, 50%);
    shield-halo-radius: 1;
    shield-halo-rasterizer: fast;
    [zoom=7] { shield-size: 14; }
}

#place[class='city'][zoom>=8][zoom<=14][rank<=11],
#place[class='city'][zoom>=9][zoom<=14][rank<=12],
#place[class='city'][zoom>=10][zoom<=14][rank<=15],
#place[class='town'][zoom>=9][zoom<=14][rank<=12],
#place[class='town'][zoom=15],
#place[class='village'][zoom>=12][zoom<=14][rank<=11],
#place[class='village'][zoom>=15][zoom<=16],
#place[class='suburb'][zoom>=12][zoom<=14][rank<=11],
#place[class='suburb'][zoom>=15][zoom<=16],
#place[zoom>=13][zoom<=15][rank<=11],
#place[zoom>=16][zoom<=17] {
  text-name: @name;
  text-face-name: @sans;
  text-wrap-width: 120;
  text-placement: @text3d;
  text-wrap-before: true;
  text-fill: #333;
  text-halo-fill: fadeout(#fff, 50%);
  text-halo-radius: 1;
  text-halo-rasterizer: fast;
  text-size: 10;
  [class='city'] {
  	text-face-name: @sans_md;
    text-size: 16;
    [zoom>=10] { 
      text-size: 18;
      text-wrap-width: 140;
    }
    [zoom>=12] { 
      text-size: 24;
      text-wrap-width: 180;
    }
    // Hide at largest scales:
    [zoom>=16] { text-name: ''; }
  }
  [class='town'] {
    text-size: 14;
    [zoom>=12] { text-size: 16; }
    [zoom>=14] { text-size: 20; }
    [zoom>=16] { text-size: 24; }
    // Hide at largest scales:
    [zoom>=18] { text-name: ''; }
  }
  [class='village'] {
    text-size: 12;
    [zoom>=12] { text-size: 14; }
    [zoom>=14] { text-size: 18; }
    [zoom>=16] { text-size: 22; }
  }
  [class='hamlet'],
  [class='suburb'],
  [class='neighbourhood'] {
    text-fill: #633;
    text-face-name:	@sans_bd;
    text-transform: uppercase;
    text-character-spacing: 0.5;
    [zoom>=14] { text-size: 11; }
    [zoom>=15] { text-size: 12; text-character-spacing: 1; }
    [zoom>=16] { text-size: 14; text-character-spacing: 2; }
  }
}


// ---------------------------------------------------------------------
// Points of interest




//Peak labels
#mountain_peak {
    [zoom>=4][comment =~'.*Highest.*'],
    [zoom>=4][comment =~'.*highest.*'],
    [zoom>=6][ele>=3000],
    [zoom>=8][ele>=2000],
    [zoom>=11][elevation>=1000]
    [zoom>=13][elevation>=500] {
      shield-name: @name + '\n'  + [ele] + 'm';
      shield-face-name: @sans;
      shield-size: 11;
      shield-file: url('icon/mountain-11.svg');
      shield-unlock-image: true;
      shield-avoid-edges: true;
      shield-fill: @peak_label;
      shield-halo-fill: @peak_halo;
      shield-halo-radius: 1;
      shield-halo-rasterizer: fast;
      shield-min-distance: 2;
      shield-placement: @text3d;
      shield-text-dy: 8;
      shield-text-dx: 0;
      shield-min-distance: 3;
      shield-wrap-width: 80;
      shield-line-spacing: -2;

      [comment =~'.*Highest.*'],
      [comment =~'.*highest.*'] {
        shield-face-name: @mont_it;
      }
    }
}

#poi[zoom=14][rank<=1],
#poi[zoom=15][rank<=2],
#poi[zoom=16][rank<=3],
#poi[zoom=17][rank<=4],
#poi[zoom>=18] {
  // Separate icon and label attachments are created to ensure that
  // all icon placement happens first, then labels are placed only
  // if there is still room.
  ::icon[class!=null] {
    // The [maki] field values match a subset of Maki icon names, so we
    // can use that in our url expression.
    // Not all POIs have a Maki icon assigned, so we limit this section
    // to those that do. See also <https://www.mapbox.com/maki/>
    marker-fill:#999;
    marker-file:url('icon/[class]-11.svg');
    marker-placement: @text3d;
  }
  ::label {
    text-name: '[name]';
    text-face-name: @sans_md;
    text-size: 12;
    text-fill: #666;
    text-halo-fill: fadeout(#fff, 50%);
    text-halo-radius: 1;
    text-halo-rasterizer: fast;
    text-wrap-width: 70;
    text-line-spacing:	-1;
    //text-transform: uppercase;
    //text-character-spacing:	0.25;
    // POI labels with an icon need to be offset:
    [class!=null] { text-dy: 8; }
  }
}
