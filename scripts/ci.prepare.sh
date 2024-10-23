#!/usr/bin/env bash

for i in "$@"; do
  case $i in
    -p|--platform)
      PLATFORM="$2"
      shift # past argument
      shift # past value
      ;;
    -v|--version)
      VERSION="$2"
      shift # past argument
      shift # past value
      ;;
    -f|--flavor)
      FLAVOR=YES
      shift # past argument
      shift # past value
      ;;
    -*|--*)
      echo "Unknown option $1"
      exit 1
      ;;
    *)
      ;;
  esac
done

if [[ -z "${CARTO_SDK_VERSION}" ]]; then
  CARTO_SDK_VERSION="5.0.0-rc.2"
else
  CARTO_SDK_VERSION="${CARTO_SDK_VERSION}"
fi

echo "PLATFORM  = ${PLATFORM}"
echo "VERSION   = ${VERSION}"
echo "FLAVOR    = ${FLAVOR}"
echo "FLAVOR    = $(dirname $0)"

git clone -b alpimaps https://github.com/nativescript-community/ui-carto.git

if ["${PLATFORM}" -eq "android"]
then
  wget https://github.com/Akylas/mobile-sdk/releases/download/v$CARTO_SDK_VERSION/carto-mobile-sdk-$CARTO_SDK_VERSION.aar
  mv carto-mobile-sdk-$CARTO_SDK_VERSION.aar ./ui-carto/packages/ui-carto/platforms/android
else
  wget https://github.com/Akylas/mobile-sdk/releases/download/v$CARTO_SDK_VERSION/carto-mobile-sdk-ios-$CARTO_SDK_VERSION.zip
  unzip -o-d ./ui-carto/packages/ui-carto/platforms/io carto-mobile-sdk-ios-$CARTO_SDK_VERSION.zip
fi

yarn link -r ./ui-carto/packages/ui-carto
