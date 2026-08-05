import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import TradingCommandCenter, { TCC_PREFIX } from "./TradingCommandCenter.jsx";

/* Self-heal a stale cached bundle: fetch the freshest index.html (bypassing
   cache) and compare the hashed JS filename it references to the one actually
   running. If they differ, this tab is on an old build — reload once to pick up
   the latest. A sessionStorage guard prevents a reload loop if it can't recover. */
async function ensureFreshBuild() {
  try {
    const running = (import.meta.url.split("/").pop() || "").split("?")[0];
    if (!running) return;
    const res = await fetch("/?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    const m = html.match(/assets\/[A-Za-z0-9_.-]+\.js/);
    const latest = m ? m[0].split("/").pop() : null;
    if (latest && latest !== running) {
      if (!sessionStorage.getItem("tcc:staleReload")) {
        sessionStorage.setItem("tcc:staleReload", "1");
        location.reload();
      }
    } else {
      sessionStorage.removeItem("tcc:staleReload");
    }
  } catch (e) { /* offline / blocked — ignore */ }
}
ensureFreshBuild();
setInterval(ensureFreshBuild, 5 * 60 * 1000);

/* localStorage is per-browser: the journal you build on your phone is invisible
   on your laptop, and clearing site data wipes it. This bar is the way across. */

function readAll() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(TCC_PREFIX)) out[k.slice(TCC_PREFIX.length)] = localStorage.getItem(k);
  }
  return out;
}

function tradeCount() {
  try { const a = JSON.parse(localStorage.getItem(TCC_PREFIX + "journal:trades") || "[]"); return Array.isArray(a) ? a.length : 0; }
  catch (e) { return 0; }
}
function lastBackupCount() {
  try { return parseInt(localStorage.getItem(TCC_PREFIX + "backup:lastCount") || "0", 10) || 0; }
  catch (e) { return 0; }
}

function BackupBar() {
  const [note, setNote] = useState("");
  const [unsaved, setUnsaved] = useState(0);
  const fileRef = useRef(null);

  // Track how many journaled trades exist since the last "Save a copy", so we can
  // gently nudge a backup before the browser data can be lost.
  React.useEffect(() => {
    const check = () => setUnsaved(Math.max(0, tradeCount() - lastBackupCount()));
    check();
    const t1 = setTimeout(check, 1500), t2 = setTimeout(check, 4000); // catch first-load data seeding
    const id = setInterval(check, 20000);
    window.addEventListener("focus", check);
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(id); window.removeEventListener("focus", check); };
  }, []);

  function exportData() {
    const data = readAll();
    const n = Object.keys(data).length;
    if (!n) return setNote("Nothing saved yet — log a trade first.");
    const blob = new Blob(
      [JSON.stringify({ app: "trading-command-center", version: 1, savedAt: new Date().toISOString(), data }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(TCC_PREFIX + "backup:lastCount", String(tradeCount()));
    setUnsaved(0);
    setNote(`Saved ${n} record${n === 1 ? "" : "s"} to your downloads.`);
  }

  function importData(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !parsed.data || typeof parsed.data !== "object") {
          return setNote("That file isn't a Command Center backup.");
        }
        const keys = Object.keys(parsed.data);
        if (!confirm(`Restore ${keys.length} record(s)? This overwrites what's on this device.`)) return;
        keys.forEach((k) => localStorage.setItem(TCC_PREFIX + k, parsed.data[k]));
        localStorage.setItem(TCC_PREFIX + "backup:lastCount", String(tradeCount()));
        setNote("Restored. Reloading…");
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        setNote("Couldn't read that file — it may be damaged.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const btn = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: 700,
    background: "#1E2630",
    border: "1px solid #42505F",
    color: "#F2BE6E",
    borderRadius: 8,
    padding: "7px 13px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 16px",
        background: "#171E27",
        borderBottom: "1px solid #33404E",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#95A0AD",
        }}
      >
        Backup
      </span>
      <button style={btn} onClick={exportData}>Save a copy</button>
      <button style={btn} onClick={() => fileRef.current && fileRef.current.click()}>Restore</button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={importData} style={{ display: "none" }} />
      {note ? (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#B8C1CD" }}>{note}</span>
      ) : unsaved > 0 ? (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: unsaved >= 5 ? "#F2BE6E" : "#95A0AD" }}>
          {unsaved >= 5 ? "⚠ " : ""}{unsaved} trade{unsaved === 1 ? "" : "s"} since your last backup{unsaved >= 5 ? " — Save a copy" : ""}
        </span>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BackupBar />
    <TradingCommandCenter />
  </React.StrictMode>
);
