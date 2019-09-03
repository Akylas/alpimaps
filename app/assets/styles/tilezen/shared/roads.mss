/* For the main linear features, such as roads and railways. */
@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];


// Areas
#roads['mapnik::geometry_type'=3] {
	// [kind=living_street][zoom>=14] {
	// 	polygon-fill: @living-street-fill;
	// }

	[kind=residential],
	[kind=unkindified],
	[kind=minor],
	[kind=service] {
		[zoom>=14] {
			polygon-fill: #fff;
			line-color: #999;
			line-width: 1;
		}
	}
	[kind=path] [zoom>=15]{
		[subkind=pedestrian],
		[subkind=footway],
		[subkind=cycleway] {
			polygon-fill: @pedestrian-fill;
			line-color: #808080;
			line-width: 0.2;
		}
	}
	

	[kind=track][zoom>=15] {
		polygon-fill: #cdbea0;
		line-color: @track-fill;
		line-width: 1;
		line-dasharray: 5,4,2,4;
		line-cap: round;
		line-join: round;
	}

	[kind=path][subkind=platform] {
		[zoom>=16] {
			polygon-fill: #bbbbbb;
			line-color: #808080;
			line-width: 2;
			line-cap: round;
			line-join: round;
			// polygon-gamma: 0.65;
		}
	}
}
#roads {
		/* Data on z<10 comes from osm_planet_roads, data on z>=10 comes from
	osm_planet_line. This is for performance reasons: osm_planet_roads contains less
	data, and is thus faster. Chosen is for zoom level 10 as cut-off, because
	tertiary is rendered from z10 and is not included in osm_planet_roads. */


	::halo {
		[zoom=9][kind=secondary] {
			line-color: @halo-color-for-minor-road;
			line-width: 2.2;
			line-opacity: 0.4;
			line-join: round;
			//Missing line-cap: round; is intentional. It would cause rendering glow multiple times in some places - what as result of partial transparency would cause differences in rendering
			//Also, bridges - including bridge casings - are rendered on top of roads. Enabling line-cap: round would result in glow from bridges rendered on top of road around bridges.
		}
		[zoom>=10][zoom<=11][kind=secondary] {
			line-color: @halo-color-for-minor-road;
			line-width: 2.7;
			line-opacity: 0.4;
			line-join: round;
			//Missing line-cap: round; is intentional. It would cause rendering glow multiple times in some places - what as result of partial transparency would cause differences in rendering
			//Also, bridges - including bridge casings - are rendered on top of roads. Enabling line-cap: round would result in glow from bridges rendered on top of road around bridges.
		}
		[zoom>=10][zoom<=11][kind=tertiary],
		[zoom=12][kind=unkindified],
		[zoom=12][kind=minor] {
			line-color: @halo-color-for-minor-road;
			line-width: 2.2;
			line-opacity: 0.3;
			line-join: round;
			//Missing line-cap: round; is intentional. It would cause rendering glow multiple times in some places - what as result of partial transparency would cause differences in rendering
			//Also, bridges - including bridge casings are rendered on top of roads. Enabling line-cap: round would result in glow from bridges rendered on top of road around bridges.
		}
		[kind=motorway][ramp!=1][zoom>=6][zoom<12],
		[kind=motorway][ramp=1][zoom>=10][zoom<12],
		[kind=trunk][ramp!=1][zoom>=6][zoom<12],
		[kind=trunk][ramp=1][zoom>=10][zoom<12],
		[kind=primary][ramp!=1][zoom>=8][zoom<12],
		[kind=primary][ramp=1][zoom>=10][zoom<12],
		[kind=secondary][zoom>=11][zoom<12] {
			[kind=motorway] {
			line-width: linear([view::zoom], (6, @motorway-width-z6), (7, @motorway-width-z7), (8, @motorway-width-z8), (9, @motorway-width-z9), (10, @motorway-width-z10), (11, @motorway-width-z11)) + 2 * @lowzoom-halo-width;

			}
			[kind=trunk] {
			line-width: linear([view::zoom], (6, @trunk-width-z6), (7, @trunk-width-z7), (8, @trunk-width-z8), (9, @trunk-width-z9), (10, @trunk-width-z10), (11, @trunk-width-z11)) + 2 * @lowzoom-halo-width;
			}
			[kind=primary] {
			line-width: linear([view::zoom], (8, @primary-width-z8), (9, @primary-width-z9), (10, @primary-width-z10), (11, @primary-width-z11)) + 2 * @lowzoom-halo-width;
			}
			line-color: @lowzoom-halo-color;
			line-opacity: .4;
		}
	}
	::casing {
		[kind=motorway] [zoom>=12]{
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

		[kind=trunk][zoom>=12] {
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

		[kind=primary][zoom>=12] {
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

		[kind=secondary][zoom>=12] {
			line-color: linear([view::zoom], (12, @secondary-low-zoom-casing), (13, @secondary-casing));
			line-join: round;
			line-cap: round;
			line-width: linear([view::zoom], (12, @secondary-width-z12), (13, @secondary-width-z13), (14, @secondary-width-z14), (15, @secondary-width-z15), (16, @secondary-width-z16), (17, @secondary-width-z17), (18, @secondary-width-z18), (19, @secondary-width-z19));
			// [ramp=1] {
			//	 line-width: @secondary-link-width-z12;
			//	 [zoom>=13] { line-width: @secondary-link-width-z13; }
			//	 [zoom>=15] { line-width: @secondary-link-width-z15; }
			//	 [zoom>=17] { line-width: @secondary-link-width-z17; }
			//	 [zoom>=18] { line-width: @secondary-link-width-z18; }
			//	 [zoom>=19] { line-width: @secondary-link-width-z19; }
			// }
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge][zoom>=13] {
				line-color: @bridge-casing;
				line-join: round;
			}
		}

		[kind=tertiary][zoom>=12] {
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

		[kind=residential],
		[kind=unkindified],
		[kind=minor] {
			[zoom>=13] {
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

		// [kind=road] {
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

		[kind=service][zoom>=14] {
			line-color: @service-casing;
			[kind=service] {
				line-width: linear([view::zoom], (14, @service-width-z14), (16, @service-width-z16), (17, @service-width-z17), (18, @service-width-z18), (19, @service-width-z19));
			}
			// [kind=minor] {
			// 	line-width: linear([view::zoom], (16, @minor-service-width-z16), (17, @minor-service-width-z17), (18, @minor-service-width-z18), (19, @minor-service-width-z19));
			// }
			
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] {
				line-color: @bridge-casing;
				line-join: round;
			}
		}

		[kind=path][subkind=pedestrian][zoom>=14] {
			line-color: @pedestrian-casing;
			line-width: linear([view::zoom], (14, @pedestrian-width-z14), (15, @pedestrian-width-z15), (16, @pedestrian-width-z16), (17, @pedestrian-width-z17), (18, @pedestrian-width-z18), (19, @pedestrian-width-z19));
			[brunnel=tunnel] {
				line-dasharray: 4,2;
			}
			[brunnel=bridge] {
				line-color: @bridge-casing;
				line-join: round;
			}
		}

		// [kind=living_street] {
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

		[kind=path][zoom>=13] {
			[subkind=steps] {
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

			[subkind=bridleway],
			[subkind=path][horse=designated] {
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

			[subkind=footway],
			[subkind=path][bicycle!=designated][horse!=designated] {
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

			[subkind=cycleway],
			[subkind=path][bicycle=designated] {
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

		[kind=track] {
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

		[kind=rail][brunnel=bridge] {
			[subkind=tram],
			[subkind='tram-service'][zoom>=15] {
				[zoom>=13]  {
					line-width: 4;
					[zoom>=15] {
					line-width: 5;
					}
					line-color: @bridge-casing;
					line-join: round;
				}
			}

			[subkind=subway],
			[subkind=construction][construction=subway] {
				[zoom>=14] {
					line-width: 5.5;
					line-color: @bridge-casing;
					line-join: round;
				}
			}
			[subkind=light_rail],
			[subkind=funicular],
			[subkind=narrow_gauge] {
				[zoom>=14] {
					line-width: 5.5;
					line-color: @bridge-casing;
					line-join: round;
				}
			}
			[subkind=rail],
			[subkind=preserved],
			[subkind=monorail][zoom>=14] {
				[zoom>=13] {
					line-width: 6.5;
					line-color: @bridge-casing;
					line-join: round;
				}
			}
			[service=spur],
			[service=yard],
			[service=siding] {
				[zoom>=13] {
					line-width: 5.7;
					line-color: @bridge-casing;
					line-join: round;
				}
			}
			[subkind=disused][zoom>=15],
			[subkind=construction][construction != subway],
			[subkind=miniature][zoom>=15]{
					line-width: 6;
					line-color: @bridge-casing;
					line-join: round;
			}
		}
	}

	::bridges_and_tunnels_background {
		[kind=path]{
			[subkind=bridleway],
			[subkind=path][horse=designated] {
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

			[subkind=footway],
			[subkind=path][bicycle != designated][horse != designated] {
				[brunnel=bridge][zoom>=14],
				[brunnel=tunnel][zoom>=14] {
					line-color: @footway-casing;
					line-cap: round;
					line-join: round;
					line-width: linear([view::zoom], (14,	@footway-width-z14 + 2 * @paths-background-width), (15, @footway-width-z15 + 2 * @paths-background-width), (16, @footway-width-z16 + 2 * @paths-background-width), (18, @footway-width-z18 + 2 * @paths-background-width), (19, @footway-width-z19 + 2 * @paths-background-width));
				}
			}

			[subkind=cycleway],
			[subkind=path][bicycle=designated] {
				[brunnel=bridge][zoom>=14],
				[brunnel=tunnel][zoom>=13] {
					line-join: round;
					line-cap: round;

					line-color: @cycleway-casing;
					line-width: linear([view::zoom], (13,	@cycleway-width-z13 + 2 * @paths-background-width), (14,	@cycleway-width-z14 + 2 * @paths-background-width), (15, @cycleway-width-z15 + 2 * @paths-background-width), (16, @cycleway-width-z16 + 2 * @paths-background-width), (18, @cycleway-width-z18 + 2 * @paths-background-width), (19, @cycleway-width-z19 + 2 * @paths-background-width));
				}
			}

			[subkind=steps] {
				[brunnel=bridge][zoom>=14],
				[brunnel=tunnel][zoom>=13] {
					line-color: @steps-casing;
					line-cap: round;
					line-join: round;
					line-width: linear([view::zoom], (13,	@cycleway-width-z13), (15, @cycleway-width-z15)) + 2 * @paths-background-width;
				}
			}
		}

		[kind=track] {
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
		[kind=rail][brunnel=bridge][zoom>=13]{
			[subkind=rail][zoom>=13],
			[subkind=preserved][zoom>=13],
			[subkind=monorail][zoom>=14] {
					line-width: 5;
					line-color: white;
					line-join: round;
			}

			[service=spur],
			[service=yard],
			[service=siding] {
					line-width: 4;
					line-color: white;
					line-join: round;
			}

			[subkind=disused][zoom>=15],
			[subkind=construction][construction != subway],
			[subkind=miniature][zoom>=15] {
					line-width: 4.5;
					line-color: white;
					line-join: round;
			}

			[subkind=tram],
			[subkind=tram-service][zoom>=15] {
					line-width: 3;
					[zoom>=15] {
						line-width: 4;
					}
					line-color: white;
			}

			[subkind=subway],
			[subkind=construction][construction=subway] {
				[zoom>=14] {
					line-width: 4;
					line-color: white;
					line-join: round;
				}
			}

			[subkind=light_rail],
			[subkind=funicular],
			[subkind=narrow_gauge] {
				[zoom>=14] {
					line-width: 4;
					line-color: white;
					line-join: round;
				}
			}
		}
	}



	::fill {
		/*
		* The highway_construction rules below are quite sensitive to re-ordering, since the instances end up swapping round
		* (and then the dashes appear below the fills). See:
		* https://github.com/gravitystorm/openstreetmap-carto/issues/23
		* https://github.com/mapbox/carto/issues/235
		* https://github.com/mapbox/carto/issues/237
		*/
		// [kind=construction][zoom>=12] {
		//	 [construction=motorway][zoom>=12],
		//	 [construction=motorway][ramp=1][zoom>=13],
		//	 [construction=trunk][zoom>=12],
		//	 [construction=trunk][ramp=1][zoom>=13],
		//	 [construction=primary][zoom>=12],
		//	 [construction=primary][ramp=1][zoom>=13],
		//	 [construction=secondary][zoom>=12],
		//	 [construction=secondary][ramp=1][zoom>=13],
		//	 [construction=tertiary][zoom>=13],
		//	 [construction=tertiary][ramp=1][zoom>=14] {
		//		 [construction=motorway],
		//		 [construction=motorway][ramp=1] { line-color: @motorway-fill; }
		//		 [construction=trunk],
		//		 [construction=trunk][ramp=1] { line-color: @trunk-fill; }
		//		 [construction=primary],
		//		 [construction=primary][ramp=1] { line-color: @primary-fill; }
		//		 [construction=secondary],
		//		 [construction=secondary][ramp=1] { line-color: @secondary-fill; }
		//		 [construction=tertiary],
		//		 [construction=tertiary][ramp=1] { line-color: @minor-construction; }
		//		 line-width: 2;
		//		 b/line-width: 2;
		//		 b/line-dasharray: 4,2;
		//		 b/line-color: white;
		//		 [zoom>=13] {
		//			 line-width: 4;
		//			 b/line-width: 3.5;
		//			 b/line-dasharray: 6,4;
		//		 }
		//		 [zoom>=16] {
		//			 line-width: 8;
		//			 b/line-width: 7;
		//			 b/line-dasharray: 8,6;
		//			 [construction=secondary][ramp=1] {
		//				 line-width: @secondary-link-width-z15;
		//				 b/line-width: @secondary-link-width-z15 - 2 * @casing-width-z15;
		//			 }
		//			 [construction=tertiary][ramp=1] {
		//				 line-width: @tertiary-link-width-z15;
		//				 b/line-width: @tertiary-link-width-z15 - 2 * @casing-width-z15;
		//			 }
		//		 }
		//		 [zoom>=17] {
		//			 line-width: 8;
		//			 b/line-width: 7;
		//		 }
		//	 }

		//	 [construction=null][zoom>=14],
		//	 [construction=residential][zoom>=14],
		//	 [construction=unkindified][zoom>=14] {
		//		 line-color: @minor-construction;
		//		 b/line-color: white;
		//		 line-width: @residential-width-z14;
		//		 b/line-width: @residential-width-z14 - 2 * @casing-width-z13;
		//		 b/line-dasharray: 6,4;
		//		 [zoom>=15] {
		//			 line-width: @residential-width-z15;
		//			 b/line-width: @residential-width-z15 - 2 * @casing-width-z15;
		//			 }
		//		 [zoom>=16] {
		//			 line-width: @residential-width-z16;
		//			 b/line-width: @residential-width-z16 - 2 * @casing-width-z16;
		//			 b/line-dasharray: 8,6;
		//		 }
		//		 [zoom>=17] {
		//			 line-width: 8;
		//			 b/line-width: 7;
		//		 }
		//	 }
		//	 [construction=living_street][zoom>=14] {
		//		 line-color: @minor-construction;
		//		 b/line-color: @living-street-fill;
		//		 line-width: @living-street-width-z14;
		//		 b/line-width: @living-street-width-z14 - 2 * @casing-width-z13;
		//		 b/line-dasharray: 6,4;
		//		 [zoom>=15] {
		//			 line-width: @living-street-width-z15;
		//			 b/line-width: @living-street-width-z15 - 2 * @casing-width-z15;
		//		 }
		//		 [zoom>=16] {
		//			 line-width: @living-street-width-z16;
		//			 b/line-width: @living-street-width-z16 - 2 * @casing-width-z16;
		//			 b/line-dasharray: 8,6;
		//		 }
		//		 [zoom>=17] {
		//			 line-width: 8;
		//			 b/line-width: 7;
		//		 }
		//	 }
		//	 [construction=pedestrian][zoom>=14] {
		//		 line-color: @minor-construction;
		//		 b/line-color: @pedestrian-fill;
		//		 line-width: @pedestrian-width-z14;
		//		 b/line-width: @pedestrian-width-z14 - 2 * @casing-width-z13;
		//		 b/line-dasharray: 6,4;
		//		 [zoom>=15] {
		//			 line-width: @pedestrian-width-z15;
		//			 b/line-width: @pedestrian-width-z15 - 2 * @casing-width-z15;
		//		 }
		//		 [zoom>=16] {
		//			 line-width: @pedestrian-width-z16;
		//			 b/line-width: @pedestrian-width-z16 - 2 * @casing-width-z16;
		//			 b/line-dasharray: 8,6;
		//		 }
		//		 [zoom>=17] {
		//			 line-width: 8;
		//			 b/line-width: 7;
		//		 }
		//	 }

		//	 [construction=service][zoom>=15],
		//	 [construction=minor][zoom>=17]{
		//		 line-color: @minor-construction;
		//		 b/line-color: white;
		//		 b/line-dasharray: 6,4;
		//			 {
		//			 line-width: @service-width-z14;
		//			 b/line-width: @service-width-z14;
		//			 [zoom>=16] {
		//				 line-width: @service-width-z16;
		//				 b/line-width: @service-width-z16 - 2 * @casing-width-z16;
		//				 b/line-dasharray: 8,6;
		//			 }
		//			 [zoom>=17] {
		//				 line-width: @service-width-z17;
		//				 b/line-width: @service-width-z17 - 2 * @casing-width-z17;
		//			 }
		//			 [zoom>=18] {
		//				 line-width: 8;
		//				 b/line-width: 7
		//			 }
		//		 }
		//		 [service='INT-minor'] {
		//			 line-width: @minor-service-width-z17;
		//			 b/line-width: @minor-service-width-z17 - 2 * @casing-width-z17;
		//			 b/line-dasharray: 8,6;
		//			 [zoom>=18] {
		//				 line-width: @minor-service-width-z18;
		//				 b/line-width: @minor-service-width-z18 - 2 * @casing-width-z18;
		//			 }
		//			 [zoom>=19] {
		//				 line-width: @minor-service-width-z19 - 2 * @casing-width-z19;
		//				 b/line-width: @minor-service-width-z19 - 4 * @casing-width-z19;
		//			 }
		//		 }
		//	 }

		//	 [construction=road][zoom>=15],
		//	 [construction=raceway][zoom>=15] {
		//		 line-color: @minor-construction;
		//		 b/line-color: @road-fill;
		//		 line-width: @road-width-z14;
		//		 b/line-width: @road-width-z14;
		//		 b/line-dasharray: 6,4;
		//		 [zoom>=16] {
		//			 line-width: @road-width-z16;
		//			 b/line-width: @road-width-z16 - 2 * @casing-width-z16;
		//			 b/line-dasharray: 8,6;
		//		 }
		//		 [zoom>=17] {
		//			 line-width: @road-width-z17;
		//			 b/line-width: @road-width-z17 - 2 * @casing-width-z17;
		//		 }
		//		 [zoom>=18] {
		//			 line-width: 8;
		//			 b/line-width: 7;
		//		 }
		//	 }
		//	 [construction=footway][zoom>=15],
		//	 [construction=cycleway][zoom>=15],
		//	 [construction=bridleway][zoom>=15],
		//	 [construction=path][zoom>=15],
		//	 [construction=track][zoom>=15],
		//	 [construction=steps][zoom>=15] {
		//		 line-color: white;
		//		 line-width: 3;
		//		 line-opacity: 0.4;
		//		 b/line-width: 1.2;
		//		 b/line-color: @minor-construction;
		//		 b/line-dasharray: 2,6;
		//	 }
		// }

		[kind=motorway] {
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

		[kind=trunk] {
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

		[kind=primary] {
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

		[kind=secondary] {
			[zoom>=9][ramp!=1],
			[zoom>=10] {
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

		[kind=tertiary] {
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

		[kind=residential],
		[kind=unkindified],
		[kind=minor] {
			[zoom=12][kind=residential] {
				line-color: @unimportant-road;
				line-width: @residential-width-z12;
			}
			[zoom=12][kind=minor],
			[zoom=12][kind=unkindified] {
				line-color: @unimportant-road;
				line-width: @unkindified-width-z12;
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

		// [kind=living_street] {
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

		// [kind=road] {
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

		[kind=service][zoom>=14]{
			line-color: @service-fill;
			[kind='service'] {
				line-width: linear([view::zoom], (14, @service-width-z14 - 2 * @casing-width-z14), (16, @service-width-z16 - 2 * @casing-width-z16), (17, @service-width-z17 - 2 * @casing-width-z17), (18, @service-width-z18 - 2 * @casing-width-z17), (19, @service-width-z19 - 2 * @casing-width-z19));
			}
			// [kind='minor'] {
			// 	line-width: linear([view::zoom], (16, @minor-service-width-z16 - 2 * @casing-width-z16), (17, @minor-service-width-z17 - 2 * @casing-width-z17), (18, @minor-service-width-z18 - 2 * @casing-width-z17), (19, @minor-service-width-z19 - 2 * @casing-width-z19));
			
			// }
			line-join: round;
			line-cap: round;
			[brunnel=tunnel] {
				line-color: darken(white, 5%);
			}
			[brunnel=bridge] {
				[kind=service] {
					line-width: linear([view::zoom], (14, @service-width-z14 - 2 * @casing-width-z14), (16, @service-width-z16 - 2 * @bridge-casing-width-z16), (17, @service-width-z17 - 2 * @bridge-casing-width-z17), (18, @service-width-z18 - 2 * @bridge-casing-width-z17), (19, @service-width-z19 - 2 * @bridge-casing-width-z19));
					
				}
				// [kind='minor'] {
				// 	line-width: linear([view::zoom], (14, @minor-service-width-z14 - 2 * @casing-width-z14), (16, @minor-service-width-z16 - 2 * @bridge-casing-width-z16), (17, @minor-service-width-z17 - 2 * @bridge-casing-width-z17), (18, @minor-service-width-z18 - 2 * @bridge-casing-width-z17), (19, @minor-service-width-z19 - 2 * @bridge-casing-width-z19));
				
				// }
			}
		}

		[kind=path][subkind=pedestrian][zoom>=14] {
			line-width: linear([view::zoom], (14, @pedestrian-width-z14 - 2 * @casing-width-z14), (15, @pedestrian-width-z15 - 2 * @casing-width-z15), (16, @pedestrian-width-z16 - 2 * @casing-width-z16), (17, @pedestrian-width-z17 - 2 * @casing-width-z17), (18, @pedestrian-width-z18 - 2 * @casing-width-z17), (19, @pedestrian-width-z19 - 2 * @casing-width-z19));
			
			line-color: @pedestrian-fill;
			[brunnel=bridge] {
				line-width: linear([view::zoom], (14, @pedestrian-width-z14 - 2 * @bridge-casing-width-z14), (15, @pedestrian-width-z15 - 2 * @bridge-casing-width-z15), (16, @pedestrian-width-z16 - 2 * @bridge-casing-width-z16), (17, @pedestrian-width-z17 - 2 * @bridge-casing-width-z17), (18, @pedestrian-width-z18 - 2 * @bridge-casing-width-z17), (19, @pedestrian-width-z19 - 2 * @bridge-casing-width-z19));
			
			}
			line-join: round;
			line-cap: round;
		}

		[kind=raceway][zoom>=12] {
			line-color: @raceway-fill;
			line-width: 1.2;
			line-join: round;
			line-cap: round;
			line-width: linear([view::zoom], (12, 1.2), (13, 2), (14, 3), (15, 6), (18, 8), (19, 12), (20, 24));
		}
		[kind=path]{
			[subkind=platform] {
				[zoom>=16] {
				line-join: round;
				line-width: 6;
				line-color: #808080;
				line-cap: round;
				b/line-width: 4;
				b/line-color: #bbbbbb;
				b/line-cap: round;
				b/line-join: round;
				}
			}
		
			[subkind=steps] {
				[zoom>=13] {
					[zoom>=15] {
						background/line-color: @steps-casing;
						background/line-cap: round;
						background/line-join: round;
						background/line-width: @steps-width-z15 + 2 * @paths-background-width;
						background/line-opacity: 0.4;
					}
					line/line-color: @steps-fill;
					[access=no] { line/line-color: @steps-fill-noaccess; }
					line/line-dasharray: 2,1;
					line/line-width: @steps-width-z13;
					[zoom>=15] { line/line-width:	@steps-width-z15; }
				}
			}
		
			[subkind=bridleway],
			[subkind=path][horse=designated] {
				[zoom>=13] {
					[zoom>=15] {
						background/line-color: @bridleway-casing;
						background/line-cap: round;
						background/line-join: round;
						background/line-width: @bridleway-width-z15 + 2 * @paths-background-width;
						background/line-opacity: 0.4;
					}
					line/line-color: @bridleway-fill;
					[access=no] { line/line-color: @bridleway-fill-noaccess; }
					line/line-dasharray: 4,2;
					line/line-width: @bridleway-width-z13;
					[zoom>=15] { line/line-width: @bridleway-width-z15; }
					[brunnel=tunnel] {
						line/line-join: round;
						line/line-cap: round;
					}
				}
			}
		
			[subkind=footway],
			[subkind=path][bicycle != designated][horse != designated] {
				[zoom>=14] {
					[zoom>=15] {
						background/line-color: @footway-casing;
						background/line-cap: round;
						background/line-join: round;
						background/line-width: @footway-width-z15 + 2 * @paths-background-width;
						background/line-opacity: 0.4;
						[zoom>=16] {
						background/line-width: @footway-width-z16 + 2 * @paths-background-width;
						}
						[zoom>=18] {
						background/line-width: @footway-width-z18 + 2 * @paths-background-width;
						}
						[zoom>=19] {
						background/line-width: @footway-width-z19 + 2 * @paths-background-width;
						}
					}
					line/line-color: @footway-fill;
					[access=no] { line/line-color: @footway-fill-noaccess; }
					line/line-dasharray: 1,3;
					line/line-join: round;
					line/line-cap: round;
					line/line-width: @footway-width-z14;
					[zoom>=15][ramp!=1][surface=paved] {
						line/line-dasharray: 2,3.5;
						line/line-width: @footway-width-z15;
						[zoom>=16] {
							line/line-dasharray: 3,3.5;
							line/line-width: @footway-width-z16;
						}
						[zoom>=17] {
							line/line-dasharray: 3,3;
						}
						[zoom>=18] {
							line/line-width: @footway-width-z18;
						}
						[zoom>=19] {
							line/line-width: @footway-width-z19;
						}
					}
					[zoom>=15][ramp!=1][surface=null] {
						line/line-color: @footway-fill;
						[access=no] { line/line-color: @footway-fill-noaccess; }
						line/line-dasharray: 1,3,2,4;
						line/line-join: round;
						line/line-cap: round;
						line/line-width: @footway-width-z15;
						[zoom>=16] {
							line/line-dasharray: 1,4,2,3;
							line/line-width: @footway-width-z16;
						}
							[zoom>=18] {
							line/line-width: @footway-width-z18;
						}
						[zoom>=19] {
							line/line-width: @footway-width-z19;
						}
					}
					[zoom>=15][ramp!=1][surface=unpaved] {
						line/line-color: @footway-fill;
						[access=no] { line/line-color: @footway-fill-noaccess; }
						line/line-dasharray: 1,4;
						line/line-join: round;
						line/line-cap: round;
						line/line-width: @footway-width-z15;
						[zoom>=16] {
						line/line-width: @footway-width-z16;
						}
						[zoom>=18] {
						line/line-width: @footway-width-z18;
						}
						[zoom>=19] {
						line/line-width: @footway-width-z19;
						}
					}
				}
			}
		
			[subkind=cycleway],
			[subkind=path][bicycle=designated] {
				[zoom>=13] {
					background/line-color: @cycleway-casing;
					background/line-cap: round;
					background/line-join: round;
					background/line-width: @cycleway-width-z15 + 2 * @paths-background-width;
					background/line-opacity: 0.4;
					[zoom>=16] {
					background/line-width: @cycleway-width-z16 + 2 * @paths-background-width;
					}
					[zoom>=18] {
					background/line-width: @cycleway-width-z18 + 2 * @paths-background-width;
					}
					[zoom>=19] {
					background/line-width: @cycleway-width-z19 + 2 * @paths-background-width;
					}
					line/line-color: @cycleway-fill;
					[access=no] { line/line-color: @cycleway-fill-noaccess; }
					line/line-dasharray: 1,3;
					line/line-join: round;
					line/line-cap: round;
					line/line-width: @cycleway-width-z13;
					[zoom>=15][ramp!=1][surface=paved] {
						line/line-dasharray: 2,3.5;
						line/line-width: @cycleway-width-z15;
						[zoom>=16] {
						line/line-dasharray: 3,3.5;
						line/line-width: @cycleway-width-z16;
						}
						[zoom>=17] {
						line/line-dasharray: 3,3;
						}
						[zoom>=18] {
						line/line-width: @cycleway-width-z18;
						}
						[zoom>=19] {
						line/line-width: @cycleway-width-z19;
						}
					}
					[zoom>=15][ramp!=1][surface=null] {
						line/line-color: @cycleway-fill;
						[access=no] { line/line-color: @cycleway-fill-noaccess; }
						line/line-dasharray: 1,3,2,4;
						line/line-join: round;
						line/line-cap: round;
						line/line-width: @cycleway-width-z15;
						[zoom>=16] {
							line/line-dasharray: 1,4,2,3;
							line/line-width: @cycleway-width-z16;
						}
						[zoom>=18] {
							line/line-width: @cycleway-width-z18;
						}
						[zoom>=19] {
							line/line-width: @cycleway-width-z19;
						}
					}
					[zoom>=15][ramp!=1][surface=unpaved] {
						line/line-color: @cycleway-fill;
						[access=no] { line/line-color: @cycleway-fill-noaccess; }
						line/line-dasharray: 1,4;
						line/line-join: round;
						line/line-cap: round;
						line/line-width:	@cycleway-width-z15;
						[zoom>=16] {
							line/line-width:	@cycleway-width-z16;
						}
						[zoom>=18] {
							line/line-width: @cycleway-width-z18;
						}
						[zoom>=19] {
							line/line-width:	@cycleway-width-z19;
						}
					}
				}
			}
		}
		

		[kind=track][zoom>=13] {
			/* The white casing that you mainly see against forests and other dark features */
			// #roads-fill[zoom>=15] {
			background/line-opacity: 0.4;
			background/line-color: @track-casing;
			background/line-join: round;
			background/line-cap: round;
			background/line-width: @track-width-z15 + 2 * @paths-background-width;
			/* With the heavier dasharrays on grade1 and grade2 it helps to make the casing a bit larger */
			[tracktype=grade1] {
				background/line-width: @track-grade1-width-z15 + 2 * @paths-background-width;
			}
			[tracktype=grade2] {
				background/line-width: @track-grade2-width-z15 + 2 * @paths-background-width;
			}
			// }

			/* Set the properties of the brown inside */
			line/line-color: @track-fill;
			[access=no] { line/line-color: @track-fill-noaccess; }
			line/line-dasharray: 5,4,2,4;
			line/line-cap: round;
			line/line-join: round;
			line/line-opacity: 0.8;
			// line/line-clip:false;

			line/line-width: @track-width-z13;

			[tracktype=grade1] {
				line/line-dasharray: 100,0;
			}
			[tracktype=grade2] {
				line/line-dasharray: 8.8,3.2;
			}
			[tracktype=grade3] {
				line/line-dasharray: 5.6,4.0;
			}
			[tracktype=grade4] {
				line/line-dasharray: 3.2,4.8;
			}
			[tracktype=grade5] {
				line/line-dasharray: 1.6,6.4;
			}

			[zoom>=15] {
				line/line-width: @track-width-z15;
				[tracktype=grade1] {
					line/line-dasharray: 100,0;
				}
				[tracktype=grade2] {
					line/line-dasharray: 11,4;
				}
				[tracktype=grade3] {
					line/line-dasharray: 7,5;
				}
				[tracktype=grade4] {
					line/line-dasharray: 4,6;
				}
				[tracktype=grade5] {
					line/line-dasharray: 2,8;
				}
			}
		}

		[kind=rail][service=spur][zoom>=13],
		[kind=rail][service=yard][zoom>=13],
		[kind=rail][service=siding][zoom>=13],
		[kind=rail][zoom>=8],
		[kind=transit][zoom>=8] {
			[zoom<13] {
				line-color: #787878;
				line-width: 0.5;
				[zoom>=8] { line-width: 0.8; }
				[zoom>=12] { line-width: 0.9; }
				line-join: round;
				[brunnel=tunnel] {
					line-dasharray: 5,2;
				}
			}
			[zoom>=12] {
				// [brunnel=bridge] {
					dark/line-join: round;
					light/line-color: #ffffff;
					light/line-join: round;
					[subkind=rail] {
						dark/line-color: #707070;
						dark/line-width: 2;
						light/line-width: 0.75;
						light/line-dasharray: 8,8;
						[zoom>=13] {
							dark/line-width: 3;
							light/line-width: 1;
						}
						[zoom>=15] {
							light/line-dasharray: 0,8,8,1;
						}
						[zoom>=18] {
							dark/line-width: 4;
							light/line-width: 2;
						}
					}
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
						line-width: 1.9;
						line-dasharray: 3,3;
						[zoom>=18] {
							line-width: 2.7;
						}
					}
					[kind=rail][zoom>=18] {
						line-dasharray: 8,6;
						line-width: 3.8;
					}
				}
			}
			[subkind=light_rail],
			[subkind=funicular],
			[subkind=narrow_gauge] {
				[zoom>=8] {
				line-color: #ccc;
				[zoom>=10] { line-color: #aaa; }
				[zoom>=13] { line-color: #666; }
				line-width: 1;
				[zoom>=13] { line-width: 2; }
				[brunnel=tunnel] {
					line-dasharray: 5,3;
				}
				}
			}

			[subkind=miniature] {
				[zoom>=15] {
				line/line-width: 1.2;
				line/line-color: #999;
				dashes/line-width: 3;
				dashes/line-color: #999;
				dashes/line-dasharray: 1,10;
				}
			}

			[subkind=tram],
			[subkind='tram-service'][zoom>=15] {
				[zoom>=12] {
					line-color: #6E6E6E;
					line-width: 0.75;
					[zoom>=14] {
						line-width: 1;
					}
					[zoom>=15] {
						line-width: 1.5;
						[subkind='tram-service'] {
						line-width: 0.5;
						}
					}
					[zoom>=17] {
						line-width: 2;
						[subkind='tram-service'] {
						line-width: 1;
						}
					}
					[zoom>=18] {
						[subkind='tram-service'] {
						line-width: 1.5;
						}
					}
					[zoom>=19] {
						[subkind='tram-service'] {
						line-width: 2;
						}
					}
					[brunnel=tunnel] {
						line-dasharray: 5,3;
					}
				}
			}

			[subkind=subway] {
				[zoom>=12] {
					line-width: 2;
					line-color: #999;
					[brunnel=tunnel] {
						line-dasharray: 5,3;
					}
				}
				[brunnel=bridge] {
					[zoom>=14] {
						line-width: 2;
						line-color: #999;
					}
				}
			}

			[subkind=preserved] {
				[zoom>=12] {
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
				}
			}

			// [subkind='INT-preserved-ssy'] {
			//	 [zoom>=12] {
			//		 dark/line-width: 1;
			//		 dark/line-color: #aaa;
			//		 dark/line-join: round;
			//		 [zoom>=13] {
			//			 dark/line-width: 2;
			//			 dark/line-color: #999999;
			//			 light/line-width: 0.8;
			//			 light/line-color: white;
			//			 light/line-dasharray: 0,1,8,1;
			//			 light/line-join: round;
			//		 }
			//	 }
			// }

			[subkind=monorail] {
				[zoom>=14] {
					background/line-width: 4;
					background/line-color: #fff;
					background/line-opacity: 0.4;
					background/line-cap: round;
					background/line-join: round;
					line/line-width: 3;
					line/line-color: #777;
					line/line-dasharray: 2,3;
					line/line-cap: round;
					line/line-join: round;
				}
			}
			[subkind=construction] {
				[zoom>=13] {
					line-color: #808080;
					line-width: 2;
					line-dasharray: 2,4;
					line-join: round;
					[zoom>=14] {
						line-dasharray: 2,3;
					}
					[zoom>=15] {
						line-width: 3;
						line-dasharray: 3,3;
					}
				}
			}
		
			[subkind=disused] {
				[zoom>=15] {
					line-color: #aaa;
					line-width: 2;
					line-dasharray: 2,4;
					line-join: round;
				}
			}
		
			[subkind=platform] {
				[zoom>=16] {
					line-join: round;
					line-width: 6;
					line-color: #808080;
					line-cap: round;
					b/line-width: 4;
					b/line-color: #bbbbbb;
					b/line-cap: round;
					b/line-join: round;
				}
			}
		
			[subkind=turntable] {
				[zoom>=16] {
					line-width: 1.5;
					line-color: #999;
				}
			}
		}
	}
}
// #turning-circle-casing {
//	 [[ramp!=1]tc_type=tertiary][zoom>=15] {
//		 marker-fill: @tertiary-casing;
//		 marker-width: @tertiary-width-z15 * 1.6 + 2 * @casing-width-z15;
//		 marker-height: @tertiary-width-z15 * 1.6 + 2 * @casing-width-z15;
//		 [zoom>=16] {
//			 marker-width: @tertiary-width-z16 * 1.6 + 2 * @casing-width-z16;
//			 marker-height: @tertiary-width-z16 * 1.6 + 2 * @casing-width-z16;
//		 }
//		 [zoom>=17] {
//			 marker-width: @tertiary-width-z17 * 1.6 + 2 * @casing-width-z17;
//			 marker-height: @tertiary-width-z17 * 1.6 + 2 * @casing-width-z17;
//		 }
//		 [zoom>=18] {
//			 marker-width: @tertiary-width-z18 * 1.6 + 2 * @casing-width-z18;
//			 marker-height: @tertiary-width-z18 * 1.6 + 2 * @casing-width-z18;
//		 }
//		 [zoom>=19] {
//			 marker-width: @tertiary-width-z19 * 1.6 + 2 * @casing-width-z19;
//			 marker-height: @tertiary-width-z19 * 1.6 + 2 * @casing-width-z19;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=residential][zoom>=15],
//	 [[ramp!=1]tc_type=unkindified][zoom>=15] {
//		 marker-fill: @residential-casing;
//		 marker-width: @residential-width-z15 * 1.6 + 2 * @casing-width-z15;
//		 marker-height: @residential-width-z15 * 1.6 + 2 * @casing-width-z15;
//		 [zoom>=16] {
//			 marker-width: @residential-width-z16 * 1.6 + 2 * @casing-width-z16;
//			 marker-height: @residential-width-z16 * 1.6 + 2 * @casing-width-z16;
//		 }
//		 [zoom>=17] {
//			 marker-width: @residential-width-z17 * 1.6 + 2 * @casing-width-z17;
//			 marker-height: @residential-width-z17 * 1.6 + 2 * @casing-width-z17;
//		 }
//		 [zoom>=18] {
//			 marker-width: @residential-width-z18 * 1.6 + 2 * @casing-width-z18;
//			 marker-height: @residential-width-z18 * 1.6 + 2 * @casing-width-z18;
//		 }
//		 [zoom>=19] {
//			 marker-width: @residential-width-z19 * 1.6 + 2 * @casing-width-z19;
//			 marker-height: @residential-width-z19 * 1.6 + 2 * @casing-width-z19;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=living_street][zoom>=15] {
//		 marker-fill: @living-street-casing;
//		 marker-width: @living-street-width-z15 * 1.6 + 2 * @casing-width-z15;
//		 marker-height: @living-street-width-z15 * 1.6 + 2 * @casing-width-z15;
//		 [zoom>=16] {
//			 marker-width: @living-street-width-z16 * 1.6 + 2 * @casing-width-z16;
//			 marker-height: @living-street-width-z16 * 1.6 + 2 * @casing-width-z16;
//		 }
//		 [zoom>=17] {
//			 marker-width: @living-street-width-z17 * 1.6 + 2 * @casing-width-z17;
//			 marker-height: @living-street-width-z17 * 1.6 + 2 * @casing-width-z17;
//		 }
//		 [zoom>=18] {
//			 marker-width: @living-street-width-z18 * 1.6 + 2 * @casing-width-z18;
//			 marker-height: @living-street-width-z18 * 1.6 + 2 * @casing-width-z18;
//		 }
//		 [zoom>=19] {
//			 marker-width: @living-street-width-z19 * 1.6 + 2 * @casing-width-z19;
//			 marker-height: @living-street-width-z19 * 1.6 + 2 * @casing-width-z19;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=service][[ramp!=1]tc_service='INT-normal'][zoom>=16] {
//		 marker-fill: @service-casing;
//		 marker-width: @service-width-z16 * 1.6 + 2 * @casing-width-z16;
//		 marker-height: @service-width-z16 * 1.6 + 2 * @casing-width-z16;
//		 [zoom>=17] {
//			 marker-width: @service-width-z17 * 1.6 + 2 * @casing-width-z17;
//			 marker-height: @service-width-z17 * 1.6 + 2 * @casing-width-z17;
//		 }
//		 [zoom>=18] {
//			 marker-width: @service-width-z18 * 1.6 + 2 * @casing-width-z18;
//			 marker-height: @service-width-z18 * 1.6 + 2 * @casing-width-z18;
//		 }
//		 [zoom>=19] {
//			 marker-width: @service-width-z19 * 1.6 + 2 * @casing-width-z19;
//			 marker-height: @service-width-z19 * 1.6 + 2 * @casing-width-z19;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=service][[ramp!=1]tc_service='INT-minor'][zoom>=18] {
//		 marker-fill: @service-casing;
//		 marker-width: @minor-service-width-z18 * 1.6 + 2 * @casing-width-z18;
//		 marker-height: @minor-service-width-z18 * 1.6 + 2 * @casing-width-z18;
//		 [zoom>=19] {
//			 marker-width: @minor-service-width-z19 * 1.6 + 2 * @casing-width-z19;
//			 marker-height: @minor-service-width-z19 * 1.6 + 2 * @casing-width-z19;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }
// }

// #turning-circle-fill {
//	 [[ramp!=1]tc_type=tertiary][zoom>=15] {
//		 marker-fill: @tertiary-fill;
//		 marker-width: @tertiary-width-z15 * 1.6;
//		 marker-height: @tertiary-width-z15 * 1.6;
//		 [zoom>=16] {
//			 marker-width: @tertiary-width-z16 * 1.6;
//			 marker-height: @tertiary-width-z16 * 1.6;
//		 }
//		 [zoom>=17] {
//			 marker-width: @tertiary-width-z17 * 1.6;
//			 marker-height: @tertiary-width-z17 * 1.6;
//		 }
//		 [zoom>=18] {
//			 marker-width: @tertiary-width-z18 * 1.6;
//			 marker-height: @tertiary-width-z18 * 1.6;
//		 }
//		 [zoom>=19] {
//			 marker-width: @tertiary-width-z19 * 1.6;
//			 marker-height: @tertiary-width-z19 * 1.6;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=residential],
//	 [[ramp!=1]tc_type=unkindified] {
//		 [zoom>=15] {
//			 marker-fill: @residential-fill;
//			 marker-width: @residential-width-z15 * 1.6;
//			 marker-height: @residential-width-z15 * 1.6;
//			 [zoom>=16] {
//				 marker-width: @residential-width-z16 * 1.6;
//				 marker-height: @residential-width-z16 * 1.6;
//			 }
//			 [zoom>=17] {
//				 marker-width: @residential-width-z17 * 1.6;
//				 marker-height: @residential-width-z17 * 1.6;
//			 }
//			 [zoom>=18] {
//				 marker-width: @residential-width-z18 * 1.6;
//				 marker-height: @residential-width-z18 * 1.6;
//			 }
//			 [zoom>=19] {
//				 marker-width: @residential-width-z19 * 1.6;
//				 marker-height: @residential-width-z19 * 1.6;
//			 }
//			 marker-allow-overlap: true;
//			 marker-ignore-placement: true;
//			 marker-line-width: 0;
//		 }
//	 }

//	 [[ramp!=1]tc_type=living_street][zoom>=15] {
//		 marker-fill: @living-street-fill;
//		 marker-width: @living-street-width-z15 * 1.6;
//		 marker-height: @living-street-width-z15 * 1.6;
//		 [zoom>=16] {
//			 marker-width: @living-street-width-z16 * 1.6;
//			 marker-height: @living-street-width-z16 * 1.6;
//		 }
//		 [zoom>=17] {
//			 marker-width: @living-street-width-z17 * 1.6;
//			 marker-height: @living-street-width-z17 * 1.6;
//		 }
//		 [zoom>=18] {
//			 marker-width: @living-street-width-z18 * 1.6;
//			 marker-height: @living-street-width-z18 * 1.6;
//		 }
//		 [zoom>=19] {
//			 marker-width: @living-street-width-z19 * 1.6;
//			 marker-height: @living-street-width-z19 * 1.6;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=service][[ramp!=1]tc_service='INT-normal'][zoom>=16] {
//		 marker-fill: @service-fill;
//		 marker-width: @service-width-z16 * 1.6;
//		 marker-height: @service-width-z16 * 1.6;
//		 [zoom>=17] {
//			 marker-width: @service-width-z17 * 1.6;
//			 marker-height: @service-width-z17 * 1.6;
//		 }
//		 [zoom>=18] {
//			 marker-width: @service-width-z18 * 1.6;
//			 marker-height: @service-width-z18 * 1.6;
//		 }
//		 [zoom>=19] {
//			 marker-width: @service-width-z19 * 1.6;
//			 marker-height: @service-width-z19 * 1.6;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=service][[ramp!=1]tc_service='INT-minor'][zoom>=18] {
//		 marker-fill: @service-fill;
//		 marker-width: @minor-service-width-z18 * 1.6;
//		 marker-height: @minor-service-width-z18 * 1.6;
//		 [zoom>=19] {
//			 marker-width: @minor-service-width-z19 * 1.6;
//			 marker-height: @minor-service-width-z19 * 1.6;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }

//	 [[ramp!=1]tc_type=track][zoom>=15] {
//		 marker-fill: @track-fill;
//		 marker-width: 6;
//		 marker-height: 6;
//		 [zoom>=17] {
//			 marker-width: 10;
//			 marker-height: 10;
//		 }
//		 marker-allow-overlap: true;
//		 marker-ignore-placement: true;
//		 marker-line-width: 0;
//	 }
// }

// #aeroway['mapnik::geometry_type'=3]{
// 	[kind=runway][zoom>=11] {
// 		polygon-fill: @runway-fill;
// 	}

// 	[kind=taxiway][zoom>=13] {
// 		polygon-fill: @taxiway-fill;
// 	}

// 	[kind=helipad][zoom>=16] {
// 		polygon-fill: @helipad-fill;
// 	}
// }

// #junctions {
//	 [subkind=motorway_junction] {
//		 [zoom>=11] {
//			 text-name: "[ref]";
//			 text-size: 10;
//			 text-fill: @junction-text-color;
//			 text-min-distance: 2;
//			 text-face-name: @oblique-fonts;
//			 text-halo-radius: @standard-halo-radius;
//			 text-wrap-character: ";";
//			 text-wrap-width: 2; // effectively break after every wrap character
//			 text-line-spacing: -1.5; // -0.15 em
//			 [zoom>=13] {
//				 ["name" != null]["ref"=null] {
//					 text-name: @name;
//				 }
//				 ["name" != null]["ref" != null] {
//					 text-name: [name] + "\n" + [ref];
//				 }
//			 }
//			 [zoom>=15] {
//				 text-size: 11;
//				 text-line-spacing: -1.65; // -0.15 em
//			 }
//		 }
//	 }

//	 [junction=yes],
//	 [subkind=traffic_signals] {
//		 [zoom>=15] {
//			 text-name: @name;
//			 text-size: 10;
//			 text-fill: black;
//			 text-face-name: @book-fonts;
//			 text-halo-radius: @standard-halo-radius;
//			 text-halo-fill: @standard-halo-fill;
//			 text-wrap-width: 30;	// 3.0 em
//			 text-line-spacing: -1.5; // -0.15 em
//			 text-min-distance: 2;
//			 [zoom>=17] {
//				 text-size: 11;
//				 text-line-spacing: -1.65; // -0.15 em
//				 /* Offset name on traffic_signals on zoomlevels where they are displayed
//				 in order not to hide the text */
//				 [subkind=traffic_signals] {
//					 text-dy: 9;
//				 }
//			 }
//		 }
//	 }
// }

// #bridge-text	{
//	 [man_made=bridge] {
//		 [zoom>=12][way_pixels > 62.5][way_pixels<=64000] {
//			 text-name: @name;
//			 text-size: 10;
//			 text-wrap-width: 30; // 3 em
//			 text-line-spacing: -1.2; // -0.15 em
//			 text-fill: black;
//			 text-face-name: @book-fonts;
//			 text-halo-radius: @standard-halo-radius;
//			 text-halo-fill: @standard-halo-fill;
//			 text-margin: 3; // 0.3 em
//			 text-wrap-width: 30;
//			 text-placement: interior;
//			 [way_pixels > 250] {
//				 text-size: 11;
//				 text-margin: 3.3; // 0.3 em
//				 text-wrap-width: 33; // 3 em
//				 text-line-spacing: -1.35; // -0.15 em
//				 text-halo-radius: @standard-halo-radius * 1.1;
//			 }
//			 [way_pixels > 1000] {
//				 text-size: 12;
//				 text-margin: 3.6; // 0.3 em
//				 text-wrap-width: 36; // 3 em
//				 text-line-spacing: -1.65; // -0.15 em
//				 text-halo-radius: @standard-halo-radius * 1.2;
//			 }
//			 [way_pixels > 4000] {
//				 text-size: 13;
//				 text-margin: 3.9; // 0.3 em
//				 text-wrap-width: 39; // 3 em
//				 text-line-spacing: -1.80; // -0.15 em
//				 text-halo-radius: @standard-halo-radius * 1.3;
//			 }
//			 [way_pixels > 16000] {
//				 text-size: 14;
//				 text-margin: 4.2; // 0.3 em
//				 text-wrap-width: 42; // 3 em
//				 text-line-spacing: -1.95; // -0.15 em
//				 text-halo-radius: @standard-halo-radius * 1.4;
//			 }
//		 }
//	 }
// }

// .access::fill {
//	 [access=destination] {
//		 [kind=secondary],
//		 [kind=tertiary],
//		 [kind=unkindified],
//		 [kind=residential],
//		 [kind=living_street] {
//			 [zoom>=15] {
//				 access/line-color: @access-marking;
//				 [kind=living_street] {
//					 access/line-color: @access-marking-living-street;
//				 }
//				 access/line-join: round;
//				 access/line-cap: round;
//				 access/line-width: 3;
//				 access/line-dasharray: 0.1,9;
//				 [zoom>=17] {
//					 access/line-width: 6;
//					 access/line-dasharray: 0.1,12;
//				 }
//			 }
//		 }
//		 [kind=road],
//		 [kind=service] {
//			 [zoom>=15] {
//				 access/line-color: @access-marking;
//				 access/line-join: round;
//				 access/line-cap: round;
//				 access/line-width: 2;
//				 access/line-dasharray: 0.1,4;
//				 [zoom>=17] {
//					 access/line-width: 4;
//					 access/line-dasharray: 0.1,9;
//				 }
//			 }
//		 }
//		 [kind=minor] {
//			 [zoom>=16] {
//				 access/line-color: @access-marking;
//				 access/line-join: round;
//				 access/line-cap: round;
//				 access/line-width: 1;
//				 access/line-dasharray: 0.1,4;
//				 [zoom>=17] {
//					 access/line-width: 2;
//				 }
//			 }
//		 }
//	 }
//	 [access=no] {
//		 [kind=motorway],
//		 [kind=trunk],
//		 [kind=primary],
//		 [kind=secondary],
//		 [kind=tertiary],
//		 [kind=unkindified],
//		 [kind=residential],
//		 [kind=living_street] {
//			 [zoom>=15] {
//				 access/line-color: @access-marking;
//				 [kind=living_street] {
//					 access/line-color: @access-marking-living-street;
//				 }
//				 access/line-join: round;
//				 access/line-cap: round;
//				 access/line-width: 2;
//				 access/line-dasharray: 6,6;
//				 [zoom>=17] {
//					 access/line-width: 6;
//					 access/line-dasharray: 10,12;
//				 }
//			 }
//		 }
//		 [kind=road],
//		 [kind=service] {
//			 [zoom>=15] {
//				 access/line-color: @access-marking;
//				 access/line-join: round;
//				 access/line-cap: round;
//				 access/line-width: 2;
//				 access/line-dasharray: 6,8;
//				 [zoom>=17] {
//					 access/line-width: 3;
//					 access/line-dasharray: 8,10;
//				 }
//			 }
//		 }
//		 [kind=minor][zoom>=16] {
//			 access/line-color: @access-marking;
//			 access/line-join: round;
//			 access/line-cap: round;
//			 access/line-width: 1;
//			 access/line-dasharray: 6,8;
//			 [zoom>=17] {
//				 access/line-width: 2;
//			 }
//		 }
//	 }
// }

// #guideways {
//	 [zoom>=11][zoom<13] {
//		 line-width: 0.6;
//		 line-color: #6699ff;
//		 [zoom>=12] { line-width: 1; }
//	 }
//	 [zoom>=13] {
//		 line-width: 3;
//		 line-color: #6699ff;
//		 line-join: round;
//		 b/line-width: 1;
//		 b/line-color: white;
//		 b/line-dasharray: 8,12;
//		 b/line-join: round;
//	 }
//	 [zoom>=14] {
//		 b/line-dasharray: 0,11,8,1;
//	 }
// }

// #aeroway {
// 	[kind=runway] {
// 		[zoom>=11] {
// 			::casing[brunnel=bridge][zoom>=14] {
// 				line-width: 12 + 2*@major-casing-width-z14;
// 				line-color: @bridge-casing;
// 				line-join: round;
// 				[zoom>=15] { line-width: 18 + 2*@major-casing-width-z15; }
// 				[zoom>=16] { line-width: 24 + 2*@major-casing-width-z16; }
// 				[zoom>=17] { line-width: 24 + 2*@major-casing-width-z17; }
// 				[zoom>=18] { line-width: 24 + 2*@major-casing-width-z18; }
// 			}
// 			::fill {
// 				line-color: @runway-fill;
// 				line-width: 2;
// 				[zoom>=12] { line-width: 4; }
// 				[zoom>=13] { line-width: 6; }
// 				[zoom>=14] { line-width: 12; }
// 				[zoom>=15] { line-width: 18; }
// 				[zoom>=16] { line-width: 24; }
// 			}
// 		}
// 	}
// 	[kind=taxiway] {
// 		[zoom>=11] {
// 			::casing[brunnel=bridge][zoom>=14] {
// 				line-width: 4 + 2*@secondary-casing-width-z14;
// 				line-color: @bridge-casing;
// 				line-join: round;
// 				[zoom>=15] { line-width: 6 + 2*@secondary-casing-width-z15; }
// 				[zoom>=16] { line-width: 8 + 2*@secondary-casing-width-z16; }
// 				[zoom>=17] { line-width: 8 + 2*@secondary-casing-width-z17; }
// 				[zoom>=18] { line-width: 8 + 2*@secondary-casing-width-z18; }
// 			}
// 			::fill {
// 				line-color: @taxiway-fill ;
// 				line-width: 1;
// 				[zoom>=13] { line-width: 2; }
// 				[zoom>=14] { line-width: 4; }
// 				[zoom>=15] { line-width: 6; }
// 				[zoom>=16] { line-width: 8; }
// 			}
// 		}
// 	}
// }

// #transportation_name[ref_length>=0][zoom<13] {
// 	[kind=motorway][zoom>=10],
// 	[kind=trunk][zoom>=11],
// 	[kind=primary][zoom>=11],
// 	[kind=secondary][zoom>=12] {
// 		shield-name: [ref];
// 		shield-size: @shield-size;
// 		shield-line-spacing: @shield-line-spacing;
// 		shield-placement: line;
// 		shield-spacing: @shield-spacing;
// 		// shield-repeat-distance: @shield-repeat-distance;
// 		// shield-margin: @shield-margin;
// 		shield-face-name: @shield-font;
// 		shield-clip: @shield-clip;

// 		[kind=motorway] {
// 			shield-fill: @motorway-shield;
// 			shield-file: url("symbols/shields/motorway_[width]x[height].svg");
// 		}

// 		[kind=trunk] {
// 			shield-fill: @trunk-shield;
// 			shield-file: url("symbols/shields/trunk_[width]x[height].svg");
// 		}

// 		[kind=primary] {
// 			shield-fill: @primary-shield;
// 			shield-file: url("symbols/shields/primary_[width]x[height].svg");
// 		}

// 		[kind=secondary] {
// 			shield-fill: @secondary-shield;
// 			shield-file: url("symbols/shields/secondary_[width]x[height].svg");
// 		}
// 	}
// }

// #transportation_name[ref_length>=0][zoom>=13] {
// 	[kind=motorway],
// 	[kind=trunk],
// 	[kind=primary],
// 	[kind=secondary],
// 	[kind=tertiary] {
// 		shield-name: [ref];
// 		shield-size: @shield-size;
// 		shield-line-spacing: @shield-line-spacing;

// 		[zoom>=16] {
// 			shield-size: @shield-size-z16;
// 			shield-line-spacing: @shield-line-spacing-z16;
// 		}
// 		[zoom>=18] {
// 			shield-size: @shield-size-z18;
// 			shield-line-spacing: @shield-line-spacing-z18;
// 		}

// 		shield-placement: line;
// 		shield-spacing: @shield-spacing;
// 	//	 shield-repeat-distance: @shield-repeat-distance;
// 	//	 shield-margin: @shield-margin;
// 		shield-face-name: @shield-font;
// 		shield-clip: @shield-clip;

// 		[kind=motorway] {
// 			shield-fill: @motorway-shield;
// 			shield-file: url("symbols/shields/motorway_[width]x[height].svg");

// 			[zoom>=16] {
// 				shield-file: url("symbols/shields/motorway_[width]x[height]_z16.svg");
// 			}
// 			[zoom>=18] {
// 				shield-file: url("symbols/shields/motorway_[width]x[height]_z18.svg");
// 			}
// 		}
// 		[kind=trunk] {
// 			shield-fill: @trunk-shield;
// 			shield-file: url("symbols/shields/trunk_[width]x[height].svg");

// 			[zoom>=16] {
// 				shield-file: url("symbols/shields/trunk_[width]x[height]_z16.svg");
// 			}
// 			[zoom>=18] {
// 				shield-file: url("symbols/shields/trunk_[width]x[height]_z18.svg");
// 			}
// 		}
// 		[kind=primary] {
// 			shield-fill: @primary-shield;
// 			shield-file: url("symbols/shields/primary_[width]x[height].svg");

// 			[zoom>=16] {
// 				shield-file: url("symbols/shields/primary_[width]x[height]_z16.svg");
// 			}
// 			[zoom>=18] {
// 				shield-file: url("symbols/shields/primary_[width]x[height]_z18.svg");
// 			}
// 		}
// 		[kind=secondary] {
// 			shield-fill: @secondary-shield;
// 			shield-file: url("symbols/shields/secondary_[width]x[height].svg");

// 			[zoom>=16] {
// 				shield-file: url("symbols/shields/secondary_[width]x[height]_z16.svg");
// 			}
// 			[zoom>=18] {
// 				shield-file: url("symbols/shields/secondary_[width]x[height]_z18.svg");
// 			}
// 		}
// 		[kind=tertiary] {
// 			shield-fill: @tertiary-shield;
// 			shield-file: url("symbols/shields/tertiary_[width]x[height].svg");

// 			[zoom>=16] {
// 				shield-file: url("symbols/shields/tertiary_[width]x[height]_z16.svg");
// 			}
// 			[zoom>=18] {
// 				shield-file: url("symbols/shields/tertiary_[width]x[height]_z18.svg");
// 			}
// 		}
// 	}

// 	[kind=unkindified][zoom>=15],
// 	[kind=minor][zoom>=15],
// 	[kind=residential][zoom>=15] {
// 		text-name: [ref];
// 		text-size: 8;

// 		[zoom>=16] {
// 			text-size: 9;
// 		}
// 		[zoom>=18] {
// 			text-size: 10;
// 		}

// 		text-fill: #000;
// 		text-face-name: @book-fonts;
// 		text-placement: line;
// 		text-min-distance: @major-highway-text-repeat-distance;
// 		text-halo-radius: 2;
// 		text-halo-fill: @standard-halo-fill;
// 		text-spacing: 760;
// 		text-clip: false;
// 	}

// 	[kind=track][zoom>=15] {
// 		text-name: [ref];
// 		text-size: 8;
// 		text-dy: 5;

// 		[zoom>=16] {
// 			text-size: 9;
// 			text-dy: 7;
// 		}
// 		[zoom>=17] {
// 			text-size: 11;
// 			text-dy: 9;
// 		}

// 		text-clip: false;
// 		text-fill: #222;
// 		text-face-name: @book-fonts;
// 		text-halo-radius: @standard-halo-radius;
// 		text-halo-fill: @standard-halo-fill;
// 	//	 text-margin: 10;
// 		text-placement: line;
// 		text-spacing: 760;
// 		text-min-distance: @major-highway-text-repeat-distance;
// 		text-vertical-alignment: middle;
// 	}
// }
// #aeroway {
// 	[kind=runway],
// 	[kind=taxiway] {
// 		[zoom>=15] {
// 			text-name: [ref];
// 			text-size: 10;
// 			text-fill: #333;
// 			text-spacing: 750;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @standard-halo-fill;
// 			text-min-distance: @minor-highway-text-repeat-distance;
// 		}
// 	}
// }

// #transportation_name {
// 	[kind=motorway],
// 	[kind=trunk],
// 	[kind=primary],
// 	[kind=motorway],
// 	[kind=trunk],
// 	[kind=primary] {
// 		[zoom>=13] {
// 			text-name: @name;
// 			text-size: 8;
// 			text-fill: black;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-min-distance: @major-highway-text-repeat-distance;
// 			[tunnel=no] {
// 			text-halo-radius: @standard-halo-radius;
// 			[kind=motorway] { text-halo-fill: @motorway-fill; }
// 			[kind=trunk] { text-halo-fill: @trunk-fill; }
// 			[kind=primary] { text-halo-fill: @primary-fill; }
// 			}
// 		}
// 		[zoom>=14] {
// 			text-size: 9;
// 		}
// 		[zoom>=15] {
// 			text-size: 10;
// 		}
// 		[zoom>=17] {
// 			text-size: 11;
// 		}
// 		[zoom>=19] {
// 			text-size: 12;
// 		}
// 	}
// 	[kind=secondary] {
// 		[zoom>=13] {
// 			text-name: @name;
// 			text-size: 8;
// 			text-fill: black;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @secondary-fill;
// 			text-min-distance: @major-highway-text-repeat-distance;
// 		}
// 		[zoom>=14] {
// 			text-size: 9;
// 		}
// 		[zoom>=15] {
// 			text-size: 10;
// 		}
// 		[zoom>=17] {
// 			text-size: 11;
// 		}
// 		[zoom>=19] {
// 			text-size: 12;
// 		}
// 	}
// 	[kind=tertiary],
// 	[kind=minor] {
// 		[zoom>=14] {
// 			text-name: @name;
// 			text-size: 9;
// 			text-fill: black;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @tertiary-fill;
// 			text-min-distance: @major-highway-text-repeat-distance;
// 		}
// 		[zoom>=17] {
// 			text-size: 11;
// 		}
// 		[zoom>=19] {
// 			text-size: 12;
// 		}
// 	}
// 	// [subkind=construction][construction=null][zoom>=16] {
// 	// 	text-name: @name;
// 	// 	text-size: 9;
// 	// 	text-fill: black;
// 	// 	text-spacing: 300;
// 	// 	text-clip: false;
// 	// 	text-placement: line;
// 	// 	text-halo-radius: @standard-halo-radius;
// 	// 	text-halo-fill: @standard-halo-fill;
// 	// 	text-face-name: @book-fonts;
// 	// 	text-min-distance: @major-highway-text-repeat-distance;

// 	// 	[zoom>=17] {
// 	// 		text-size: 11;
// 	// 		text-spacing: 400;
// 	// 	}
// 	// 	[zoom>=19] {
// 	// 		text-size: 12;
// 	// 		text-spacing: 400;
// 	// 	}
// 	// }
// 	// [kind=residential],
// 	// [kind=unkindified],
// 	// [kind=minor],
// 	// [kind=construction][construction=null],
// 	// [kind=road] {
// 	// 	[zoom>=15] {
// 	// 		text-name: @name;
// 	// 		text-size: 8;
// 	// 		text-fill: black;
// 	// 		text-spacing: 300;
// 	// 		text-clip: false;
// 	// 		text-placement: line;
// 	// 		text-halo-radius: @standard-halo-radius;
// 	// 		text-halo-fill: @residential-fill;
// 	// 		text-face-name: @book-fonts;
// 	// 		text-min-distance: @minor-highway-text-repeat-distance;
// 	// 		[subkind=unkindified] { text-min-distance: @major-highway-text-repeat-distance;}
// 	// 	}
// 	// 	[zoom>=16] {
// 	// 		text-size: 9;
// 	// 	}
// 	// 	[zoom>=17] {
// 	// 		text-size: 11;
// 	// 		text-spacing: 400;
// 	// 	}
// 	// 	[zoom>=19] {
// 	// 		text-size: 12;
// 	// 		text-spacing: 400;
// 	// 	}
// 	// }

// 	[kind=raceway],
// 	[kind=service][zoom>=17] {
// 		[zoom>=16] {
// 			text-name: @name;
// 			text-size: 9;
// 			text-fill: black;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-halo-radius: @standard-halo-radius;
// 			[kind=raceway] { text-halo-fill: @raceway-fill; }
// 			[kind=service] { text-halo-fill: @service-fill; }
// 			text-face-name: @book-fonts;
// 			text-min-distance: @major-highway-text-repeat-distance;
// 		}
// 		[zoom>=17] {
// 			text-size: 11;
// 		}
// 	}
	
// 	[kind=path] {
// 		// [subkind=living_street],
// 		// [subkind=pedestrian],
// 		[subkind=living_street][zoom>=16],
// 		[subkind=pedestrian][zoom>=16] {
// 			[zoom>=15] {
// 				text-name: @name;
// 				text-size: 8;
// 				text-fill: black;
// 				text-spacing: 300;
// 				text-clip: false;
// 				text-placement: line;
// 				text-halo-radius: @standard-halo-radius;
// 				[subkind=living_street] {
// 				text-halo-fill: @living-street-fill;
// 				text-min-distance: @major-highway-text-repeat-distance;
// 				}
// 				[subkind=pedestrian] { text-halo-fill: @pedestrian-fill; }
// 				text-face-name: @book-fonts;
// 				text-min-distance: @minor-highway-text-repeat-distance;
// 			}
// 			[zoom>=16] {
// 				text-size: 9;
// 			}
// 			[zoom>=17] {
// 				text-size: 11;
// 			}
// 			[zoom>=19] {
// 				text-size: 12;
// 			}
// 		}
// 	}
// }

// // #roads-area-text-name {
// //	 [way_pixels > 3000],
// //	 [zoom>=17] {
// //		 text-name: @name;
// //		 text-size: 11;
// //		 text-face-name: @book-fonts;
// //		 text-placement: interior;
// //		 text-wrap-width: 30; // 2.7 em
// //		 text-line-spacing: -1.7; // -0.15 em
// //	 }
// // }

// #transportation_name {
// 	[kind=track],
// 	[kind=path][subkind=track][zoom>=16] {
// 		[zoom>=15] {
// 			text-name: @name;
// 			text-fill: #222;
// 			text-size: 8;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @standard-halo-fill;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-vertical-alignment: middle;
// 			text-dy: 5;
// 			text-min-distance: @major-highway-text-repeat-distance;
// 		}
// 		[zoom>=16] {
// 			text-size: 9;
// 			text-dy: 7;
// 		}
// 		[zoom>=17] {
// 			text-size: 11;
// 			text-dy: 9;
// 		}
// 	}
// 	[kind=path] {
// 		[subkind=bridleway],
// 		[subkind=footway],
// 		[subkind=cycleway],
// 		[subkind=path],
// 		[subkind=steps],
// 		[subkind=bridleway],
// 		[subkind=footway],
// 		[subkind=cycleway],
// 		[subkind=path],
// 		[subkind=steps] {
// 			[zoom>=16] {
// 				text-name: @name;
// 				text-fill: #222;
// 				text-size: 9;
// 				text-halo-radius: @standard-halo-radius;
// 				text-halo-fill: @standard-halo-fill;
// 				text-spacing: 300;
// 				text-clip: false;
// 				text-placement: line;
// 				text-face-name: @book-fonts;
// 				text-vertical-alignment: middle;
// 				text-dy: 7;
// 				text-min-distance: @major-highway-text-repeat-distance;
// 				[subkind=steps] { text-min-distance: @minor-highway-text-repeat-distance; }
// 			}
// 			[zoom>=17] {
// 				text-size: 11;
// 				text-dy: 9;
// 			}
// 		}
// 	}
// }

#roads[oneway!=0][zoom>=15] {
	// intentionally omitting highway_platform, highway_construction
	[kind=motorway],
	[kind=trunk],
	[kind=primary],
	[kind=secondary],
	[kind=tertiary],
	[kind=residential],
	[kind=unkindified],
	[kind=living_street],
	[kind=road],
	[kind=service],
	[kind=path][subkind=pedestrian],
	[kind=raceway] {
		[oneway!=0]{
			marker-placement: line;
			marker-spacing: 180;
			marker-file: url('symbols/oneway.svg');
			[oneway=-1] {
				marker-file: url('symbols/oneway-reverse.svg');
			}

			[kind=motorway] {
				marker-fill: @motorway-oneway-arrow-color;
			}
			[kind=trunk] {
				marker-fill: @trunk-oneway-arrow-color;
			}
			[kind=primary] {
				marker-fill: @primary-oneway-arrow-color;
			}
			[kind=secondary] {
				marker-fill: @secondary-oneway-arrow-color;
			}
			[kind=tertiary] {
				marker-fill: @tertiary-oneway-arrow-color;
			}
			[kind=residential],
			[kind=unkindified],
			[kind=road],
			[kind=service] {
				marker-fill: @residential-oneway-arrow-color;
			}
			[kind=living_street] {
				marker-fill: @living-street-oneway-arrow-color;
			}
			[kind=path][subkind=pedestrian] {
				marker-fill: @pedestrian-oneway-arrow-color;
			}
			[kind=raceway] {
				marker-fill: @raceway-oneway-arrow-color;
			}
		}
	}

	[kind=path] {
		[subkind=steps],
		[subkind=cycleway],
		[subkind=footway],
		[subkind=path],
		[subkind=track],
		[subkind=bridleway] {
			[oneway!=0] {
				text-name: [nuti::book-arrow];
				text-size: 15;
				text-clip: false;
				text-spacing: 180;
				text-placement: line;
				text-halo-fill: @standard-halo-fill;
				text-halo-radius: 1.5;
				// text-margin: 2;
				text-dy: 3;
				// text-upright: right;
				text-vertical-alignment: middle;
				text-face-name: @book-fonts;
				[oneway=-1] {
					// text-upright: left;
					text-dy: -3;
				}
				[subkind=footway] {
					text-fill: @footway-oneway-arrow-color;
				}
				[subkind=path] {
					text-fill: @footway-oneway-arrow-color;
					[horse=designated] {
						text-fill: @bridleway-oneway-arrow-color;
					}
					[bicycle=designated] {
						text-fill: @cycleway-oneway-arrow-color;
					}
				}
				[subkind=steps] {
					text-fill: @steps-oneway-arrow-color;
				}
				[subkind=cycleway] {
					text-fill: @cycleway-oneway-arrow-color;
				}
				[subkind=track] {
					text-fill: @track-oneway-arrow-color;
				}
				[subkind=bridleway] {
					text-fill: @bridleway-oneway-arrow-color;
				}
			}
		}
	}
}


// #transportation[name!=null][kind=rail] {
// 	/* Mostly started from z17. */
// 	[subkind=rail],
// 	[subkind=subway],
// 	[subkind=narrow_gauge],
// 	[subkind=light_rail],
// 	[subkind=preserved],
// 	[subkind=funicular],
// 	[subkind=monorail],
// 	[subkind=tram] {
// 		[zoom>=17] {
// 			text-name: @name;
// 			text-fill: #666666;
// 			text-size: 10;
// 			text-dy: 6;
// 			text-spacing: 900;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @standard-halo-fill;
// 			text-min-distance: @railway-text-repeat-distance;
// 		}
// 		[zoom>=19] {
// 			text-size: 11;
// 			text-dy: 7;
// 		}
// 	}
// 	[subkind=rail] {
// 	/* Render highspeed rails from z11,
// 		 other main routes at z14. */
// 		[highspeed=yes] {
// 			[zoom>=11] {
// 			text-name: @name;
// 			text-fill: #666666;
// 			text-size: 10;
// 			text-dy: 3;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @standard-halo-fill;
// 			text-min-distance: @railway-text-repeat-distance;
// 			}
// 			[zoom>=13] {
// 			text-dy: 6;
// 			}
// 			[zoom>=14] {
// 			text-spacing: 600;
// 			}
// 			[zoom>=17] {
// 			text-size: 11;
// 			text-dy: 7;
// 			}
// 			[zoom>=19] {
// 			text-size: 12;
// 			text-dy: 8;
// 			}
// 		}
// 		[highspeed != yes][usage=main] {
// 			[zoom>=14] {
// 				text-name: @name;
// 				text-fill: #666666;
// 				text-size: 10;
// 				text-dy: 6;
// 				text-spacing: 300;
// 				text-clip: false;
// 				text-placement: line;
// 				text-face-name: @book-fonts;
// 				text-halo-radius: @standard-halo-radius;
// 				text-halo-fill: @standard-halo-fill;
// 				text-min-distance: @railway-text-repeat-distance;
// 			}
// 			[zoom>=17] {
// 				text-spacing: 600;
// 				text-size: 11;
// 				text-dy: 7;
// 			}
// 			[zoom>=19] {
// 				text-size: 12;
// 				text-dy: 8;
// 			}
// 		}
// 	}
// 	/* Other minor railway styles. For service rails, see:
// 	 https://github.com/gravitystorm/openstreetmap-carto/pull/2687 */
// 	[subkind=preserved][zoom>=17] ,
// 	[subkind=miniature][zoom>=17] ,
// 	[subkind=disused][zoom>=17] ,
// 	[subkind=construction][zoom>=17]  {
// 		text-name: @name;
// 		text-fill: #666666;
// 		text-size: 10;
// 		text-dy: 6;
// 		text-spacing: 900;
// 		text-clip: false;
// 		text-placement: line;
// 		text-face-name: @book-fonts;
// 		text-halo-radius: @standard-halo-radius;
// 		text-halo-fill: @standard-halo-fill;
// 		text-min-distance: @railway-text-repeat-distance;
// 		[zoom>=19] {
// 			text-size: 11;
// 			text-dy: 7;
// 		}
// 	}
// }
