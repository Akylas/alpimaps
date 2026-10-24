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

import android.util.Log;

public class WebServer extends NanoHTTPD {
    // Handles of the SDK's tile sources, 0 for none.
    final int heightSource;
    final int peaksSource;
    final int contoursSource;
    final int rasterSource;

    public WebServer(int port, int heightSource, int peaksSource, int contoursSource, int rasterSource) {
        super(port);
        this.heightSource = heightSource;
        this.rasterSource = rasterSource;
        this.contoursSource = contoursSource;
        this.peaksSource = peaksSource;
    }

    @Override
    public NanoHTTPD.Response serve(NanoHTTPD.IHTTPSession session) {
        Map<String, String> parms = session.getParms();
        final String source = parms.get("source");
        final String imageFormat = parms.containsKey("format") ? parms.get("format") : "png";

        int dataSource;
        switch (source) {
            case "raster":
                dataSource = rasterSource;
                break;
            case "height":
                dataSource = heightSource;
                break;
            case "contours":
                dataSource = contoursSource;
                break;
            case "peaks":
            case "data":
            default:
                dataSource = peaksSource;
                break;
        }
        if (dataSource == 0) {
            return newFixedLengthResponse(NanoHTTPD.Response.Status.NOT_FOUND, "text/plain", "source not found: " + source);
        }

        int z = Integer.parseInt(parms.get("z"));
        int x = Integer.parseInt(parms.get("x"));
        int y = Integer.parseInt(parms.get("y"));

        if (source.equals("peaks")) {
            try {
                return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "plain/text", TileSupport.peaksGeoJson(dataSource, x, y, z));
            } catch (Exception exception) {
                return NanoHTTPD.newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "plain/text", exception.toString());
            }
        }

        byte[] data = TileSupport.loadTile(dataSource, x, y, z);
        if (data == null) {
            return newFixedLengthResponse(NanoHTTPD.Response.Status.NOT_FOUND, "text/plain", "not found");
        }
        InputStream targetStream = new ByteArrayInputStream(data);
        if (source.equals("data") || source.equals("contours")) {
            Response response = NanoHTTPD.newChunkedResponse(Response.Status.OK, "application/x-protobuf", targetStream);
            response.addHeader("Content-Encoding", "gzip");
            return response;
        }
        return NanoHTTPD.newFixedLengthResponse(Response.Status.OK, "image/" + imageFormat, targetStream, data.length);
    }
}
