# <h1 align="center">grammY Web App Utils</h1>

---

**WARNING: unstable.** This is still a work in progress.

## Building Blocks for Telegram Web Apps

This repo provides an npm package for building Web App for your Telegram bot. It
simply re-exports the API provided by Telegram's JS module which you must still
script-tag include.

The advantage package bundles up TypeScript types, which may make it easier to
set up the project. In addition, it will allow you to properly scope access to
`window.Telegram`, rather than relying on the global scope.

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
