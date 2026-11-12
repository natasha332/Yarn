// Settings now starts with its areas folded up. Older tests that reach into them use this init script
// (ctx.addInitScript(require('./open-settings.js'))) to unfold everything on the Settings page.
module.exports = () => {
  const openAll = () => { if (location.pathname === '/settings') document.querySelectorAll('details').forEach(d => { d.open = true; }); };
  new MutationObserver(openAll).observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', openAll);
};
