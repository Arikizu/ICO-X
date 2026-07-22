# ICO-X — PNG to ICO Converter

A lightweight, self-contained Flask web application that converts PNG images into multi-resolution Windows `.ico` files. Convert single images or batch process entire folders—all processed entirely in-memory with zero server-side disk writes.

---

## Quick Start

```bash
# 1. Install required packages
pip install flask pillow

# 2. Run the application
python3 app.py
```

Your default web browser will automatically open to **http://localhost:5000**. If running on a headless machine or remote server, navigate to that URL manually.

---

## Features

- **Drag & Drop (Single or Batch)**
  - Drag and drop single PNG files or entire folders at once.
  - Interactive preview queue with thumbnails, file names, and individual remove controls.
  - Flexible exports: single files download directly as `.ico`; multi-file batches are packed into a single `.zip` archive.
  - Robust batch processing skips invalid files gracefully and reports skipped items without breaking the conversion flow.

- **Customizable Resolution Sizes**
  - Selectable resolutions: `16px`, `24px`, `32px`, `48px`, `64px`, `96px`, `128px`, and `256px`.

- **Antialiasing Presets**
  - **OFF** — Crisp, untouched downscaling without antialiasing.
  - **Standard (x1)** — Standard balanced antialiasing.
  - **Soft (x2)** — Softened edges for smoother rendering.
  - **Extra Soft (x3)** — Enhanced edge smoothing for high-contrast graphics.

---

## Notes

- **Source Image Quality:** For optimal results across all icon sizes, use square, high-resolution source PNGs (512×512px or larger).
- **Upload Limits:** Max upload size is capped at **50 MB per file** and up to **100 files per batch**.
- **Production Deployment:** This app runs on Flask's built-in development server by default. For production environments, deploy behind a production WSGI server (such as *Gunicorn* or *Waitress*) and disable dev-convenience features like auto-browser launching.
