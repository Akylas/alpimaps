// The text faces come from the DEVICE - the style packages none. The SDK resolves an unpackaged
// face-name through SystemFontUtils, which reads a trailing weight and style off the name: on iOS
// CoreText answers 'Helvetica Neue Medium' with HelveticaNeue-Medium, on Android the alias table
// maps the family to Roboto and the suffixes pick Roboto-Medium. 'Helvetica Neue Regular' would
// drop to plain Helvetica on iOS, so the regular weight is the bare family name.
@font_face:'Helvetica Neue';
@mont: @font_face;
@mont_md: @font_face + ' Medium';
@mont_bd: @font_face + ' Bold';
@mont_it: @font_face + ' Medium Italic';

@standard-halo-radius: 2;
@standard-halo-fill: #f2f5f8;
@wrap_characters: '-_';
