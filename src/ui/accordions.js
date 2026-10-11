export function initAccordions() {
  document.querySelectorAll('details').forEach((details) => {
    const summary = details.querySelector(':scope > summary');
    if (!summary) return;
    const body = document.createElement('div');
    body.className = 'detail-body';
    Array.from(details.children)
      .filter((c) => c !== summary)
      .forEach((c) => body.append(c));
    details.append(body);
    let animation = null,
      targetOpen = details.open;
    summary.addEventListener('click', (event) => {
      if (event.target.closest('button') || typeof details.animate !== 'function') return;
      event.preventDefault();
      const opening = animation ? !targetOpen : !details.open;
      targetOpen = opening;
      if (animation) {
        animation.cancel();
        animation = null;
      }
      const start = details.getBoundingClientRect().height;
      if (opening) details.open = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        details.open = opening;
        return;
      }
      const end = opening
        ? summary.getBoundingClientRect().height + body.scrollHeight
        : summary.getBoundingClientRect().height;
      details.style.overflow = 'hidden';
      animation = details.animate(
        { height: [start + 'px', end + 'px'] },
        { duration: 240, easing: 'cubic-bezier(.22,.8,.3,1)' },
      );
      animation.onfinish = () => {
        details.open = opening;
        details.style.overflow = '';
        animation = null;
      };
      animation.oncancel = () => {
        details.style.overflow = '';
      };
    });
  });
}
