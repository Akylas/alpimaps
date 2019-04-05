

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
    text-face-name: @mont;
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
    text-face-name: @mont;
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

