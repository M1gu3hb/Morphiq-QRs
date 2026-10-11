export const $ = (id) => document.getElementById(id);
export const buttons = (key) => Array.from(document.querySelectorAll('[data-' + key + ']'));
