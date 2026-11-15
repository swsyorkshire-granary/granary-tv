package uk.granary.tv;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Minimal reader for the compiled (binary) AndroidManifest.xml inside an APK: lists intent filters that carry link data. */
final class Axml {
    private Axml() {}

    static JSONObject scanApk(String apkPath) throws Exception {
        byte[] bytes;
        try (ZipFile z = new ZipFile(apkPath)) {
            ZipEntry e = z.getEntry("AndroidManifest.xml");
            if (e == null) throw new IllegalStateException("no manifest in " + apkPath);
            try (InputStream in = z.getInputStream(e)) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[16384]; int n;
                while ((n = in.read(b)) > 0) bo.write(b, 0, n);
                bytes = bo.toByteArray();
            }
        }
        return parse(bytes);
    }

    static JSONObject parse(byte[] data) throws Exception {
        ByteBuffer bb = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
        String[] strings = new String[0]; int[] resIds = new int[0];
        JSONArray filters = new JSONArray();
        String manifestPkg = null, activity = null; JSONObject filter = null;
        int pos = 8; // skip XML file header
        while (pos + 8 <= data.length) {
            int type = bb.getShort(pos) & 0xffff, headerSize = bb.getShort(pos + 2) & 0xffff, size = bb.getInt(pos + 4);
            if (size <= 0) break;
            if (type == 0x0001) { // string pool
                int count = bb.getInt(pos + 8), flags = bb.getInt(pos + 16), stringsStart = bb.getInt(pos + 20);
                boolean utf8 = (flags & 0x100) != 0;
                strings = new String[count];
                for (int i = 0; i < count; i++) {
                    int off = pos + stringsStart + bb.getInt(pos + headerSize + i * 4);
                    strings[i] = utf8 ? readUtf8(data, off) : readUtf16(bb, off);
                }
            } else if (type == 0x0180) { // resource ids for attribute names
                int n = (size - headerSize) / 4; resIds = new int[n];
                for (int i = 0; i < n; i++) resIds[i] = bb.getInt(pos + headerSize + i * 4);
            } else if (type == 0x0102) { // start tag
                String tag = str(strings, bb.getInt(pos + 20));
                int attrStart = bb.getShort(pos + 24) & 0xffff, attrSize = bb.getShort(pos + 26) & 0xffff, attrCount = bb.getShort(pos + 28) & 0xffff;
                JSONObject attrs = new JSONObject();
                for (int i = 0; i < attrCount; i++) {
                    int a = pos + 16 + attrStart + i * attrSize;
                    int nameIdx = bb.getInt(a + 4), raw = bb.getInt(a + 8), dt = data[a + 15] & 0xff, val = bb.getInt(a + 16);
                    String name = str(strings, nameIdx);
                    if ((name == null || name.isEmpty()) && nameIdx >= 0 && nameIdx < resIds.length) name = attrName(resIds[nameIdx]);
                    if (name == null || name.isEmpty()) name = "attr" + nameIdx;
                    String v;
                    if (raw != -1) v = str(strings, raw);
                    else if (dt == 0x03) v = str(strings, val);
                    else if (dt == 0x12) v = val != 0 ? "true" : "false";
                    else if (dt == 0x01) v = "@0x" + Integer.toHexString(val);
                    else v = String.valueOf(val);
                    attrs.put(name, v);
                }
                if ("manifest".equals(tag)) manifestPkg = attrs.optString("package");
                else if ("activity".equals(tag) || "activity-alias".equals(tag)) activity = attrs.optString("name");
                else if ("intent-filter".equals(tag)) filter = new JSONObject().put("activity", activity).put("actions", new JSONArray()).put("categories", new JSONArray()).put("data", new JSONArray());
                else if (filter != null && "action".equals(tag)) filter.getJSONArray("actions").put(attrs.optString("name"));
                else if (filter != null && "category".equals(tag)) filter.getJSONArray("categories").put(attrs.optString("name"));
                else if (filter != null && "data".equals(tag)) filter.getJSONArray("data").put(attrs);
            } else if (type == 0x0103) { // end tag
                String tag = str(strings, bb.getInt(pos + 20));
                if ("intent-filter".equals(tag) && filter != null) { if (filter.getJSONArray("data").length() > 0) filters.put(filter); filter = null; }
                else if ("activity".equals(tag) || "activity-alias".equals(tag)) activity = null;
            }
            pos += (type == 0x0003) ? headerSize : size; // descend into the XML chunk, otherwise skip whole chunk
        }
        return new JSONObject().put("manifestPackage", manifestPkg).put("filters", filters);
    }

    private static String attrName(int id) {
        switch (id) {
            case 0x01010003: return "name"; case 0x01010026: return "mimeType"; case 0x01010027: return "scheme";
            case 0x01010028: return "host"; case 0x01010029: return "port"; case 0x0101002a: return "path";
            case 0x0101002b: return "pathPrefix"; case 0x0101002c: return "pathPattern"; case 0x010104ee: return "autoVerify";
            default: return "0x" + Integer.toHexString(id);
        }
    }
    private static String str(String[] s, int i) { return i >= 0 && i < s.length ? s[i] : null; }
    private static String readUtf16(ByteBuffer bb, int off) {
        int len = bb.getShort(off) & 0xffff; int p = off + 2;
        if ((len & 0x8000) != 0) { len = ((len & 0x7fff) << 16) | (bb.getShort(off + 2) & 0xffff); p += 2; }
        char[] c = new char[len]; for (int i = 0; i < len; i++) c[i] = bb.getChar(p + i * 2);
        return new String(c);
    }
    private static String readUtf8(byte[] d, int off) {
        int p = off;
        int u16 = d[p++] & 0xff; if ((u16 & 0x80) != 0) p++;          // utf-16 length (skip)
        int len = d[p++] & 0xff; if ((len & 0x80) != 0) len = ((len & 0x7f) << 8) | (d[p++] & 0xff);
        return new String(d, p, len, java.nio.charset.StandardCharsets.UTF_8);
    }
}
