package uk.granary.tv;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Reads the string table of every classes*.dex in an APK and returns strings matching a pattern (link formats, extra keys). */
final class DexStrings {
    private DexStrings() {}

    static List<String> find(List<String> apks, Pattern p, int max) throws Exception {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String apk : apks) {
            try (ZipFile z = new ZipFile(apk)) {
                Enumeration<? extends ZipEntry> en = z.entries();
                while (en.hasMoreElements() && out.size() < max) {
                    ZipEntry e = en.nextElement();
                    if (!e.getName().matches("classes\\d*\\.dex")) continue;
                    byte[] d;
                    try (InputStream in = z.getInputStream(e)) {
                        ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int n;
                        while ((n = in.read(b)) > 0) bo.write(b, 0, n);
                        d = bo.toByteArray();
                    }
                    int count = le32(d, 0x38), off = le32(d, 0x3c);
                    for (int i = 0; i < count && out.size() < max; i++) {
                        int so = le32(d, off + i * 4);
                        int p0 = so; while ((d[p0] & 0x80) != 0) p0++; p0++; // skip uleb128 length
                        int end = p0; while (end < d.length && d[end] != 0) end++;
                        int len = end - p0;
                        if (len < 4 || len > 220) continue;
                        String s = new String(d, p0, len, java.nio.charset.StandardCharsets.UTF_8);
                        if (p.matcher(s).find()) out.add(s);
                    }
                }
            }
        }
        return new ArrayList<>(out);
    }

    private static int le32(byte[] d, int o) { return (d[o] & 0xff) | (d[o + 1] & 0xff) << 8 | (d[o + 2] & 0xff) << 16 | (d[o + 3] & 0xff) << 24; }
}
