package akylas.alpi.maps;

import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

public class SphericalMercator {
    static Map<Integer, Map<String, ArrayList<Double>>> cache = new HashMap();
    static final double EPSLN = 1.0e-10;
    static final double D2R = Math.PI / 180;
    static final double R2D = 180 / Math.PI;
    // 900913 properties.
    static final double A = 6378137.0;
    static final double MAXEXTENT = 20037508.342789244;
    int size;
    // Closures including constants and other precalculated values.

    ArrayList<Double> Bc;
    ArrayList<Double> Cc;
    ArrayList<Double> zc;
    ArrayList<Double> Ac;

    // SphericalMercator constructor: precaches calculations
    // for fast tile lookups.
    SphericalMercator() {
        this(256);
    }

    SphericalMercator(int size) {
        this.size = size;
        if (!cache.containsKey(size)) {
            Map<String, ArrayList<Double>> c = new HashMap();
            ArrayList<Double> Bc = new ArrayList<Double>();
            ArrayList<Double> Cc = new ArrayList<Double>();
            ArrayList<Double> zc = new ArrayList<Double>();
            ArrayList<Double> Ac = new ArrayList<Double>();
            for (int d = 0; d < 30; d++) {
                Bc.add(size / 360.0);
                Cc.add(size / (2.0 * Math.PI));
                zc.add(size / 2.0);
                Ac.add(size * 1.0);
                size *= 2;
            }
            c.put("Bc", Bc);
            this.Bc = Bc;
            c.put("Cc", Cc);
            this.Cc = Cc;
            c.put("zc", zc);
            this.zc = zc;
            c.put("Ac", Ac);
            this.Ac = Ac;
            cache.put(size, c);
        } else {
            Map<String, ArrayList<Double>> c = cache.get(size);

            this.Bc = c.get("Bc");
            this.Cc = c.get("Cc");
            this.zc = c.get("zc");
            this.Ac = c.get("Ac");
        }
    }

    // Convert lon lat to screen pixel value
    //
    // - `ll` {Array} `[lon, lat]` array of geographic coordinates.
    // - `zoom` {Number} zoom level.
    // public int[] px(int[] ll, int zoom) {
    //     Double d = this.zc.get(zoom);
    //     double f = Math.min(Math.max(Math.sin(D2R * ll[1]), -0.9999), 0.9999);
    //     double x = d + ll[0] * this.Bc.get(zoom);
    //     double y = d + 0.5 * Math.log((1 + f) / (1 - f)) * -this.get(zoom);
    //     if (x > this.Ac.get(zoom)) {
    //         x = this.Ac.get(zoom);
    //     }
    //     if (y > this.Ac.get(zoom)) {
    //         y = this.Ac.get(zoom);
    //     }
    //     // (x < 0) && (x = 0);
    //     // (y < 0) && (y = 0);
    //     return new int[] { (int) x, (int) y };
    // }

    // Convert screen pixel value to lon lat
    //
    // - `px` {Array} `[x, y]` array of geographic coordinates.
    // - `zoom` {Number} zoom level.
    public double[] ll(double[] px, int zoom) {
        double g = (px[1] - this.zc.get(zoom)) / -this.Cc.get(zoom);
        double lon = (px[0] - this.zc.get(zoom)) / this.Bc.get(zoom);
        double lat = R2D * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
        return new double[] {  lon,  lat };
    }

    // Convert tile xyz value to bbox of the form `[w, s, e, n]`
    //
    // - `x` {Number} x (longitude) number.
    // - `y` {Number} y (latitude) number.
    // - `zoom` {Number} zoom.
    // - `tms_style` {Boolean} whether to compute using tms-style.
    // - `srs` {String} projection for resulting bbox (WGS84|900913).
    // - `return` {Array} bbox array of values in form `[w, s, e, n]`.
    // bbox(int x, int y, int zoom, boolean tms_style, srs) {
    // // Convert xyz into bbox with srs WGS84
    // if (tms_style) {
    // y = Math.pow(2, zoom) - 1 - y;
    // }
    // // Use +y to make sure it's a number to avoid inadvertent concatenation.
    // const ll = [x * this.size, (+y + 1) * this.size]; // lower left
    // // Use +x to make sure it's a number to avoid inadvertent concatenation.
    // const ur = [(+x + 1) * this.size, y * this.size]; // upper right
    // const bbox = this.ll(ll, zoom).concat(this.ll(ur, zoom));

    // // If web mercator requested reproject to 900913.
    // if (srs === '900913') {
    // return this.convert(bbox, '900913');
    // } else {
    // return bbox;
    // }
    // }

    // // Convert bbox to xyx bounds
    // //
    // // - `bbox` {Number} bbox in the form `[w, s, e, n]`.
    // // - `zoom` {Number} zoom.
    // // - `tms_style` {Boolean} whether to compute using tms-style.
    // // - `srs` {String} projection of input bbox (WGS84|900913).
    // // - `@return` {Object} XYZ bounds containing minX, maxX, minY, maxY
    // properties.
    // xyz(bbox, zoom, tms_style, srs) {
    // // If web mercator provided reproject to WGS84.
    // if (srs === '900913') {
    // bbox = this.convert(bbox, 'WGS84');
    // }

    // const ll = [bbox[0], bbox[1]]; // lower left
    // const ur = [bbox[2], bbox[3]]; // upper right
    // const px_ll = this.px(ll, zoom);
    // const px_ur = this.px(ur, zoom);
    // // Y = 0 for XYZ is the top hence minY uses px_ur[1].
    // const x = [Math.floor(px_ll[0] / this.size), Math.floor((px_ur[0] - 1) /
    // this.size)];
    // const y = [Math.floor(px_ur[1] / this.size), Math.floor((px_ll[1] - 1) /
    // this.size)];
    // const bounds = {
    // minX: Math.min.apply(Math, x) < 0 ? 0 : Math.min.apply(Math, x),
    // minY: Math.min.apply(Math, y) < 0 ? 0 : Math.min.apply(Math, y),
    // maxX: Math.max.apply(Math, x),
    // maxY: Math.max.apply(Math, y)
    // };
    // if (tms_style) {
    // const tms = {
    // minY: Math.pow(2, zoom) - 1 - bounds.maxY,
    // maxY: Math.pow(2, zoom) - 1 - bounds.minY
    // };
    // bounds.minY = tms.minY;
    // bounds.maxY = tms.maxY;
    // }
    // return bounds;
    // }

    // // Convert projection of given bbox.
    // //
    // // - `bbox` {Number} bbox in the form `[w, s, e, n]`.
    // // - `to` {String} projection of output bbox (WGS84|900913). Input bbox
    // // assumed to be the "other" projection.
    // // - `@return` {Object} bbox with reprojected coordinates.
    // convert(bbox, to) {
    // if (to === '900913') {
    // return this.forward(bbox.slice(0, 2)).concat(this.forward(bbox.slice(2, 4)));
    // } else {
    // return this.inverse(bbox.slice(0, 2)).concat(this.inverse(bbox.slice(2, 4)));
    // }
    // }

    // // Convert lon/lat values to 900913 x/y.
    // forward(ll) {
    // const xy = [A * ll[0] * D2R, A * Math.log(Math.tan(Math.PI * 0.25 + 0.5 *
    // ll[1] * D2R))];
    // // if xy value is beyond maxextent (e.g. poles), return maxextent.
    // xy[0] > MAXEXTENT && (xy[0] = MAXEXTENT);
    // xy[0] < -MAXEXTENT && (xy[0] = -MAXEXTENT);
    // xy[1] > MAXEXTENT && (xy[1] = MAXEXTENT);
    // xy[1] < -MAXEXTENT && (xy[1] = -MAXEXTENT);
    // return xy;
    // }

    // // Convert 900913 x/y values to lon/lat.
    // inverse(xy) {
    // return [(xy[0] * R2D) / A, (Math.PI * 0.5 - 2.0 * Math.atan(Math.exp(-xy[1] /
    // A))) * R2D];
    // }

}
