const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const dropzoneEmpty = document.getElementById("dropzoneEmpty");
const dropzoneFilled = document.getElementById("dropzoneFilled");
const queueEl = document.getElementById("queue");
const convertBtn = document.getElementById("convertBtn");
const statusMsg = document.getElementById("statusMsg");
const toggleAll = document.getElementById("toggleAll");
const ladder = document.getElementById("ladder");
const aaOptions = document.getElementById("aaOptions");
const aaHint = document.getElementById("aaHint");

const AA_LABELS = {
  crisp: "Crisp — hard pixel edges, no smoothing",
  standard: "Standard — clean resize, balanced edges",
  soft: "Soft — gently smoothed, softer edges",
  extra: "Extra soft — noticeably softened edges",
};

let queue = []; // { id, file, url, width, height }
let aaValue = "crisp";
let nextId = 1;

// ---------- helpers ----------

function checkboxes() {
  return Array.from(ladder.querySelectorAll('input[type="checkbox"]'));
}

function selectedSizes() {
  return checkboxes().filter(c => c.checked).map(c => c.value);
}

function setStatus(text, kind) {
  statusMsg.textContent = text || "";
  statusMsg.className = "status" + (kind ? " " + kind : "");
}

function refreshConvertState() {
  const n = queue.length;
  convertBtn.disabled = n === 0 || selectedSizes().length === 0;
  const label = convertBtn.querySelector(".btn-label");
  if (!convertBtn.disabled || n > 0) {
    label.textContent = n > 1 ? `Cast ${n} icons` : "Cast .ico";
  } else {
    label.textContent = "Convert";
  }
}

function updateToggleAllLabel() {
  const anyChecked = checkboxes().some(c => c.checked);
  toggleAll.textContent = anyChecked ? "Deselect all" : "Select all";
}

function updateDropzoneMode() {
  const hasFiles = queue.length > 0;
  dropzoneEmpty.hidden = hasFiles;
  dropzoneFilled.hidden = !hasFiles;
  queueEl.hidden = !hasFiles;
}

// ---------- file queue ----------

function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  if (incoming.length === 0) return;

  let rejected = 0;
  incoming.forEach(file => {
    const isPng = file.type.includes("png") || file.name.toLowerCase().endsWith(".png");
    if (!isPng) {
      rejected++;
      return;
    }
    const id = nextId++;
    const url = URL.createObjectURL(file);
    const item = { id, file, url, width: null, height: null };
    queue.push(item);
    renderQueueItem(item);
  });

  if (rejected > 0) {
    setStatus(`Skipped ${rejected} file${rejected > 1 ? "s" : ""} — only PNGs are accepted.`, "error");
  } else {
    setStatus("");
  }

  updateDropzoneMode();
  refreshConvertState();
}

function renderQueueItem(item) {
  const li = document.createElement("li");
  li.className = "queue-item";
  li.dataset.id = item.id;

  const img = document.createElement("img");
  img.src = item.url;
  img.alt = "";
  img.onload = () => {
    item.width = img.naturalWidth;
    item.height = img.naturalHeight;
    dims.textContent = `${item.width} × ${item.height}px`;
  };

  const meta = document.createElement("div");
  meta.className = "file-meta";
  const name = document.createElement("span");
  name.textContent = item.file.name;
  const dims = document.createElement("span");
  dims.className = "hint";
  dims.textContent = "";
  meta.appendChild(name);
  meta.appendChild(dims);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "queue-remove";
  removeBtn.setAttribute("aria-label", `Remove ${item.file.name}`);
  removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  removeBtn.addEventListener("click", () => removeFile(item.id));

  li.appendChild(img);
  li.appendChild(meta);
  li.appendChild(removeBtn);
  queueEl.appendChild(li);
}

function removeFile(id) {
  queue = queue.filter(item => {
    if (item.id === id) {
      URL.revokeObjectURL(item.url);
      return false;
    }
    return true;
  });
  const li = queueEl.querySelector(`.queue-item[data-id="${id}"]`);
  if (li) li.remove();
  updateDropzoneMode();
  refreshConvertState();
  setStatus("");
}

// ---------- dropzone interactions ----------

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  });
});

dropzone.addEventListener("drop", (e) => {
  addFiles(e.dataTransfer.files);
});

// ---------- size ladder ----------

checkboxes().forEach(cb => {
  cb.addEventListener("change", () => {
    refreshConvertState();
    updateToggleAllLabel();
  });
});

toggleAll.addEventListener("click", () => {
  const anyChecked = checkboxes().some(c => c.checked);
  checkboxes().forEach(c => (c.checked = !anyChecked));
  refreshConvertState();
  updateToggleAllLabel();
});

// ---------- antialiasing ----------

aaOptions.addEventListener("click", (e) => {
  const pill = e.target.closest(".aa-pill");
  if (!pill) return;
  aaValue = pill.dataset.aa;
  Array.from(aaOptions.querySelectorAll(".aa-pill")).forEach(p => {
    const active = p === pill;
    p.classList.toggle("is-active", active);
    p.setAttribute("aria-checked", String(active));
  });
  aaHint.textContent = pill.textContent.trim();
});

// ---------- convert ----------

convertBtn.addEventListener("click", async () => {
  if (queue.length === 0) return;
  const sizes = selectedSizes();
  if (sizes.length === 0) return;

  convertBtn.disabled = true;
  const label = convertBtn.querySelector(".btn-label");
  const prevLabel = label.textContent;
  label.textContent = queue.length > 1 ? "Casting…" : "Casting…";
  convertBtn.querySelector(".btn-spinner").hidden = false;
  setStatus("");

  const formData = new FormData();
  queue.forEach(item => formData.append("images", item.file));
  formData.append("sizes", sizes.join(","));
  formData.append("antialiasing", aaValue);

  try {
    const res = await fetch("/convert", { method: "POST", body: formData });

    if (!res.ok) {
      let msg = "Something went wrong. Try again.";
      try {
        const data = await res.json();
        if (data.error) msg = data.error;
      } catch (_) {}
      setStatus(msg, "error");
      return;
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const downloadName = match ? match[1] : (queue.length > 1 ? "cast-icons.zip" : "icon.ico");

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    const skippedHeader = res.headers.get("X-Skipped") || "";
    const skippedNames = skippedHeader.split(",").filter(Boolean);
    const castCount = queue.length - skippedNames.length;

    let msg = queue.length > 1
      ? `Cast ${castCount} of ${queue.length} files into ${downloadName}`
      : `Cast ${sizes.length} size${sizes.length > 1 ? "s" : ""} into ${downloadName}`;
    if (skippedNames.length > 0) {
      msg += ` — skipped ${skippedNames.length}: ${skippedNames.join(", ")}`;
    }
    setStatus(msg, "success");
  } catch (err) {
    setStatus("Couldn't reach the server. Try again.", "error");
  } finally {
    convertBtn.querySelector(".btn-spinner").hidden = true;
    refreshConvertState();
  }
});

refreshConvertState();
updateToggleAllLabel();
