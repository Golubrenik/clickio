// js/redirect-manager.js
// Resolves target ONLY from (1) current URL (?offer_link / ?offer) then (2) hidden anchor #redirect-url.
// No controller globals, no config.json fallback.
// Replaces the address itself and appends mapped prefill params (plus optional UTM passthrough).

const defaultMapping = {
  firstname: "first_name",
  lastname: "last_name",
  email: "email",
  phone: "phone",
  address: "address",
  city: "city",
  postcode: "zip",
};

// Optionally pass these through from the current URL onto the target
const PASSTHROUGH_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "wbraid", "gbraid", "fbclid", "ref"
];

class RedirectManager extends BaseModule {
  constructor() {
    super();
    this.on("redirect", () => this.redirect());
  }

  redirect() {
    // 1) Build the BASE target URL (address itself)
    const baseUrl = this.resolveBaseURL();
    if (!(baseUrl instanceof URL)) {
      console.warn("[RedirectManager] No valid redirect base URL.");
      return;
    }

    // 2) Add mapped prefill params
    this.applyPrefillParams(baseUrl);

    // 3) Optionally pass through some current URL params (utm/gclid/etc.)
    this.applyPassthroughParams(baseUrl);

    // 4) Go
    window.location.replace(baseUrl.toString());
  }

  // ---------------- core pieces ----------------

  resolveBaseURL() {
    // a) Current URL query: ?offer_link= or ?offer=
    const fromLocation = this._readOfferFromLocation();
    if (fromLocation) {
      const u = this._toURL(fromLocation);
      if (u) return u; // REPLACES address itself
    }

    // b) Hidden anchor: <a id="redirect-url" href="...">
    try {
      const a = document.getElementById("redirect-url");
      const domHref = (a && (a.getAttribute("href") || a.dataset.redirectUrl || "").trim()) || "";
      if (domHref && !/\{offer(_link)?\}/i.test(domHref)) {
        const u = this._toURL(domHref);
        if (u) return u;
      }
    } catch {}

    // No other fallbacks (explicitly NOT using controller globals or config.json)
    return null;
  }

  applyPrefillParams(url) {
    const cfg = this.getConfig() || {};
    const mapping = (cfg.prefill && cfg.prefill.mapping) || defaultMapping;

    const prefill = this.get("prefill");
    const data = prefill && typeof prefill.getPrefillData === "function"
      ? (prefill.getPrefillData() || {})
      : {};

    // Phone code: dotted key first, then nested fallback (kept for compatibility)
    const phoneCode =
      (typeof cfg["phone.code"] === "string" ? cfg["phone.code"] : "") ||
      (cfg.phone && typeof cfg.phone.code === "string" ? cfg.phone.code : "") ||
      "";

    if (!mapping || typeof mapping !== "object") return;

    Object.keys(mapping).forEach((fieldName) => {
      const token = mapping[fieldName]; // e.g., first_name
      if (!token) return;

      const raw = data[fieldName];
      if (raw == null) return;

      let v = String(raw).trim();

      // email lowercase
      if (fieldName === "email" && v) v = v.toLowerCase();

      // strip leading + and stray delimiters (URLSearchParams will encode but keep clean)
      v = v.replace(/^\+/, "").replace(/[?&]/g, "");

      // phone prefix with country code if provided
      if (fieldName === "phone" && v) {
        const cc = String(phoneCode || "").trim(); // "+1"
        if (cc) {
          const ccNoPlus = cc.replace(/^\+/, "");
          if (!v.startsWith(ccNoPlus) && !v.startsWith(cc)) v = `${cc}${v}`;
        }
      }

      if (v) url.searchParams.set(token, v);
    });
  }

  applyPassthroughParams(url) {
    try {
      const current = new URL(window.location.href);
      for (const key of PASSTHROUGH_KEYS) {
        const val = current.searchParams.get(key);
        if (val != null && val !== "") {
          url.searchParams.set(key, val);
        }
      }
    } catch {}
  }

  // --------------- helpers ----------------

  _readOfferFromLocation() {
    try {
      const loc = window.location;
      const qs = new URLSearchParams(loc.search);
      const v = (qs.get("offer_link") || qs.get("offer") || "").trim();
      if (v && !/\{offer(_link)?\}/i.test(v)) return v;

      // Optional: allow #offer_link= in hash
      if (loc.hash && loc.hash.length > 1) {
        const hqs = new URLSearchParams(loc.hash.slice(1));
        const hv = (hqs.get("offer_link") || hqs.get("offer") || "").trim();
        if (hv && !/\{offer(_link)?\}/i.test(hv)) return hv;
      }
    } catch {}
    return "";
  }

  _toURL(value) {
    try {
      if (/^https?:\/\//i.test(value)) return new URL(value);
      if (value.startsWith("//")) return new URL(window.location.protocol + value);
      if (value.startsWith("/")) return new URL(value, window.location.origin);
      return new URL(value, window.location.href); // relative to current page
    } catch {
      return null;
    }
  }
}

window.RedirectManager = RedirectManager;