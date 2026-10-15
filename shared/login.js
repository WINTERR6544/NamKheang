// Fills the drifting brand-name rows on the NamKheang sign-in screen (portal, admin, factory).
// Each row holds the text twice so the CSS loop (translateX -50%) is seamless. Decorative only.
(() => {
  const half = "<span>NamKheang ✻</span>".repeat(6);
  document.querySelectorAll(".nk-marquee").forEach((el) => {
    el.innerHTML = ("<div>" + half + half + "</div>").repeat(9);
  });
})();
