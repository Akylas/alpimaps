#!/bin/bash

function usage() {
	echo "usage: $0 <image-filename> [--output=output-directory]";
	exit 1;
}

image=""
output="."
width="-1"
height="-1"
density="-1"
outputExt=""
platform="all"

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output=*)
      output="$2"
      ;;
    -w|--width=*)
      width="$2"
      ;;
    -e|--ext=*)
      outputExt="$2"
      ;;
    -h|--height=*)
      height="$2"
      ;;
    -d|--density=*)
      density="$2"
      ;;
    -p|--platform=*)
      platform="$2"
      ;;
    *)
	  image="$1"
  esac
  shift
done
[ "$image" ] || usage

nameWithExt=${image##*/}
name=${nameWithExt%.*}
extension="${nameWithExt##*.}"

devices=iOS,Android #,windows-phone,bada,bada-wac,blackberry,webos
eval mkdir -p "$output/{$devices}"

# Show the user some progress by outputing all commands being run.
# set -x

# Setting IFS (input field separator) value as ","
IFS='x'

# Reading the split string into array

if [ "$extension" = "svg" ]; then
	if [ "$outputExt" = "" ]; then
		outputExt="png"
	fi
	TEMP_DIR=`mktemp -d`
	echo "converting svg image $width $height"
	if [ "$width" -gt "0" ] && [ "$height" -gt "0" ]; then
		rsvg-convert -h $height -w $width "$image" > $TEMP_DIR/$name.$outputExt
	elif [ "$height" -gt "0" ]; then
		rsvg-convert -h $height "$image" > $TEMP_DIR/$name.$outputExt
	elif [ "$width" -gt "0" ]; then
		rsvg-convert -w $width "$image" > $TEMP_DIR/$name.$outputExt
	fi

	image="$TEMP_DIR/$name.$outputExt"
	echo "svgGeneratedImage $image"
fi
echo "image $image"
imageSize=$(convert "$image" -format "%wx%h" info:)
read -ra sizes <<< "$imageSize"

echo "width $width"
echo "height $height"
echo "image $image"

if [ "$width" -gt "0" ]; then
	echo "hanlding width $width"
  	echo "sizes[0] ${sizes[0]}"
  	echo "sizes[1] ${sizes[1]}"
	ratio="$(echo "(`expr ${sizes[0]}` / `expr ${sizes[1]}`)" | bc -l)"
  	echo "ratio $ratio"
	sizes[0]=$width
	sizes[1]="$(echo "(`expr $width` / `expr $ratio`+0.5)/1" | bc )"
fi
if [ "$height" -gt "0" ]; then
	echo "hanlding height $height"
  	echo "sizes[0] ${sizes[0]}"
  	echo "sizes[1] ${sizes[1]}"
	ratio="$(echo "(`expr ${sizes[0]}` / `expr ${sizes[1]}`)" | bc -l)"
  	echo "ratio $ratio"
	sizes[1]=$height
	sizes[0]="$(echo "(`expr $height` * `expr $ratio`+0.5)/1" | bc )"
  	echo "width ${sizes[0]}"
  	echo "height ${sizes[1]}"
fi

function convertImage() {
	local factor="$1"
	local output="$2"
	
	convert "$image" -background none -density "$density" -resize "$(getSize $factor)" "$output"
	# opti "$output"
}
function getSize() {
	local factor="$1"
	echo "$(echo "(`expr ${sizes[0]}`* $factor+0.5)/1" | bc)x$(echo "(`expr ${sizes[1]}`* $factor+0.5)/1" | bc)"
}

function opti() {
  optipng -nb -nc "$*";
  advpng -z4 "$*";
  pngcrush -rem gAMA -rem alla -rem cHRM -rem iCCP -rem sRGB -rem time -ow "$*";
}

function androidConvertIcon() {
	echo "androidConvertIcon"
	drawables=drawable,drawable-ldpi,drawable-mdpi,drawable-hdpi,drawable-xhdpi,drawable-xxhdpi,drawable-xxxhdpi
	eval mkdir -p "$output/Android/src/main/res/{$drawables}"

	convertImage "0.1875" "$output/Android/src/main/res/drawable-ldpi/$name.$outputExt"
	convertImage "0.25" "$output/Android/src/main/res/drawable-mdpi/$name.$outputExt"
	convertImage "0.375" "$output/Android/src/main/res/drawable-hdpi/$name.$outputExt"
	convertImage "0.5" "$output/Android/src/main/res/drawable-xhdpi/$name.$outputExt"
	convertImage "0.75" "$output/Android/src/main/res/drawable-xxhdpi/$name.$outputExt"
	convertImage "1" "$output/Android/src/main/res/drawable-xxxhdpi/$name.$outputExt"
}

function iosConvertIcon() {
	echo "iosConvertIcon $output"
	convertImage "0.33" "$output/iOS/$name.$outputExt"
	convertImage "0.66" "$output/iOS/$name@2x.$outputExt"
	convertImage "1" "$output/iOS/$name@3x.$outputExt"
}
if [ "$outputExt" = "" ]; then
	outputExt="$extension"
fi

if [[ "$platform" == "all" || "$platform" == "android" ]]; then
	androidConvertIcon
fi
if [[ "$platform" == "all" || "$platform" == "ios" ]]; then
	iosConvertIcon
fi