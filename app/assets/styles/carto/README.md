#Mobile SDK Styles

Vector map style sources for mobile-sdk

Copyright CartoDB Inc, 2017

## Editing

* Experimental: use https://github.com/CartoDB/mobile-style-editor mobile app to view and edit styles
* If not available, edit with text editor
* No web-based editor 
* Common CartoCSS editors like CARTO Builder, MB Studio Classic etc **do not support** some mobile SDK parameters and will reject CSS

## Updating

1. cleanup style files.
2. zip the folder
3. test the zip file with mobile SDK, as custom style
4. copy to https://github.com/CartoDB/mobile-sdk/tree/master/assets
5. generate assets using https://github.com/CartoDB/mobile-sdk/blob/master/scripts/generate-assets.sh script
6. recompile mobile SDK
