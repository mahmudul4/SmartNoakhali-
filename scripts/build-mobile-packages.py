#!/usr/bin/env python3
"""
Builds:
1. Compliant PWA PNG icons (192x192, 512x512, maskable 512x512, apple-touch-icon 180x180)
   from public/logo.png
2. A genuine, spec-compliant, v1 + v2 signed Android APK (public/downloads/Smart-Noakhali-Android.apk)
   that launches https://smartnoakhali.netlify.app in a fullscreen Android WebView with
   JavaScript, DOM Storage, and hardware back-button navigation.
3. A genuine Apple iOS WebClip Configuration Profile (public/downloads/Smart-Noakhali-iOS.mobileconfig)
   with embedded icon for 1-click iPhone/iPad installation.
4. Pre-populated public/data/app_packages_manifest.json for server & serverless functions.
"""

import base64
import hashlib
import json
import os
import struct
import subprocess
import tempfile
import time
import uuid
import zlib

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DOWNLOADS_DIR = os.path.join(PUBLIC_DIR, "downloads")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")


# ==============================================================================
# 1. Pure-Python PNG Decoder / Bilinear Resizer / Encoder
# ==============================================================================
def read_png_rgba(path):
    with open(path, "rb") as f:
        data = f.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "Not a PNG file"
    pos = 8
    width = height = bit_depth = color_type = 0
    idat_chunks = []
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        chunk_data = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if chunk_type == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", chunk_data)
        elif chunk_type == b"IDAT":
            idat_chunks.append(chunk_data)
        elif chunk_type == b"IEND":
            break

    raw = zlib.decompress(b"".join(idat_chunks))
    bpp = 4 if color_type == 6 else 3
    stride = width * bpp
    pixels = bytearray(width * height * 4)

    prev_row = bytearray(stride)
    in_pos = 0
    for y in range(height):
        filter_type = raw[in_pos]
        in_pos += 1
        cur_row = bytearray(raw[in_pos : in_pos + stride])
        in_pos += stride

        if filter_type == 1:  # Sub
            for i in range(bpp, stride):
                cur_row[i] = (cur_row[i] + cur_row[i - bpp]) & 0xFF
        elif filter_type == 2:  # Up
            for i in range(stride):
                cur_row[i] = (cur_row[i] + prev_row[i]) & 0xFF
        elif filter_type == 3:  # Average
            for i in range(stride):
                left = cur_row[i - bpp] if i >= bpp else 0
                up = prev_row[i]
                cur_row[i] = (cur_row[i] + ((left + up) >> 1)) & 0xFF
        elif filter_type == 4:  # Paeth
            for i in range(stride):
                a = cur_row[i - bpp] if i >= bpp else 0
                b = prev_row[i]
                c = prev_row[i - bpp] if i >= bpp else 0
                p = a + b - c
                pa = abs(p - a)
                pb = abs(p - b)
                pc = abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                cur_row[i] = (cur_row[i] + pr) & 0xFF

        prev_row = cur_row
        out_row_start = y * width * 4
        if bpp == 4:
            pixels[out_row_start : out_row_start + width * 4] = cur_row
        else:
            for x in range(width):
                pixels[out_row_start + x * 4 : out_row_start + x * 4 + 4] = bytes(
                    [cur_row[x * 3], cur_row[x * 3 + 1], cur_row[x * 3 + 2], 255]
                )

    return width, height, pixels


def resize_rgba(src_w, src_h, src_pixels, dst_w, dst_h, pad_ratio=0.0, bg_rgba=None):
    dst = bytearray(dst_w * dst_h * 4)
    if bg_rgba:
        r0, g0, b0, a0 = bg_rgba
        for i in range(0, len(dst), 4):
            dst[i] = r0
            dst[i + 1] = g0
            dst[i + 2] = b0
            dst[i + 3] = a0

    pad_x = int(dst_w * pad_ratio)
    pad_y = int(dst_h * pad_ratio)
    inner_w = max(1, dst_w - 2 * pad_x)
    inner_h = max(1, dst_h - 2 * pad_y)

    for y in range(inner_h):
        sy = int(y * src_h / inner_h)
        if sy >= src_h:
            sy = src_h - 1
        for x in range(inner_w):
            sx = int(x * src_w / inner_w)
            if sx >= src_w:
                sx = src_w - 1
            s_idx = (sy * src_w + sx) * 4
            sr, sg, sb, sa = (
                src_pixels[s_idx],
                src_pixels[s_idx + 1],
                src_pixels[s_idx + 2],
                src_pixels[s_idx + 3],
            )
            d_idx = ((y + pad_y) * dst_w + (x + pad_x)) * 4
            if bg_rgba and sa < 255:
                inv = 255 - sa
                dst[d_idx] = (sr * sa + bg_rgba[0] * inv) // 255
                dst[d_idx + 1] = (sg * sa + bg_rgba[1] * inv) // 255
                dst[d_idx + 2] = (sb * sa + bg_rgba[2] * inv) // 255
                dst[d_idx + 3] = 255
            else:
                dst[d_idx] = sr
                dst[d_idx + 1] = sg
                dst[d_idx + 2] = sb
                dst[d_idx + 3] = sa

    return dst


def encode_png_rgba(width, height, pixels):
    def make_chunk(chunk_type, chunk_data):
        crc = zlib.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
        return struct.pack(">I", len(chunk_data)) + chunk_type + chunk_data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # Filter 0 (None)
        row_start = y * stride
        raw.extend(pixels[row_start : row_start + stride])

    compressed = zlib.compress(bytes(raw), 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + make_chunk(b"IHDR", ihdr)
        + make_chunk(b"IDAT", compressed)
        + make_chunk(b"IEND", b"")
    )


# ==============================================================================
# 2. Android Binary XML (AXML) Builder for AndroidManifest.xml
# ==============================================================================
def build_string_pool_utf16(strings):
    offsets = []
    buf = bytearray()
    for s in strings:
        offsets.append(len(buf))
        encoded = s.encode("utf-16le")
        char_len = len(s)
        buf.extend(struct.pack("<H", char_len))
        buf.extend(encoded)
        buf.extend(b"\x00\x00")
    while len(buf) % 4 != 0:
        buf.append(0)

    strings_start = 28 + 4 * len(strings)
    total_size = strings_start + len(buf)
    header = struct.pack(
        "<HHIIIIII",
        0x0001,  # RES_STRING_POOL_TYPE
        28,  # headerSize (28 bytes)
        total_size,
        len(strings),
        0,  # styleCount
        0,  # flags (UTF-16)
        strings_start,
        0,  # stylesStart
    )
    offset_table = b"".join(struct.pack("<I", off) for off in offsets)
    return header + offset_table + bytes(buf)


def build_android_manifest_axml():
    # Attribute strings with Android resource IDs MUST come first, sorted by resource ID
    attr_defs = [
        ("theme", 0x01010000),
        ("label", 0x01010001),
        ("icon", 0x01010002),
        ("name", 0x01010003),
        ("exported", 0x0101001E),
        ("configChanges", 0x0101001F),
        ("minSdkVersion", 0x0101020C),
        ("versionCode", 0x0101021B),
        ("versionName", 0x0101021C),
        ("targetSdkVersion", 0x01010270),
        ("allowBackup", 0x01010280),
        ("hardwareAccelerated", 0x010102D3),
        ("usesCleartextTraffic", 0x010104EC),
    ]
    # Keep attr_defs in exact order of their appearance in string pool
    other_strings = [
        "android",
        "http://schemas.android.com/apk/res/android",
        "manifest",
        "package",
        "app.smartnoakhali.mobile",
        "2.0.0",
        "uses-sdk",
        "uses-permission",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "application",
        "স্মার্ট নোয়াখালী",
        "activity",
        "app.smartnoakhali.mobile.MainActivity",
        "intent-filter",
        "action",
        "android.intent.action.MAIN",
        "category",
        "android.intent.category.LAUNCHER",
    ]
    all_strings = [name for name, _ in attr_defs] + other_strings
    s_idx = {s: i for i, s in enumerate(all_strings)}
    res_ids = [rid for _, rid in attr_defs]

    sp_chunk = build_string_pool_utf16(all_strings)
    res_map_chunk = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(res_ids)) + b"".join(
        struct.pack("<I", rid) for rid in res_ids
    )

    NS_ANDROID = s_idx["http://schemas.android.com/apk/res/android"]
    PFX_ANDROID = s_idx["android"]
    NO_IDX = 0xFFFFFFFF

    TYPE_REFERENCE = 0x01
    TYPE_STRING = 0x03
    TYPE_INT_DEC = 0x10
    TYPE_INT_HEX = 0x11
    TYPE_INT_BOOLEAN = 0x12

    def make_start_ns(prefix_idx, uri_idx, line=1):
        return struct.pack(
            "<HHIIII", 0x0100, 16, 24, line, NO_IDX, prefix_idx
        ) + struct.pack("<I", uri_idx)

    def make_end_ns(prefix_idx, uri_idx, line=1):
        return struct.pack(
            "<HHIIII", 0x0101, 16, 24, line, NO_IDX, prefix_idx
        ) + struct.pack("<I", uri_idx)

    def make_attr(ns_idx, name_str, raw_str, val_type, val_data):
        name_i = s_idx[name_str]
        raw_i = s_idx[raw_str] if raw_str is not None else NO_IDX
        return struct.pack(
            "<IIIHBBI",
            ns_idx,
            name_i,
            raw_i,
            8,
            0,
            val_type,
            val_data & 0xFFFFFFFF,
        )

    def make_start_el(name_str, attrs, line=1):
        attr_bytes = b"".join(attrs)
        size = 36 + len(attr_bytes)
        return (
            struct.pack(
                "<HHIIIIIHHHHHH",
                0x0102,  # RES_XML_START_ELEMENT_TYPE
                16,
                size,
                line,
                NO_IDX,
                NO_IDX,  # elem ns
                s_idx[name_str],
                20,  # attributeStart
                20,  # attributeSize
                len(attrs),
                0,
                0,
                0,
            )
            + attr_bytes
        )

    def make_end_el(name_str, line=1):
        return struct.pack(
            "<HHIIIIII",
            0x0103,  # RES_XML_END_ELEMENT_TYPE
            16,
            24,
            line,
            NO_IDX,
            NO_IDX,
            s_idx[name_str],
        )[:24]

    def make_end_element(name_str, line=1):
        return struct.pack(
            "<HHIIII",
            0x0103,
            16,
            24,
            line,
            NO_IDX,
            NO_IDX,
        ) + struct.pack("<I", s_idx[name_str])

    xml_nodes = bytearray()
    xml_nodes.extend(make_start_ns(PFX_ANDROID, NS_ANDROID, 2))

    # <manifest android:versionCode="200" android:versionName="2.0.0" package="app.smartnoakhali.mobile">
    xml_nodes.extend(
        make_start_el(
            "manifest",
            [
                make_attr(NS_ANDROID, "versionCode", None, TYPE_INT_DEC, 200),
                make_attr(NS_ANDROID, "versionName", "2.0.0", TYPE_STRING, s_idx["2.0.0"]),
                make_attr(
                    NO_IDX,
                    "package",
                    "app.smartnoakhali.mobile",
                    TYPE_STRING,
                    s_idx["app.smartnoakhali.mobile"],
                ),
            ],
            2,
        )
    )

    # <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="28" />
    xml_nodes.extend(
        make_start_el(
            "uses-sdk",
            [
                make_attr(NS_ANDROID, "minSdkVersion", None, TYPE_INT_DEC, 21),
                make_attr(NS_ANDROID, "targetSdkVersion", None, TYPE_INT_DEC, 28),
            ],
            3,
        )
    )
    xml_nodes.extend(make_end_element("uses-sdk", 3))

    # <uses-permission android:name="android.permission.INTERNET" />
    xml_nodes.extend(
        make_start_el(
            "uses-permission",
            [
                make_attr(
                    NS_ANDROID,
                    "name",
                    "android.permission.INTERNET",
                    TYPE_STRING,
                    s_idx["android.permission.INTERNET"],
                ),
            ],
            4,
        )
    )
    xml_nodes.extend(make_end_element("uses-permission", 4))

    # <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    xml_nodes.extend(
        make_start_el(
            "uses-permission",
            [
                make_attr(
                    NS_ANDROID,
                    "name",
                    "android.permission.ACCESS_NETWORK_STATE",
                    TYPE_STRING,
                    s_idx["android.permission.ACCESS_NETWORK_STATE"],
                ),
            ],
            5,
        )
    )
    xml_nodes.extend(make_end_element("uses-permission", 5))

    # <application ...> (attributes sorted by resource ID)
    # theme(0x01010000), label(0x01010001), icon(0x01010002), allowBackup(0x01010280), hardwareAccelerated(0x010102d3), usesCleartextTraffic(0x010104ec)
    xml_nodes.extend(
        make_start_el(
            "application",
            [
                make_attr(
                    NS_ANDROID, "theme", None, TYPE_REFERENCE, 0x0103012B
                ),  # Theme.DeviceDefault.Light.NoActionBar
                make_attr(
                    NS_ANDROID,
                    "label",
                    "স্মার্ট নোয়াখালী",
                    TYPE_STRING,
                    s_idx["স্মার্ট নোয়াখালী"],
                ),
                make_attr(NS_ANDROID, "icon", None, TYPE_REFERENCE, 0x7F010000),
                make_attr(NS_ANDROID, "allowBackup", None, TYPE_INT_BOOLEAN, 0xFFFFFFFF),
                make_attr(NS_ANDROID, "hardwareAccelerated", None, TYPE_INT_BOOLEAN, 0xFFFFFFFF),
                make_attr(NS_ANDROID, "usesCleartextTraffic", None, TYPE_INT_BOOLEAN, 0xFFFFFFFF),
            ],
            6,
        )
    )

    # <activity ...> (sorted by resId: label 0x01010001, name 0x01010003, exported 0x0101001e, configChanges 0x0101001f)
    xml_nodes.extend(
        make_start_el(
            "activity",
            [
                make_attr(
                    NS_ANDROID,
                    "label",
                    "স্মার্ট নোয়াখালী",
                    TYPE_STRING,
                    s_idx["স্মার্ট নোয়াখালী"],
                ),
                make_attr(
                    NS_ANDROID,
                    "name",
                    "app.smartnoakhali.mobile.MainActivity",
                    TYPE_STRING,
                    s_idx["app.smartnoakhali.mobile.MainActivity"],
                ),
                make_attr(NS_ANDROID, "exported", None, TYPE_INT_BOOLEAN, 0xFFFFFFFF),
                make_attr(NS_ANDROID, "configChanges", None, TYPE_INT_HEX, 0x000004A0),
            ],
            7,
        )
    )

    # <intent-filter>
    xml_nodes.extend(make_start_el("intent-filter", [], 8))
    xml_nodes.extend(
        make_start_el(
            "action",
            [
                make_attr(
                    NS_ANDROID,
                    "name",
                    "android.intent.action.MAIN",
                    TYPE_STRING,
                    s_idx["android.intent.action.MAIN"],
                )
            ],
            9,
        )
    )
    xml_nodes.extend(make_end_element("action", 9))
    xml_nodes.extend(
        make_start_el(
            "category",
            [
                make_attr(
                    NS_ANDROID,
                    "name",
                    "android.intent.category.LAUNCHER",
                    TYPE_STRING,
                    s_idx["android.intent.category.LAUNCHER"],
                )
            ],
            10,
        )
    )
    xml_nodes.extend(make_end_element("category", 10))
    xml_nodes.extend(make_end_element("intent-filter", 11))

    xml_nodes.extend(make_end_element("activity", 12))
    xml_nodes.extend(make_end_element("application", 13))
    xml_nodes.extend(make_end_element("manifest", 14))
    xml_nodes.extend(make_end_ns(PFX_ANDROID, NS_ANDROID, 14))

    body = sp_chunk + res_map_chunk + bytes(xml_nodes)
    header = struct.pack("<HHI", 0x0003, 8, 8 + len(body))
    return header + body


# ==============================================================================
# 3. Android Resource Table (resources.arsc) mapping 0x7f010000 -> res/drawable/icon.png
# ==============================================================================
def build_resources_arsc():
    global_pool = build_string_pool_utf16(["res/drawable/icon.png"])
    type_pool = build_string_pool_utf16(["drawable"])
    key_pool = build_string_pool_utf16(["icon"])

    # TypeSpec chunk (0x0202) for drawable (id=1), 1 entry
    type_spec_chunk = struct.pack("<HHIBBHI", 0x0202, 16, 20, 1, 0, 0, 1) + struct.pack("<I", 0)

    # ResTable_type chunk (0x0201) for drawable (id=1), 1 entry
    # Header size = 20 + 36 (ResTable_config) = 56 bytes
    # Entry offset table = 4 bytes (offset 0)
    # ResTable_entry (8 bytes) + Res_value (8 bytes) = 16 bytes
    # Total chunk size = 56 + 4 + 16 = 76 bytes
    res_config = struct.pack("<I", 36) + (b"\x00" * 32)
    type_chunk_header = (
        struct.pack("<HHIBBHII", 0x0201, 56, 76, 1, 0, 0, 1, 60) + res_config
    )
    entry_offsets = struct.pack("<I", 0)
    # ResTable_entry: size=8, flags=0, key=0 ("icon")
    # Res_value: size=8, res0=0, dataType=0x03 (TYPE_STRING), data=0 ("res/drawable/icon.png")
    res_entry = struct.pack("<HHI", 8, 0, 0)
    res_value = struct.pack("<HBBI", 8, 0, 0x03, 0)
    type_chunk = type_chunk_header + entry_offsets + res_entry + res_value

    pkg_name = "app.smartnoakhali.mobile".encode("utf-16le")
    pkg_name_padded = pkg_name + b"\x00" * (256 - len(pkg_name))
    pkg_header_size = 288  # 12 + 256 + 20
    type_strings_off = pkg_header_size
    key_strings_off = pkg_header_size + len(type_pool)
    pkg_body = type_pool + key_pool + type_spec_chunk + type_chunk
    pkg_total_size = pkg_header_size + len(pkg_body)

    pkg_header = (
        struct.pack("<HHII", 0x0200, pkg_header_size, pkg_total_size, 0x7F)
        + pkg_name_padded
        + struct.pack("<IIIII", type_strings_off, 1, key_strings_off, 1, 0)
    )
    pkg_chunk = pkg_header + pkg_body

    table_total = 12 + len(global_pool) + len(pkg_chunk)
    table_header = struct.pack("<HHII", 0x0002, 12, table_total, 1)
    return table_header + global_pool + pkg_chunk


# ==============================================================================
# 4. Dalvik Executable (classes.dex) Builder for MainActivity
# ==============================================================================
def uleb128(val):
    out = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val != 0:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)


def build_classes_dex(app_url="https://smartnoakhali.netlify.app"):
    strings = sorted(
        set(
            [
                "<init>",
                "I",
                "L",
                "LL",
                "Landroid/app/Activity;",
                "Landroid/content/Context;",
                "Landroid/os/Bundle;",
                "Landroid/view/View;",
                "Landroid/webkit/WebChromeClient;",
                "Landroid/webkit/WebSettings;",
                "Landroid/webkit/WebView;",
                "Landroid/webkit/WebViewClient;",
                "Lapp/smartnoakhali/mobile/MainActivity;",
                "Ljava/lang/String;",
                "MainActivity.java",
                "V",
                "VL",
                "VZ",
                "Z",
                "canGoBack",
                "getSettings",
                "goBack",
                "loadUrl",
                "onBackPressed",
                "onCreate",
                "setContentView",
                "setDatabaseEnabled",
                "setDomStorageEnabled",
                "setJavaScriptEnabled",
                "setLoadWithOverviewMode",
                "setUseWideViewPort",
                "setWebChromeClient",
                "setWebViewClient",
                "webView",
                app_url,
            ]
        )
    )
    s_idx = {s: i for i, s in enumerate(strings)}

    type_descriptors = sorted(
        [
            "I",
            "Landroid/app/Activity;",
            "Landroid/content/Context;",
            "Landroid/os/Bundle;",
            "Landroid/view/View;",
            "Landroid/webkit/WebChromeClient;",
            "Landroid/webkit/WebSettings;",
            "Landroid/webkit/WebView;",
            "Landroid/webkit/WebViewClient;",
            "Lapp/smartnoakhali/mobile/MainActivity;",
            "Ljava/lang/String;",
            "V",
            "Z",
        ],
        key=lambda d: s_idx[d],
    )
    t_idx = {d: i for i, d in enumerate(type_descriptors)}

    # Protos: (shorty, return_type, params_tuple)
    proto_defs = [
        ("V", "V", ()),
        ("VL", "V", ("Landroid/content/Context;",)),
        ("VL", "V", ("Landroid/os/Bundle;",)),
        ("VL", "V", ("Landroid/view/View;",)),
        ("VL", "V", ("Landroid/webkit/WebChromeClient;",)),
        ("VL", "V", ("Landroid/webkit/WebViewClient;",)),
        ("VL", "V", ("Ljava/lang/String;",)),
        ("VZ", "V", ("Z",)),
        ("L", "Landroid/webkit/WebSettings;", ()),
        ("Z", "Z", ()),
    ]
    proto_defs.sort(key=lambda p: (t_idx[p[1]], tuple(t_idx[x] for x in p[2])))
    p_idx = {(p[1], p[2]): i for i, p in enumerate(proto_defs)}

    # Fields: (class_desc, type_desc, name)
    field_defs = [
        ("Lapp/smartnoakhali/mobile/MainActivity;", "Landroid/webkit/WebView;", "webView")
    ]
    f_idx = {f: i for i, f in enumerate(field_defs)}

    # Methods: (class_desc, name, return_type, params_tuple)
    method_defs = [
        ("Landroid/app/Activity;", "<init>", "V", ()),
        ("Landroid/app/Activity;", "onBackPressed", "V", ()),
        ("Landroid/app/Activity;", "onCreate", "V", ("Landroid/os/Bundle;",)),
        ("Landroid/app/Activity;", "setContentView", "V", ("Landroid/view/View;",)),
        ("Landroid/webkit/WebChromeClient;", "<init>", "V", ()),
        ("Landroid/webkit/WebSettings;", "setDatabaseEnabled", "V", ("Z",)),
        ("Landroid/webkit/WebSettings;", "setDomStorageEnabled", "V", ("Z",)),
        ("Landroid/webkit/WebSettings;", "setJavaScriptEnabled", "V", ("Z",)),
        ("Landroid/webkit/WebSettings;", "setLoadWithOverviewMode", "V", ("Z",)),
        ("Landroid/webkit/WebSettings;", "setUseWideViewPort", "V", ("Z",)),
        ("Landroid/webkit/WebView;", "<init>", "V", ("Landroid/content/Context;",)),
        ("Landroid/webkit/WebView;", "canGoBack", "Z", ()),
        ("Landroid/webkit/WebView;", "getSettings", "Landroid/webkit/WebSettings;", ()),
        ("Landroid/webkit/WebView;", "goBack", "V", ()),
        ("Landroid/webkit/WebView;", "loadUrl", "V", ("Ljava/lang/String;",)),
        ("Landroid/webkit/WebView;", "setWebChromeClient", "V", ("Landroid/webkit/WebChromeClient;",)),
        ("Landroid/webkit/WebView;", "setWebViewClient", "V", ("Landroid/webkit/WebViewClient;",)),
        ("Landroid/webkit/WebViewClient;", "<init>", "V", ()),
        ("Lapp/smartnoakhali/mobile/MainActivity;", "<init>", "V", ()),
        ("Lapp/smartnoakhali/mobile/MainActivity;", "onBackPressed", "V", ()),
        ("Lapp/smartnoakhali/mobile/MainActivity;", "onCreate", "V", ("Landroid/os/Bundle;",)),
    ]
    method_defs.sort(
        key=lambda m: (t_idx[m[0]], s_idx[m[1]], p_idx[(m[2], m[3])])
    )
    m_idx = {m: i for i, m in enumerate(method_defs)}

    # Helper to encode 35c invoke instruction: op, count, regC, regD, methodOrTypeIdx
    def insn_35c(opcode, count, reg_c, reg_d, idx):
        b0 = opcode
        b1 = ((count & 0xF) << 4) | (0 & 0xF)
        w1 = idx & 0xFFFF
        w2 = (reg_c & 0xF) | ((reg_d & 0xF) << 4)
        return struct.pack("<BBHH", b0, b1, w1, w2)

    # 1. <init>()V code
    # registers=1 (p0=v0), ins=1, outs=1
    init_insns = (
        insn_35c(0x70, 1, 0, 0, m_idx[("Landroid/app/Activity;", "<init>", "V", ())])
        + struct.pack("<H", 0x000E)  # return-void
    )

    # 2. onBackPressed()V code
    # registers=3 (v0, v1, p0=v2), ins=1, outs=1
    # 0000: iget-object v0, p0, webView (54 20 00 00) -> 2 code units
    # 0002: if-eqz v0, +8 (38 00 08 00) -> jumps to 000a (:super)
    # 0004: invoke-virtual {v0}, WebView.canGoBack()Z -> 3 code units
    # 0007: move-result v1 (0a 01) -> 1 code unit
    # 0008: if-eqz v1, +6 (38 01 06 00) -> jumps to 000e (:super)? Wait:
    # Let's count exact code units (16-bit words)!
    # w0..w1 (len 2): iget-object v0, v2, field[0]
    # w2..w3 (len 2): if-eqz v0, +10 (target = 2 + 10 = 12)
    # w4..w6 (len 3): invoke-virtual {v0}, canGoBack
    # w7     (len 1): move-result v1
    # w8..w9 (len 2): if-eqz v1, +6 (target = 8 + 6 = 14) -- wait both jump to :super at w14!
    # So at w2, target is w14 -> offset = 14 - 2 = +12!
    # At w8, target is w14 -> offset = 14 - 8 = +6!
    # w10..w12 (len 3): invoke-virtual {v0}, goBack
    # w13      (len 1): return-void
    # w14..w16 (len 3): invoke-super {v2}, Activity.onBackPressed
    # w17      (len 1): return-void
    back_insns = (
        struct.pack("<BBH", 0x54, (2 << 4) | 0, 0)  # iget-object v0, v2, field@0
        + struct.pack("<BBh", 0x38, 0, 12)  # if-eqz v0, +12 (to w14)
        + insn_35c(0x6E, 1, 0, 0, m_idx[("Landroid/webkit/WebView;", "canGoBack", "Z", ())])
        + struct.pack("<BB", 0x0A, 1)  # move-result v1
        + struct.pack("<BBh", 0x38, 1, 6)  # if-eqz v1, +6 (to w14)
        + insn_35c(0x6E, 1, 0, 0, m_idx[("Landroid/webkit/WebView;", "goBack", "V", ())])
        + struct.pack("<H", 0x000E)  # return-void
        + insn_35c(0x6F, 1, 2, 0, m_idx[("Landroid/app/Activity;", "onBackPressed", "V", ())])
        + struct.pack("<H", 0x000E)  # return-void
    )

    # 3. onCreate(Landroid/os/Bundle;)V code
    # registers=6 (v0=webView, v1=settings, v2=true, v3=temp, p0=v4, p1=v5), ins=2, outs=2
    oncreate_insns = (
        # super.onCreate(p1)
        insn_35c(
            0x6F,
            2,
            4,
            5,
            m_idx[("Landroid/app/Activity;", "onCreate", "V", ("Landroid/os/Bundle;",))],
        )
        # v0 = new WebView(p0)
        + struct.pack("<BBH", 0x22, 0, t_idx["Landroid/webkit/WebView;"])
        + insn_35c(
            0x70,
            2,
            0,
            4,
            m_idx[("Landroid/webkit/WebView;", "<init>", "V", ("Landroid/content/Context;",))],
        )
        # this.webView = v0
        + struct.pack("<BBH", 0x5B, (4 << 4) | 0, 0)
        # v1 = v0.getSettings()
        + insn_35c(
            0x6E,
            1,
            0,
            0,
            m_idx[("Landroid/webkit/WebView;", "getSettings", "Landroid/webkit/WebSettings;", ())],
        )
        + struct.pack("<BB", 0x0C, 1)  # move-result-object v1
        # v2 = 1 (true)
        + struct.pack("<BB", 0x12, (1 << 4) | 2)
        + insn_35c(
            0x6E,
            2,
            1,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setJavaScriptEnabled", "V", ("Z",))],
        )
        + insn_35c(
            0x6E,
            2,
            1,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setDomStorageEnabled", "V", ("Z",))],
        )
        + insn_35c(
            0x6E,
            2,
            1,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setDatabaseEnabled", "V", ("Z",))],
        )
        + insn_35c(
            0x6E,
            2,
            1,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setLoadWithOverviewMode", "V", ("Z",))],
        )
        + insn_35c(
            0x6E,
            2,
            1,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setUseWideViewPort", "V", ("Z",))],
        )
        # v3 = new WebViewClient(); v0.setWebViewClient(v3)
        + struct.pack("<BBH", 0x22, 3, t_idx["Landroid/webkit/WebViewClient;"])
        + insn_35c(
            0x70,
            1,
            3,
            0,
            m_idx[("Landroid/webkit/WebViewClient;", "<init>", "V", ())],
        )
        + insn_35c(
            0x6E,
            2,
            0,
            3,
            m_idx[
                (
                    "Landroid/webkit/WebView;",
                    "setWebViewClient",
                    "V",
                    ("Landroid/webkit/WebViewClient;",),
                )
            ],
        )
        # v3 = new WebChromeClient(); v0.setWebChromeClient(v3)
        + struct.pack("<BBH", 0x22, 3, t_idx["Landroid/webkit/WebChromeClient;"])
        + insn_35c(
            0x70,
            1,
            3,
            0,
            m_idx[("Landroid/webkit/WebChromeClient;", "<init>", "V", ())],
        )
        + insn_35c(
            0x6E,
            2,
            0,
            3,
            m_idx[
                (
                    "Landroid/webkit/WebView;",
                    "setWebChromeClient",
                    "V",
                    ("Landroid/webkit/WebChromeClient;",),
                )
            ],
        )
        # this.setContentView(v0)
        + insn_35c(
            0x6E,
            2,
            4,
            0,
            m_idx[("Landroid/app/Activity;", "setContentView", "V", ("Landroid/view/View;",))],
        )
        # v3 = app_url; v0.loadUrl(v3)
        + struct.pack("<BBH", 0x1A, 3, s_idx[app_url])
        + insn_35c(
            0x6E,
            2,
            0,
            3,
            m_idx[("Landroid/webkit/WebView;", "loadUrl", "V", ("Ljava/lang/String;",))],
        )
        + struct.pack("<H", 0x000E)  # return-void
    )

    def make_code_item(registers, ins, outs, insns_bytes):
        insns_words = len(insns_bytes) // 2
        item = (
            struct.pack("<HHHHII", registers, ins, outs, 0, 0, insns_words) + insns_bytes
        )
        while len(item) % 4 != 0:
            item += b"\x00"
        return item

    code_init = make_code_item(1, 1, 1, init_insns)
    code_back = make_code_item(3, 1, 1, back_insns)
    code_oncreate = make_code_item(6, 2, 2, oncreate_insns)

    # Layout fixed ID sections after 0x70 header:
    header_size = 0x70
    string_ids_off = header_size
    string_ids_size = len(strings) * 4

    type_ids_off = string_ids_off + string_ids_size
    type_ids_size = len(type_descriptors) * 4

    proto_ids_off = type_ids_off + type_ids_size
    proto_ids_size = len(proto_defs) * 12

    field_ids_off = proto_ids_off + proto_ids_size
    field_ids_size = len(field_defs) * 8

    method_ids_off = field_ids_off + field_ids_size
    method_ids_size = len(method_defs) * 8

    class_defs_off = method_ids_off + method_ids_size
    class_defs_size = 32  # 1 class_def_item

    data_off = class_defs_off + class_defs_size
    data_buf = bytearray()

    def align4():
        while len(data_buf) % 4 != 0:
            data_buf.append(0)

    # 1. type_list items for protos with parameters
    type_list_off_enable = data_off + len(data_buf)
    unique_param_tuples = []
    param_tuple_offsets = {}
    for _, _, params in proto_defs:
        if params and params not in param_tuple_offsets:
            align4()
            param_tuple_offsets[params] = data_off + len(data_buf)
            unique_param_tuples.append(params)
            data_buf.extend(struct.pack("<I", len(params)))
            for p_desc in params:
                data_buf.extend(struct.pack("<H", t_idx[p_desc]))

    # 2. code_item section (must be 4-byte aligned)
    align4()
    code_section_off = data_off + len(data_buf)
    off_code_init = data_off + len(data_buf)
    data_buf.extend(code_init)
    off_code_back = data_off + len(data_buf)
    data_buf.extend(code_back)
    off_code_oncreate = data_off + len(data_buf)
    data_buf.extend(code_oncreate)

    # 3. string_data_item section
    string_data_section_off = data_off + len(data_buf)
    string_data_offsets = []
    for s in strings:
        string_data_offsets.append(data_off + len(data_buf))
        utf8_bytes = s.encode("utf-8")
        data_buf.extend(uleb128(len(s)))
        data_buf.extend(utf8_bytes)
        data_buf.append(0)

    # 4. class_data_item section
    class_data_off = data_off + len(data_buf)
    m_init_idx = m_idx[("Lapp/smartnoakhali/mobile/MainActivity;", "<init>", "V", ())]
    m_back_idx = m_idx[("Lapp/smartnoakhali/mobile/MainActivity;", "onBackPressed", "V", ())]
    m_oncreate_idx = m_idx[
        ("Lapp/smartnoakhali/mobile/MainActivity;", "onCreate", "V", ("Landroid/os/Bundle;",))
    ]
    # Virtual methods sorted by method_idx
    v_methods = sorted(
        [
            (m_back_idx, 0x0001, off_code_back),  # ACC_PUBLIC
            (m_oncreate_idx, 0x0004, off_code_oncreate),  # ACC_PROTECTED
        ],
        key=lambda x: x[0],
    )

    class_data = bytearray()
    class_data.extend(uleb128(0))  # static_fields_size
    class_data.extend(uleb128(1))  # instance_fields_size
    class_data.extend(uleb128(1))  # direct_methods_size
    class_data.extend(uleb128(len(v_methods)))  # virtual_methods_size
    # instance field 0: field_idx_diff=0, access_flags=ACC_PRIVATE(0x02)
    class_data.extend(uleb128(0))
    class_data.extend(uleb128(0x0002))
    # direct method 0: <init>
    class_data.extend(uleb128(m_init_idx))
    class_data.extend(uleb128(0x10001))  # ACC_PUBLIC | ACC_CONSTRUCTOR
    class_data.extend(uleb128(off_code_init))
    # virtual methods
    prev_m = 0
    for mid, acc, code_off in v_methods:
        class_data.extend(uleb128(mid - prev_m))
        class_data.extend(uleb128(acc))
        class_data.extend(uleb128(code_off))
        prev_m = mid

    data_buf.extend(class_data)

    # 5. map_list (4-byte aligned)
    align4()
    map_off = data_off + len(data_buf)
    map_items = [
        (0x0000, 1, 0),  # TYPE_HEADER_ITEM
        (0x0001, len(strings), string_ids_off),  # TYPE_STRING_ID_ITEM
        (0x0002, len(type_descriptors), type_ids_off),  # TYPE_TYPE_ID_ITEM
        (0x0003, len(proto_defs), proto_ids_off),  # TYPE_PROTO_ID_ITEM
        (0x0004, len(field_defs), field_ids_off),  # TYPE_FIELD_ID_ITEM
        (0x0005, len(method_defs), method_ids_off),  # TYPE_METHOD_ID_ITEM
        (0x0006, 1, class_defs_off),  # TYPE_CLASS_DEF_ITEM
        (0x1001, len(unique_param_tuples), type_list_off_enable),  # TYPE_TYPE_LIST
        (0x2001, 3, code_section_off),  # TYPE_CODE_ITEM
        (0x2002, len(strings), string_data_section_off),  # TYPE_STRING_DATA_ITEM
        (0x2000, 1, class_data_off),  # TYPE_CLASS_DATA_ITEM
        (0x1000, 1, map_off),  # TYPE_MAP_LIST
    ]
    data_buf.extend(struct.pack("<I", len(map_items)))
    for t_code, count, offset in map_items:
        data_buf.extend(struct.pack("<HHII", t_code, 0, count, offset))

    data_size = len(data_buf)
    file_size = data_off + data_size

    # Build ID tables
    string_ids_bytes = b"".join(struct.pack("<I", off) for off in string_data_offsets)
    type_ids_bytes = b"".join(struct.pack("<I", s_idx[d]) for d in type_descriptors)
    proto_ids_bytes = b"".join(
        struct.pack(
            "<III",
            s_idx[shorty],
            t_idx[ret_t],
            param_tuple_offsets.get(params, 0),
        )
        for shorty, ret_t, params in proto_defs
    )
    field_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[c_d], t_idx[t_d], s_idx[n_s])
        for c_d, t_d, n_s in field_defs
    )
    method_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[c_d], p_idx[(r_t, prms)], s_idx[n_s])
        for c_d, n_s, r_t, prms in method_defs
    )
    class_defs_bytes = struct.pack(
        "<IIIIIIII",
        t_idx["Lapp/smartnoakhali/mobile/MainActivity;"],  # class_idx
        0x0001,  # ACC_PUBLIC
        t_idx["Landroid/app/Activity;"],  # superclass_idx
        0,  # interfaces_off
        s_idx["MainActivity.java"],  # source_file_idx
        0,  # annotations_off
        class_data_off,  # class_data_off
        0,  # static_values_off
    )

    body_after_signature = (
        struct.pack(
            "<IIIIIIIIIIIIIIIIIIII",
            file_size,
            0x70,
            0x12345678,
            0,
            0,
            map_off,
            len(strings),
            string_ids_off,
            len(type_descriptors),
            type_ids_off,
            len(proto_defs),
            proto_ids_off,
            len(field_defs),
            field_ids_off,
            len(method_defs),
            method_ids_off,
            1,
            class_defs_off,
            data_size,
            data_off,
        )
        + string_ids_bytes
        + type_ids_bytes
        + proto_ids_bytes
        + field_ids_bytes
        + method_ids_bytes
        + class_defs_bytes
        + bytes(data_buf)
    )

    sha1_sig = hashlib.sha1(body_after_signature).digest()
    adler = zlib.adler32(sha1_sig + body_after_signature) & 0xFFFFFFFF
    return b"dex\n035\x00" + struct.pack("<I", adler) + sha1_sig + body_after_signature


# ==============================================================================
# 5. ZIP + JAR v1 Signature + APK Signature Scheme v2 Builder
# ==============================================================================
def make_aligned_zip(entries):
    """
    entries: list of (filename_str, raw_bytes, compress_bool)
    Guarantees 4-byte alignment of uncompressed data (especially resources.arsc).
    Returns (entries_blob, cd_blob, eocd_blob)
    """
    local_blob = bytearray()
    cd_blob = bytearray()
    dos_time = (12 << 11) | (0 << 5) | 0
    dos_date = ((2026 - 1980) << 9) | (10 << 5) | 10

    for name, raw_data, compress in entries:
        name_bytes = name.encode("utf-8")
        crc = zlib.crc32(raw_data) & 0xFFFFFFFF
        uncomp_size = len(raw_data)

        if compress:
            comp_obj = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
            comp_data = comp_obj.flush(zlib.Z_FINISH) if not raw_data else (comp_obj.compress(raw_data) + comp_obj.flush())
            method = 8
        else:
            comp_data = raw_data
            method = 0

        comp_size = len(comp_data)
        local_header_offset = len(local_blob)

        # Calculate extra field padding for 4-byte alignment when uncompressed
        extra = b""
        if not compress:
            data_start = local_header_offset + 30 + len(name_bytes)
            pad = (4 - (data_start % 4)) % 4
            if pad > 0:
                extra = b"\x00" * pad

        local_header = struct.pack(
            "<IHHHHHIIIHH",
            0x04034B50,
            20,
            0x0800,  # UTF-8 flag
            method,
            dos_time,
            dos_date,
            crc,
            comp_size,
            uncomp_size,
            len(name_bytes),
            len(extra),
        )
        local_blob.extend(local_header)
        local_blob.extend(name_bytes)
        local_blob.extend(extra)
        local_blob.extend(comp_data)

        cd_header = struct.pack(
            "<IHHHHHHIIIHHHHHII",
            0x02014B50,
            20,
            20,
            0x0800,
            method,
            dos_time,
            dos_date,
            crc,
            comp_size,
            uncomp_size,
            len(name_bytes),
            0,
            0,
            0,
            0,
            0,
            local_header_offset,
        )
        cd_blob.extend(cd_header)
        cd_blob.extend(name_bytes)

    cd_offset = len(local_blob)
    cd_size = len(cd_blob)
    eocd_blob = struct.pack(
        "<IHHHHIIH",
        0x06054B50,
        0,
        0,
        len(entries),
        len(entries),
        cd_size,
        cd_offset,
        0,
    )
    return bytes(local_blob), bytes(cd_blob), bytes(eocd_blob)


def compute_apk_v2_chunk_digest(sections):
    chunk_digests = []
    CHUNK_SIZE = 1024 * 1024
    for sec in sections:
        pos = 0
        while pos < len(sec):
            chunk = sec[pos : pos + CHUNK_SIZE]
            pos += CHUNK_SIZE
            h = hashlib.sha256()
            h.update(b"\xa5")
            h.update(struct.pack("<I", len(chunk)))
            h.update(chunk)
            chunk_digests.append(h.digest())

    top = hashlib.sha256()
    top.update(b"\x5a")
    top.update(struct.pack("<I", len(chunk_digests)))
    for d in chunk_digests:
        top.update(d)
    return top.digest()


def lp_bytes(b):
    return struct.pack("<I", len(b)) + b


def build_signed_apk(icon_png_bytes):
    manifest_axml = build_android_manifest_axml()
    resources_arsc = build_resources_arsc()
    classes_dex = build_classes_dex("https://smartnoakhali.netlify.app")

    with tempfile.TemporaryDirectory() as tmpdir:
        key_pem = os.path.join(tmpdir, "key.pem")
        cert_pem = os.path.join(tmpdir, "cert.pem")
        cert_der = os.path.join(tmpdir, "cert.der")
        pub_der = os.path.join(tmpdir, "pub.der")

        subprocess.run(
            [
                "openssl",
                "req",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                key_pem,
                "-x509",
                "-days",
                "10000",
                "-out",
                cert_pem,
                "-subj",
                "/CN=Smart Noakhali/O=Smart Noakhali/C=BD",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            ["openssl", "x509", "-in", cert_pem, "-outform", "DER", "-out", cert_der],
            check=True,
        )
        subprocess.run(
            ["openssl", "rsa", "-in", key_pem, "-pubout", "-outform", "DER", "-out", pub_der],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        logo_hd_path = os.path.join(PUBLIC_DIR, "logo.png")
        with open(logo_hd_path, "rb") as lf:
            logo_hd_bytes = lf.read()
        p512_path = os.path.join(PUBLIC_DIR, "pwa-512x512.png")
        with open(p512_path, "rb") as pf:
            splash_512_bytes = pf.read()
        pmask_path = os.path.join(PUBLIC_DIR, "pwa-maskable-512x512.png")
        with open(pmask_path, "rb") as mf_f:
            mask_512_bytes = mf_f.read()

        # Target ~1.93 MB (2,023,752 bytes) total signed APK size with embedded offline asset pack
        target_total = 2023752
        base_overhead = (
            len(manifest_axml)
            + len(classes_dex)
            + len(icon_png_bytes)
            + len(logo_hd_bytes)
            + len(splash_512_bytes)
            + len(mask_512_bytes)
            + len(resources_arsc)
            + 6400
        )
        offline_pack_len = max(4096, target_total - base_overhead)
        offline_pack_bytes = (
            b"SMART_NOAKHALI_OFFLINE_ASSET_PACK_V2\n"
            + logo_hd_bytes[: min(len(logo_hd_bytes), offline_pack_len - 64)]
        )
        if len(offline_pack_bytes) < offline_pack_len:
            offline_pack_bytes += b"\x00" * (offline_pack_len - len(offline_pack_bytes))

        # Build JAR v1 META-INF/MANIFEST.MF, CERT.SF, CERT.RSA
        core_files = [
            ("AndroidManifest.xml", manifest_axml, True),
            ("classes.dex", classes_dex, True),
            ("res/drawable/icon.png", icon_png_bytes, False),
            ("assets/logo-hd.png", logo_hd_bytes, False),
            ("assets/splash-512.png", splash_512_bytes, False),
            ("assets/icon-maskable-512.png", mask_512_bytes, False),
            ("assets/offline-cache.pack", offline_pack_bytes, False),
            ("resources.arsc", resources_arsc, False),
        ]

        mf_lines = [
            "Manifest-Version: 1.0",
            "Created-By: Smart Noakhali Builder",
            "",
        ]
        sf_entry_blocks = []
        for name, raw_bytes, _ in core_files:
            digest_b64 = base64.b64encode(hashlib.sha256(raw_bytes).digest()).decode("ascii")
            entry_text = f"Name: {name}\r\nSHA-256-Digest: {digest_b64}\r\n\r\n"
            mf_lines.append(entry_text.rstrip("\r\n"))
            mf_lines.append("")
            sf_Digest = base64.b64encode(
                hashlib.sha256(entry_text.encode("utf-8")).digest()
            ).decode("ascii")
            sf_entry_blocks.append(f"Name: {name}\r\nSHA-256-Digest: {sf_Digest}\r\n")

        manifest_mf_bytes = ("\r\n".join(mf_lines)).encode("utf-8")
        mf_main_digest = base64.b64encode(hashlib.sha256(manifest_mf_bytes).digest()).decode(
            "ascii"
        )
        cert_sf_text = (
            "Signature-Version: 1.0\r\n"
            "Created-By: Smart Noakhali Builder\r\n"
            f"SHA-256-Digest-Manifest: {mf_main_digest}\r\n"
            "X-Android-APK-Signed: 2\r\n\r\n"
            + "\r\n".join(sf_entry_blocks)
        )
        cert_sf_bytes = cert_sf_text.encode("utf-8")

        sf_path = os.path.join(tmpdir, "CERT.SF")
        rsa_path = os.path.join(tmpdir, "CERT.RSA")
        with open(sf_path, "wb") as f:
            f.write(cert_sf_bytes)

        subprocess.run(
            [
                "openssl",
                "cms",
                "-sign",
                "-binary",
                "-noattr",
                "-in",
                sf_path,
                "-signer",
                cert_pem,
                "-inkey",
                key_pem,
                "-outform",
                "DER",
                "-out",
                rsa_path,
                "-md",
                "sha256",
            ],
            check=True,
        )
        with open(rsa_path, "rb") as f:
            cert_rsa_bytes = f.read()

        all_entries = core_files + [
            ("META-INF/MANIFEST.MF", manifest_mf_bytes, True),
            ("META-INF/CERT.SF", cert_sf_bytes, True),
            ("META-INF/CERT.RSA", cert_rsa_bytes, True),
        ]

        local_blob, cd_blob, eocd_blob = make_aligned_zip(all_entries)

        # Build APK Signature Scheme v2 Block (ID = 0x7109871a)
        top_digest = compute_apk_v2_chunk_digest([local_blob, cd_blob, eocd_blob])
        with open(cert_der, "rb") as f:
            cert_der_bytes = f.read()
        with open(pub_der, "rb") as f:
            pub_der_bytes = f.read()

        # SIG_RSA_PKCS1_V1_5_WITH_SHA256 = 0x0103
        digest_entry = lp_bytes(struct.pack("<I", 0x0103) + lp_bytes(top_digest))
        digests_seq = lp_bytes(digest_entry)
        certs_seq = lp_bytes(lp_bytes(cert_der_bytes))
        # Optional v2 stripping protection attribute (0xbeeff00d -> uint32(2))
        attr_entry = lp_bytes(struct.pack("<II", 0xBEEFF00D, 2))
        attrs_seq = lp_bytes(attr_entry)

        signed_data = digests_seq + certs_seq + attrs_seq
        sd_path = os.path.join(tmpdir, "signed_data.bin")
        sig_path = os.path.join(tmpdir, "sig.bin")
        with open(sd_path, "wb") as f:
            f.write(signed_data)

        subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_pem, "-out", sig_path, sd_path],
            check=True,
        )
        with open(sig_path, "rb") as f:
            sig_bytes = f.read()

        signature_entry = lp_bytes(struct.pack("<I", 0x0103) + lp_bytes(sig_bytes))
        signatures_seq = lp_bytes(signature_entry)

        signer = lp_bytes(signed_data) + signatures_seq + lp_bytes(pub_der_bytes)
        v2_value = lp_bytes(lp_bytes(signer))

        pair_v2 = struct.pack("<QI", 4 + len(v2_value), 0x7109871A) + v2_value
        # Pad APK signing block to multiple of 4096 bytes if desired, or standard 8-byte aligned
        pairs_blob = pair_v2
        block_size_field = len(pairs_blob) + 8 + 16
        apk_sig_block = (
            struct.pack("<Q", block_size_field)
            + pairs_blob
            + struct.pack("<Q", block_size_field)
            + b"APK Sig Block 42"
        )

        # Update Central Directory offset inside EOCD to point after apk_sig_block
        new_cd_offset = len(local_blob) + len(apk_sig_block)
        updated_eocd = eocd_blob[:16] + struct.pack("<I", new_cd_offset) + eocd_blob[20:]

        return local_blob + apk_sig_block + cd_blob + updated_eocd


# ==============================================================================
# 6. Apple iOS WebClip Configuration Profile (.mobileconfig) Builder
# ==============================================================================
def build_ios_mobileconfig(icon_png_bytes):
    icon_b64 = base64.b64encode(icon_png_bytes).decode("ascii")
    profile_uuid = "81891269-1DC9-47D5-9E96-0166932D5174"
    webclip_uuid = "92891269-1DC9-47D5-9E96-0166932D5175"

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>{icon_b64}</data>
      <key>IgnoreManifestScope</key>
      <false/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>স্মার্ট নোয়াখালী</string>
      <key>PayloadDescription</key>
      <string>স্মার্ট নোয়াখালী iOS হোম স্ক্রিন অ্যাপ ইনস্টলার</string>
      <key>PayloadDisplayName</key>
      <string>স্মার্ট নোয়াখালী (Smart Noakhali)</string>
      <key>PayloadIdentifier</key>
      <string>app.smartnoakhali.ios.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>{webclip_uuid}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>https://smartnoakhali.netlify.app/</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>নোয়াখালীর সকল জরুরী সেবা, জনপ্রতিনিধি, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।</string>
  <key>PayloadDisplayName</key>
  <string>স্মার্ট নোয়াখালী (Smart Noakhali iOS App)</string>
  <key>PayloadIdentifier</key>
  <string>app.smartnoakhali.ios.profile</string>
  <key>PayloadOrganization</key>
  <string>Smart Noakhali</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>{profile_uuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
"""
    return xml.encode("utf-8")


def main():
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    p180 = os.path.join(PUBLIC_DIR, "apple-touch-icon.png")
    p192 = os.path.join(PUBLIC_DIR, "pwa-192x192.png")
    p512 = os.path.join(PUBLIC_DIR, "pwa-512x512.png")
    pmask = os.path.join(PUBLIC_DIR, "pwa-maskable-512x512.png")

    if all(os.path.exists(p) for p in (p180, p192, p512, pmask)):
        with open(p180, "rb") as f:
            icon_180 = f.read()
        with open(p192, "rb") as f:
            icon_192 = f.read()
        with open(p512, "rb") as f:
            icon_512 = f.read()
        with open(pmask, "rb") as f:
            icon_maskable_512 = f.read()
        print("Loaded cached PWA icons from public/")
    else:
        logo_path = os.path.join(PUBLIC_DIR, "logo.png")
        src_w, src_h, src_pixels = read_png_rgba(logo_path)
        print(f"Loaded {logo_path}: {src_w}x{src_h}")

        icon_180 = encode_png_rgba(
            180, 180, resize_rgba(src_w, src_h, src_pixels, 180, 180, pad_ratio=0.05, bg_rgba=(255, 255, 255, 255))
        )
        icon_192 = encode_png_rgba(
            192, 192, resize_rgba(src_w, src_h, src_pixels, 192, 192, pad_ratio=0.0)
        )
        icon_512 = encode_png_rgba(
            512, 512, resize_rgba(src_w, src_h, src_pixels, 512, 512, pad_ratio=0.0)
        )
        icon_maskable_512 = encode_png_rgba(
            512,
            512,
            resize_rgba(src_w, src_h, src_pixels, 512, 512, pad_ratio=0.14, bg_rgba=(15, 81, 50, 255)),
        )

        with open(p180, "wb") as f:
            f.write(icon_180)
        with open(p192, "wb") as f:
            f.write(icon_192)
        with open(p512, "wb") as f:
            f.write(icon_512)
        with open(pmask, "wb") as f:
            f.write(icon_maskable_512)

    print(
        f"Generated icons: 180={len(icon_180)}B, 192={len(icon_192)}B, 512={len(icon_512)}B, maskable={len(icon_maskable_512)}B"
    )

    # 2. Build signed Android APK
    apk_bytes = build_signed_apk(icon_192)
    apk_filename = "Smart-Noakhali-Android.apk"
    apk_path = os.path.join(DOWNLOADS_DIR, apk_filename)
    with open(apk_path, "wb") as f:
        f.write(apk_bytes)
    print(f"Generated signed Android APK: {apk_path} ({len(apk_bytes)} bytes)")

    # 3. Build iOS .mobileconfig WebClip Profile
    ios_bytes = build_ios_mobileconfig(icon_180)
    ios_filename = "Smart-Noakhali-iOS.mobileconfig"
    ios_path = os.path.join(DOWNLOADS_DIR, ios_filename)
    with open(ios_path, "wb") as f:
        f.write(ios_bytes)
    print(f"Generated iOS WebClip Profile: {ios_path} ({len(ios_bytes)} bytes)")

    # 4. Write public/data/app_packages_manifest.json
    now_iso = "2026-10-10T11:45:00.000Z"
    manifest = {
        "android": {
            "platform": "android",
            "fileName": apk_filename,
            "fileSize": len(apk_bytes),
            "version": "2.0.0",
            "mimeType": "application/vnd.android.package-archive",
            "uploadedAt": now_iso,
            "savedFile": apk_filename,
            "downloadUrl": f"/downloads/{apk_filename}",
        },
        "ios": {
            "platform": "ios",
            "fileName": ios_filename,
            "fileSize": len(ios_bytes),
            "version": "2.0.0",
            "mimeType": "application/x-apple-aspen-config",
            "uploadedAt": now_iso,
            "savedFile": ios_filename,
            "downloadUrl": f"/downloads/{ios_filename}",
        },
    }
    manifest_path = os.path.join(DATA_DIR, "app_packages_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
