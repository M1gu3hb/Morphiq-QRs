import './styles/studio.css';
import './styles/color-picker.css';
import './styles/gallery.css';
import './styles/image-editor.css';
import './styles/advanced.css';
import './styles/refinements.css';
import './styles/scanner.css';
import { createStudio } from './app/create-studio.js';
import { initColorPicker } from './ui/color-picker.js';
import { initAdvanced } from './advanced/controller.js';
import { initFrames } from './frames/controller.js';
import { initProjects } from './projects/controller.js';
import { initAccordions } from './ui/accordions.js';
import { createScanner } from './scanner/controller.js';
import { initPwa } from './pwa/install.js';
import { initFollowingPreview } from './ui/following-preview.js';
import { initGeneratorSharing } from './ui/sharing.js';
const studio = createStudio();
initFrames(studio);
initAdvanced(studio);
initColorPicker();
const projects = initProjects(studio);
initAccordions();
const scanner = createScanner();
const el = (id) => document.getElementById(id);
function view(name) {
  const scan = name === 'scan';
  document.body.classList.toggle('scanning', scan);
  el('studio-view').hidden = scan;
  el('scanner-view').hidden = !scan;
  el('reset').hidden = scan;
  el('nav-studio').setAttribute('aria-pressed', String(!scan));
  el('nav-scan').setAttribute('aria-pressed', String(scan));
  if (!scan) scanner.stop();
  document.dispatchEvent(new Event('studio:view'));
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
initPwa(studio, projects);
initFollowingPreview(studio);
initGeneratorSharing(studio);
