(function () {
  const explicit = "https://rede-cats.onrender.com";
  const stored = (localStorage.getItem("redecats_api_base") || "").trim();
  const fromQuery = new URLSearchParams(window.location.search).get("api") || "";
  const base = explicit || fromQuery.trim() || stored || "";

  if (base) localStorage.setItem("redecats_api_base", base);

  const api = {
    base,
    configured: !!base,
    url(path) {
      if (!base) return path;
      return base.replace(/\/$/, "") + path;
    }
  };

  window.REDE_CATS_API = api;
  window.RedeCatsAPI = api;
})();
