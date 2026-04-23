# API Keys

Some map providers require an API key or access token to serve tiles. AlpiMaps makes it easy to configure these in **Settings → API Keys**.

## AmericanaOSM

The default vector map style. Rather than a classic API key, this requires a **CloudFront URL** pointing to your own instance of the Protomaps tile server on AWS.

**How to set up a free personal instance:**

1. Create an [AWS account](https://aws.amazon.com/) (free tier is sufficient)
2. Follow the [Protomaps CloudFormation guide](https://docs.protomaps.com/deploy/aws#_2-cloudformation-template)
   - Section **"CloudFormation Template"** only — you do not need to do anything else
   - Set `BucketName = osmus-tile`
   - Create the stack in the **`us-east-2` region** ⚠️ (important — other regions will not work)
3. Wait for the stack to be created (a few minutes)
4. Go to the stack **Outputs** tab in the AWS Console
5. Copy the `LambdaFunctionUrl` — it will look like `https://XXXXXXXX.cloudfront.net`
6. In AlpiMaps: **Settings → API Keys → americanaosm** → paste the URL

> **Tip:** Set up a billing alert on AWS so you get notified if you approach the free tier limit. Follow [this guide](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html).

---

## MapTiler

MapTiler provides high-quality vector and raster tiles, including OpenStreetMap-based and satellite styles.

1. Create a free account at [maptiler.com](https://www.maptiler.com/)
2. Navigate to **Account → Keys** and create a new key
3. Enter the key in **Settings → API Keys → maptiler**

---

## Mapbox

Mapbox provides vector tiles and a variety of premium styles.

1. Sign up at [mapbox.com](https://www.mapbox.com/)
2. Go to **Account → Access tokens** and copy your default public token (or create a new one)
3. Enter the token in **Settings → API Keys → mapbox**

---

## Thunderforest

Thunderforest offers outdoor-focused styles like OpenCycleMap, Landscape and Pioneer.

1. Register at [thunderforest.com](https://www.thunderforest.com/)
2. Go to **Dashboard** and copy your API key
3. Enter it in **Settings → API Keys → thunderforest**

---

## IGN (France)

IGN provides official French government maps including the detailed topographic IGN maps, Plan V2 and more.

IGN tiles are now available **free of charge** via the Géoportail API with no key required for most layers. However, some layers may require a key for higher usage:

1. Register at [geoservices.ign.fr](https://geoservices.ign.fr/)
2. Create an API key with access to the WMTS service
3. Enter it in **Settings → API Keys → ign**

If you leave the IGN key empty, public layers (Plan V2, etc.) will still work at normal usage levels.

---

## HERE Maps

HERE provides a range of mapping, routing and geocoding services.

1. Sign up at [developer.here.com](https://developer.here.com/)
2. Create a project and generate `APP_ID` and `APP_CODE` credentials
3. Enter them in **Settings → API Keys → here_appid** and **here_appcode**

---

## MapQuest

1. Register at [developer.mapquest.com](https://developer.mapquest.com/)
2. Create an app and copy the consumer key
3. Enter it in **Settings → API Keys → mapquest**

---

## CARTO

CARTO provides basemaps and spatial data services.

1. Sign up at [carto.com](https://carto.com/)
2. Go to your account API keys
3. Enter it in **Settings → API Keys → carto**

---

## Which Keys Do I Need?

You do not need any API keys to use AlpiMaps with the freely available tile sources (OpenStreetMap, OpenTopoMap, Refuges.info, etc.). API keys unlock access to premium providers that require authentication.

For most users the recommended setup is:

1. Set up a free **AmericanaOSM** instance (the best default vector style)
2. Optionally add **MapTiler** or **Thunderforest** for premium styles

All other functionality (offline maps, routing, elevation, search, GPS tools) works without any API key.
