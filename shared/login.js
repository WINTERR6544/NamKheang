// Fills the drifting brand-name rows on the NamKheang sign-in screen (portal, admin, factory).
// Each row holds the text twice so the CSS loop (translateX -50%) is seamless. Decorative only.
(() => {
  const half = "<span>NamKheang ✻</span>".repeat(6);
  document.querySelectorAll(".nk-marquee").forEach((el) => {
    el.innerHTML = ("<div>" + half + half + "</div>").repeat(9);
  });
})();

// Show / hide password: each .nk-reveal button toggles the input named in its aria-controls.
(() => {
  const svg = (d) =>
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  const EYE = svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
  const EYE_OFF = svg('<path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/>');
  document.querySelectorAll(".nk-reveal").forEach((btn) => {
    const input = document.getElementById(btn.getAttribute("aria-controls"));
    if (!input) return;
    const render = () => {
      const shown = input.type === "text";
      btn.innerHTML = shown ? EYE_OFF : EYE;
      btn.setAttribute("aria-pressed", String(shown));
      btn.setAttribute("aria-label", shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
    };
    btn.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      render();
      input.focus();
    });
    // hide again on submit so the password isn't left on screen while signing in
    input.form?.addEventListener("submit", () => {
      input.type = "password";
      render();
    });
    render();
  });
})();
