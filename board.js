// Compatibility only: resolve former /implant/#n addresses to the new pages.
(() => {
  const match = /^#([12])(?:-(.+))?$/.exec(location.hash);
  const link = match && document.querySelector(`[data-legacy-id="${match[1]}"]`);
  const url = link ? new URL(link.href) : new URL('/blog/', location.href);
  if (link && match[2]) url.hash = match[2];
  location.replace(url.href);
})();
