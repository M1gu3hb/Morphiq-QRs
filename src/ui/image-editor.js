import { $ } from './dom.js';
import { QRImage } from '../image/framing.js';
export function bindImageEditor({ getGeometry, canEdit, onChange }) {
  let imageDrag = null;
  $('image-editor').addEventListener('pointerdown', (e) => {
    if (!canEdit() || e.button > 0) return;
    e.preventDefault();
    const box = $('image-editor').getBoundingClientRect(),
      g = getGeometry();
    imageDrag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      panX: Number($('image-x').value),
      panY: Number($('image-y').value),
      unit: g.side / box.width,
      g,
    };
    $('image-editor').setPointerCapture(e.pointerId);
  });
  $('image-editor').addEventListener('pointermove', (e) => {
    if (!imageDrag || imageDrag.id !== e.pointerId) return;
    e.preventDefault();
    $('image-x').value = Math.round(
      QRImage.clamp(
        imageDrag.panX + (((e.clientX - imageDrag.x) * imageDrag.unit) / imageDrag.g.travelX) * 100,
        -100,
        100,
      ),
    );
    $('image-y').value = Math.round(
      QRImage.clamp(
        imageDrag.panY + (((e.clientY - imageDrag.y) * imageDrag.unit) / imageDrag.g.travelY) * 100,
        -100,
        100,
      ),
    );
    onChange();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) =>
    $('image-editor').addEventListener(type, () => {
      imageDrag = null;
    }),
  );
  $('image-editor').addEventListener('keydown', (e) => {
    if (!canEdit()) return;
    const delta = e.shiftKey ? 10 : 2;
    if (['ArrowLeft', 'ArrowRight'].includes(e.key))
      $('image-x').value = QRImage.clamp(
        Number($('image-x').value) + (e.key === 'ArrowLeft' ? -delta : delta),
        -100,
        100,
      );
    else if (['ArrowUp', 'ArrowDown'].includes(e.key))
      $('image-y').value = QRImage.clamp(
        Number($('image-y').value) + (e.key === 'ArrowUp' ? -delta : delta),
        -100,
        100,
      );
    else return;
    e.preventDefault();
    onChange();
  });
}
