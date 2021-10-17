package akylas.alpi.maps;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Arrays;
import java.lang.Exception;

import fi.iki.elonen.NanoHTTPD;

import com.carto.core.MapPos;
import com.carto.core.MapPosVector;
import com.carto.core.MapTile;
import com.carto.core.BinaryData;
import com.carto.datasources.TileDataSource;
import com.carto.datasources.components.TileData;
import com.carto.geometry.GeoJSONGeometryWriter;
import com.carto.geometry.PolygonGeometry;
import com.carto.geometry.VectorTileFeatureCollection;
import com.carto.projections.EPSG4326;
import com.carto.search.SearchRequest;
import com.carto.search.VectorTileSearchService;
import com.carto.styles.CartoCSSStyleSet;
import com.carto.vectortiles.MBVectorTileDecoder;
import com.carto.core.MapBounds;

import android.util.Log;

public class WebServer extends NanoHTTPD {
    TileDataSource heightDataSource;
    TileDataSource peaksDataSource;
    TileDataSource contoursDataSource;
    TileDataSource rasterDataSource;
    MBVectorTileDecoder decoder;
    EPSG4326 projection;
    GeoJSONGeometryWriter geojsonWriter;

    private double tile2lon(int x, int z) {
        return x / Math.pow(2, z) * 360.0f - 180.0f;
    }
    private static final double r2d = 180 / Math.PI;
    private double tile2lat(int y, int z) {
        double n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }
    private double[] tileToBBOX(int x, int y, int z) {
        double e = tile2lon(x + 1, z);
        double w = tile2lon(x, z);
        double s = tile2lat(y + 1, z);
        double n = tile2lat(y, z);
        return new double[] {w, s, e, n};
    }

    public WebServer(int port, TileDataSource heightDataSource, TileDataSource peaksDataSource, TileDataSource contoursDataSource, TileDataSource rasterDataSource) {
        super(port);
        this.heightDataSource = heightDataSource;
        this.peaksDataSource = peaksDataSource;
        this.rasterDataSource = rasterDataSource;
        this.contoursDataSource = contoursDataSource;
        decoder = new MBVectorTileDecoder(new CartoCSSStyleSet("#mountain_peak { text-name: [name];}"));
        projection = new EPSG4326();
        geojsonWriter = new GeoJSONGeometryWriter();
        geojsonWriter.setSourceProjection(peaksDataSource.getProjection());
    }

    @Override
    public NanoHTTPD.Response serve(NanoHTTPD.IHTTPSession session) {
        String uri = session.getUri();
        NanoHTTPD.Method method = session.getMethod();
        Map<String, String> parms = session.getParms();
        final String source = parms.get("source");
        final String imageFormat = parms.containsKey("format") ? parms.get("format") : "png";

        TileDataSource dataSource = null;


        switch (source) {
            case "raster":
                dataSource = rasterDataSource;
                break;
            case "height":
                dataSource = heightDataSource;
                break;
            case "contours":
                dataSource = contoursDataSource;
                break;
            case "peaks":
            case "data":
            default:
                dataSource = peaksDataSource;
                break;
        }
        if (dataSource == null) {
            return newFixedLengthResponse(NanoHTTPD.Response.Status.NOT_FOUND, "text/plain", "source not found: " + source);
        }

        int z = Integer.parseInt(parms.get("z"));
        int x = Integer.parseInt(parms.get("x"));
        int y = Integer.parseInt(parms.get("y"));


        if (source.equals("peaks")) {
            try {
                double[] bbox = tileToBBOX(x, y, z);
                MapPosVector poses = new MapPosVector();
                poses.add(new MapPos(bbox[0], bbox[3], 0));
                poses.add(new MapPos(bbox[0], bbox[1], 0));
                poses.add(new MapPos(bbox[2], bbox[1], 0));
                poses.add(new MapPos(bbox[2], bbox[3], 0));
                poses.add(new MapPos(bbox[0], bbox[3], 0));
                PolygonGeometry geometry = new PolygonGeometry(poses);
                MapBounds bounds  = geometry.getBounds();
                VectorTileSearchService searchService = new VectorTileSearchService(dataSource,
                        decoder);
                searchService.setMinZoom(z);
                searchService.setMaxZoom(z);
                SearchRequest searchRequest = new SearchRequest();
                searchRequest.setProjection(projection);
                searchRequest.setGeometry(geometry);
                searchRequest.setFilterExpression("layer::name='mountain_peak'");
                VectorTileFeatureCollection result = searchService.findFeatures(searchRequest);
                geojsonWriter.writeFeatureCollection(result);
    
                return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "plain/text", geojsonWriter.writeFeatureCollection(result));
            } catch(Exception exception) {
                return NanoHTTPD.newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "plain/text", exception.toString());
            }
            
        }

        TileData tileData = dataSource.loadTile(new MapTile(x, y, z, 0));
        if (tileData == null) {
            return newFixedLengthResponse(NanoHTTPD.Response.Status.NOT_FOUND, "text/plain", "not found");
        }
        BinaryData binaryData = tileData.getData();
        if (binaryData == null) {
            return newFixedLengthResponse(NanoHTTPD.Response.Status.NOT_FOUND, "text/plain", "not found");
        }
        byte[] binaryDataData = binaryData.getData();
        InputStream targetStream = new ByteArrayInputStream(binaryDataData);
        if (source.equals("data") || source.equals("contours")) {
            return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "application/x-protobuf", targetStream,
                binaryDataData.length);
        }
        return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "image/" + imageFormat, targetStream,
                binaryDataData.length);
    }
}
