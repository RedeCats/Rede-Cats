(function(){
  const explicit = (window.REDECATS_API_BASE || '').trim();
  const stored = (localStorage.getItem('redecats_api_base') || '').trim();
  const fromQuery = new URLSearchParams(window.location.search).get('api') || '';
  const base = explicit || fromQuery.trim() || stored || '';
  if (base) localStorage.setItem('redecats_api_base', base);
  window.RedeCatsAPI = {
    base,
    configured: !!base,
    url(path){
      if(!base) return path;
      return base.replace(/\/$/, '') + path;
    }
  };
})();
