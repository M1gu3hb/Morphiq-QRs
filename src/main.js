import './styles/studio.css';
import './styles/color-picker.css';
import './styles/gallery.css';
import './styles/image-editor.css';
import './styles/advanced.css';
import { createStudio } from './app/create-studio.js';
import { initColorPicker } from './ui/color-picker.js';
import { initAdvanced } from './advanced/controller.js';
import { initProjects } from './projects/controller.js';
import { initAccordions } from './ui/accordions.js';
import { createScanner } from './scanner/controller.js';
import { initPwa } from './pwa/install.js';
const studio = createStudio();
initAdvanced(studio);
initColorPicker();
initProjects(studio);
initAccordions();
const scanner = createScanner();
const el = (id) => document.getElementById(id);
function view(name) {
  const scan = name === 'scan';
  el('studio-view').hidden = scan;
  el('scanner-view').hidden = !scan;
  el('reset').hidden = scan;
  el('nav-studio').setAttribute('aria-pressed', String(!scan));
  el('nav-scan').setAttribute('aria-pressed', String(scan));
  if (!scan) scanner.stop();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
el('nav-studio').addEventListener('click', () => view('create'));
el('nav-scan').addEventListener('click', () => view('scan'));
const params = new URLSearchParams(location.search),
  installed =
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
view(
  params.get('view') === 'create'
    ? 'create'
    : params.get('view') === 'scan' || installed || params.get('app') === '1'
      ? 'scan'
      : 'create',
);
initPwa(studio);
