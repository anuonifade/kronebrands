import { useRef, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";

/**
 * The whole gallery for one product: every shot, in the order customers scroll
 * through them. Index 0 is the hero and doubles as the card image everywhere else.
 *
 * Reordering is drag-and-drop with arrow buttons alongside, so it works without a
 * mouse. The parent owns persistence — for a saved product each callback hits the
 * API; while a new product is still being drafted they just edit local state.
 */
export default function ImageManager({ images, uploads, onAdd, onRemove, onReorder, busy }) {
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [dropping, setDropping] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef(null);
  const toast = useToast();

  const move = (from, to) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorder(next);
  };

  const addUrl = (e) => {
    e.preventDefault();
    const v = url.trim();
    if (!v) return;
    onAdd(v);
    setUrl("");
  };

  const sendFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    if (!uploads?.uploads_enabled) return toast(uploads?.reason || "Uploads aren't configured.", "warn");
    setUploading(list.length);
    try {
      for (const f of list) {
        const { url: uploaded } = await api.admin.uploadImage(f);
        await onAdd(uploaded);
      }
      toast(`Uploaded ${list.length} image${list.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast(e.message, "warn");
    } finally {
      setUploading(0);
    }
  };

  return (
    <div className="imgman">
      <div className="imgman__head">
        <h2 className="panel__h">Images <span className="muted">({images.length})</span></h2>
        {images.length > 0 && <p className="muted small">First image is the hero — it's what the shop, bag and search results show.</p>}
      </div>

      {images.length === 0 && <p className="muted small">No images yet. Add one below.</p>}

      <ul className="imgman__grid">
        {images.map((src, i) => (
          <li
            key={src}
            className={`shot ${over === i ? "is-over" : ""} ${drag === i ? "is-dragging" : ""}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnter={() => setOver(i)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
          >
            <img src={src} alt={`Product image ${i + 1}`} loading="lazy" />
            {i === 0 && <span className="shot__hero">Hero</span>}
            <div className="shot__bar">
              <button type="button" className="shot__btn" title="Move earlier" aria-label={`Move image ${i + 1} earlier`}
                      disabled={i === 0 || busy} onClick={() => move(i, i - 1)}>←</button>
              <button type="button" className="shot__btn" title="Move later" aria-label={`Move image ${i + 1} later`}
                      disabled={i === images.length - 1 || busy} onClick={() => move(i, i + 1)}>→</button>
              <a className="shot__btn" href={src} target="_blank" rel="noreferrer" title="Open full size" aria-label={`Open image ${i + 1} full size`}>↗</a>
              <button type="button" className="shot__btn shot__btn--x" title="Remove" aria-label={`Remove image ${i + 1}`}
                      disabled={busy} onClick={() => onRemove(i)}>×</button>
            </div>
            {i !== 0 && (
              <button type="button" className="shot__make" disabled={busy} onClick={() => move(i, 0)}>Make hero</button>
            )}
          </li>
        ))}
      </ul>

      <div
        className={`dropzone ${dropping ? "is-over" : ""} ${uploads?.uploads_enabled ? "" : "is-off"}`}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => { e.preventDefault(); setDropping(false); sendFiles(e.dataTransfer.files); }}
      >
        {uploading > 0 ? (
          <p className="small">Uploading {uploading} image{uploading === 1 ? "" : "s"}…</p>
        ) : uploads?.uploads_enabled ? (
          <>
            <p className="small">Drop images here, or{" "}
              <button type="button" className="linkbtn" onClick={() => fileRef.current?.click()}>choose files</button>.
            </p>
            <p className="muted small">JPEG, PNG, WebP or AVIF, up to {Math.round((uploads.max_bytes || 0) / 1048576)}MB each · {uploads.provider}</p>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden
                   onChange={(e) => { sendFiles(e.target.files); e.target.value = ""; }} />
          </>
        ) : (
          <p className="muted small">{uploads?.reason || "File uploads aren't configured."} Add images by URL below in the meantime.</p>
        )}
      </div>

      <form className="imgman__add" onSubmit={addUrl}>
        <input type="url" placeholder="https://… paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="btn btn--ghost" disabled={!url.trim() || busy}>Add image</button>
      </form>
    </div>
  );
}
