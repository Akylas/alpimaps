
package akylas.alpi.maps;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.zip.GZIPInputStream ;
import java.util.Map;
import java.util.Arrays;
import java.util.Set;
import java.lang.Exception;
import java.nio.charset.StandardCharsets;

import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;
import android.webkit.WebResourceResponse;
import android.webkit.WebResourceRequest;
import android.graphics.Bitmap;
import android.net.Uri;


public class WebViewClient extends android.webkit.WebViewClient {
    static final String AUTHORITY = "127.0.0.1:8080";
    static final String THREED_MAP_MAPPING = "http://127.0.0.1/3dmap";

    static final Map<String, String> headers = Map.of(
        "Access-Control-Allow-Headers", "*",
        "Access-Control-Allow-Origin", "*",
        "Access-Control-Allow-Methods", "DELETE, GET, POST, PUT, OPTIONS"
    );
    
    android.webkit.WebViewClient originalClient;

    // Handles of the SDK's tile sources, 0 for none.
    final int heightSource;
    final int peaksSource;
    final int contoursSource;
    final int rasterSource;
    final int routesSource;
    HashMap<String, String> localResources = new HashMap<String, String>();

    public WebViewClient(android.webkit.WebViewClient originalClient, int heightSource, int peaksSource, int contoursSource, int rasterSource, int routesSource) {
        super();
        this.originalClient = originalClient;
        this.heightSource = heightSource;
        this.peaksSource = peaksSource;
        this.rasterSource = rasterSource;
        this.contoursSource = contoursSource;
        this.routesSource = routesSource;
    }

    public void registerLocalResource(String key, String value) {
        localResources.put(key, value);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
        WebResourceResponse response = shouldInterceptRequest(view, Uri.parse(url));
        if (response != null) {
            return response;
        }
        return super.shouldInterceptRequest(view, url);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        // Log.d("JS", "WebViewClient shouldInterceptRequest " + request.getUrl() + " " + request.getMethod());
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return new WebResourceResponse("text/plain", "utf-8", 204, "No Content", headers, null);
        }
        WebResourceResponse response = shouldInterceptRequest(view, request.getUrl());
        if (response != null) {
            return response;
        }
        return super.shouldInterceptRequest(view, request);
    }

    private String getMimeType(String extension) {
        if (extension == null) return "application/octet-stream";

        switch (extension) {
            case "html":
            case "htm":
                return "text/html";
            case "js":
                return "application/javascript";
            case "json":
                return "application/json";
            case "css":
                return "text/css";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "pbf":
                return "application/x-protobuf";
            case "woff":
                return "font/woff";
            case "woff2":
                return "font/woff2";
            default:
                return "application/octet-stream";
        }
    }
    private String getMimeTypeFromPath(String path) {
        String extension = null;
        if (path != null) {
            int lastDot = path.lastIndexOf('.');
            if (lastDot != -1 && lastDot < path.length() - 1) {
                extension = path.substring(lastDot + 1).toLowerCase();
            }
        }

        return getMimeType(extension);
    }
    public WebResourceResponse shouldInterceptRequest(WebView view, Uri uri) {
        String server = uri.getAuthority();

        String protocol = uri.getScheme();           // e.g., "http"
        String host = uri.getHost();               // e.g., "127.0.0.1"
        int port = uri.getPort();                  // e.g., 8080, -1 if default
        String path = uri.getPath();               // e.g., "/map.html"

        String baseUrl;
        if (port == -1) {
            baseUrl = protocol + "://" + host + path;
        } else {
            baseUrl = protocol + "://" + host + ":" + port + path;
        }
        
        if (!server.equals(AUTHORITY)) {
            if (baseUrl.startsWith(THREED_MAP_MAPPING) && localResources.containsKey(THREED_MAP_MAPPING)) {
                try {
                    java.io.FileInputStream stream = new java.io.FileInputStream(new java.io.File(baseUrl.replace(THREED_MAP_MAPPING, localResources.get(THREED_MAP_MAPPING))));
                    String mimeType = getMimeTypeFromPath(path);
                    return new WebResourceResponse(mimeType, mimeType.equals("application/octet-stream") ? "binary": "utf-8", 200, "OK", headers, stream);
                } catch(Exception exception) {
                    return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(exception.toString().getBytes(StandardCharsets.UTF_8)));
                }
            } else if (localResources.containsKey(baseUrl)) {
                try {
                    java.io.FileInputStream stream = new java.io.FileInputStream(new java.io.File(localResources.get(baseUrl)));
                    String mimeType = getMimeTypeFromPath(path);

                    return new WebResourceResponse(mimeType, mimeType.equals("application/octet-stream") ? "binary": "utf-8", 200, "OK", headers, stream);
                } catch(Exception exception) {
                    return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(exception.toString().getBytes(StandardCharsets.UTF_8)));
                }
            }
            return null;
        }
        Set<String> args = uri.getQueryParameterNames();
        final String source = uri.getQueryParameter("source");
        final String imageFormat = args.contains("format") ? uri.getQueryParameter("format") : "png";
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
            case "routes":
                dataSource = routesSource;
                break;
            case "peaks":
            case "data":
            default:
                dataSource = peaksSource;
                break;
        }

        int z = Integer.parseInt(uri.getQueryParameter("z"));
        int x = Integer.parseInt(uri.getQueryParameter("x"));
        int y = Integer.parseInt(uri.getQueryParameter("y"));
        if (dataSource == 0) {
            return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream("source not found".getBytes(StandardCharsets.UTF_8)));
        }


        if (source.equals("peaks")) {
            try {
                return new WebResourceResponse("text/plain", "utf-8", 200, "OK", headers, new ByteArrayInputStream(TileSupport.peaksGeoJson(dataSource, x, y, z).getBytes(StandardCharsets.UTF_8)));
            } catch (Exception exception) {
                return new WebResourceResponse("text/plain", "utf-8", 200, "OK", headers, new ByteArrayInputStream(exception.toString().getBytes(StandardCharsets.UTF_8)));
            }
        }

        byte[] binaryDataData = TileSupport.loadTile(dataSource, x, y, z);
        if (binaryDataData == null) {
            return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream("not found".getBytes(StandardCharsets.UTF_8)));
        }
        InputStream targetStream = new ByteArrayInputStream(binaryDataData);
        if (source.equals("data") || source.equals("routes") || source.equals("contours")) {
            try {
                return new WebResourceResponse("application/x-protobuf", "utf-8", 200, "OK", headers, new GZIPInputStream(targetStream));
            } catch(Exception exception) {
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(exception.toString().getBytes(StandardCharsets.UTF_8)));
            }
        }
        // Log.d("JS", "WebViewClient raster " + imageFormat + " " +headers);
        return new WebResourceResponse(getMimeType(imageFormat), "utf-8", 200, "OK", headers, targetStream);
    }

    @Override
    public boolean shouldOverrideUrlLoading (WebView view, 
                WebResourceRequest request) {
        return originalClient.shouldOverrideUrlLoading(view, request);
    }
    @Override
    public boolean shouldOverrideUrlLoading (WebView view, 
                String url) {
        return originalClient.shouldOverrideUrlLoading(view, url);
    }
    @Override
    public void onPageStarted (WebView view, 
                String url, 
                Bitmap favicon) {
        originalClient.onPageStarted(view, url, favicon);
    }
    @Override
    public void onPageFinished (WebView view, 
                String url) {
        originalClient.onPageFinished(view, url);
    }
}