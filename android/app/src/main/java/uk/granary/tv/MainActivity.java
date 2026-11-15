package uk.granary.tv;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.List;
import java.util.Locale;

/**
 * Granary TV for Fire TV.
 * Shows the Granary TV website (TV layout) full screen. When a "Watch"/"Open" link points at a
 * streaming service, it opens that service's installed app instead of a web page:
 *   1. ask Android to open the link in the service's app (works where the app supports deep links),
 *   2. otherwise just launch the service's app,
 *   3. otherwise open the link in the web browser.
 * The guide itself lives on the website, so website updates appear here without reinstalling.
 */
public class MainActivity extends Activity {
    static final String SITE_HOST = "neon-empanada-981548.netlify.app";
    static final String START_URL = "https://" + SITE_HOST + "/tv.html";

    /** host fragment -> words that appear in the installed app's name on Fire TV */
    static final String[][] SERVICES = {
        {"bbc.co.uk", "BBC iPlayer", "iplayer"},
        {"itv.com", "ITVX", "itvx", "itv"},
        {"channel4.com", "Channel 4", "channel 4", "all 4", "4od"},
        {"channel5.com", "My5", "my5", "channel 5", "5"},
        {"amazon.co.uk", "Prime Video", "prime video"},
        {"primevideo.com", "Prime Video", "prime video"},
        {"disneyplus.com", "Disney+", "disney"},
        {"nowtv.com", "NOW", "now", "now tv"},
        {"sky.com", "NOW", "now", "now tv", "sky"},
        {"tv.apple.com", "Apple TV", "apple tv"},
        {"netflix.com", "Netflix", "netflix"},
        {"youtube.com", "YouTube", "youtube"},
        {"u.co.uk", "U", "uktv play", "u"},
    };

    WebView web;
    /** Services whose Fire TV app ignores web links: just open the app. Updated from /app-config.json on the website. */
    final Set<String> appOnly = new HashSet<>(java.util.Arrays.asList("itv.com"));
    String pendingTitle = null;
    /** Link rewrites from /app-config.json: {"host":"channel4.com","to":"channel4://{path}{query}","pkg":"com.channel4.ondemand"} */
    final List<JSONObject> rewrites = new ArrayList<>();

    void loadConfig() {
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL("https://" + SITE_HOST + "/app-config.json?t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(5000); c.setReadTimeout(5000);
                StringBuilder sb = new StringBuilder();
                try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()))) { String l; while ((l = r.readLine()) != null) sb.append(l); }
                JSONObject cfg = new JSONObject(sb.toString());
                JSONArray rw = cfg.optJSONArray("rewrite");
                if (rw != null) synchronized (rewrites) { rewrites.clear(); for (int i = 0; i < rw.length(); i++) rewrites.add(rw.getJSONObject(i)); }
                JSONArray a = cfg.optJSONArray("appOnly");
                if (a != null) { Set<String> n = new HashSet<>(); for (int i = 0; i < a.length(); i++) n.add(a.getString(i)); synchronized (appOnly) { appOnly.clear(); appOnly.addAll(n); } }
            } catch (Exception ignored) { }
        }).start();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0c1422"));
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " GranaryTVApp/1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "GranaryApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return route(req.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // Links with target="_blank" arrive here; catch their address and route it.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean userGesture, Message resultMsg) {
                WebView catcher = new WebView(MainActivity.this);
                catcher.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                        Uri u = req.getUrl();
                        if (isOwnSite(u)) web.loadUrl(u.toString()); else openExternal(u);
                        v.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
                t.setWebView(catcher);
                resultMsg.sendToTarget();
                return true;
            }
        });

        loadConfig();
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    boolean isOwnSite(Uri u) {
        String h = u.getHost();
        return h != null && (h.equals(SITE_HOST) || h.endsWith("supabase.co") || h.endsWith("ontvnow.co.uk"));
    }

    /** true = handled outside the WebView */
    boolean route(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        if (!scheme.startsWith("http")) { openExternal(u); return true; }
        if (isOwnSite(u)) return false;
        openExternal(u);
        return true;
    }

    String[] serviceFor(Uri u) {
        String h = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.UK);
        for (String[] s : SERVICES) if (h.equals(s[0]) || h.endsWith("." + s[0])) return s;
        return null;
    }

    /** Installed TV apps whose name matches the service. */
    List<String> findApps(String[] service) {
        List<String> found = new ArrayList<>();
        PackageManager pm = getPackageManager();
        for (String cat : new String[]{"android.intent.category.LEANBACK_LAUNCHER", Intent.CATEGORY_LAUNCHER}) {
            Intent q = new Intent(Intent.ACTION_MAIN).addCategory(cat);
            for (ResolveInfo ri : pm.queryIntentActivities(q, 0)) {
                String pkg = ri.activityInfo.packageName;
                if (pkg.equals(getPackageName()) || found.contains(pkg)) continue;
                String label = String.valueOf(ri.loadLabel(pm)).toLowerCase(Locale.UK).trim();
                for (int i = 2; i < service.length; i++) {
                    String w = service[i];
                    boolean match = w.length() <= 3 ? (label.equals(w) || label.startsWith(w + " ")) : (label.equals(w) || label.startsWith(w + " ") || label.contains(w));
                    if (match) { found.add(pkg); break; }
                }
            }
        }
        return found;
    }

    void openExternal(Uri u) {
        String[] service = serviceFor(u);
        String title = pendingTitle; pendingTitle = null;
        // 0. a rewrite rule from the website config turns a web address into the app's own link
        String host0 = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.UK);
        synchronized (rewrites) {
            for (JSONObject r : rewrites) {
                String h = r.optString("host");
                if (h.isEmpty() || !(host0.equals(h) || host0.endsWith("." + h))) continue;
                if (u.getScheme() == null || !u.getScheme().startsWith("http")) continue; // never rewrite app links like channel4://
                String path = u.getEncodedPath() == null ? "" : u.getEncodedPath().replaceFirst("^/", "");
                String q = u.getEncodedQuery() == null ? "" : "?" + u.getEncodedQuery();
                String target = r.optString("to").replace("{path}", path).replace("{query}", q).replace("{title}", title == null ? "" : Uri.encode(title));
                Intent ri = new Intent(Intent.ACTION_VIEW, Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (!r.optString("pkg").isEmpty()) ri.setPackage(r.optString("pkg"));
                try { startActivity(ri); toast("Opening " + r.optString("name", "the app") + "…  Press Back to return"); return; }
                catch (Exception ignored) { /* fall through to the normal route */ }
            }
        }
        if (service != null) {
            boolean deepOk; synchronized (appOnly) { deepOk = !appOnly.contains(service[0]); }
            for (String pkg : findApps(service)) {
                // 1. deep link straight into the programme, if the app accepts it
                Intent deep = new Intent(Intent.ACTION_VIEW, u).setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (deepOk && deep.resolveActivity(getPackageManager()) != null) {
                    try { startActivity(deep); toast("Opening " + service[1] + "…  Press Back to return"); return; }
                    catch (ActivityNotFoundException | SecurityException ignored) { }
                }
                // 2. just open the app
                Intent launch = getPackageManager().getLeanbackLaunchIntentForPackage(pkg);
                if (launch == null) launch = getPackageManager().getLaunchIntentForPackage(pkg);
                if (launch != null) {
                    try {
                        startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        toast(title != null && !title.isEmpty() ? "Opened " + service[1] + " — search for \u201C" + title + "\u201D" : "Opened " + service[1] + " — search for the programme there");
                        return;
                    } catch (ActivityNotFoundException | SecurityException ignored) { }
                }
            }
            toast(service[1] + " app not found on this device — opening the web page");
        }
        // 3. browser fallback
        try { startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (ActivityNotFoundException e) { toast("No app can open this link"); }
    }

    void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_LONG).show(); }

    /** Lets the website know it is running inside the app (window.GranaryApp.isApp()). */
    class Bridge {
        @JavascriptInterface public boolean isApp() { return true; }
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
        @JavascriptInterface public void open(String url) { runOnUiThread(() -> openExternal(Uri.parse(url))); }
        /** Deep Link Lab: installed TV apps as JSON [{label,pkg}] */
        @JavascriptInterface public String apps() {
            try {
                JSONArray out = new JSONArray(); PackageManager pm = getPackageManager(); java.util.Set<String> seen = new java.util.HashSet<>();
                for (String cat : new String[]{"android.intent.category.LEANBACK_LAUNCHER", Intent.CATEGORY_LAUNCHER})
                    for (ResolveInfo ri : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(cat), 0))
                        if (seen.add(ri.activityInfo.packageName)) out.put(new JSONObject().put("label", String.valueOf(ri.loadLabel(pm))).put("pkg", ri.activityInfo.packageName));
                return out.toString();
            } catch (Exception e) { return "[]"; }
        }
        /** Deep Link Lab: read another app's manifest and list every intent filter that has links (data). */
        public String manifestViaAssets(String pkg) {
            try {
                JSONObject out = new JSONObject();
                android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(pkg, 0);
                out.put("package", pkg).put("version", pi.versionName);
                android.content.Context other = createPackageContext(pkg, 0);
                android.content.res.XmlResourceParser x = other.getAssets().openXmlResourceParser("AndroidManifest.xml");
                JSONArray filters = new JSONArray();
                String activity = null; JSONObject filter = null;
                for (int ev = x.getEventType(); ev != org.xmlpull.v1.XmlPullParser.END_DOCUMENT; ev = x.next()) {
                    if (ev == org.xmlpull.v1.XmlPullParser.START_TAG) {
                        String tag = x.getName();
                        JSONObject attrs = new JSONObject();
                        for (int i = 0; i < x.getAttributeCount(); i++) {
                            String n = x.getAttributeName(i);
                            int res = x.getAttributeNameResource(i);
                            if (n == null || n.isEmpty()) {
                                switch (res) { case 0x01010003: n = "name"; break; case 0x01010026: n = "mimeType"; break; case 0x01010027: n = "scheme"; break;
                                    case 0x01010028: n = "host"; break; case 0x01010029: n = "port"; break; case 0x0101002a: n = "path"; break;
                                    case 0x0101002b: n = "pathPrefix"; break; case 0x0101002c: n = "pathPattern"; break; default: n = "0x" + Integer.toHexString(res); }
                            }
                            attrs.put(n, x.getAttributeValue(i));
                        }
                        if (tag.equals("activity") || tag.equals("activity-alias")) { activity = attrs.optString("name"); }
                        else if (tag.equals("intent-filter")) { filter = new JSONObject().put("activity", activity).put("actions", new JSONArray()).put("categories", new JSONArray()).put("data", new JSONArray()); }
                        else if (filter != null && tag.equals("action")) filter.getJSONArray("actions").put(attrs.optString("name"));
                        else if (filter != null && tag.equals("category")) filter.getJSONArray("categories").put(attrs.optString("name"));
                        else if (filter != null && tag.equals("data")) filter.getJSONArray("data").put(attrs);
                    } else if (ev == org.xmlpull.v1.XmlPullParser.END_TAG) {
                        if (x.getName().equals("intent-filter") && filter != null) { if (filter.getJSONArray("data").length() > 0) filters.put(filter); filter = null; }
                        else if (x.getName().equals("activity") || x.getName().equals("activity-alias")) activity = null;
                    }
                }
                out.put("filters", filters);
                return out.toString();
            } catch (Throwable e) {
                try { return new JSONObject().put("package", pkg).put("error", e.getClass().getSimpleName() + ": " + e.getMessage()).toString(); } catch (Exception ignored) { return "{}"; }
            }
        }
        /** Deep Link Lab: read the app's installed APK file(s) directly and list intent filters with link data. */
        @JavascriptInterface public String manifest(String pkg) {
            try {
                android.content.pm.ApplicationInfo ai = getPackageManager().getApplicationInfo(pkg, 0);
                android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(pkg, 0);
                JSONObject out = new JSONObject().put("package", pkg).put("version", pi.versionName).put("source", "apk");
                JSONObject base = Axml.scanApk(ai.sourceDir);
                out.put("manifestPackage", base.optString("manifestPackage")).put("filters", base.get("filters"));
                JSONArray splits = new JSONArray();
                if (ai.splitSourceDirs != null) for (String sp : ai.splitSourceDirs) {
                    try { JSONObject r = Axml.scanApk(sp); if (r.getJSONArray("filters").length() > 0) splits.put(r.put("apk", sp)); }
                    catch (Exception ex) { splits.put(new JSONObject().put("apk", sp).put("error", ex.getMessage())); }
                }
                out.put("splits", splits);
                return out.toString();
            } catch (Throwable e) {
                String fallback = manifestViaAssets(pkg);
                try { return new JSONObject(fallback).put("apkError", e.getClass().getSimpleName() + ": " + e.getMessage()).toString(); } catch (Exception ignored) { return fallback; }
            }
        }
        /** Deep Link Lab: link-related text inside an app (route patterns, intent extra names). */
        @JavascriptInterface public String strings(String pkg, String regex) {
            try {
                android.content.pm.ApplicationInfo ai = getPackageManager().getApplicationInfo(pkg, 0);
                java.util.List<String> apks = new java.util.ArrayList<>(); apks.add(ai.sourceDir);
                if (ai.splitSourceDirs != null) java.util.Collections.addAll(apks, ai.splitSourceDirs);
                JSONArray a = new JSONArray();
                for (String s : DexStrings.find(apks, java.util.regex.Pattern.compile(regex), 600)) a.put(s);
                return new JSONObject().put("package", pkg).put("kind", "strings").put("regex", regex).put("strings", a).toString();
            } catch (Throwable e) {
                try { return new JSONObject().put("package", pkg).put("kind", "strings").put("error", e.getClass().getSimpleName() + ": " + e.getMessage()).toString(); } catch (Exception ignored) { return "{}"; }
            }
        }
        /** Deep Link Lab: send a search to an app (Intent.ACTION_SEARCH with a query). */
        @JavascriptInterface public String search(String pkg, String cls, String query) {
            try {
                Intent i = new Intent(Intent.ACTION_SEARCH).putExtra(android.app.SearchManager.QUERY, query).putExtra("query", query).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (cls != null && !cls.isEmpty()) i.setClassName(pkg, cls); else i.setPackage(pkg);
                startActivity(i); return "started";
            } catch (Exception e) { return "error: " + e.getClass().getSimpleName() + " " + e.getMessage(); }
        }
        /** Deep Link Lab: ask for permission to read the Fire TV channel guide data (shows a system prompt). */
        @JavascriptInterface public String askEpgPermission() {
            try {
                if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission("com.android.providers.tv.permission.READ_EPG_DATA") != PackageManager.PERMISSION_GRANTED) {
                    runOnUiThread(() -> requestPermissions(new String[]{"com.android.providers.tv.permission.READ_EPG_DATA"}, 77));
                    return "asked";
                }
                return "granted";
            } catch (Exception e) { return "error: " + e.getMessage(); }
        }
        /** Deep Link Lab: read what streaming apps registered with the Fire TV guide (channels, continue-watching, previews) incl. their play intents. */
        @JavascriptInterface public String tvProvider() {
            JSONObject out = new JSONObject();
            String[][] tables = {{"channels", "content://android.media.tv/channel"}, {"watchNext", "content://android.media.tv/watch_next_program"}, {"previews", "content://android.media.tv/preview_program"}};
            for (String[] t : tables) {
                JSONArray rows = new JSONArray();
                try (android.database.Cursor c = getContentResolver().query(Uri.parse(t[1]), null, null, null, null)) {
                    if (c == null) { out.put(t[0] + "Error", "null cursor"); continue; }
                    String[] cols = c.getColumnNames();
                    int n = 0;
                    while (c.moveToNext() && n++ < 120) {
                        JSONObject r = new JSONObject();
                        for (int i = 0; i < cols.length; i++) {
                            String col = cols[i];
                            if (!(col.contains("intent") || col.contains("link") || col.contains("package") || col.contains("title") || col.contains("display_name") || col.contains("display_number")
                                || col.contains("input_id") || col.contains("internal_provider") || col.contains("content_id") || col.equals("type") || col.contains("channel_id"))) continue;
                            int ty = c.getType(i);
                            if (ty == android.database.Cursor.FIELD_TYPE_BLOB) { byte[] b = c.getBlob(i); if (b != null) r.put(col, new String(b, java.nio.charset.StandardCharsets.UTF_8).replaceAll("[^\\x20-\\x7e]", ".")); }
                            else if (ty != android.database.Cursor.FIELD_TYPE_NULL) r.put(col, c.getString(i));
                        }
                        rows.put(r);
                    }
                    try { out.put(t[0], rows); } catch (Exception ignored) { }
                } catch (Throwable e) { try { out.put(t[0] + "Error", e.getClass().getSimpleName() + ": " + e.getMessage()); } catch (Exception ignored) { } }
            }
            return out.toString();
        }
        /** Deep Link Lab: fire an intent written as an Android intent URI (intent:#Intent;...;end), as the Fire TV guide would. */
        @JavascriptInterface public String launchIntentUri(String uri) {
            try { Intent i = Intent.parseUri(uri, Intent.URI_INTENT_SCHEME); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); return "started"; }
            catch (Exception e) { return "error: " + e.getClass().getSimpleName() + " " + e.getMessage(); }
        }
        /** Deep Link Lab: which activities say they can open this link */
        @JavascriptInterface public String resolve(String uri) {
            try {
                JSONArray out = new JSONArray();
                for (ResolveInfo ri : getPackageManager().queryIntentActivities(new Intent(Intent.ACTION_VIEW, Uri.parse(uri)), 0))
                    out.put(ri.activityInfo.packageName + "/" + ri.activityInfo.name);
                return out.toString();
            } catch (Exception e) { return "[]"; }
        }
        /** Deep Link Lab: fire exactly this intent (optional package / class), bypassing Granary's own routing */
        @JavascriptInterface public String launch(String uri, String pkg, String cls) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (pkg != null && !pkg.isEmpty()) { if (cls != null && !cls.isEmpty()) i.setClassName(pkg, cls); else i.setPackage(pkg); }
                startActivity(i);
                return "started";
            } catch (Exception e) { return "error: " + e.getClass().getSimpleName() + " " + e.getMessage(); }
        }
        @JavascriptInterface public void openWithTitle(String url, String title) { runOnUiThread(() -> { pendingTitle = title; openExternal(Uri.parse(url)); }); }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // Ask the page first: an open panel (Library, programme details, Channels…) closes.
            web.evaluateJavascript("(window.granaryBack && window.granaryBack()) ? 'closed' : 'none'", result -> {
                if (result != null && result.contains("closed")) return;
                if (web.canGoBack()) web.goBack();
                else finish();
            });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); web.requestFocus(View.FOCUS_DOWN); }

    @Override
    protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
}
