(function () {
  // --- Locale detection: default EN, override with ?lang=fr or ?lang=es ---
  function getLang() {
    try {
      var v = new URLSearchParams(window.location.search).get("lang");
      v = (v || "").toLowerCase();
      if (v) return v;
    } catch (e) {}
    return "en";
  }

  // Deep merge that REPLACES arrays (e.g., questions.items)
  function deepMerge(base, override) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(override || {}).forEach(function (k) {
      var bv = out[k];
      var ov = override[k];
      if (Array.isArray(ov)) {
        out[k] = ov.slice();
      } else if (ov && typeof ov === "object" && !Array.isArray(ov)) {
        out[k] = deepMerge(bv && typeof bv === "object" ? bv : {}, ov);
      } else {
        out[k] = ov;
      }
    });
    return out;
  }

  // ================= LOAD CONFIG_EN + LOCALES FROM config.json =================
  var CONFIG_EN = {};
  var LOCALES = {};

  function loadConfigSync() {
    // allow override: <script>window.CONFIG_URL = "/some/other/config.json";</script>
    var candidates = [
      window.CONFIG_URL || null, // explicit override
      "/config.json",            // root (default, e.g. https://site.com/config.json)
      "../config.json",          // fallback (if script lives in /js/)
      "./config.json"            // fallback (same dir as this script)
    ].filter(Boolean);

    for (var i = 0; i < candidates.length; i++) {
      var url = candidates[i];
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false); // sync to preserve original behavior
        if (xhr.overrideMimeType) xhr.overrideMimeType("application/json");
        xhr.send(null);

        if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
          try {
            var data = JSON.parse(xhr.responseText || "{}");
            if (data && typeof data === "object") {
              if (data.CONFIG_EN && typeof data.CONFIG_EN === "object") CONFIG_EN = data.CONFIG_EN;
              if (data.LOCALES && typeof data.LOCALES === "object") LOCALES = data.LOCALES;
              return true; // success
            }
          } catch (e) {
            console.error("config.json parse error from", url, e);
          }
        }
      } catch (e) {
        // try next candidate
      }
    }
    console.error("Failed to load config.json from candidates:", candidates);
    return false;
  }

  loadConfigSync();

  // ================= MERGE AND EXPOSE =================
  var lang = getLang();
  var cfg = deepMerge(CONFIG_EN, LOCALES[lang] || {});

  window.ThemeConfig = cfg;
  window.AppConfig = window.AppConfig || window.ThemeConfig;
})();
