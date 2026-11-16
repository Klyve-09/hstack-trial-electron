import './index.css';
import type { Item } from './items';

const app = document.querySelector<HTMLElement>('#app')!;
const message = document.querySelector<HTMLElement>('#message')!;
let dirty = false;
let busy = false;
let previousHash = location.hash || '#items';
let renderVersion = 0;

function escape(value: string): string {
  const element = document.createElement('span');
  element.textContent = value;
  return element.innerHTML;
}

function report(error: unknown) {
  message.textContent =
    error instanceof Error
      ? error.message
      : 'Something went wrong. Please try again.';
}

function date(value: string) {
  return new Date(value).toLocaleString();
}

function editor(item?: Item) {
  app.innerHTML = `
    <a href="#items" class="back">← All items</a>
    <h1>${item ? 'Edit item' : 'New item'}</h1>
    <form>
      <label for="title">Title</label>
      <input id="title" name="title" required maxlength="120" autocomplete="off" />
      <label for="body">Body</label>
      <textarea id="body" name="body" rows="12" maxlength="100000"></textarea>
      ${item ? `<p class="muted">Updated ${escape(date(item.updatedAt))}</p>` : ''}
      <div class="actions">
        <button type="submit">Save item</button>
        <a href="#items" class="button secondary">Cancel</a>
        ${item ? '<button type="button" id="copy-link" class="secondary">Copy note link</button>' : ''}
        ${item ? '<button type="button" id="delete" class="danger">Delete item</button>' : ''}
      </div>
    </form>`;
  const form = app.querySelector('form')!;
  const title = app.querySelector<HTMLInputElement>('#title')!;
  const body = app.querySelector<HTMLTextAreaElement>('#body')!;
  title.value = item?.title ?? '';
  body.value = item?.body ?? '';
  title.focus();
  form.addEventListener('input', () => {
    dirty = true;
  });
  async function mutate(action: () => Promise<unknown>, success: string) {
    busy = true;
    for (const control of form.elements)
      (control as HTMLInputElement).disabled = true;
    try {
      await action();
      dirty = false;
      message.textContent = success;
      location.hash = '#items';
    } catch (error) {
      report(error);
    } finally {
      busy = false;
      for (const control of form.elements)
        (control as HTMLInputElement).disabled = false;
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    void mutate(
      () =>
        window.notebook.save({
          id: item?.id,
          title: title.value,
          body: body.value,
        }),
      'Item saved.',
    );
  });
  app.querySelector('#copy-link')?.addEventListener('click', () => {
    window.notebook.copyLink(item!.id);
    message.textContent =
      'Note link copied. Open it on this device to return to this item.';
  });
  app.querySelector('#delete')?.addEventListener('click', () => {
    if (busy || !confirm('Delete this item? This cannot be undone.')) return;
    void mutate(() => window.notebook.remove(item!.id), 'Item deleted.');
  });
}

async function render() {
  const version = ++renderVersion;
  const route = location.hash || '#items';
  dirty = false;
  if (route === '#about') {
    app.innerHTML = `<p class="eyebrow">A little space for your thoughts</p>
      <h1>About Pocket Notebook</h1>
      <p class="intro">Keep notes, ideas, and everyday reminders in one quiet place.</p>
      <p>Your items stay on this device in a local JSON file. There are no accounts or cloud sync.</p>
      <p>Write a title and a body, then save. You can return to edit or delete an item at any time.</p>
      <a href="#items" class="button">Open your notebook</a>`;
    return;
  }
  if (route === '#new') {
    editor();
    return;
  }
  app.innerHTML = '<p class="muted">Opening your notebook…</p>';
  try {
    const items = await window.notebook.list();
    if (version !== renderVersion) return;
    if (route.startsWith('#edit/')) {
      const item = items.find((candidate) => candidate.id === route.slice(6));
      if (!item)
        throw new Error(
          'This item could not be found. Return to Items to continue.',
        );
      editor(item);
      return;
    }
    app.innerHTML = `<div class="heading"><div><p class="eyebrow">Your personal collection</p>
      <h1>Items <span class="count">${items.length}</span></h1></div>
      <div class="actions"><button id="export" class="secondary">Export notes</button>
      <a href="#new" class="button">+ New item</a></div></div>
      ${
        items.length
          ? `<ul class="items">${items
              .map(
                (item) => `
        <li><a href="#edit/${encodeURIComponent(item.id)}">
          <h2>${escape(item.title)}</h2>
          <p class="excerpt">${escape(item.body.slice(0, 180)) || 'No body text'}</p>
          <time datetime="${escape(item.updatedAt)}">Updated ${escape(date(item.updatedAt))}</time>
        </a></li>`,
              )
              .join('')}</ul>`
          : `<div class="empty"><h2>A fresh page awaits</h2>
        <p>Add your first item to start your notebook.</p><a href="#new">Write an item →</a></div>`
      }`;
    app
      .querySelector<HTMLButtonElement>('#export')!
      .addEventListener('click', async (event) => {
        const button = event.currentTarget as HTMLButtonElement;
        button.disabled = true;
        try {
          const destination = await window.notebook.export();
          message.textContent = `Notes exported to ${destination}`;
        } catch (error) {
          report(error);
        } finally {
          button.disabled = false;
        }
      });
  } catch (error) {
    if (version !== renderVersion) return;
    app.innerHTML =
      '<h1>Unable to open items</h1><p>Your saved file has been left untouched.</p><button id="retry">Try again</button>';
    app.querySelector('#retry')!.addEventListener('click', () => {
      void render();
    });
    report(error);
  }
}

window.notebook.onOpen((id) => {
  location.hash = `#edit/${encodeURIComponent(id)}`;
});

window.addEventListener('hashchange', () => {
  if (location.hash === previousHash) return;
  if (busy || (dirty && !confirm('Discard your unsaved changes?'))) {
    location.hash = previousHash;
    return;
  }
  previousHash = location.hash;
  message.textContent = '';
  void render();
});
window.addEventListener('beforeunload', (event) => {
  if ((busy || dirty) && !confirm('Close without saving your changes?'))
    event.returnValue = false;
});
void render();
