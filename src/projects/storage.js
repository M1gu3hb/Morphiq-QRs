let connection;
export async function openProjects() {
  if (typeof indexedDB === 'undefined')
    throw new Error('Este navegador no permite guardar proyectos. Puedes exportar un respaldo.');
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('morphiq-qr-studio', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('projects', { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        connection = null;
        reject(new Error('No se pudo abrir el almacenamiento local.'));
      };
      request.onblocked = () => {
        connection = null;
        reject(new Error('Cierra otra pestaña del estudio para actualizar el almacenamiento.'));
      };
    });
  return connection;
}
async function operation(mode, action) {
  const database = await openProjects();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('projects', mode),
      request = action(transaction.objectStore('projects'));
    let result;
    request.onsuccess = () => (result = request.result);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = transaction.onabort = () =>
      reject(
        new Error('No se pudo guardar. Exporta un respaldo; el almacenamiento puede estar lleno.'),
      );
  });
}
export const projectStore = {
  get: (id) => operation('readonly', (store) => store.get(id)),
  list: () => operation('readonly', (store) => store.getAll()),
  save: (record) => operation('readwrite', (store) => store.put(record)),
  remove: (id) => operation('readwrite', (store) => store.delete(id)),
};
