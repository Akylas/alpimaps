/**
 * J2000 right ascension (HOURS), declination (degrees), visual magnitude. Precession since J2000
 * (~1/3 degree) is not applied. Pure data: no NativeScript import.
 */

export interface CatalogueStar {
    name: string;
    ra: number;
    dec: number;
    mag: number;
    wikidata: string;
    /** Distance, light-years: Wikidata's, else from the Wikipedia infobox parallax. */
    ly: number;
}

export interface CatalogueFigure {
    name: string;
    wikidata: string;
    /** Pairs of star names: a typo is a missing line and a DEV_LOG warning, not a wrong sky. */
    segments: [string, string][];
}

export interface CataloguePlanet {
    /** i18n key of its name, and the index `planetHorizon` takes. */
    key: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
    wikidata: string;
    /** r, g, b */
    colour: [number, number, number];
}

export const STARS: CatalogueStar[] = [
    { name: 'Sirius', ra: 6.7525, dec: -16.7161, mag: -1.46, wikidata: 'Q3409', ly: 8.6 },
    { name: 'Canopus', ra: 6.3992, dec: -52.6957, mag: -0.72, wikidata: 'Q12189', ly: 310 },
    { name: 'Rigil Kentaurus', ra: 14.66, dec: -60.8339, mag: -0.27, wikidata: 'Q12176', ly: 4.39 },
    { name: 'Arcturus', ra: 14.261, dec: 19.1825, mag: -0.05, wikidata: 'Q12985', ly: 36.7 },
    { name: 'Vega', ra: 18.6156, dec: 38.7837, mag: 0.03, wikidata: 'Q3427', ly: 25.0 },
    { name: 'Capella', ra: 5.2782, dec: 45.998, mag: 0.08, wikidata: 'Q12970', ly: 42.4 },
    { name: 'Rigel', ra: 5.2423, dec: -8.2016, mag: 0.13, wikidata: 'Q12126', ly: 860 },
    { name: 'Procyon', ra: 7.6551, dec: 5.225, mag: 0.34, wikidata: 'Q13034', ly: 11.4 },
    { name: 'Achernar', ra: 1.6286, dec: -57.2367, mag: 0.46, wikidata: 'Q12183', ly: 144 },
    { name: 'Betelgeuse', ra: 5.9195, dec: 7.4071, mag: 0.5, wikidata: 'Q12124', ly: 548 },
    { name: 'Hadar', ra: 14.0637, dec: -60.373, mag: 0.61, wikidata: 'Q13175', ly: 50.0 },
    { name: 'Altair', ra: 19.8464, dec: 8.8683, mag: 0.77, wikidata: 'Q12975', ly: 17.0 },
    { name: 'Acrux', ra: 12.4433, dec: -63.0991, mag: 0.77, wikidata: 'Q66476660', ly: 320 },
    { name: 'Aldebaran', ra: 4.5987, dec: 16.5093, mag: 0.85, wikidata: 'Q88540091', ly: 65.1 },
    { name: 'Spica', ra: 13.4199, dec: -11.1613, mag: 1.04, wikidata: 'Q13008', ly: 303 },
    { name: 'Antares', ra: 16.4901, dec: -26.432, mag: 1.09, wikidata: 'Q12166', ly: 550 },
    { name: 'Pollux', ra: 7.7553, dec: 28.0262, mag: 1.14, wikidata: 'Q13028', ly: 33.7 },
    { name: 'Fomalhaut', ra: 22.9608, dec: -29.6222, mag: 1.16, wikidata: 'Q13169', ly: 25.0 },
    { name: 'Deneb', ra: 20.6905, dec: 45.2803, mag: 1.25, wikidata: 'Q12179', ly: 1640 },
    { name: 'Mimosa', ra: 12.7952, dec: -59.6888, mag: 1.25, wikidata: 'Q13105', ly: 277 },
    { name: 'Regulus', ra: 10.1395, dec: 11.9672, mag: 1.35, wikidata: 'Q76493786', ly: 78.3 },
    { name: 'Adhara', ra: 6.9771, dec: -28.972, mag: 1.5, wikidata: 'Q13414', ly: 430 },
    { name: 'Castor', ra: 7.5766, dec: 31.8883, mag: 1.58, wikidata: 'Q13029', ly: 49.8 },
    { name: 'Shaula', ra: 17.5601, dec: -37.1038, mag: 1.62, wikidata: 'Q78603928', ly: 365 },
    { name: 'Gacrux', ra: 12.5194, dec: -57.1133, mag: 1.63, wikidata: 'Q14233', ly: 88.0 },
    { name: 'Bellatrix', ra: 5.4185, dec: 6.3497, mag: 1.64, wikidata: 'Q13066', ly: 395 },
    { name: 'Elnath', ra: 5.4381, dec: 28.6075, mag: 1.65, wikidata: 'Q13508', ly: 134 },
    { name: 'Miaplacidus', ra: 9.22, dec: -69.7172, mag: 1.67, wikidata: 'Q13174', ly: 113 },
    { name: 'Alnilam', ra: 5.6036, dec: -1.2019, mag: 1.69, wikidata: 'Q13070', ly: 1190 },
    { name: 'Alnair', ra: 22.1372, dec: -46.9611, mag: 1.74, wikidata: 'Q854042', ly: 101 },
    { name: 'Alnitak', ra: 5.6793, dec: -1.9426, mag: 1.77, wikidata: 'Q13076', ly: 1260 },
    { name: 'Alioth', ra: 12.9005, dec: 55.9598, mag: 1.77, wikidata: 'Q13091', ly: 79.1 },
    { name: 'Dubhe', ra: 11.0622, dec: 61.751, mag: 1.79, wikidata: 'Q13084', ly: 123 },
    { name: 'Mirfak', ra: 3.4054, dec: 49.8612, mag: 1.79, wikidata: 'Q13790', ly: 509 },
    { name: 'Wezen', ra: 7.1399, dec: -26.3932, mag: 1.83, wikidata: 'Q13411', ly: 1610 },
    { name: 'Regor', ra: 8.1589, dec: -47.3367, mag: 1.83, wikidata: 'Q14235', ly: 512 },
    { name: 'Kaus Australis', ra: 18.4029, dec: -34.3846, mag: 1.85, wikidata: 'Q14034', ly: 143 },
    { name: 'Alkaid', ra: 13.7923, dec: 49.3133, mag: 1.86, wikidata: 'Q13093', ly: 100 },
    { name: 'Sargas', ra: 17.622, dec: -42.9978, mag: 1.86, wikidata: 'Q14236', ly: 270 },
    { name: 'Avior', ra: 8.3752, dec: -59.5095, mag: 1.86, wikidata: 'Q14256', ly: 605 },
    { name: 'Menkalinan', ra: 5.9922, dec: 44.9474, mag: 1.9, wikidata: 'Q13219', ly: 81.1 },
    { name: 'Atria', ra: 16.8111, dec: -69.0277, mag: 1.91, wikidata: 'Q14242', ly: 391 },
    { name: 'Alhena', ra: 6.6285, dec: 16.3993, mag: 1.93, wikidata: 'Q14238', ly: 109 },
    { name: 'Peacock', ra: 20.4275, dec: -56.7351, mag: 1.94, wikidata: 'Q14240', ly: 183 },
    { name: 'Alsephina', ra: 8.7451, dec: -54.7085, mag: 1.96, wikidata: 'Q1048396', ly: 80.6 },
    { name: 'Mirzam', ra: 6.3783, dec: -17.9559, mag: 1.98, wikidata: 'Q13415', ly: 492 },
    { name: 'Polaris', ra: 2.5303, dec: 89.2641, mag: 1.98, wikidata: 'Q12980', ly: 432 },
    { name: 'Alphard', ra: 9.4597, dec: -8.6586, mag: 1.99, wikidata: 'Q13577', ly: 180 },
    { name: 'Hamal', ra: 2.1195, dec: 23.4624, mag: 2, wikidata: 'Q13213', ly: 65.9 },
    { name: 'Deneb Kaitos', ra: 0.7265, dec: -17.9866, mag: 2.04, wikidata: 'Q13170', ly: 96.3 },
    { name: 'Nunki', ra: 18.9211, dec: -26.2967, mag: 2.05, wikidata: 'Q14036', ly: 228 },
    { name: 'Mirach', ra: 1.1622, dec: 35.6206, mag: 2.05, wikidata: 'Q13043', ly: 199 },
    { name: 'Alpheratz', ra: 0.1398, dec: 29.0904, mag: 2.06, wikidata: 'Q13039', ly: 97.0 },
    { name: 'Menkent', ra: 14.1114, dec: -36.3697, mag: 2.06, wikidata: 'Q14225', ly: 58.8 },
    { name: 'Saiph', ra: 5.7959, dec: -9.6697, mag: 2.09, wikidata: 'Q14028', ly: 799 },
    { name: 'Kochab', ra: 14.8451, dec: 74.1555, mag: 2.08, wikidata: 'Q14059', ly: 131 },
    { name: 'Rasalhague', ra: 17.5822, dec: 12.56, mag: 2.08, wikidata: 'Q13504', ly: 48.6 },
    { name: 'Algieba', ra: 10.3329, dec: 19.8415, mag: 2.08, wikidata: 'Q66477100', ly: 130 },
    { name: 'Algol', ra: 3.1361, dec: 40.9556, mag: 2.09, wikidata: 'Q13080', ly: 93.0 },
    { name: 'Almach', ra: 2.065, dec: 42.3297, mag: 2.1, wikidata: 'Q66477099', ly: 393 },
    { name: 'Denebola', ra: 11.8177, dec: 14.572, mag: 2.14, wikidata: 'Q13015', ly: 36.2 },
    { name: 'Muhlifain', ra: 12.6919, dec: -48.9597, mag: 2.2, wikidata: 'Q14226', ly: 130 },
    { name: 'Naos', ra: 8.0597, dec: -40.0033, mag: 2.21, wikidata: 'Q13200', ly: 1080 },
    { name: 'Aspidiske', ra: 9.2848, dec: -59.2753, mag: 2.21, wikidata: 'Q14247', ly: 5860 },
    { name: 'Alphecca', ra: 15.5781, dec: 26.7147, mag: 2.22, wikidata: 'Q14046', ly: 74.7 },
    { name: 'Suhail', ra: 9.1333, dec: -43.4326, mag: 2.23, wikidata: 'Q14245', ly: 545 },
    { name: 'Sadr', ra: 20.3705, dec: 40.2567, mag: 2.23, wikidata: 'Q13327', ly: 1830 },
    { name: 'Mizar', ra: 13.3987, dec: 54.9254, mag: 2.23, wikidata: 'Q66477109', ly: 85.8 },
    { name: 'Eltanin', ra: 17.9435, dec: 51.4889, mag: 2.23, wikidata: 'Q14246', ly: 154 },
    { name: 'Schedar', ra: 0.6751, dec: 56.5375, mag: 2.24, wikidata: 'Q13108', ly: 231 },
    { name: 'Mintaka', ra: 5.5334, dec: -0.2991, mag: 2.25, wikidata: 'Q680341', ly: 692 },
    { name: 'Caph', ra: 0.153, dec: 59.1498, mag: 2.28, wikidata: 'Q13594', ly: 54.4 },
    { name: 'Larawag', ra: 16.8361, dec: -34.2933, mag: 2.29, wikidata: 'Q14249', ly: 79.7 },
    { name: 'Dschubba', ra: 16.0056, dec: -22.6217, mag: 2.29, wikidata: 'Q14248', ly: 731 },
    { name: 'Epsilon Centauri', ra: 13.6648, dec: -53.4664, mag: 2.3, wikidata: 'Q14228', ly: 427 },
    { name: 'Eta Centauri', ra: 14.5918, dec: -42.1578, mag: 2.31, wikidata: 'Q14229', ly: 306 },
    { name: 'Kakkab', ra: 14.6988, dec: -47.3881, mag: 2.3, wikidata: 'Q14230', ly: 465 },
    { name: 'Merak', ra: 11.0307, dec: 56.3824, mag: 2.37, wikidata: 'Q13096', ly: 84.5 },
    { name: 'Izar', ra: 14.7498, dec: 27.0742, mag: 2.37, wikidata: 'Q13255', ly: 203 },
    { name: 'Enif', ra: 21.7364, dec: 9.875, mag: 2.39, wikidata: 'Q14255', ly: 670 },
    { name: 'Ankaa', ra: 0.4381, dec: -42.3061, mag: 2.4, wikidata: 'Q14251', ly: 81.7 },
    { name: 'Girtab', ra: 17.7081, dec: -39.03, mag: 2.41, wikidata: 'Q14253', ly: 483 },
    { name: 'Scheat', ra: 23.0629, dec: 28.0828, mag: 2.42, wikidata: 'Q14258', ly: 199 },
    { name: 'Sabik', ra: 17.173, dec: -15.725, mag: 2.43, wikidata: 'Q670536', ly: 88.4 },
    { name: 'Phecda', ra: 11.8972, dec: 53.6948, mag: 2.44, wikidata: 'Q13099', ly: 111 },
    { name: 'Alderamin', ra: 21.3096, dec: 62.5856, mag: 2.45, wikidata: 'Q13259', ly: 49.1 },
    { name: 'Aludra', ra: 7.4016, dec: -29.3031, mag: 2.45, wikidata: 'Q13416', ly: 1990 },
    { name: 'Navi', ra: 0.9451, dec: 60.7167, mag: 2.47, wikidata: 'Q13584', ly: 382 },
    { name: 'Markeb', ra: 9.3685, dec: -55.0108, mag: 2.47, wikidata: 'Q14259', ly: 571 },
    { name: 'Aljanah', ra: 20.7702, dec: 33.9703, mag: 2.48, wikidata: 'Q13328', ly: 75.5 },
    { name: 'Markab', ra: 23.0793, dec: 15.2053, mag: 2.49, wikidata: 'Q14262', ly: 140 },
    { name: 'Menkar', ra: 3.038, dec: 4.0897, mag: 2.53, wikidata: 'Q13173', ly: 249 },
    { name: 'Zosma', ra: 11.2351, dec: 20.5237, mag: 2.56, wikidata: 'Q14204', ly: 57.7 },
    { name: 'Zeta Ophiuchi', ra: 16.6193, dec: -10.5672, mag: 2.56, wikidata: 'Q1068388', ly: 724 },
    { name: 'Acrab', ra: 16.0906, dec: -19.8056, mag: 2.56, wikidata: 'Q1043118', ly: 1110 },
    { name: 'Arneb', ra: 5.5455, dec: -17.8222, mag: 2.58, wikidata: 'Q693059', ly: 695 },
    { name: 'Ascella', ra: 19.0435, dec: -29.8803, mag: 2.6, wikidata: 'Q14037', ly: 88.2 },
    { name: 'Zubeneschamali', ra: 15.2834, dec: -9.3829, mag: 2.61, wikidata: 'Q13053', ly: 185 },
    { name: 'Theta Aurigae', ra: 5.9954, dec: 37.2125, mag: 2.62, wikidata: 'Q13227', ly: 166 },
    { name: 'Unukalhai', ra: 15.7378, dec: 6.4256, mag: 2.63, wikidata: 'Q1333626', ly: 74.2 },
    { name: 'Sheratan', ra: 1.9107, dec: 20.8081, mag: 2.64, wikidata: 'Q13215', ly: 58.7 },
    { name: 'Muphrid', ra: 13.9114, dec: 18.3978, mag: 2.68, wikidata: 'Q14020', ly: 37.2 },
    { name: 'Hassaleh', ra: 4.9499, dec: 33.1661, mag: 2.69, wikidata: 'Q13225', ly: 450 },
    { name: 'Lesath', ra: 17.5127, dec: -37.2958, mag: 2.69, wikidata: 'Q431136', ly: 576 },
    { name: 'Delta Crucis', ra: 12.2524, dec: -58.7489, mag: 2.79, wikidata: 'Q333243', ly: 455 },
    { name: 'Tarazed', ra: 19.771, dec: 10.6133, mag: 2.72, wikidata: 'Q13206', ly: 583 },
    { name: 'Yed Prior', ra: 16.2391, dec: -3.6942, mag: 2.73, wikidata: 'Q543080', ly: 160 },
    { name: 'Porrima', ra: 12.6944, dec: -1.4494, mag: 2.74, wikidata: 'Q66477101', ly: 39.2 },
    { name: 'Zubenelgenubi', ra: 14.848, dec: -16.0417, mag: 2.75, wikidata: 'Q13047', ly: 74.9 },
    { name: 'Cebalrai', ra: 17.7246, dec: 4.5672, mag: 2.76, wikidata: 'Q1052228', ly: 83.1 },
    { name: 'Hatysa', ra: 5.5906, dec: -5.91, mag: 2.77, wikidata: 'Q14029', ly: 2330 },
    { name: 'Rastaban', ra: 17.5072, dec: 52.3014, mag: 2.79, wikidata: 'Q1321897', ly: 398 },
    { name: 'Nihal', ra: 5.4707, dec: -20.7594, mag: 2.81, wikidata: 'Q830887', ly: 156 },
    { name: 'Kaus Borealis', ra: 18.4662, dec: -25.4217, mag: 2.81, wikidata: 'Q14040', ly: 76.0 },
    { name: 'Tau Scorpii', ra: 16.5981, dec: -28.2161, mag: 2.82, wikidata: 'Q1571090', ly: 637 },
    { name: 'Vindemiatrix', ra: 13.0363, dec: 10.9592, mag: 2.83, wikidata: 'Q14198', ly: 108 },
    { name: 'Algenib', ra: 0.2206, dec: 15.1836, mag: 2.83, wikidata: 'Q954716', ly: 469 },
    { name: 'Zeta Persei', ra: 3.9022, dec: 31.8836, mag: 2.85, wikidata: 'Q13793', ly: 1300 },
    { name: 'Tejat', ra: 6.3827, dec: 22.5136, mag: 2.87, wikidata: 'Q66497320', ly: 232 },
    { name: 'Alcyone', ra: 3.7914, dec: 24.1053, mag: 2.87, wikidata: 'Q13425', ly: 370 },
    { name: 'Delta Cygni', ra: 19.7496, dec: 45.1308, mag: 2.87, wikidata: 'Q13331', ly: 165 },
    { name: 'Pi Scorpii', ra: 15.9809, dec: -26.1142, mag: 2.89, wikidata: 'Q2538697', ly: 1890 },
    { name: 'Gomeisa', ra: 7.4525, dec: 8.2894, mag: 2.89, wikidata: 'Q13420', ly: 160 },
    { name: 'Epsilon Persei', ra: 3.9642, dec: 40.0103, mag: 2.9, wikidata: 'Q13808', ly: 268 },
    { name: 'Gamma Persei', ra: 3.0799, dec: 53.5064, mag: 2.93, wikidata: 'Q13802', ly: 231 },
    { name: 'Matar', ra: 22.7167, dec: 30.2214, mag: 2.94, wikidata: 'Q1417104', ly: 196 },
    { name: 'Mebsuta', ra: 6.7322, dec: 25.1311, mag: 2.98, wikidata: 'Q1416569', ly: 547 },
    { name: 'Epsilon Leonis', ra: 9.7642, dec: 23.7742, mag: 2.98, wikidata: 'Q14205', ly: 227 },
    { name: 'Alnasl', ra: 18.0968, dec: -30.4242, mag: 2.99, wikidata: 'Q10288214', ly: 101 },
    { name: 'Zeta Aquilae', ra: 19.0902, dec: 13.8633, mag: 2.99, wikidata: 'Q13212', ly: 85.3 },
    { name: 'Mu Scorpii', ra: 16.8644, dec: -38.0475, mag: 3, wikidata: 'Q3327325', ly: 501 },
    { name: 'Zeta Tauri', ra: 5.6274, dec: 21.1425, mag: 3, wikidata: 'Q196848', ly: 457 },
    { name: 'Gamma Hydrae', ra: 13.3153, dec: -23.1714, mag: 3, wikidata: 'Q2732974', ly: 128 },
    { name: 'Delta Persei', ra: 3.7154, dec: 47.7875, mag: 3.01, wikidata: 'Q2743026', ly: 368 },
    { name: 'Epsilon Aurigae', ra: 5.0328, dec: 43.8233, mag: 3.03, wikidata: 'Q13222', ly: 2000 },
    { name: 'Seginus', ra: 14.5346, dec: 38.3083, mag: 3.03, wikidata: 'Q14022', ly: 86.0 },
    { name: 'Iota Scorpii', ra: 17.7931, dec: -40.1269, mag: 3.03, wikidata: 'Q2711568', ly: 17900 },
    { name: 'Pherkad', ra: 15.3455, dec: 71.8339, mag: 3.05, wikidata: 'Q14061', ly: 766 },
    { name: 'Albireo', ra: 19.5121, dec: 27.9597, mag: 3.05, wikidata: 'Q67622059', ly: 390 },
    { name: 'Delta Draconis', ra: 19.2093, dec: 67.6617, mag: 3.07, wikidata: 'Q434054', ly: 97.8 },
    { name: 'Ruchbah', ra: 1.4304, dec: 60.2353, mag: 2.68, wikidata: 'Q13597', ly: 102 },
    { name: 'Zeta Draconis', ra: 17.1465, dec: 65.7147, mag: 3.17, wikidata: 'Q15713', ly: 417 },
    { name: 'Phi Sagittarii', ra: 18.7609, dec: -26.9908, mag: 3.17, wikidata: 'Q3179854', ly: 268 },
    { name: 'Pi3 Orionis', ra: 4.8307, dec: 6.9614, mag: 3.19, wikidata: 'Q14216', ly: 26.2 },
    { name: 'Errai', ra: 23.6558, dec: 77.6325, mag: 3.21, wikidata: 'Q13265', ly: 45.0 },
    { name: 'Alfirk', ra: 21.4777, dec: 70.5608, mag: 3.23, wikidata: 'Q67622053', ly: 690 },
    { name: 'Sulafat', ra: 18.9824, dec: 32.6894, mag: 3.24, wikidata: 'Q1334044', ly: 657 },
    { name: 'Yed Posterior', ra: 16.3054, dec: -4.6925, mag: 3.24, wikidata: 'Q1347738', ly: 107 },
    { name: 'Kaus Media', ra: 18.3499, dec: -29.8281, mag: 2.7, wikidata: 'Q14038', ly: 416 },
    { name: 'Theta Aquilae', ra: 20.1884, dec: -0.8214, mag: 3.24, wikidata: 'Q15825', ly: 229 },
    { name: 'Eta Geminorum', ra: 6.248, dec: 22.5067, mag: 3.28, wikidata: 'Q505752', ly: 689 },
    { name: 'Sigma Librae', ra: 15.0678, dec: -25.2819, mag: 3.29, wikidata: 'Q15719', ly: 260 },
    { name: 'Megrez', ra: 12.2571, dec: 57.0326, mag: 3.31, wikidata: 'Q850779', ly: 80.9 },
    { name: 'Chertan', ra: 11.2373, dec: 15.4297, mag: 3.32, wikidata: 'Q14206', ly: 161 },
    { name: 'Tau Sagittarii', ra: 19.1157, dec: -27.6706, mag: 3.32, wikidata: 'Q3179839', ly: 115 },
    { name: 'Delta Aquilae', ra: 19.425, dec: 3.1147, mag: 3.36, wikidata: 'Q949903', ly: 50.6 },
    { name: 'Xi Geminorum', ra: 6.7548, dec: 12.8956, mag: 3.36, wikidata: 'Q450766', ly: 60.2 },
    { name: 'Epsilon Cassiopeiae', ra: 1.9066, dec: 63.67, mag: 3.37, wikidata: 'Q13602', ly: 466 },
    { name: 'Zeta Virginis', ra: 13.5782, dec: -0.5958, mag: 3.38, wikidata: 'Q14199', ly: 74.6 },
    { name: 'Delta Virginis', ra: 12.9267, dec: 3.3975, mag: 3.38, wikidata: 'Q14200', ly: 187 },
    { name: 'Meissa', ra: 5.5856, dec: 9.9342, mag: 3.39, wikidata: 'Q14219', ly: 1040 },
    { name: 'Theta2 Tauri', ra: 4.4777, dec: 15.8708, mag: 3.4, wikidata: 'Q1151577', ly: 150 },
    { name: 'Homam', ra: 22.691, dec: 10.8314, mag: 3.4, wikidata: 'Q607426', ly: 228 },
    { name: 'Adhafera', ra: 10.2782, dec: 23.4172, mag: 3.44, wikidata: 'Q14207', ly: 232 },
    { name: 'Delta Bootis', ra: 15.2584, dec: 33.3147, mag: 3.47, wikidata: 'Q14023', ly: 120 },
    { name: 'Gamma Ceti', ra: 2.7217, dec: 3.2358, mag: 3.47, wikidata: 'Q15819', ly: 79.6 },
    { name: 'Nekkar', ra: 15.0324, dec: 40.3906, mag: 3.49, wikidata: 'Q14025', ly: 235 },
    { name: 'Eta Leonis', ra: 10.1222, dec: 16.7628, mag: 3.51, wikidata: 'Q14208', ly: 1270 },
    { name: 'Sheliak', ra: 18.8347, dec: 33.3628, mag: 3.52, wikidata: 'Q13352', ly: 906 },
    { name: 'Wasat', ra: 7.3354, dec: 21.9822, mag: 3.53, wikidata: 'Q505787', ly: 56.5 },
    { name: 'Ain', ra: 4.4769, dec: 19.1806, mag: 3.53, wikidata: 'Q405857', ly: 146 },
    { name: 'Hyadum I', ra: 4.3299, dec: 15.6278, mag: 3.65, wikidata: 'Q1493218', ly: 151 },
    { name: 'Thuban', ra: 14.0732, dec: 64.3758, mag: 3.65, wikidata: 'Q15714', ly: 261 },
    { name: 'Nusakan', ra: 15.4638, dec: 29.1058, mag: 3.66, wikidata: 'Q830861', ly: 117 },
    { name: 'Alshain', ra: 19.9219, dec: 6.4067, mag: 3.71, wikidata: 'Q78181697', ly: 4250 },
    { name: 'Delta Tauri', ra: 4.3822, dec: 17.5425, mag: 3.76, wikidata: 'Q42297791', ly: 161 },
    { name: 'Mekbuda', ra: 7.0685, dec: 20.5703, mag: 3.79, wikidata: 'Q502119', ly: 1060 },
    { name: 'Delta Andromedae', ra: 0.6555, dec: 30.8611, mag: 3.27, wikidata: 'Q13061', ly: 103 },
    { name: 'Rasalas', ra: 9.8794, dec: 26.0069, mag: 3.88, wikidata: 'Q1153864', ly: 125 },
    { name: 'Epsilon Ursae Minoris', ra: 16.7661, dec: 82.0372, mag: 4.21, wikidata: 'Q14064', ly: 331 },
    { name: 'Zeta Ursae Minoris', ra: 15.7343, dec: 77.7944, mag: 4.32, wikidata: 'Q14065', ly: 337 },
    { name: 'Delta Ursae Minoris', ra: 17.5369, dec: 86.5864, mag: 4.36, wikidata: 'Q14066', ly: 182 },
    { name: 'Eta Ursae Minoris', ra: 16.2918, dec: 75.7553, mag: 4.95, wikidata: 'Q14067', ly: 97.6 },
    { name: 'Pi Puppis', ra: 7.2857, dec: -37.0975, mag: 2.71, wikidata: 'Q14054', ly: 807 }
];

export const FIGURES: CatalogueFigure[] = [
    {
        name: 'Orion',
        wikidata: 'Q8860',
        segments: [
            ['Betelgeuse', 'Bellatrix'],
            ['Bellatrix', 'Mintaka'],
            ['Mintaka', 'Alnilam'],
            ['Alnilam', 'Alnitak'],
            ['Alnitak', 'Betelgeuse'],
            ['Mintaka', 'Rigel'],
            ['Alnitak', 'Saiph'],
            ['Rigel', 'Saiph'],
            ['Betelgeuse', 'Meissa'],
            ['Meissa', 'Bellatrix'],
            ['Alnilam', 'Hatysa']
        ]
    },
    {
        name: 'Ursa Major',
        wikidata: 'Q8918',
        segments: [
            ['Alkaid', 'Mizar'],
            ['Mizar', 'Alioth'],
            ['Alioth', 'Megrez'],
            ['Megrez', 'Phecda'],
            ['Phecda', 'Merak'],
            ['Merak', 'Dubhe'],
            ['Dubhe', 'Megrez']
        ]
    },
    {
        name: 'Ursa Minor',
        wikidata: 'Q10478',
        segments: [
            ['Polaris', 'Delta Ursae Minoris'],
            ['Delta Ursae Minoris', 'Epsilon Ursae Minoris'],
            ['Epsilon Ursae Minoris', 'Zeta Ursae Minoris'],
            ['Zeta Ursae Minoris', 'Kochab'],
            ['Kochab', 'Pherkad'],
            ['Pherkad', 'Eta Ursae Minoris'],
            ['Eta Ursae Minoris', 'Zeta Ursae Minoris']
        ]
    },
    {
        name: 'Cassiopeia',
        wikidata: 'Q10464',
        segments: [
            ['Caph', 'Schedar'],
            ['Schedar', 'Navi'],
            ['Navi', 'Ruchbah'],
            ['Ruchbah', 'Epsilon Cassiopeiae']
        ]
    },
    {
        name: 'Cygnus',
        wikidata: 'Q8921',
        segments: [
            ['Deneb', 'Sadr'],
            ['Sadr', 'Albireo'],
            ['Aljanah', 'Sadr'],
            ['Sadr', 'Delta Cygni']
        ]
    },
    {
        name: 'Lyra',
        wikidata: 'Q10484',
        segments: [
            ['Vega', 'Sheliak'],
            ['Sheliak', 'Sulafat'],
            ['Sulafat', 'Vega']
        ]
    },
    {
        name: 'Aquila',
        wikidata: 'Q10586',
        segments: [
            ['Tarazed', 'Altair'],
            ['Altair', 'Alshain'],
            ['Tarazed', 'Zeta Aquilae'],
            ['Altair', 'Delta Aquilae'],
            ['Delta Aquilae', 'Theta Aquilae']
        ]
    },
    {
        name: 'Scorpius',
        wikidata: 'Q8865',
        segments: [
            ['Dschubba', 'Acrab'],
            ['Dschubba', 'Pi Scorpii'],
            ['Dschubba', 'Antares'],
            ['Antares', 'Tau Scorpii'],
            ['Tau Scorpii', 'Larawag'],
            ['Larawag', 'Mu Scorpii'],
            ['Mu Scorpii', 'Sargas'],
            ['Sargas', 'Iota Scorpii'],
            ['Iota Scorpii', 'Girtab'],
            ['Girtab', 'Shaula'],
            ['Shaula', 'Lesath']
        ]
    },
    {
        name: 'Sagittarius',
        wikidata: 'Q8866',
        segments: [
            ['Alnasl', 'Kaus Media'],
            ['Kaus Australis', 'Kaus Media'],
            ['Kaus Media', 'Kaus Borealis'],
            ['Kaus Borealis', 'Nunki'],
            ['Nunki', 'Ascella'],
            ['Ascella', 'Kaus Australis'],
            ['Nunki', 'Tau Sagittarii'],
            ['Tau Sagittarii', 'Phi Sagittarii'],
            ['Phi Sagittarii', 'Kaus Borealis']
        ]
    },
    {
        name: 'Leo',
        wikidata: 'Q8853',
        segments: [
            ['Regulus', 'Eta Leonis'],
            ['Eta Leonis', 'Algieba'],
            ['Algieba', 'Adhafera'],
            ['Adhafera', 'Rasalas'],
            ['Rasalas', 'Epsilon Leonis'],
            ['Algieba', 'Zosma'],
            ['Zosma', 'Denebola'],
            ['Denebola', 'Chertan'],
            ['Chertan', 'Regulus']
        ]
    },
    {
        name: 'Taurus',
        wikidata: 'Q10570',
        segments: [
            ['Elnath', 'Ain'],
            ['Ain', 'Aldebaran'],
            ['Aldebaran', 'Theta2 Tauri'],
            ['Theta2 Tauri', 'Hyadum I'],
            ['Aldebaran', 'Delta Tauri'],
            ['Zeta Tauri', 'Aldebaran']
        ]
    },
    {
        name: 'Gemini',
        wikidata: 'Q8923',
        segments: [
            ['Castor', 'Pollux'],
            ['Castor', 'Mebsuta'],
            ['Mebsuta', 'Tejat'],
            ['Tejat', 'Eta Geminorum'],
            ['Pollux', 'Wasat'],
            ['Wasat', 'Mekbuda'],
            ['Mekbuda', 'Alhena'],
            ['Wasat', 'Xi Geminorum']
        ]
    },
    {
        name: 'Canis Major',
        wikidata: 'Q10538',
        segments: [
            ['Mirzam', 'Sirius'],
            ['Sirius', 'Wezen'],
            ['Wezen', 'Adhara'],
            ['Adhara', 'Mirzam'],
            ['Wezen', 'Aludra']
        ]
    },
    {
        name: 'Bootes',
        wikidata: 'Q8667',
        segments: [
            ['Arcturus', 'Izar'],
            ['Izar', 'Seginus'],
            ['Seginus', 'Nekkar'],
            ['Nekkar', 'Delta Bootis'],
            ['Delta Bootis', 'Izar'],
            ['Arcturus', 'Muphrid']
        ]
    },
    {
        name: 'Crux',
        wikidata: 'Q10542',
        segments: [
            ['Acrux', 'Gacrux'],
            ['Mimosa', 'Delta Crucis']
        ]
    },
    {
        name: 'Centaurus',
        wikidata: 'Q8844',
        segments: [
            ['Rigil Kentaurus', 'Hadar'],
            ['Hadar', 'Epsilon Centauri'],
            ['Epsilon Centauri', 'Muhlifain'],
            ['Muhlifain', 'Menkent'],
            ['Menkent', 'Eta Centauri'],
            ['Eta Centauri', 'Hadar']
        ]
    },
    {
        name: 'Pegasus',
        wikidata: 'Q8864',
        segments: [
            ['Markab', 'Scheat'],
            ['Scheat', 'Alpheratz'],
            ['Alpheratz', 'Algenib'],
            ['Algenib', 'Markab'],
            ['Markab', 'Homam'],
            ['Scheat', 'Matar'],
            ['Homam', 'Enif']
        ]
    },
    {
        name: 'Andromeda',
        wikidata: 'Q9256',
        segments: [
            ['Alpheratz', 'Delta Andromedae'],
            ['Delta Andromedae', 'Mirach'],
            ['Mirach', 'Almach']
        ]
    },
    {
        name: 'Auriga',
        wikidata: 'Q10476',
        segments: [
            ['Capella', 'Menkalinan'],
            ['Menkalinan', 'Theta Aurigae'],
            ['Theta Aurigae', 'Elnath'],
            ['Elnath', 'Hassaleh'],
            ['Hassaleh', 'Epsilon Aurigae'],
            ['Epsilon Aurigae', 'Capella']
        ]
    },
    {
        name: 'Perseus',
        wikidata: 'Q10511',
        segments: [
            ['Mirfak', 'Algol'],
            ['Algol', 'Zeta Persei'],
            ['Mirfak', 'Delta Persei'],
            ['Delta Persei', 'Epsilon Persei'],
            ['Mirfak', 'Gamma Persei']
        ]
    },
    {
        name: 'Virgo',
        wikidata: 'Q8842',
        segments: [
            ['Spica', 'Zeta Virginis'],
            ['Zeta Virginis', 'Porrima'],
            ['Porrima', 'Delta Virginis'],
            ['Delta Virginis', 'Vindemiatrix']
        ]
    },
    {
        name: 'Aries',
        wikidata: 'Q10584',
        segments: [['Hamal', 'Sheratan']]
    },
    {
        name: 'Cepheus',
        wikidata: 'Q10468',
        segments: [
            ['Alderamin', 'Alfirk'],
            ['Alfirk', 'Errai'],
            ['Errai', 'Alderamin']
        ]
    },
    {
        name: 'Draco',
        wikidata: 'Q8675',
        segments: [
            ['Eltanin', 'Rastaban'],
            ['Rastaban', 'Zeta Draconis'],
            ['Zeta Draconis', 'Delta Draconis'],
            ['Delta Draconis', 'Thuban']
        ]
    },
    {
        name: 'Corona Borealis',
        wikidata: 'Q10406',
        segments: [['Alphecca', 'Nusakan']]
    },
    {
        name: 'Canis Minor',
        wikidata: 'Q9305',
        segments: [['Procyon', 'Gomeisa']]
    },
    {
        name: 'Ophiuchus',
        wikidata: 'Q8906',
        segments: [
            ['Rasalhague', 'Cebalrai'],
            ['Cebalrai', 'Sabik'],
            ['Sabik', 'Zeta Ophiuchi'],
            ['Zeta Ophiuchi', 'Yed Prior'],
            ['Yed Prior', 'Yed Posterior'],
            ['Yed Prior', 'Rasalhague']
        ]
    },
    {
        name: 'Libra',
        wikidata: 'Q10580',
        segments: [
            ['Zubeneschamali', 'Zubenelgenubi'],
            ['Zubenelgenubi', 'Sigma Librae'],
            ['Sigma Librae', 'Zubeneschamali']
        ]
    },
    {
        name: 'Carina',
        wikidata: 'Q10470',
        segments: [
            ['Canopus', 'Avior'],
            ['Avior', 'Aspidiske'],
            ['Aspidiske', 'Miaplacidus']
        ]
    },
    {
        name: 'Vela',
        wikidata: 'Q10521',
        segments: [
            ['Regor', 'Markeb'],
            ['Markeb', 'Alsephina'],
            ['Alsephina', 'Suhail'],
            ['Suhail', 'Regor']
        ]
    }
];

/** In the order of `PLANET_ELEMENTS` in astronomy.ts. */
export const PLANETS: CataloguePlanet[] = [
    { key: 'mercury', wikidata: 'Q308', colour: [220, 220, 230] },
    { key: 'venus', wikidata: 'Q313', colour: [255, 250, 220] },
    { key: 'mars', wikidata: 'Q111', colour: [255, 130, 90] },
    { key: 'jupiter', wikidata: 'Q319', colour: [255, 235, 180] },
    { key: 'saturn', wikidata: 'Q193', colour: [240, 220, 160] }
];

export const SUN_WIKIDATA = 'Q525';
export const MOON_WIKIDATA = 'Q405';
