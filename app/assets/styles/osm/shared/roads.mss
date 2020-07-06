/* For the main linear features, such as roads and railways. */
@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];


// Areas
#transportation['mapnik::geometry_type'=3] {
	// [class=living_street][zoom>=14] {
	// 	polygon-fill: @living-street-fill;
	// }
	
	[class=residential],
	[class=unclassified],
	[class=minor],
	[class=service] {
		[zoom>=14] {
			polygon-fill: #fff;
			line-color: #999;
			line-width: 1;
		}
	}
	[class=path] [zoom>=15]{
		[subclass=pedestrian],
		[subclass=footway],
		[subclass=cycleway] {
			polygon-fill: @pedestrian-fill;
			line-color: #808080;
			line-width: 0.2;
		}
	}
	

	[class=track][zoom>=15] {
		polygon-fill: #cdbea0;
		line-color: @track-fill;
		line-width: 1;
		line-dasharray: 5,4,2,4;
		line-cap: round;
		line-join: round;
	}

	[class=path],[class=transit],[class=rail]{
		[subclass=platform][zoom>=17]  {
			// {
				polygon-fill: #bbbbbb;
				line-color: #808080;
				line-width: linear([view::zoom], (17, 0), (21, 2));
			// }
		}
	}
	[class=bridge] {
		polygon-fill: rgba(255,255,255,0.4) ;
		line-color: #B0B0A8;
		line-width:0.5;
	}
}
#transportation['mapnik::geometry_type'=2] {
		/* Data on z<10 comes from osm_planet_roads, data on z>=10 comes from
	osm_planet_line. This is for performance reasons: osm_planet_roads contains less
	data, and is thus faster. Chosen is for zoom level 10 as cut-off, because
	tertiary is rendered from z10 and is not included in osm_planet_roads. */
	
	::halo[zoom<12] {
		
		[zoom>=10][zoom<=11][class=tertiary]
		// [zoom=12][class=unclassified],
		// [zoom=12][class=minor]
		 {
			line-color: @halo-color-for-minor-road;
			line-width: @residential-width-z12;
			line-opacity: 0.3;
			line-join: round;
			//Missing line-cap: round; is intentional. It would cause rendering glow multiple times in some places - what as result of partial transparency would cause differences in rendering
			//Also, bridges - including bridge casings are rendered on top of roads. Enabling line-cap: round would result in glow from bridges rendered on top of road around bridges.
		}
		[class=motorway][ramp!=1][zoom>=6],
		[class=motorway][ramp=1][zoom>=10] {
			line-width: linear([view::zoom], (6, @motorway-width-z6), (7, @motorway-width-z7), (8, @motorway-width-z8), (9, @motorway-width-z9), (10, @motorway-width-z10), (11, @motorway-width-z11)) + 2 * @lowzoom-halo-width;

			line-color: @lowzoom-halo-color;
			line-opacity: .4;
			}
		[class=trunk][ramp!=1][zoom>=6],
		[class=trunk][ramp=1][zoom>=10] {
			line-width: linear([view::zoom], (6, @trunk-width-z6), (7, @trunk-width-z7), (8, @trunk-width-z8), (9, @trunk-width-z9), (10, @trunk-width-z10), (11, @trunk-width-z11)) + 2 * @lowzoom-halo-width;
			line-color: @lowzoom-halo-color;
			line-opacity: .4;
			}
		[class=primary][ramp!=1][zoom>=8],
		[class=primary][ramp=1][zoom>=10] {
			line-width: linear([view::zoom], (8, @primary-width-z8), (9, @primary-width-z9), (10, @primary-width-z10), (11, @primary-width-z11)) + 2 * @lowzoom-halo-width;
			line-color: @lowzoom-halo-color;
			line-opacity: .4;
			}
		
	} 
	::casing {
		[class=path][subclass=pedestrian][zoom>=14] {
			line-color: @pedestrian-casing;
			line-width: linear([view::zoom], (14, @pedestrian-width-z14), (15, @pedestrian-width-z15), (16, @pedestrian-width-z16), (17, @pedestrian-width-z17), (18, @pedestrian-width-z18), (19, @pedestrian-width-z19));
			[brunnel=tunnel] {
				line-dasharray: 4,2; 
			}
			[brunnel=bridge] { 
				line-color: @bridge-casing;
				// line-join: round;
			}
			// line-join: round;
			// line-cap: round;
		}
		[class=service][zoom>=14] {
			line-color: @service-casing;
			[class=service] {
				line-width: linear([view::zoom], (14, @service-width-z14), (16, @service-width-z16), (17, @service-width-z17), (18, @service-width-z18), (19, @service-width-z19));
			}
			// [class=minor] {
			// 	line-width: linear([view::zoom], (16, @minor-service-width-z16), (17, @minor-service-width-z17), (18, @minor-service-width-z18), (19, @minor-service-width-z19));
			// }
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] {
				line-color: @bridge-casing;
				// line-join: round;
			}
			line-join: round;
			line-cap: round;
		}

		[class=residential],
		[class=unclassified],
		[class=minor] {
			[zoom>=15] {
				line-color: @residential-casing;
				line-width: linear([view::zoom], (13, @residential-width-z13), (14, @residential-width-z14), (15, @residential-width-z15), (16, @residential-width-z16), (17, @residential-width-z17), (18, @residential-width-z18), (19, @residential-width-z19));
				[brunnel=tunnel] {
					line-dasharray: 4,2;
				}
				[brunnel=bridge] {
					[zoom>=14] {
					line-color: @bridge-casing;
					line-join: round;
					}
				}
			}
		}

		[class=tertiary][zoom>=12] {
			line-color: @tertiary-casing;
			line-width: linear([view::zoom], (12, @tertiary-width-z12), (13, @tertiary-width-z13), (14, @tertiary-width-z14), (15, @tertiary-width-z15), (16, @tertiary-width-z16), (17, @tertiary-width-z17), (18, @tertiary-width-z18), (19, @tertiary-width-z19));
			// [ramp=1] {
			//	 line-width: @tertiary-link-width-z12;
			//	 [zoom>=13] { line-width: @tertiary-link-width-z13; }
			//	 [zoom>=15] { line-width: @tertiary-link-width-z15; }
			//	 [zoom>=17] { line-width: @tertiary-link-width-z17; }
			//	 [zoom>=18] { line-width: @tertiary-link-width-z18; }
			//	 [zoom>=19] { line-width: @tertiary-link-width-z19; }
			// }
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] [zoom>=14]{
				line-color: @bridge-casing;
				line-join: round;
			}
		}

		
		[class=primary][zoom>=12] {
			line-color: linear([view::zoom], (12, @primary-low-zoom-casing), (13, @primary-casing));

			line-width: linear([view::zoom], (12, @primary-width-z12), (13, @primary-width-z13), (15, @primary-width-z15), (17, @primary-width-z17), (18, @primary-width-z18), (19, @primary-width-z19));
			// [ramp=1] {
			//	 line-width: @primary-link-width-z12;
			//	 [zoom>=13] { line-width: @primary-link-width-z13; }
			//	 [zoom>=15] { line-width: @primary-link-width-z15; }
			//	 [zoom>=17] { line-width: @primary-link-width-z17; }
			//	 [zoom>=18] { line-width: @primary-link-width-z18; }
			//	 [zoom>=19] { line-width: @primary-link-width-z19; }
			// }
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] {
				line-join: round;
				[zoom>=13] { line-color: @bridge-casing; }
			}
		}
		[class=trunk][zoom>=12] {
			line-color: @trunk-low-zoom-casing;
			[zoom>=13] {
			line-color: @trunk-casing;
			}
			line-width: linear([view::zoom], (12, @trunk-width-z12), (13, @trunk-width-z13), (15, @trunk-width-z15), (17, @trunk-width-z17), (18, @trunk-width-z18), (19, @trunk-width-z19));
			
			// [ramp=1] {
			//	 line-width: @trunk-link-width-z12;
			//	 [zoom>=13] { line-width: @trunk-link-width-z13; }
			//	 [zoom>=15] { line-width: @trunk-link-width-z15; }
			//	 [zoom>=17] { line-width: @trunk-link-width-z17; }
			//	 [zoom>=18] { line-width: @trunk-link-width-z18; }
			//	 [zoom>=19] { line-width: @trunk-link-width-z19; }
			// }
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] {
				line-join: round;
				[zoom>=13] { line-color: @bridge-casing; }
			}
		}
		[class=motorway] [zoom>=12]{
			line-width: linear([view::zoom], (12, @motorway-width-z12), (13, @motorway-width-z13), (15, @motorway-width-z15), (17, @motorway-width-z17), (18, @motorway-width-z18), (19, @motorway-width-z19));

			// [ramp=1] {
			//	 line-width: @motorway-link-width-z12;
			//	 [zoom>=13] { line-width: @motorway-link-width-z13; }
			//	 [zoom>=15] { line-width: @motorway-link-width-z15; }
			//	 [zoom>=17] { line-width: @motorway-link-width-z17; }
			//	 [zoom>=18] { line-width: @motorway-link-width-z18; }
			//	 [zoom>=19] { line-width: @motorway-link-width-z19; }
			// }
			line-color: @motorway-low-zoom-casing;
			[zoom>=13] {
				line-color: @motorway-casing;
			}
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] {
				line-join: round;
				[zoom>=13] { line-color: @bridge-casing; }
			}
		}



		// [class=road] {
		// 	[zoom>=14] {
		// 	line-color: @road-casing;
		// 	line-width: linear([view::zoom], (14, @road-width-z14), (16, @road-width-z16), (17, @road-width-z17), (18, @road-width-z18), (19, @road-width-z19));
		// 	[brunnel=tunnel] {
		// 		line-dasharray: 4,2;
		// 	}
		// 	[brunnel=bridge] {
		// 		line-color: @bridge-casing;
		// 		line-join: round;
		// 	}
		// 	}
		// }


		// [class=living_street] {
		// 	[zoom>=13] {
		// 	line-color: @residential-casing;
		// 	[zoom>=14] {
		// 		line-color: @living-street-casing;
		// 	}
		// 	line-width: linear([view::zoom], (13, @living-street-width-z13), (14, @living-street-width-z14), (15, @living-street-width-z15), (16, @living-street-width-z16), (17, @living-street-width-z17), (18, @living-street-width-z18), (19, @living-street-width-z19));
		// 	[brunnel=tunnel] {
		// 		line-dasharray: 4,2;
		// 	}
		// 	[brunnel=bridge] {
		// 		[zoom>=14] {
		// 		line-color: @bridge-casing;
		// 		line-join: round;
		// 		}
		// 	}
		// 	}
		// }

		[class=path][zoom>=12] {
			[subclass=steps] {
				[brunnel=bridge][zoom>=14]  {

					line-color: @bridge-casing;
					line-join: round;
					line-width: linear([view::zoom], (13, @steps-width-z13 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (15, @steps-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width)));
				}
				[brunnel=tunnel][zoom>=13] {

					line-width: linear([view::zoom], (13, @steps-width-z13 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (15, @steps-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width)));
					line-color: @tunnel-casing;
					line-dasharray: 4,2;
				}
			}

			[subclass=bridleway]
			// ,
			// [subclass=path][horse=designated] 
			{
				[brunnel=bridge][zoom>=14] {
					line-width: linear([view::zoom], (13, @bridleway-width-z13 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (15, @bridleway-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width)));
					line-color: @bridge-casing;
					line-join: round;
				}
				[brunnel=tunnel][zoom>=13] {
					line-width: linear([view::zoom], (13, @bridleway-width-z13 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (15, @bridleway-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width)));
					line-color: @tunnel-casing;
					line-dasharray: 4,2;
				}
			}

			[subclass=footway]
			// ,
			// [subclass=path]
			// [bicycle!=designated][horse!=designated]
			 {
				[brunnel=bridge][zoom>=14] {
					line-width: linear([view::zoom], (14, @footway-width-z14 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (15, @footway-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (16, @footway-width-z16 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (18, @footway-width-z18 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (19, @footway-width-z19 + 2 * (@paths-background-width + @paths-bridge-casing-width)));

					line-color: @bridge-casing;
					line-join: round;
				}
				[brunnel=tunnel][zoom>=14] {
					line-width: linear([view::zoom], (14, @footway-width-z14 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (15, @footway-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (16, @footway-width-z16 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (18, @footway-width-z18 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (19, @footway-width-z19 + 2 * (@paths-background-width + @paths-tunnel-casing-width)));
					line-color: @tunnel-casing;
					line-dasharray: 4,2;
				}
			}

			[subclass=cycleway]
			// ,
			// [subclass=path][bicycle=designated]
			 {
				[brunnel=bridge][zoom>=14] {
					line-width: linear([view::zoom], (13,	@cycleway-width-z13 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (15, @cycleway-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (16, @cycleway-width-z16 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (18, @cycleway-width-z18 + 2 * (@paths-background-width + @paths-bridge-casing-width)), (19, @cycleway-width-z19 + 2 * (@paths-background-width + @paths-bridge-casing-width)));
					line-color: @bridge-casing;
					line-join: round;
				}
				[brunnel=tunnel][zoom>=13] {
					line-width: linear([view::zoom], (13,	@cycleway-width-z13 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (15, @cycleway-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (16, @cycleway-width-z16 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (18, @cycleway-width-z18 + 2 * (@paths-background-width + @paths-tunnel-casing-width)), (19, @cycleway-width-z19 + 2 * (@paths-background-width + @paths-tunnel-casing-width)));
					line-color: @tunnel-casing;
					line-dasharray: 4,2;
				}
			}
		}

		[class=track] {
			[brunnel=bridge] {
				[zoom>=13][zoom<15] {
					line-color: @bridge-casing;
					line-join: round;
					line-width: @track-width-z13 + 2 * (@paths-background-width + @paths-bridge-casing-width);
					[tracktype=grade1] {
					line-width: @track-grade1-width-z13 + 2 * (@paths-background-width + @paths-bridge-casing-width);
					}
					[tracktype=grade2] {
					line-width: @track-grade2-width-z13 + 2 * (@paths-background-width + @paths-bridge-casing-width);
					}
				}
				[zoom>=15] {
					line-color: @bridge-casing;
					line-join: round;
					line-width: @track-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width);
					[tracktype=grade1] {
					line-width: @track-grade1-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width);
					}
					[tracktype=grade2] {
					line-width: @track-grade2-width-z15 + 2 * (@paths-background-width + @paths-bridge-casing-width);
					}
				}
			}
			[brunnel=tunnel][zoom>=13] {
				line-color: @tunnel-casing;
				line-dasharray: 4,2;
				line-width: @track-width-z13 + 2 * (@paths-background-width + @paths-tunnel-casing-width);
				[tracktype=grade1] {
				line-width: @track-grade1-width-z13 + 2 * (@paths-background-width + @paths-tunnel-casing-width);
				}
				[tracktype=grade2] {
				line-width: @track-grade2-width-z13 + 2 * (@paths-background-width + @paths-tunnel-casing-width);
				}
				[zoom>=15]{
					line-width: @track-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width);
					[tracktype=grade1] {
						line-width: @track-grade1-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width);
					}
					[tracktype=grade2] {
						line-width: @track-grade2-width-z15 + 2 * (@paths-background-width + @paths-tunnel-casing-width);
					}
				}
			}
		}

		[class=rail][brunnel=bridge][zoom>=13] {
			[subclass=tram],
			[subclass='tram-service'][zoom>=15] {
				// [zoom>=13]  {
					line-width: 4;
					line-width: linear([view::zoom], (13,4),(15,5))
					// [zoom>=15] {
					// line-width: 5;
					// }
					line-color: @bridge-casing;
					line-join: round;
				// }
			}

			[subclass=subway]
			// [subclass=construction][construction=subway]
			 {
				[zoom>=14] {
					line-width: 5.5;
					line-color: @bridge-casing;
					line-join: round;
				}
			}
			[subclass=light_rail],
			[subclass=funicular],
			[subclass=narrow_gauge] {
				[zoom>=14] {
					line-width: 5.5;
					line-color: @bridge-casing;
					line-join: round;
				}
			}
			[subclass=rail][zoom>=13],
			[subclass=preserved][zoom>=13],
			[subclass=monorail][zoom>=14] {
				// [zoom>=13] {
					line-width: 6.5;
					line-color: @bridge-casing;
					line-join: round;
				// }
				// [service=spur],
				// [service=yard],
				// [service=siding] {
				// 	[zoom>=13] {
				// 		line-width: 5.7;
				// 		line-color: @bridge-casing;
				// 		line-join: round;
				// 	}
				// }
			}
			
			[subclass=disused][zoom>=15],
			// [subclass=construction][construction != subway],
			[subclass=miniature][zoom>=15]{
					line-width: 6;
					line-color: @bridge-casing;
					line-join: round;
			}
		}

		
	
	}

	::bridges_and_tunnels_background {
		[class=path]{
			[subclass=bridleway]
			// ,
			// [subclass=path][horse=designated] 
			{
				[brunnel=bridge][zoom>=14] {
					line-width: linear([view::zoom], (13,	@bridleway-width-z13 + 2 * @paths-background-width), (15, @bridleway-width-z15 + 2 * @paths-background-width));
					line-color: @bridleway-casing;
					line-join: round;
				}
				[brunnel=tunnel][zoom>=13] {
					line-color: @bridleway-casing;
					line-cap: round;
					line-join: round;
					line-width: linear([view::zoom], (13,	@bridleway-width-z13 + 2 * @paths-background-width), (15, @bridleway-width-z15 + 2 * @paths-background-width));
				}
			}

			[subclass=footway],
			[subclass=path]
			// [bicycle != designated][horse != designated]
			{
				[brunnel=bridge][zoom>=14],
				[brunnel=tunnel][zoom>=14] {
					line-color: @footway-casing;
					line-cap: round;
					line-join: round;
					line-width: linear([view::zoom], (14,	@footway-width-z14 + 2 * @paths-background-width), (15, @footway-width-z15 + 2 * @paths-background-width), (16, @footway-width-z16 + 2 * @paths-background-width), (18, @footway-width-z18 + 2 * @paths-background-width), (19, @footway-width-z19 + 2 * @paths-background-width));
				}
			}

			[subclass=cycleway]
			// ,
			// [subclass=path][bicycle=designated] 
			{
				[brunnel=bridge][zoom>=14],
				[brunnel=tunnel][zoom>=13] {
					line-join: round;
					line-cap: round;

					line-color: @cycleway-casing;
					line-width: linear([view::zoom], (13,	@cycleway-width-z13 + 2 * @paths-background-width), (15, @cycleway-width-z15 + 2 * @paths-background-width), (16, @cycleway-width-z16 + 2 * @paths-background-width), (18, @cycleway-width-z18 + 2 * @paths-background-width), (19, @cycleway-width-z19 + 2 * @paths-background-width));
				}
			}

			[subclass=steps] {
				[brunnel=bridge][zoom>=14],
				[brunnel=tunnel][zoom>=13] {
					line-color: @steps-casing;
					line-cap: round;
					line-join: round;
					line-width: linear([view::zoom], (13,	@cycleway-width-z13), (15, @cycleway-width-z15)) + 2 * @paths-background-width;
				}
			}
		}

		[class=track] {
			/* We don't set opacity here, so it's 1.0. Aside from that, it's basically a copy of roads-fill::background in the track part of ::fill */
			[brunnel=bridge] {
				[zoom>=13][access != no] {
					line-color: @track-casing;
					line-join: round;
					line-width: @track-width-z13 + 2 * @paths-background-width;
					[tracktype=grade1] {
					line-width: @track-grade1-width-z13 + 2 * @paths-background-width;
					}
					[tracktype=grade2] {
					line-width: @track-grade2-width-z13 + 2 * @paths-background-width;
					}
				}
				[zoom>=15] {
					line-color: @track-casing;
					line-join: round;
						line-width: @track-width-z15 + 2 * @paths-background-width;
					[tracktype=grade1] {
						line-width: @track-grade1-width-z15 + 2 * @paths-background-width;
					}
					[tracktype=grade2] {
						line-width: @track-grade2-width-z15 + 2 * @paths-background-width;
					}
				}
			}
			[brunnel=tunnel] {
				[zoom>=13][access != no],
				[zoom>=15] {
					line-color: @track-casing;
					line-join: round;
					line-cap: round;
					line-width: @track-width-z13 + 2 * @paths-background-width;
					/* With the heavier dasharrays on grade1 and grade2 it helps to make the casing a bit larger */
					[tracktype=grade1] {
						line-width: @track-grade1-width-z13 + 2 * @paths-background-width;
					}
					[tracktype=grade2] {
						line-width: @track-grade2-width-z13 + 2 * @paths-background-width;
					}

					[zoom>=15] {
						line-width: @track-width-z15 + 2 * @paths-background-width;
						[tracktype=grade1] {
							line-width: @track-grade1-width-z15 + 2 * @paths-background-width;
						}
						[tracktype=grade2] {
							line-width: @track-grade2-width-z15 + 2 * @paths-background-width;
						}
					}
				}
			}
		}
		[class=rail][brunnel=bridge][zoom>=13]{
			[subclass=rail][zoom>=13],
			[subclass=preserved][zoom>=13],
			[subclass=monorail][zoom>=14] {
					line-width: 5;
					line-color: white;
					line-join: round;
					// [service=spur],
					// [service=yard],
					// [service=siding] {
					// 		line-width: 4;
					// 		line-color: white;
					// 		line-join: round;
					// }
			}

			

			[subclass=disused][zoom>=15],
			// [subclass=construction][construction != subway],
			[subclass=miniature][zoom>=15] {
					line-width: 4.5;
					line-color: white;
					line-join: round;
			}

			[subclass=tram],
			[subclass=tram-service][zoom>=15] {
					line-width: 3;
					[zoom>=15] {
						line-width: 4;
					}
					line-color: white;
			}

			[subclass=subway]
			// [subclass=construction][construction=subway]
			 {
				[zoom>=14] {
					line-width: 4;
					line-color: white;
					line-join: round;
				}
			}

			[subclass=light_rail],
			[subclass=funicular],
			[subclass=narrow_gauge] {
				[zoom>=14] {
					line-width: 4;
					line-color: white;
					line-join: round;
				}
			}
		}
	}



	::fill {
		[class=path],[class=transit],[class=rail]{
			[subclass=platform][zoom>=17]  {
				// {
					// polygon-fill: #bbbbbb;
					// line-color: #808080;
					// line-width: linear([view::zoom], (17, 0), (21, 2));

					// line-join: round;
				line-width: linear([view::zoom], (17, 0), (18, 6));
				line-color: #808080;
			// 	line-cap: round;
				b/line-width: linear([view::zoom], (17, 0), (18, 4));
				b/line-color: #bbbbbb;
			// 	b/line-cap: round;
			// 	b/line-join: round;
				// }
			}
		}
		[class=path][subclass=pedestrian][zoom>=14] {
			line-width: linear([view::zoom], (14, @pedestrian-width-z14 - 2 * @casing-width-z14), (15, @pedestrian-width-z15 - 2 * @casing-width-z15), (16, @pedestrian-width-z16 - 2 * @casing-width-z16), (17, @pedestrian-width-z17 - 2 * @casing-width-z17), (18, @pedestrian-width-z18 - 2 * @casing-width-z17), (19, @pedestrian-width-z19 - 2 * @casing-width-z19));
			
			line-color: @pedestrian-fill;
			[brunnel=bridge] {
				line-width: linear([view::zoom], (14, @pedestrian-width-z14 - 2 * @bridge-casing-width-z14), (15, @pedestrian-width-z15 - 2 * @bridge-casing-width-z15), (16, @pedestrian-width-z16 - 2 * @bridge-casing-width-z16), (17, @pedestrian-width-z17 - 2 * @bridge-casing-width-z17), (18, @pedestrian-width-z18 - 2 * @bridge-casing-width-z17), (19, @pedestrian-width-z19 - 2 * @bridge-casing-width-z19));
			
			}
			line-join: round;
			line-cap: round;
		}
		[class=service][zoom>=14]{
			line-color: @service-fill;
			[class='service'] {
				line-width: linear([view::zoom], (14, @service-width-z14 - 2 * @casing-width-z14), (16, @service-width-z16 - 2 * @casing-width-z16), (17, @service-width-z17 - 2 * @casing-width-z17), (18, @service-width-z18 - 2 * @casing-width-z17), (19, @service-width-z19 - 2 * @casing-width-z19));
			}
			// [class='minor'] {
			// 	line-width: linear([view::zoom], (16, @minor-service-width-z16 - 2 * @casing-width-z16), (17, @minor-service-width-z17 - 2 * @casing-width-z17), (18, @minor-service-width-z18 - 2 * @casing-width-z17), (19, @minor-service-width-z19 - 2 * @casing-width-z19));
			
			// }
			line-join: round;
			line-cap: round;
			[brunnel=tunnel] {
				line-color: darken(white, 5%);
			}
			[brunnel=bridge] {
				[class=service] {
					line-width: linear([view::zoom], (14, @service-width-z14 - 2 * @casing-width-z14), (16, @service-width-z16 - 2 * @bridge-casing-width-z16), (17, @service-width-z17 - 2 * @bridge-casing-width-z17), (18, @service-width-z18 - 2 * @bridge-casing-width-z17), (19, @service-width-z19 - 2 * @bridge-casing-width-z19));
					
				}
				// [class='minor'] {
				// 	line-width: linear([view::zoom], (14, @minor-service-width-z14 - 2 * @casing-width-z14), (16, @minor-service-width-z16 - 2 * @bridge-casing-width-z16), (17, @minor-service-width-z17 - 2 * @bridge-casing-width-z17), (18, @minor-service-width-z18 - 2 * @bridge-casing-width-z17), (19, @minor-service-width-z19 - 2 * @bridge-casing-width-z19));
				
				// }
			}
		}


		[class=residential],
		[class=unclassified],
		[class=minor] {
			[zoom>=12][class=residential] {
				line-color: @unimportant-road;
				line-width: @residential-width-z12;
			}
			[zoom=12][class=minor],
			[zoom=12][class=unclassified] {
				line-color: @residential-fill;
				line-width: @unclassified-width-z12;
			}
			[zoom>=13] {
				line-color: @residential-fill;
				line-width: linear([view::zoom], (13, @residential-width-z13 - 2 * @residential-casing-width-z13), (14, @residential-width-z14 - 2 * @casing-width-z14), (15, @residential-width-z15 - 2 * @casing-width-z15), (16, @residential-width-z16 - 2 * @casing-width-z16), (17, @residential-width-z17 - 2 * @casing-width-z17), (18, @residential-width-z18 - 2 * @casing-width-z17), (19, @residential-width-z19 - 2 * @casing-width-z19));
			
			[brunnel=tunnel] {
				line-color: @residential-tunnel-fill;
			}
			[brunnel=bridge] {
				line-color: @residential-fill;
				line-width: linear([view::zoom], (13, @residential-width-z13 - 2 * @bridge-casing-width-z13), (14, @residential-width-z14 - 2 * @bridge-casing-width-z14), (15, @residential-width-z15 - 2 * @bridge-casing-width-z15), (16, @residential-width-z16 - 2 * @bridge-casing-width-z16), (17, @residential-width-z17 - 2 * @bridge-casing-width-z17), (18, @residential-width-z18 - 2 * @bridge-casing-width-z17), (19, @residential-width-z19 - 2 * @bridge-casing-width-z19));
				
			}
			line-cap: round;
			line-join: round;
			}
		}
		
		[class=tertiary] {
			[zoom>=10] {
				line-color: @unimportant-road;
				line-width: linear([view::zoom], (10, @tertiary-width-z10), (11, @tertiary-width-z11));

				[zoom>=12] {
					line-color: @tertiary-fill;
					line-width: linear([view::zoom], (12, @tertiary-width-z12), (13, @tertiary-width-z13), (15, @tertiary-width-z15), (17, @tertiary-width-z17), (18, @tertiary-width-z18), (19, @tertiary-width-z19)) - 2 * @casing-width-z12;
					
					[ramp=1] {
						line-width: linear([view::zoom], (12, @tertiary-link-width-z12), (13, @tertiary-link-width-z13), (15, @tertiary-link-width-z15), (17, @tertiary-link-width-z17), (18, @tertiary-link-width-z18), (19, @tertiary-link-width-z19)) - 2 * @casing-width-z12;
					
					}
					[brunnel=tunnel] {
						line-color: @tertiary-tunnel-fill;
					}
					[brunnel=bridge] {
						line-width: linear([view::zoom], (12, @tertiary-width-z12), (13, @tertiary-width-z13), (15, @tertiary-width-z15), (17, @tertiary-width-z17), (18, @tertiary-width-z18), (19, @tertiary-width-z19)) - 2 * @bridge-casing-width-z12;
						
						[ramp=1] {
							line-width: linear([view::zoom], (12, @tertiary-link-width-z12), (13, @tertiary-link-width-z13), (15, @tertiary-link-width-z15), (17, @tertiary-link-width-z17), (18, @tertiary-link-width-z18), (19, @tertiary-link-width-z19)) - 2 * @bridge-casing-width-z12;
							
						}
					}
					line-cap: round;
					line-join: round;
				}
			}
		}



		[class=primary] {
			[zoom>=8][ramp!=1],
			[zoom>=10] {
				line-color: @primary-low-zoom;
				line-width: linear([view::zoom], (8, @primary-width-z8), (9, @primary-width-z9), (10, @primary-width-z10), (11, @primary-width-z11));
				[zoom>=12] {
					line-color: @primary-fill;
					line-width: linear([view::zoom], (12, @primary-width-z12), (13, @primary-width-z13), (15, @primary-width-z15), (17, @primary-width-z17), (18, @primary-width-z18), (19, @primary-width-z19)) - 2 * @major-casing-width-z12;
					[ramp=1] {
						line-width: linear([view::zoom], (12, @primary-link-width-z12), (13, @primary-link-width-z13), (15, @primary-link-width-z15), (17, @primary-link-width-z17), (18, @primary-link-width-z18), (19, @primary-link-width-z19)) - 2 * @casing-width-z12;
					}
					[brunnel=tunnel] {
						line-color: @primary-tunnel-fill;
					}
					[brunnel=bridge] {
						line-width: linear([view::zoom], (12, @primary-width-z12), (13, @primary-width-z13), (15, @primary-width-z15), (17, @primary-width-z17), (18, @primary-width-z18), (19, @primary-width-z19)) - 2 * @major-bridge-casing-width-z12;
						
						[ramp=1] {
							line-width: linear([view::zoom], (12, @primary-link-width-z12), (13, @primary-link-width-z13), (15, @primary-link-width-z15), (17, @primary-link-width-z17), (18, @primary-link-width-z18), (19, @primary-link-width-z19)) - 2 * @bridge-casing-width-z12;
						}
					}
					line-cap: round;
					line-join: round;
				}
			}
		}
		[class=trunk] {
			[zoom>=6][ramp!=1],
			[zoom>=10] {
				line-color: @trunk-low-zoom;
				line-width: linear([view::zoom], (6, @trunk-width-z6), (7, @trunk-width-z7), (8, @trunk-width-z8), (9, @trunk-width-z9), (10, @trunk-width-z10), (11, @trunk-width-z11));

				[zoom>=12] {
					line-color: @trunk-fill;
					line-width: linear([view::zoom], (12, @trunk-width-z12), (13, @trunk-width-z13), (15, @trunk-width-z15), (17, @trunk-width-z17), (18, @trunk-width-z18), (19, @trunk-width-z19)) - 2 * @major-casing-width-z12;
					[ramp=1] {
						line-width: linear([view::zoom], (12, @trunk-link-width-z12), (13, @trunk-link-width-z13), (15, @trunk-link-width-z15), (17, @trunk-link-width-z17), (18, @trunk-link-width-z18), (19, @trunk-link-width-z19)) - 2 * @casing-width-z12;
					}
					[brunnel=tunnel] {
						line-color: @trunk-tunnel-fill;
					}
					[brunnel=bridge] {
						line-width: linear([view::zoom], (12, @trunk-width-z12), (13, @trunk-width-z13), (15, @trunk-width-z15), (17, @trunk-width-z17), (18, @trunk-width-z18), (19, @trunk-width-z19)) - 2 * @major-bridge-casing-width-z12;
						
						[ramp=1] {
							line-width: linear([view::zoom], (12, @trunk-link-width-z12), (13, @trunk-link-width-z13), (15, @trunk-link-width-z15), (17, @trunk-link-width-z17), (18, @trunk-link-width-z18), (19, @trunk-link-width-z19)) - 2 * @bridge-casing-width-z12;
						}
					}
					line-cap: round;
					line-join: round;
				}
			}
		}
		[class=motorway] {
			[zoom>=6][ramp!=1],
			[zoom>=10] {
				line-color: @motorway-low-zoom;

				line-width: linear([view::zoom], (6, @motorway-width-z6), (7, @motorway-width-z7), (8, @motorway-width-z8), (9, @motorway-width-z9), (10, @motorway-width-z10), (11, @motorway-width-z11));
				[zoom>=12] {
					line-color: @motorway-fill;
					line-width: linear([view::zoom], (12, @motorway-width-z12), (13, @motorway-width-z13), (15, @motorway-width-z15), (17, @motorway-width-z17), (18, @motorway-width-z18 ), (19, @motorway-width-z19)) - 2 * @major-casing-width-z12;
					[ramp=1] {
						line-width: linear([view::zoom], (12, @motorway-link-width-z12), (13, @motorway-link-width-z13), (15, @motorway-link-width-z15), (17, @motorway-link-width-z17), (18, @motorway-link-width-z18), (19, @motorway-link-width-z19)) - 2 * @casing-width-z12;
					}
					[brunnel=tunnel] {
						line-color: @motorway-tunnel-fill;
					}
					[brunnel=bridge] {
						line-width: linear([view::zoom], (12, @motorway-width-z12), (13, @motorway-width-z13), (15, @motorway-width-z15), (17, @motorway-width-z17), (18, @motorway-width-z18), (19, @motorway-width-z19)) - 2 * @major-bridge-casing-width-z12;
				
						[ramp=1] {
							line-width: linear([view::zoom], (12, @motorway-link-width-z12), (13, @motorway-link-width-z13), (15, @motorway-link-width-z15), (17, @motorway-link-width-z17), (18, @motorway-link-width-z18), (19, @motorway-link-width-z19)) - 2 * @bridge-casing-width-z12;
						}
					}
					line-cap: round;
					line-join: round;
				}
			}
		}


		// [class=living_street] {
		// 	[zoom>=13] {
		// 	line-width: linear([view::zoom], (13, @living-street-width-z13 - 2 * @casing-width-z13), (14, @living-street-width-z14 - 2 * @casing-width-z14), (15, @living-street-width-z15 - 2 * @casing-width-z15), (16, @living-street-width-z16 - 2 * @casing-width-z16), (17, @living-street-width-z17 - 2 * @casing-width-z17), (18, @living-street-width-z18 - 2 * @casing-width-z17), (19, @living-street-width-z19 - 2 * @casing-width-z19));
			
		// 	[brunnel=tunnel] {
		// 		line-color: @living-street-tunnel-fill;
		// 	}
		// 	[brunnel=bridge] {
		// 		line-color: @living-street-fill;
		// 		line-width: linear([view::zoom], (13, @living-street-width-z13 - 2 * @casing-width-z13), (14, @living-street-width-z14 - 2 * @bridge-casing-width-z14), (15, @living-street-width-z15 - 2 * @bridge-casing-width-z15), (16, @living-street-width-z16 - 2 * @bridge-casing-width-z16), (17, @living-street-width-z17 - 2 * @bridge-casing-width-z17), (18, @living-street-width-z18 - 2 * @bridge-casing-width-z17), (19, @living-street-width-z19 - 2 * @bridge-casing-width-z19));
				
		// 	}
		// 	line-join: round;
		// 	line-cap: round;
		// 	}
		// }

		// [class=road] {
		// 	[zoom>=10] {
		// 	line-width: 1;
		// 	line-color: @unimportant-road;
		// 	line-join: round;
		// 	line-cap: round;
		// 	}
		// 	[zoom>=14] {
		// 	line-width: linear([view::zoom], (14, @road-width-z14 - 2 * @casing-width-z14), (16, @road-width-z16 - 2 * @casing-width-z16), (17, @road-width-z17 - 2 * @casing-width-z17), (18, @road-width-z18 - 2 * @casing-width-z17), (19, @road-width-z19 - 2 * @casing-width-z19));
			
		// 	line-color: @road-fill;
		// 	[brunnel=bridge] {
		// 		line-width: linear([view::zoom], (14, @road-width-z14 - 2 * @bridge-casing-width-z14), (16, @road-width-z16 - 2 * @casing-width-z16), (17, @road-width-z17 - 2 * @bridge-casing-width-z17), (18, @road-width-z18 - 2 * @bridge-casing-width-z17), (19, @road-width-z19 - 2 * @bridge-casing-width-z19));
				
		// 	}
		// 	}
		// }


		[class=via_ferrata] {
			[zoom>=16] {
				line-color: yellow;
				// [access=no] { line-color: @steps-fill-noaccess; }
				line-dasharray: 2,1;
				
				line-width: 2;
			}
		}
		[class=raceway][zoom>=12] {
			line-color: @raceway-fill;
			line-width: 1.2;
			line-join: round;
			line-cap: round;
			line-width: linear([view::zoom], (12, 1.2), (13, 2), (14, 3), (15, 6), (18, 8), (19, 12), (20, 24));
		}
		[class=path]{
			// [subclass=platform] {
			// 	[zoom>=17] {
			// 	line-join: round;
			// 	line-width: 6;
			// 	line-color: #808080;
			// 	line-cap: round;
			// 	b/line-width: 4;
			// 	b/line-color: #bbbbbb;
			// 	b/line-cap: round;
			// 	b/line-join: round;
			// 	}
			// }

			
		
			[subclass=steps] {
				[zoom>=14] {
					// [zoom>=15] {
					// 	background/line-color: @steps-casing;
					// 	background/line-cap: round;
					// 	background/line-join: round;
					// 	background/line-width: @steps-width-z15 + 2 * @paths-background-width;
					// 	background/line-opacity: 0.4;
					// }
					line-color: @steps-fill;
					[access=no] { line-color: @steps-fill-noaccess; }
					line-dasharray: 2,1;
					
					line-width: linear([view::zoom], (13,	@steps-width-z13), (15, @steps-width-z15));
				}
			}
		
			[subclass=bridleway]
			// ,
			// [subclass=path][horse=designated] 
			{
				[zoom>=13] {
					// [zoom>=15] {
					// 	background/line-color: @bridleway-casing;
					// 	background/line-cap: round;
					// 	background/line-join: round;
					// 	background/line-width: @bridleway-width-z15 + 2 * @paths-background-width;
					// 	background/line-opacity: 0.4;
					// }
					line-color: @bridleway-fill;
					[access=no] { line-color: @bridleway-fill-noaccess; }
					line-dasharray: 4,2;
					line-width: linear([view::zoom], (13,	@bridleway-width-z13), (15, @bridleway-width-z15));

					[brunnel=tunnel] {
						line-join: round;
						line-cap: round;
					}
				}
			}
		
			[subclass=footway],
			[subclass=path][zoom>=12]
			// [bicycle != designated][horse != designated]
			 {	
				 [sac_scale!=null],
				[surface!=paved][zoom>=15],
				[subclass=path][zoom>=13],
				[zoom>=16] {
					// [zoom>=15] {
					// 	background/line-color: @footway-casing;
					// 	background/line-cap: round;
					// 	background/line-join: round;
					// 	background/line-width: @footway-width-z15 + 2 * @paths-background-width;
					// 	background/line-opacity: 0.4;
					// 	[zoom>=16] {
					// 		background/line-width: @footway-width-z16 + 2 * @paths-background-width;
					// 	}
					// 	[zoom>=18] {
					// 		background/line-width: @footway-width-z18 + 2 * @paths-background-width;
					// 	}
					// 	[zoom>=19] {
					// 		background/line-width: @footway-width-z19 + 2 * @paths-background-width;
					// 	}
					// }
					line-color: @path;
					[surface=paved],[subclass=footway] {
						line-color: @footway-fill;
						// [sac_scale!=null] {
							// line-color: @path;
						// }
					}
					// [access=no] { line-color: @footway-fill-noaccess; }
					line-dasharray: 3,1;
					// line-join: round;
					// line-cap: round;
					line-width: linear([view::zoom], (14,	@footway-width-z14), (15, @footway-width-z15), (16, @footway-width-z16), (18, @footway-width-z18), (19, @footway-width-z19));

					// line-width: @footway-width-z14;
					[zoom>=15][surface=paved] {
						line-dasharray: 3.5,2;
						// line-width: @footway-width-z15;
						[zoom>=16] {
							line-dasharray: 3.5,3;
							// line-width: @footway-width-z16;
						}
						[zoom>=17] {
							line-dasharray: 3,3;
						}
						// [zoom>=18] {
						// 	line-width: @footway-width-z18;
						// }
						// [zoom>=19] {
						// 	line-width: @footway-width-z19;
						// }
					}
					// [zoom>=14][ramp!=1][surface=null] {
					// 	line-color: @footway-fill;
					// 	[access=no] { line-color: @footway-fill-noaccess; }
					// 	line-dasharray: 1,3,2,4;
					// 	line-join: round;
					// 	line-cap: round;
					// 	line-width: @footway-width-z15;
					// 	[zoom>=16] {
					// 		line-dasharray: 1,4,2,3;
					// 		line-width: @footway-width-z16;
					// 	}
					// 		[zoom>=18] {
					// 		line-width: @footway-width-z18;
					// 	}
					// 	[zoom>=19] {
					// 		line-width: @footway-width-z19;
					// 	}
					// }
					// [zoom>=15][surface=unpaved] {
						// line-color: @footway-fill;
						// [access=no] { line-color: @footway-fill-noaccess; }
						// line-dasharray: 4,1;
						// line-join: round;
						// line-cap: round;
						// line-width: @footway-width-z15;
						// [zoom>=16] {
						// // line-width: @footway-width-z16;
						// }
						// [zoom>=18] {
						// // line-width: @footway-width-z18;
						// }
						// [zoom>=19] {
						// // line-width: @footway-width-z19;
						// }
					// }
				}
			}
		
			[subclass=cycleway][zoom>=14]
			// ,
			// [subclass=path][bicycle=designated] 
			{
				//  {
					// background/line-color: @cycleway-casing;
					// background/line-cap: round;
					// background/line-join: round;
					// background/line-width: @cycleway-width-z15 + 2 * @paths-background-width;
					// background/line-opacity: 0.4;
					// [zoom>=16] {
					// background/line-width: @cycleway-width-z16 + 2 * @paths-background-width;
					// }
					// [zoom>=18] {
					// background/line-width: @cycleway-width-z18 + 2 * @paths-background-width;
					// }
					// [zoom>=19] {
					// background/line-width: @cycleway-width-z19 + 2 * @paths-background-width;
					// }
					line-color: @cycleway-fill;
					[access=no] { line-color: @cycleway-fill-noaccess; }
					line-dasharray: 1,3;
					line-join: round;
					line-cap: round;
					line-width: linear([view::zoom], (13,	@cycleway-width-z13), (15, @cycleway-width-z15), (16, @cycleway-width-z16), (18, @cycleway-width-z18), (19, @cycleway-width-z19));
					[zoom>=15][ramp!=1][surface=paved] {
						line-dasharray: 3.5,2;
						// line-width: @cycleway-width-z15;
						[zoom>=16] {
						line-dasharray: 3.5,3;
						// line-width: @cycleway-width-z16;
						}
						[zoom>=17] {
						line-dasharray: 3,3;
						}
						// [zoom>=18] {
						// // line-width: @cycleway-width-z18;
						// }
						// [zoom>=19] {
						// // line-width: @cycleway-width-z19;
						// }
					}
					[zoom>=15][ramp!=1][surface=null] {
						line-color: @cycleway-fill;
						[access=no] { line-color: @cycleway-fill-noaccess; }
						line-dasharray: 4,3,2,1;
						line-join: round;
						line-cap: round;
						// line-width: @cycleway-width-z15;
						[zoom>=16] {
							line-dasharray: 3,2,4,1;
							// line-width: @cycleway-width-z16;
						}
						// [zoom>=18] {
						// 	// line-width: @cycleway-width-z18;
						// }
						// [zoom>=19] {
						// 	// line-width: @cycleway-width-z19;
						// }
					}
					[zoom>=15][ramp!=1][surface=unpaved] {
						line-color: @cycleway-fill;
						[access=no] { line-color: @cycleway-fill-noaccess; }
						line-dasharray: 4,1;
						line-join: round;
						line-cap: round;
						// line-width:	@cycleway-width-z15;
						// [zoom>=16] {
						// 	line-width:	@cycleway-width-z16;
						// }
						// [zoom>=18] {
						// 	line-width: @cycleway-width-z18;
						// }
						// [zoom>=19] {
						// 	line-width:	@cycleway-width-z19;
						// }
					}
				// }
			}
		}
		

		[class=track][zoom>=12] {
			/* The white casing that you mainly see against forests and other dark features */
			// [zoom>=15] {
			// background/line-opacity: 0.4;
			// background/line-color: @track-casing;
			// background/line-join: round;
			// background/line-cap: round;
			// background/line-width: @track-width-z15 + 2 * @paths-background-width;
			// /* With the heavier dasharrays on grade1 and grade2 it helps to make the casing a bit larger */
			// [tracktype=grade1] {
			// 	background/line-width: @track-grade1-width-z15 + 2 * @paths-background-width;
			// }
			// [tracktype=grade2] {
			// 	background/line-width: @track-grade2-width-z15 + 2 * @paths-background-width;
			// }
			// }

			/* Set the properties of the brown inside */
			line-color: @track-fill;
			[access=no] { line-color: @track-fill-noaccess; }
			line-dasharray: 4,2,4,5;
			line-cap: round;
			line-join: round;
			line-opacity: 0.8;
			// line-clip:false;

			// line-width: @track-width-z13;
			
			line-width: linear([view::zoom], (13,	@track-width-z12), (13,	@track-width-z13), (15, @track-width-z15));

			[tracktype=grade1] {
				line-dasharray: 0,100;
			}
			[tracktype=grade2] {
				line-dasharray: 8.8,3.2;
			}
			[tracktype=grade3] {
				line-dasharray: 5.6,4.0;
			}
			[tracktype=grade4] {
				line-dasharray: 3.2,4.8;
			}
			[tracktype=grade5] {
				line-dasharray: 4.,3.2;
			}

			[zoom>=15] {
				// line-width: @track-width-z15;
				[tracktype=grade1] {
					line-dasharray: 100,0;
				}
				[tracktype=grade2] {
					line-dasharray: 11,4;
				}
				[tracktype=grade3] {
					line-dasharray: 7,5;
				}
				[tracktype=grade4] {
					line-dasharray: 4,4;
				}
				[tracktype=grade5] {
					line-dasharray: 2,6;
				}
			}
		}

		// [class=rail][service!=null][zoom>=13],
		[class=rail][zoom>=8] {
			// ::rail {
			[zoom<12] {
				line-color: #787878;
				// line-width: 0.5;
				line-width: linear([view::zoom], (8,	0.8), (12, 0.9));

				// [zoom>=8] { line-width: 0.8; }
				// [zoom>=12] { line-width: 0.9; }
				// line-join: round;
				[brunnel=tunnel] {
					line-dasharray: 2,5;
				}
			}
			[zoom>=12] {
				// [brunnel=bridge] {
					dark/line-join: round;
					light/line-join: round;
					light/line-color: #ffffff;
					[subclass=rail] {
						dark/line-width: linear([view::zoom], (12,	1.5), (13, 2), (16, 3), (18, 5));
						dark/line-color: #707070;
						// dark/line-width: 1.5;
						// light/line-width: 0.75;
						light/line-width: linear([view::zoom], (12,	0.75), (13, 1), (18, 2));
						light/line-dasharray: 8,8;
						// [zoom>=13] {
							// dark/line-width: 2;
							// light/line-width: 1;
						// }
						[zoom>=15] {
							light/line-dasharray: 0,8,8,1;
						}
						// [zoom>=18] {
							// dark/line-width: 3;
							// light/line-width: 2;
						// }
					}
					[service=spur],
					[service=yard],
					[service=siding] {
						dark/line-width: linear([view::zoom], (12,	2), (16, 3), (18, 5));
						light/line-width: linear([view::zoom], (12,	0.8), (18, 1));

						// dark/line-width: 2;
						dark/line-color: #aaa;
						// light/line-width: 0.8;
						light/line-dasharray: 0,8,8,1;
						// [zoom>=18] {
						// 	dark/line-width: 3;
						// 	light/line-width: 1;
						// }
					}
				// }
				[brunnel=tunnel] {
					line-color: #787878;
					line-width: 2.8;
					line-dasharray: 6,4;
				//	 line-clip: false;
					[service=spur],
					[service=yard],
					[service=siding] {
						line-color: #aaa;
						// line-width: 1.9;
					line-width: linear([view::zoom], (12,	1.9), (18, 2.7));

						line-dasharray: 3,3;
						// [zoom>=18] {
						// 	line-width: 2.7;
						// }
					}
					[class=rail][zoom>=18] {
						line-dasharray: 8,6;
						line-width: 3.8;
					}
				}
			// }
			[subclass=light_rail],
			[subclass=funicular],
			[subclass=narrow_gauge] {
				[zoom>=8] {
					line-color: linear([view::zoom], (8,#ccc), (10, #aaa), (13, #666));
					// line-color: #ccc;
					// [zoom>=10] { line-color: #aaa; }
					// [zoom>=13] { line-color: #666; }
					// line-width: 1;
					line-width: linear([view::zoom], (8,1), (13, 2));

					// [zoom>=13] { line-width: 2; }
					[brunnel=tunnel] {
						line-dasharray: 5,3;
					}
				}
			}

			[subclass=miniature][zoom>=15] {
				// [zoom>=15] {
				line-width: 1.2;
				line-color: #999;
				dashes/line-width: 3;
				dashes/line-color: #999;
				dashes/line-dasharray: 1,10;
				// }
			}


			[subclass=subway][zoom>=12]  {
				// [zoom>=12] {
					line-width: 2;
					line-color: #999;
					[brunnel=tunnel] {
						line-dasharray: 5,3;
					}
				// }
				[brunnel=bridge][zoom>=14] {
					// [zoom>=14] {
						line-width: 2;
						line-color: #999;
					// }
				}
			}

			[subclass=preserved][zoom>=12] {
				// [zoom>=12] {
					dark/line-width: 1.5;
					dark/line-color: #aaa;
					dark/line-join: round;
					[zoom>=13] {
						dark/line-width: 3;
						dark/line-color: #999999;
						light/line-width: 1;
						light/line-color: white;
						light/line-dasharray: 0,1,8,1;
						light/line-join: round;
					}
				// }
			}

			[subclass=monorail][zoom>=14] {
				// [zoom>=14] {
					background/line-width: 4;
					background/line-color: #fff;
					background/line-opacity: 0.4;
					// background/line-cap: round;
					// background/line-join: round;
					line-width: 3;
					line-color: #777;
					line-dasharray: 2,3;
					line-cap: round;
					line-join: round;
				// }
			}
		
			[subclass=disused][zoom>=15] {
				// [zoom>=15] {
					line-color: #aaa;
					line-width: 2;
					line-dasharray: 2,4;
					line-join: round;
				// }
			}
		
			// [subclass=platform][zoom>=16]{
			// 	// [zoom>=16] {
			// 		line-join: round;
			// 		line-width: 6;
			// 		line-color: #808080;
			// 		line-cap: round;
			// 		b/line-width: 4;
			// 		b/line-color: #bbbbbb;
			// 		b/line-cap: round;
			// 		b/line-join: round;
			// 	// }
			// }
		
			[subclass=turntable][zoom>=16] {
				// [zoom>=16] {
					line-width: 1.5;
					line-color: #999;
				// }
			}
		}
		}

		[class=transit][zoom>=14] {
			// [zoom<13] {
			// 	line-color: #787878;
			// 	// line-width: 0.5;
			// 	line-width: linear([view::zoom], (8,0.8), (12, 0.9));
			// 	// [zoom>=8] { line-width: 0.8; }
			// 	// [zoom>=12] { line-width: 0.9; }
			// 	// line-join: round;
			// 	[brunnel=tunnel] {
			// 		line-dasharray: 2,5;
			// 	}
			// }
			// [zoom>=12] {
				[subclass=tram],
			[subclass='tram-service'][zoom>=15] {
				// [zoom>=12] {
					line-color: #6E6E6E;
					// line-width: 0.75;
					line-width: linear([view::zoom], (14,0.75), (17,1), (19, 2.5));
					[subclass='tram-service'] {
						line-width: linear([view::zoom], (15,0.5), (17,0.8), (19, 2.5))
					}
					// [zoom>=14] {
					// 	line-width: 1;
					// }
					// [zoom>=15] {
					// 	line-width: 1.5;
					// 	[subclass='tram-service'] {
					// 	line-width: 0.5;
					// 	}
					// }
					// [zoom>=17] {
						// line-width: 2;
						// [service!=null] {
						// line-width: 1;
						// }
					// }
					// [zoom>=18] {
					// 	[subclass='tram-service'] {
					// 	line-width: 1.5;
					// 	}
					// }
					// [zoom>=19] {
					// 	[subclass='tram-service'] {
					// 	line-width: 2;
					// 	}
					// }
					[brunnel=tunnel] {
						line-dasharray: 5,3;
					}
				// }
			}
				[brunnel=bridge] {
					dark/line-join: round;
					light/line-color: #ffffff;
					light/line-join: round;
					
					[service=spur],
					[service=yard],
					[service=siding] {
						dark/line-width: 2;
						dark/line-color: #aaa;
						light/line-width: 0.8;
						light/line-dasharray: 0,8,8,1;
						[zoom>=18] {
							dark/line-width: 3;
							light/line-width: 1;
						}
					}
				}
				[brunnel=tunnel] {
					line-color: #787878;
					// line-width: 2.8;
					line-dasharray: 6,4;
				//	 line-clip: false;
					
				}
			// }

			

			[subclass=subway][zoom>=12] {
				// [zoom>=12] {
					line-width: 2;
					line-color: #999;
					[brunnel=tunnel] {
						line-dasharray: 5,3;
					}
				// }
				[brunnel=bridge][zoom>=14] {
					// [zoom>=14] {
						line-width: 2;
						line-color: #999;
					// }
				}
			}
			// [subclass=construction] {
			// 	[zoom>=13] {
			// 		line-color: #808080;
			// 		line-width: 2;
			// 		line-dasharray: 2,4;
			// 		line-join: round;
			// 		[zoom>=14] {
			// 			line-dasharray: 2,3;
			// 		}
			// 		[zoom>=15] {
			// 			line-width: 3;
			// 			line-dasharray: 3,3;
			// 		}
			// 	}
			// }
		
			[subclass=disused] {
				[zoom>=15] {
					line-color: #aaa;
					line-width: 2;
					line-dasharray: 2,4;
					line-join: round;
				}
			}
		
			[subclass=platform][zoom>=16]{
				// [zoom>=16] {
					line-join: round;
					line-width: 6;
					line-color: #808080;
					line-cap: round;
					b/line-width: 4;
					b/line-color: #bbbbbb;
					b/line-cap: round;
					b/line-join: round;
				// }
			}
		
		}
		
	}
	
	[class=secondary][zoom>=9] {
		[zoom<12]::halo {
			line-color:  linear([view::zoom], (10, @lowzoom-halo-color), (11, @lowzoom-halo-color));
			line-width: linear([view::zoom], (9, 2.2), (10, 2.7));
			line-opacity: .4;
			//Missing line-cap: round; is intentional. It would cause rendering glow multiple times in some places - what as result of partial transparency would cause differences in rendering
			//Also, bridges - including bridge casings - are rendered on top of roads. Enabling line-cap: round would result in glow from bridges rendered on top of road around bridges.
		}
		[zoom>=12]::casing {
			line-color: linear([view::zoom], (12, @secondary-low-zoom-casing), (13, @secondary-casing));
			line-join: round;
			line-cap: round;
			line-width: linear([view::zoom], (12, @secondary-width-z12), (13, @secondary-width-z13), (14, @secondary-width-z14), (15, @secondary-width-z15), (16, @secondary-width-z16), (17, @secondary-width-z17), (18, @secondary-width-z18), (19, @secondary-width-z19));
			[ramp=1] {

			line-width: linear([view::zoom], (12, @secondary-link-width-z12), (13, @secondary-link-width-z13), (15, @secondary-link-width-z15),(17, @secondary-link-width-z17), (18, @secondary-link-width-z18), (19, @secondary-link-width-z19));

			//	 line-width: @secondary-link-width-z12;
			//	 [zoom>=13] { line-width: @secondary-link-width-z13; }
			//	 [zoom>=15] { line-width: @secondary-link-width-z15; }
			//	 [zoom>=17] { line-width: @secondary-link-width-z17; }
			//	 [zoom>=18] { line-width: @secondary-link-width-z18; }
			//	 [zoom>=19] { line-width: @secondary-link-width-z19; }
			}
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge][zoom>=13] {
				line-color: @bridge-casing;
				line-join: round;
			}
		}
		[ramp!=1],[zoom>=10]::fill {
			line-color: @unimportant-road;
			line-width: linear([view::zoom], (9, @secondary-width-z9), (10, @secondary-width-z10), (11, @secondary-width-z11));
			[zoom>=12] {
				line-color: @secondary-fill;
				line-width: linear([view::zoom], (12, @secondary-width-z12), (13, @secondary-width-z13), (15, @secondary-width-z15), (17, @secondary-width-z17), (18, @secondary-width-z18), (19, @secondary-width-z19)) - 2 * @secondary-casing-width-z12;
				line-cap: round;
				line-join: round;
				[zoom>=13] {
					[ramp=1] {
						line-width: linear([view::zoom], (12, @secondary-link-width-z12), (13, @secondary-link-width-z13), (15, @secondary-link-width-z15), (17, @secondary-link-width-z17), (18, @secondary-link-width-z18), (19, @secondary-link-width-z19)) - 2 * @casing-width-z12;
						
					}
					[brunnel=tunnel] {
						line-color: @secondary-tunnel-fill;
					}
					[brunnel=bridge] {
						line-width: linear([view::zoom], (12, @secondary-width-z12), (13, @secondary-width-z13), (15, @secondary-width-z15), (17, @secondary-width-z17), (18, @secondary-width-z18), (19, @secondary-width-z19)) - 2 * @bridge-casing-width-z12;
						
						[ramp=1] {
						line-width: linear([view::zoom], (12, @secondary-link-width-z12), (13, @secondary-link-width-z13), (15, @secondary-link-width-z15), (17, @secondary-link-width-z17), (18, @secondary-link-width-z18), (19, @secondary-link-width-z19)) - 2 * @bridge-casing-width-z12;
						}
					}
				}
			}
		}
	}
	[class =aerialway][zoom >= 12]::aerial {
		[subclass = 'cable_car'],
		[subclass = 'gondola'],
		[subclass = 'mixed_lift'] {
		//  {
			line-width: 1;
			// line-join: round;
			// line-cap: round;
			line-color: #808080;
	
			dash/line-width: 2;
			// dash/line-join: round;
			dash/line-cap: round;
			dash/line-color: black;
			dash/line-dasharray: 1,13;
			// dash/line-clip: false;
			// [zoom >= 17] {
			//   text-name: "[name]";
			//   text-fill: #666666;
			//   text-size: 10;
			//   text-dy: 4;
			//   text-spacing: 900;
			//   text-clip: false;
			//   text-placement: line;
			//   text-repeat-distance: 200;
			//   text-margin: 18;
			// //   text-face-name: @book-fonts;
			//   text-halo-radius: @standard-halo-radius;
			//   text-halo-fill: @standard-halo-fill;
			// }
			// [zoom >= 19] {
			//   text-size: 11;
			//   text-dy: 5;
			// }
		// }
		}
	
		[subclass = 'goods'] {
			// [zoom >= 12] {
				line-width: 1;
				line-join: round;
				line-cap: round;
				line-color: #808080;
		
				dash/line-width: 3.5;
				dash/line-join: round;
				dash/line-color: #707070;
				dash/line-dasharray: 6,25;
				// dash/line-clip: false;
				// [zoom >= 17] {
				//   text-name: [name];
				//   text-fill: #666666;
				//   text-size: 10;
				//   text-dy: 4;
				//   text-spacing: 900;
				//   text-clip: false;
				//   text-placement: line;
				//   text-repeat-distance: 200;
				//   text-margin: 18;
				// //   text-face-name: @book-fonts;
				//   text-halo-radius: @standard-halo-radius;
				//   text-halo-fill: @standard-halo-fill;
				// }
				// [zoom >= 19] {
				//   text-size: 11;
				//   text-dy: 5;
				// }
			// }
		}
	
		[subclass = 'chair_lift'],
		[subclass = 'drag_lift'],
		[subclass = 't-bar'],
		[subclass = 'j-bar'],
		[subclass = 'platter'],
		[subclass = 'rope_tow'],
		[subclass = 'zip_line'] {
			// [zoom >= 12] {
				line-width: 1;
				line-join: round;
				line-cap: round;
				line-color: #808080;
		
				dash/line-width: 4;
				dash/line-join: round;
				dash/line-color: black;
				dash/line-dasharray: 1,30;
				// dash/line-clip: false;
				// [zoom >= 17] {
				//   text-name: [name];
				//   text-fill: #666666;
				//   text-size: 10;
				//   text-dy: 4;
				//   text-spacing: 900;
				//   text-clip: false;
				//   text-placement: line;
				//   text-repeat-distance: 200;
				//   text-margin: 18;
				//   text-face-name: @book-fonts;
				//   text-halo-radius: @standard-halo-radius;
				//   text-halo-fill: @standard-halo-fill;
				// }
				// [zoom >= 19] {
				//   text-size: 11;
				//   text-dy: 5;
				// }
			// }
		}
	}
}
#route['nuti::routes'>0]{
	[ref!=null],
	[zoom>=12] {
		line-color: @route;
		line-opacity: 0.35;
		line-width: 1;
		line-geometry-transform: translate(1,1);
		[ref!=null][name!=null]{
			text-name: [name];
			// text-avoid-edges: false;
			text-placement: line;
			text-wrap-before: true;
			text-face-name: @mont;
			text-fill: @route;
			text-size: linear([view::zoom], (13, 6.0), (18, 8.0));
			text-halo-fill: @minor_halo;
			text-halo-radius: 0.5;
			text-halo-rasterizer: fast;
			text-min-distance: 5;
			// [zoom>=15][name!=null] {
			// 	text-dy: 3;
			// 	text-name: [name];
				
			// }
		}
	}
	// [ref!=null][zoom<=12] {
	// 	text-placement: line;
	// 	text-name: [ref];
	// 	text-size: 9;
	// 	// text-file: url(shield/default-[ref_length].svg);
	// 	text-face-name: @mont;
	// 	text-fill: #333;
		
	// }
	
}

#aeroway {
	[class=runway][zoom>=11] {
		// [zoom>=11] {
			[brunnel=bridge][zoom>=14] {
				// line-width: 12 + 2*@major-casing-width-z14;
				casing/line-color: @bridge-casing;
				// line-join: round;
				// [zoom>=15] { line-width: 18 + 2*@major-casing-width-z15; }
				// [zoom>=16] { line-width: 24 + 2*@major-casing-width-z16; }
				// [zoom>=17] { line-width: 24 + 2*@major-casing-width-z17; }
				// [zoom>=18] { line-width: 24 + 2*@major-casing-width-z18; }
				casing/line-width: linear([view::zoom], (14,12 + 2*@major-casing-width-z14), (15, 18 + 2*@major-casing-width-z15), (16,24 + 2*@major-casing-width-z16), (17,24 + 2*@major-casing-width-z17), (18,24 + 2*@major-casing-width-z18));

			}
			// ::fill {
				line-color: @runway-fill;
				line-width: 2;
				line-width: linear([view::zoom], (11,2), (12, 4), (13, 6), (14,12), (15,18), (16,24));
				// [zoom>=12] { line-width: 4; }
				// [zoom>=13] { line-width: 6; }
				// [zoom>=14] { line-width: 12; }
				// [zoom>=15] { line-width: 18; }
				// [zoom>=16] { line-width: 24; }
			// }
		// }
	}
	[class=taxiway][zoom>=11] {
		// [zoom>=11] {
			[brunnel=bridge][zoom>=14] {
				casing/line-width: 4 + 2*@secondary-casing-width-z14;
				casing/line-color: @bridge-casing;
				casing/line-width: linear([view::zoom], (14,4 + 2*@secondary-casing-width-z14), (15, 6 + 2*@secondary-casing-width-z15), (16,8 + 2*@secondary-casing-width-z16), (17,8 + 2*@secondary-casing-width-z17), (18,8 + 2*@secondary-casing-width-z18));
				// line-join: round;
				// [zoom>=15] { line-width: 6 + 2*@secondary-casing-width-z15; }
				// [zoom>=16] { line-width: 8 + 2*@secondary-casing-width-z16; }
				// [zoom>=17] { line-width: 8 + 2*@secondary-casing-width-z17; }
				// [zoom>=18] { line-width: 8 + 2*@secondary-casing-width-z18; }
			}
			// ::fill {
				line-color: @taxiway-fill ;
				// line-width: 1;
				line-width: linear([view::zoom], (11,1), (13, 2), (14,4), (15,6), (16,8));
				// [zoom>=13] { line-width: 2; }
				// [zoom>=14] { line-width: 4; }
				// [zoom>=15] { line-width: 6; }
				// [zoom>=16] { line-width: 8; }
			// }
		// }
	}
}


// #transportation[oneway!=0][zoom>=15] {
// 	// intentionally omitting highway_platform, highway_construction
// 	[class=motorway],
// 	[class=trunk],
// 	[class=primary],
// 	[class=secondary],
// 	[class=tertiary],
// 	[class=residential],
// 	[class=unclassified],
// 	[class=living_street],
// 	[class=road],
// 	[class=service],
// 	// [class=path][subclass=pedestrian],
// 	[class=raceway] {
// 		marker-placement: line;
// 		// marker-spacing: 180;
// 		marker-file: [oneway]=1 ? url('symbols/oneway.svg') : url('symbols/oneway-reverse.svg');
// 		// 	marker-file: url('symbols/oneway.svg');
// 		// [oneway=-1] {
// 		// 	marker-file: url('symbols/oneway-reverse.svg');
// 		// }

// 		[class=motorway] {
// 			marker-fill: @motorway-oneway-arrow-color;
// 		}
// 		[class=trunk] {
// 			marker-fill: @trunk-oneway-arrow-color;
// 		}
// 		[class=primary] {
// 			marker-fill: @primary-oneway-arrow-color;
// 		}
// 		[class=secondary] {
// 			marker-fill: @secondary-oneway-arrow-color;
// 		}
// 		[class=tertiary] {
// 			marker-fill: @tertiary-oneway-arrow-color;
// 		}
// 		[class=residential],
// 		[class=unclassified],
// 		[class=road],
// 		[class=service] {
// 			marker-fill: @residential-oneway-arrow-color;
// 		}
// 		[class=living_street] {
// 			marker-fill: @living-street-oneway-arrow-color;
// 		}
// 		// [class=path][subclass=pedestrian] {
// 		// 	marker-fill: @pedestrian-oneway-arrow-color;
// 		// }
// 		[class=raceway] {
// 			marker-fill: @raceway-oneway-arrow-color;
// 		}
// 	}

// 	[class=path][zoom>=17] {
// 		[subclass=steps],
// 		[subclass=cycleway],
// 		[subclass=footway],
// 		[subclass=path],
// 		[subclass=track],
// 		[subclass=bridleway] {
// 			[oneway!=0] {
// 				// text-name: [nuti::book-arrow];
// 				// text-size: 15;
// 				// text-clip: false;
// 				// text-spacing: 180;
// 				// text-placement: line;
// 				// text-halo-fill: @standard-halo-fill;
// 				// text-halo-radius: 1.5;
// 				// // text-margin: 2;
// 				// text-dy: 3;
// 				// // text-upright: right;
// 				// text-vertical-alignment: middle;
// 				// text-face-name: @book-fonts;

// 				marker-placement: line;
// 				// marker-spacing: 180;
// 				marker-file: [oneway]=1 ? url('symbols/oneway.svg') : url('symbols/oneway-reverse.svg');
// 				// [oneway=-1] {
// 					// text-upright: left;
// 					// text-dy: -3;
// 				// }
// 				[subclass=footway] {
// 					marker-fill: @footway-oneway-arrow-color;
// 				}
// 				[subclass=path] {
// 					marker-fill: @footway-oneway-arrow-color;
// 					[horse=designated] {
// 						marker-fill: @bridleway-oneway-arrow-color;
// 					}
// 					[bicycle=designated] {
// 						marker-fill: @cycleway-oneway-arrow-color;
// 					}
// 				}
// 				[subclass=steps] {
// 					marker-fill: @steps-oneway-arrow-color;
// 				}
// 				[subclass=cycleway] {
// 					marker-fill: @cycleway-oneway-arrow-color;
// 				}
// 				[subclass=track] {
// 					marker-fill: @track-oneway-arrow-color;
// 				}
// 				[subclass=bridleway] {
// 					marker-fill: @bridleway-oneway-arrow-color;
// 				}
// 			}
// 		}
// 	}
// }

