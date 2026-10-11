import { $ } from './dom.js';
export function createToast() {
  let timer;
  return (text) => {
    clearTimeout(timer);
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    timer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
  };
}
