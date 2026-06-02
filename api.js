/* watchDocs — data adapter.
   Tries the Collector's unified API; falls back to bundled mock (data.js)
   so the dashboard still works when opened as a static file / collector down.

   Plain global script — load BEFORE the babel app scripts. */
(function () {
  "use strict";

  // Allow overriding via <body data-api-base="https://..."> if dashboard and
  // collector live on different hosts. Default: same origin (nginx proxies /api).
  var API_BASE =
    (document.body && document.body.getAttribute("data-api-base")) ||
    window.WD_API_BASE ||
    "";

  function valid(d) {
    return d && Array.isArray(d.services) && d.services.length > 0;
  }

  async function loadSnapshot() {
    try {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 3500);
      var r = await fetch(API_BASE + "/api/snapshot", {
        cache: "no-store",
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(t);
      if (r.ok) {
        var d = await r.json();
        if (valid(d)) {
          d.__live = true;
          return d;
        }
      }
    } catch (e) {
      /* offline, static preview, or collector unreachable → use mock */
    }
    var mock = window.WD_DATA;
    if (mock) mock.__live = false;
    return mock;
  }

  async function deleteService(id) {
    var r = await fetch(API_BASE + "/api/services/" + encodeURIComponent(id), {
      method: "DELETE",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    var body = null;
    try { body = await r.json(); } catch (e) {}
    if (!r.ok) {
      throw new Error((body && body.error) || ("delete failed: HTTP " + r.status));
    }
    return body || { ok: true };
  }

  window.WD_loadSnapshot = loadSnapshot;
  window.WD_deleteService = deleteService;
  window.WD_API_BASE = API_BASE;
})();
