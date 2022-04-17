# <h1 align="center">grammY Web App Utils</h1>

---

**WARNING: unstable.** This is still a work in progress.

## Building Blocks for Telegram Web Apps

This repo provides an npm package for building Web App for your Telegram bot. It
is an alternative to the officially provided JS module that you can script-tag
include, but this module is written in TypeScript and integrates much better
with your existing Node.js-based toolchain.

```ts
import WebApp from "@grammyjs/web-app";

console.log(window.Telegram.WebApp.initData);
console.log(WebApp.initData);
```
