# <h1 align="center">grammY Web App Utils</h1>

---

## Building Blocks for Telegram Web Apps

This repo provides an npm package for building Web App for your Telegram bot. It
simply re-exports the API provided by Telegram's JS module which you must still
script-tag include.

The advantage of this package is that is bundles up TypeScript types, which may
make it easier to set up the project. In addition, it will allow you to properly
scope access to `window.Telegram`, rather than relying on the global scope.

## Installation

You need to include the CDN script from Telegram. Add this to your main HTML
file in the `<head>` tag:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

You can then use this package in your application by running

```bash
npm install @grammyjs/web-app
```

In turn, you can import from it:

```ts
import { WebApp } from "@grammyjs/web-app";

console.log(WebApp.initData);
// same as
console.log(window.Telegram.WebApp.initData);
```

Once your application is ready to be displayed, you should call `ready()`.

```ts
WebApp.ready();
```

Consult
[the offical Telegram docs for Web Apps](https://core.telegram.org/bots/webapps#initializing-web-apps)
to see what else is available through `WebApp`.
