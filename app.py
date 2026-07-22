import io
import os
import threading
import webbrowser
import zipfile

from flask import Flask, render_template, request, send_file, jsonify
from PIL import Image, ImageFilter

app = Flask(__name__)

ALL_SIZES = [16, 24, 32, 48, 64, 96, 128, 256]
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB per file
MAX_FILES = 100
HOST, PORT = "127.0.0.1", 5000

# Antialiasing presets. "resample" is the filter used to shrink the source
# image down to each icon size; "blur" is a softening pass applied to each
# resized frame, scaled relative to its size so small and large icons soften
# by a proportionally similar amount.
AA_PRESETS = {
    "crisp":    {"resample": Image.Resampling.NEAREST, "blur_factor": 0.0},
    "standard": {"resample": Image.Resampling.LANCZOS, "blur_factor": 0.0},
    "soft":     {"resample": Image.Resampling.LANCZOS, "blur_factor": 0.00200},
    "extra":    {"resample": Image.Resampling.LANCZOS, "blur_factor": 0.00300},
}
DEFAULT_AA = "crisp"


@app.route("/")
def index():
    return render_template("index.html", sizes=ALL_SIZES)


def build_ico_bytes(raw: bytes, sizes: list[int], aa_key: str) -> bytes:
    """Turn raw PNG bytes into an in-memory multi-size .ico, honoring the
    chosen antialiasing preset for every frame."""
    preset = AA_PRESETS.get(aa_key, AA_PRESETS[DEFAULT_AA])
    resample = preset["resample"]
    blur_factor = preset["blur_factor"]

    base = Image.open(io.BytesIO(raw))
    base.load()
    if base.mode != "RGBA":
        base = base.convert("RGBA")

    frames = {}
    for size in sizes:
        frame = base.resize((size, size), resample=resample)
        if blur_factor > 0:
            radius = max(0.25, size * blur_factor)
            frame = frame.filter(ImageFilter.GaussianBlur(radius=radius))
        frames[size] = frame

    main_size = max(sizes)
    main_frame = frames[main_size]
    other_frames = [frames[s] for s in sizes if s != main_size]

    out = io.BytesIO()
    main_frame.save(
        out,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=other_frames,
    )
    out.seek(0)
    return out.read()


@app.route("/convert", methods=["POST"])
def convert():
    files = request.files.getlist("images") or request.files.getlist("image")
    files = [f for f in files if f and f.filename]

    if not files:
        return jsonify({"error": "No file received."}), 400
    if len(files) > MAX_FILES:
        return jsonify({"error": f"You can select up to {MAX_FILES} files at once."}), 400

    sizes_raw = request.form.get("sizes", "")
    try:
        selected = sorted({int(s) for s in sizes_raw.split(",") if s.strip()})
    except ValueError:
        return jsonify({"error": "Invalid size list."}), 400
    selected = [s for s in selected if s in ALL_SIZES]
    if not selected:
        return jsonify({"error": "Select at least one size."}), 400

    aa_key = request.form.get("antialiasing", DEFAULT_AA)
    if aa_key not in AA_PRESETS:
        aa_key = DEFAULT_AA

    results = []   # (download_name, ico_bytes)
    skipped = []   # filenames that failed

    for f in files:
        name = f.filename
        if not name.lower().endswith(".png"):
            skipped.append(name)
            continue
        raw = f.read()
        if len(raw) > MAX_UPLOAD_BYTES:
            skipped.append(name)
            continue
        try:
            ico_bytes = build_ico_bytes(raw, selected, aa_key)
        except Exception:
            skipped.append(name)
            continue

        base_name = os.path.splitext(os.path.basename(name))[0] or "icon"
        results.append((f"{base_name}.ico", ico_bytes))

    if not results:
        return jsonify({"error": "None of those files could be added. Make sure they're PNGs."}), 400

    skipped_header = ",".join(skipped)[:2000]  # keep header size sane

    if len(results) == 1:
        download_name, ico_bytes = results[0]
        resp = send_file(
            io.BytesIO(ico_bytes),
            mimetype="image/vnd.microsoft.icon",
            as_attachment=True,
            download_name=download_name,
        )
        resp.headers["X-Skipped"] = skipped_header
        resp.headers["Access-Control-Expose-Headers"] = "X-Skipped, Content-Disposition"
        return resp

    # Batch: pack every generated .ico into one zip.
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        used_names = set()
        for download_name, ico_bytes in results:
            final_name = download_name
            n = 2
            while final_name in used_names:
                final_name = f"{os.path.splitext(download_name)[0]}-{n}.ico"
                n += 1
            used_names.add(final_name)
            zf.writestr(final_name, ico_bytes)
    zip_buf.seek(0)

    resp = send_file(
        zip_buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name="ICO-X_PACK.zip",
    )
    resp.headers["X-Skipped"] = skipped_header
    resp.headers["Access-Control-Expose-Headers"] = "X-Skipped, Content-Disposition"
    return resp

def _open_browser():
    webbrowser.open(f"http://{HOST}:{PORT}")

if __name__ == "__main__":
    # use_reloader=False prevents the browser from opening twice 
    # (Flask's reloader creates a parent and child process).
    threading.Timer(1.0, _open_browser).start()
    app.run(host="0.0.0.0", debug=True, port=PORT, threaded=True, use_reloader=False)
