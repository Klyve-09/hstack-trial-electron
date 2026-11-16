#!/usr/bin/env node
// Drive the Pocket Notebook window over the Chrome DevTools Protocol.
// Input goes through Chromium's input pipeline (Input.dispatchMouseEvent,
// Input.insertText), the same path a real pointer and keyboard take.
// Usage: cdp.mjs <port> <command> [args] (normally via notebook.sh cdp ...).
import process from 'node:process';

const [port, command, ...rest] = process.argv.slice(2);
const options = { name: undefined, dialog: undefined, timeout: 10000 };
const args = [];
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--name') options.name = rest[(i += 1)];
  else if (rest[i] === '--dialog') options.dialog = rest[(i += 1)];
  else if (rest[i] === '--timeout') options.timeout = Number(rest[(i += 1)]);
  else args.push(rest[i]);
}

function fail(message, code = 1) {
  process.stderr.write(`cdp: ${message}\n`);
  process.exit(code);
}

if (!port || !command) {
  fail(
    'usage: cdp.mjs <port> wait|click|type|key|text|value|axtree|url <selector> [text] [--name N] [--dialog accept|dismiss] [--timeout ms]',
    2,
  );
}

const targets = await fetch(`http://127.0.0.1:${port}/json/list`)
  .then((response) => response.json())
  .catch((error) => fail(`DevTools port ${port} unreachable: ${error}`));
const page = targets.find((target) => target.type === 'page');
if (!page) fail('no page target');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 0;
const pending = new Map();
let dialogMessage;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else if (message.method === 'Page.javascriptDialogOpening') {
    dialogMessage = message.params.message;
    void send('Page.handleJavaScriptDialog', {
      accept: options.dialog === 'accept',
    });
  }
};
function send(method, params = {}) {
  const id = (nextId += 1);
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) fail(exceptionDetails.exception?.description);
  return result.value;
}

// Find the first visible element matching the selector whose accessible
// name (aria-label or trimmed text) equals --name when given.
function locate(selector) {
  return `(() => {
    const name = ${JSON.stringify(options.name ?? null)};
    const found = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      if (name === null) return true;
      const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
      return label.replace(/\\s+/g, ' ').trim() === name;
    });
    return found ?? null;
  })()`;
}

async function waitFor(selector) {
  const deadline = Date.now() + options.timeout;
  while (Date.now() < deadline) {
    if (await evaluate(`${locate(selector)} !== null`)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  fail(
    `timed out after ${options.timeout} ms waiting for ${selector}${options.name ? ` named "${options.name}"` : ''}`,
  );
}

async function clickAt(selector) {
  await waitFor(selector);
  const point = await evaluate(`(() => {
    const el = ${locate(selector)};
    el.scrollIntoView({ block: 'center' });
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, covered: !(hit && (hit === el || el.contains(hit))), disabled: !!el.disabled };
  })()`);
  if (point.disabled) fail(`${selector} is disabled`);
  if (point.covered) fail(`${selector} is covered by another element`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', {
      type,
      x: point.x,
      y: point.y,
      button: 'left',
      buttons: type === 'mousePressed' ? 1 : 0,
      clickCount: type === 'mouseMoved' ? 0 : 1,
    });
  }
}

await send('Page.enable');
await send('Runtime.enable');

switch (command) {
  case 'wait':
    await waitFor(args[0]);
    break;
  case 'click':
    await clickAt(args[0]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    break;
  case 'type': {
    await clickAt(args[0]);
    // Ctrl+A replaces any existing value, as a user selecting all would.
    await send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
      commands: ['selectAll'],
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    });
    await send('Input.insertText', { text: args[1] ?? '' });
    break;
  }
  case 'text':
    await waitFor(args[0] ?? 'body');
    process.stdout.write(
      `${await evaluate(`${locate(args[0] ?? 'body')}.innerText`)}\n`,
    );
    break;
  case 'axtree': {
    const { nodes } = await send('Accessibility.getFullAXTree');
    for (const node of nodes) {
      const role = node.role?.value;
      const name = node.name?.value;
      if (node.ignored || !role || role === 'none' || role === 'generic')
        continue;
      if (role === 'StaticText' || role === 'InlineTextBox') continue;
      process.stdout.write(`${role}${name ? ` "${name}"` : ''}\n`);
    }
    break;
  }
  case 'key': {
    // A named key such as End, PageDown, Escape, or Enter.
    const codes = {
      End: 35,
      Home: 36,
      PageDown: 34,
      PageUp: 33,
      Escape: 27,
      Enter: 13,
      Tab: 9,
    };
    const key = args[0];
    if (!(key in codes))
      fail(`key must be one of ${Object.keys(codes).join(', ')}`, 2);
    for (const type of ['rawKeyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: codes[key],
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    break;
  }
  case 'value':
    await waitFor(args[0]);
    process.stdout.write(`${await evaluate(`${locate(args[0])}.value`)}\n`);
    break;
  case 'url':
    process.stdout.write(`${await evaluate('location.href')}\n`);
    break;
  default:
    fail(`unknown command ${command}`, 2);
}

if (dialogMessage !== undefined) {
  process.stdout.write(
    `dialog "${dialogMessage}" ${options.dialog === 'accept' ? 'accepted' : 'dismissed'}\n`,
  );
  if (!options.dialog) fail('a dialog opened without --dialog', 3);
}
socket.close();
process.exit(0);
