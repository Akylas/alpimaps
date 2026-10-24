package akylas.alpi.maps;

import com.massifmaps.api.Massif;
import com.massifmaps.api.MassifApi;
import com.massifmaps.api.MassifObject;
import com.massifmaps.api.Spec;

import java.util.concurrent.atomic.AtomicInteger;

/** What the tile server and the web view client need from the SDK, through the surface API: source handles in, bytes and GeoJSON out. */
final class TileSupport {
    private static final AtomicInteger counter = new AtomicInteger();
    private static final String PEAKS_STYLE_ID = "alpi-tile-support-peaks-style";
    private static final String WGS84_ID = "alpi-tile-support-wgs84";

    private TileSupport() {
    }

    static double tile2lon(int x, int z) {
        return x / Math.pow(2, z) * 360.0 - 180.0;
    }

    static double tile2lat(int y, int z) {
        double n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return Math.toDegrees(Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    /** The tile's bytes, or null when the source has none. Blocks: a network source does I/O here. */
    static byte[] loadTile(int source, int x, int y, int z) {
        if (source == 0) {
            return null;
        }
        int result = MassifApi.call(source, "loadTile", "[[" + x + "," + y + "," + z + "]]");
        if (result == 0) {
            return null;
        }
        try {
            byte[] data = MassifApi.getData(result, "data");
            return data != null && data.length > 0 ? data : null;
        } finally {
            MassifApi.destroy(result);
        }
    }

    private static synchronized void ensureShared() {
        if (!Massif.has("style", PEAKS_STYLE_ID)) {
            Massif.style(PEAKS_STYLE_ID, Spec.of("mbvt").set("cartocss",
                Spec.of("cartocss").set("css", "#mountain_peak { text-name: [name];}")));
        }
        if (!Massif.has("projection", WGS84_ID)) {
            Massif.object("projection", WGS84_ID, Spec.of("EPSG:4326"));
        }
    }

    /** The mountain peaks of one tile of a vector source, as a GeoJSON FeatureCollection in WGS84. */
    static String peaksGeoJson(int source, int x, int y, int z) {
        ensureShared();
        int id = counter.incrementAndGet();
        String serviceId = "alpi-tile-support-service-" + id;
        String geometryId = "alpi-tile-support-geometry-" + id;
        String requestId = "alpi-tile-support-request-" + id;
        double west = tile2lon(x, z);
        double east = tile2lon(x + 1, z);
        double north = tile2lat(y, z);
        double south = tile2lat(y + 1, z);
        try {
            MassifObject service = Massif.object("search", serviceId, Spec.of("vectortile")
                .set("source", source).set("style", PEAKS_STYLE_ID).set("minZoom", z).set("maxZoom", z));
            MassifObject geometry = Massif.object("geometry", geometryId, Spec.of("polygon").set("poses", new double[][] {
                { west, north }, { west, south }, { east, south }, { east, north }, { west, north } }));
            MassifObject request = Massif.object("search", requestId, Spec.of("request")
                .set("filterExpression", "layer::name='mountain_peak'"));
            request.set("geometry", geometry).set("projection", Massif.find("projection", WGS84_ID));
            MassifObject found = service.call("findFeatures", request.handle());
            try {
                // The tiles are in the source's own projection; the page wants WGS84.
                MassifObject geoJson = found.call("toGeoJSON", MassifApi.getObject(source, "projection"));
                try {
                    return geoJson.json();
                } finally {
                    geoJson.close();
                }
            } finally {
                found.close();
            }
        } finally {
            Massif.destroy("search", requestId);
            Massif.destroy("geometry", geometryId);
            Massif.destroy("search", serviceId);
        }
    }
}
