import {
  Callback,
  Color,
  EventCallback,
  EventData,
  MainButtonParams,
  Params,
  ThemeParams,
  type WebApp,
} from "./telegram-web-app";

const eventHandlers: Record<string, EventCallback[]> = {};

let locationHash = "";
try {
  locationHash = location.hash.toString();
} catch {}

const initParamsWebView = urlParseHashParams(locationHash);

let isIframe = false;
try {
  isIframe = window.parent != null && window != window.parent;
  if (isIframe) {
    window.addEventListener("message", function (event) {
      if (event.source !== window.parent) return;
      let dataParsed: { eventType: string; eventData: EventData };
      try {
        dataParsed = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (!dataParsed || !dataParsed.eventType) {
        return;
      }
      receiveEvent(dataParsed.eventType, dataParsed.eventData);
    });
  }
} catch {}

function urlSafeDecode(urlencoded: string) {
  try {
    urlencoded = urlencoded.replace(/\+/g, "%20");
    return decodeURIComponent(urlencoded);
  } catch {
    return urlencoded;
  }
}

function urlParseHashParams(locationHash: string) {
  locationHash = locationHash.replace(/^#/, "");
  const params: Params = {};
  if (!locationHash.length) {
    return params;
  }
  if (locationHash.indexOf("=") < 0 && locationHash.indexOf("?") < 0) {
    params._path = urlSafeDecode(locationHash);
    return params;
  }
  const qIndex = locationHash.indexOf("?");
  if (qIndex >= 0) {
    const pathParam = locationHash.substr(0, qIndex);
    params._path = urlSafeDecode(pathParam);
    locationHash = locationHash.substr(qIndex + 1);
  }
  const query_params = urlParseQueryString(locationHash);
  for (const k in query_params) {
    params[k] = query_params[k];
  }
  return params;
}

function urlParseQueryString(queryString: string) {
  const params: Params = {};
  if (!queryString.length) {
    return params;
  }
  const queryStringParams = queryString.split("&");
  for (let i = 0; i < queryStringParams.length; i++) {
    const param = queryStringParams[i].split("=");
    const paramName = urlSafeDecode(param[0]);
    const paramValue = param[1] == null ? null : urlSafeDecode(param[1]);
    params[paramName] = paramValue;
  }
  return params;
}

// Telegram apps will implement this logic to add service params (e.g. tgShareScoreUrl) to game URL
function urlAppendHashParams(url: string, addHash: string) {
  // url looks like 'https://game.com/path?query=1#hash'
  // addHash looks like 'tgShareScoreUrl=' + encodeURIComponent('tgb://share_game_score?hash=very_long_hash123')

  const ind = url.indexOf("#");
  if (ind < 0) {
    // https://game.com/path -> https://game.com/path#tgShareScoreUrl=etc
    return url + "#" + addHash;
  }
  const curHash = url.substr(ind + 1);
  if (curHash.indexOf("=") >= 0 || curHash.indexOf("?") >= 0) {
    // https://game.com/#hash=1 -> https://game.com/#hash=1&tgShareScoreUrl=etc
    // https://game.com/#path?query -> https://game.com/#path?query&tgShareScoreUrl=etc
    return url + "&" + addHash;
  }
  // https://game.com/#hash -> https://game.com/#hash?tgShareScoreUrl=etc
  if (curHash.length > 0) {
    return url + "?" + addHash;
  }
  // https://game.com/# -> https://game.com/#tgShareScoreUrl=etc
  return url + addHash;
}

function postEvent(
  eventType: string,
  callback: Callback | false,
  eventData: EventData,
) {
  if (!callback) {
    callback = function () {};
  }
  if (eventData === undefined) {
    eventData = "" as any;
  }

  if (window.TelegramWebviewProxy !== undefined) {
    window.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
    callback();
  } else if (window.external && "notify" in window.external) {
    (window.external as any).notify(
      JSON.stringify({ eventType: eventType, eventData: eventData }),
    );
    callback();
  } else if (isIframe) {
    try {
      let trustedTarget = "https://web.telegram.org";
      // For now we don't restrict target, for testing purposes
      trustedTarget = "*";
      window.parent.postMessage(
        JSON.stringify({ eventType: eventType, eventData: eventData }),
        trustedTarget,
      );
      if (initParamsWebView.tgWebAppDebug) {
        console.log(
          "[Telegram.WebView] postEvent via postMessage",
          eventType,
          eventData,
        );
      }
      callback();
    } catch (e) {
      callback(e);
    }
  } else {
    if (initParamsWebView.tgWebAppDebug) {
      console.log("[Telegram.WebView] postEvent", eventType, eventData);
    }
    callback({ notAvailable: true });
  }
}

function receiveEvent(eventType: string, eventData: EventData) {
  callEventCallbacks(eventType, function (callback: EventCallback) {
    callback(eventType, eventData);
  });
}

function callEventCallbacks(
  eventType: string,
  func: (callback: EventCallback) => void,
) {
  const curEventHandlers = eventHandlers[eventType];
  if (
    curEventHandlers === undefined ||
    !curEventHandlers.length
  ) {
    return;
  }
  for (let i = 0; i < curEventHandlers.length; i++) {
    try {
      func(curEventHandlers[i]);
    } catch {}
  }
}

function onEvent(eventType: string, callback: EventCallback) {
  if (eventHandlers[eventType] === undefined) {
    eventHandlers[eventType] = [];
  }
  const index = eventHandlers[eventType].indexOf(callback);
  if (index === -1) {
    eventHandlers[eventType].push(callback);
  }
}

function offEvent(eventType: string, callback: EventCallback) {
  if (eventHandlers[eventType] === undefined) {
    return;
  }
  const index = eventHandlers[eventType].indexOf(callback);
  if (index === -1) {
    return;
  }
  eventHandlers[eventType].splice(index, 1);
}

function openProtoUrl(url: string) {
  if (!url.match(/^(web\+)?tgb?:\/\/./)) {
    return false;
  }
  const useIframe = navigator.userAgent.match(/iOS|iPhone OS|iPhone|iPod|iPad/i)
    ? true
    : false;
  if (useIframe) {
    const iframeContEl = document.getElementById("tgme_frame_cont") ||
      document.body;
    const iframeEl = document.createElement("iframe");
    iframeContEl.appendChild(iframeEl);
    let pageHidden = false;
    const enableHidden = function () {
      pageHidden = true;
    };
    window.addEventListener("pagehide", enableHidden, false);
    window.addEventListener("blur", enableHidden, false);
    if (iframeEl !== null) {
      iframeEl.src = url;
    }
    setTimeout(function () {
      if (!pageHidden) {
        (window as any).location = url; // circumvent href by casting
      }
      window.removeEventListener("pagehide", enableHidden, false);
      window.removeEventListener("blur", enableHidden, false);
    }, 2000);
  } else {
    (window as any).location = url; // circumvent href by casting
  }
  return true;
}

const TG = {
  WebView: {
    initParams: initParamsWebView,
    onEvent: onEvent,
    offEvent: offEvent,
    postEvent: postEvent,
    receiveEvent: receiveEvent,
    callEventCallbacks: callEventCallbacks,
  },
  Utils: {
    urlSafeDecode: urlSafeDecode,
    urlParseQueryString: urlParseQueryString,
    urlParseHashParams: urlParseHashParams,
    urlAppendHashParams: urlAppendHashParams,
  },
};

// For Windows Phone app
window.TelegramGameProxy_receiveEvent = receiveEvent;

// App backward compatibility
window.TelegramGameProxy = {
  receiveEvent: receiveEvent,
};

// WebApp
const Utils = TG.Utils;
const WebView = TG.WebView;
const initParamsWebApp = WebView.initParams;

const WebApp = {} as WebApp;
let webAppInitData = "";
let webAppInitDataUnsafe: Params;
const themeParams = {} as ThemeParams;
let colorScheme = "light";

if (initParamsWebApp.tgWebAppData && initParamsWebApp.tgWebAppData.length) {
  webAppInitData = initParamsWebApp.tgWebAppData;
  webAppInitDataUnsafe = Utils.urlParseQueryString(webAppInitData);
  for (const key in webAppInitDataUnsafe) {
    const val = webAppInitDataUnsafe[key];
    try {
      if (
        val != null && (
          val.substr(0, 1) == "{" && val.substr(-1) == "}" ||
          val.substr(0, 1) == "[" && val.substr(-1) == "]"
        )
      ) {
        webAppInitDataUnsafe[key] = JSON.parse(val);
      }
    } catch {}
  }
}
if (
  initParamsWebView.tgWebAppThemeParams &&
  initParamsWebView.tgWebAppThemeParams.length
) {
  const themeParamsRaw = initParamsWebView.tgWebAppThemeParams;
  try {
    const theme_params = JSON.parse(themeParamsRaw);
    setThemeParams(theme_params);
  } catch (e) {}
}

function onThemeChanged(_eventType: string, eventData: EventData) {
  if (eventData.theme_params) {
    setThemeParams(eventData.theme_params);
    window.Telegram.WebApp.MainButton.setParams({
      force_update: true,
    } as any);
    receiveWebViewEvent("themeChanged");
  }
}

let lastWindowHeight = window.innerHeight;
function onViewportChanged(eventType: string, eventData: EventData) {
  if (eventData.height) {
    window.removeEventListener("resize", onWindowResize);
    setViewportHeight(eventData);
  }
}

function onWindowResize(_e: Event) {
  if (lastWindowHeight != window.innerHeight) {
    lastWindowHeight = window.innerHeight;
    receiveWebViewEvent("viewportChanged", {
      isStateStable: true,
    });
  }
}

function receiveWebViewEvent(eventType: string): void;
function receiveWebViewEvent(eventType: string, args: EventData): void;
function receiveWebViewEvent(eventType: string) {
  const args = Array.prototype.slice.call(arguments) as any;
  eventType = args.shift();
  WebView.callEventCallbacks("webview:" + eventType, function (callback) {
    callback.apply(WebApp, args);
  });
}

function onWebViewEvent(eventType: string, callback: EventCallback) {
  WebView.onEvent("webview:" + eventType, callback);
}

function offWebViewEvent(eventType: string, callback: EventCallback) {
  WebView.offEvent("webview:" + eventType, callback);
}

function setCssProperty(name: string, value: string) {
  const root = document.documentElement;
  if (root && root.style && root.style.setProperty) {
    root.style.setProperty("--tg-" + name, value);
  }
}

function setThemeParams(theme_params: ThemeParams) {
  let color: Color;
  for (let key in theme_params) {
    if (color = parseColorToHex((theme_params as any)[key])) {
      (themeParams as any)[key] = color;
      if (key == "bg_color") {
        colorScheme = isColorDark(color) ? "dark" : "light";
        setCssProperty("color-scheme", colorScheme);
      }
      key = "theme-" + key.split("_").join("-");
      setCssProperty(key, color);
    }
  }
}

let viewportHeight: number | false = false;
let viewportStableHeight: number | false = false;
let isExpanded = true;
function setViewportHeight(data?: EventData) {
  if (typeof data !== "undefined") {
    isExpanded = !!data.is_expanded;
    viewportHeight = data.height as number;
    if ((data as any).is_state_stable) {
      viewportStableHeight = data.height as number;
    }
    receiveWebViewEvent("viewportChanged", {
      isStateStable: !!(data as any).is_state_stable,
    });
  }
  let height, stable_height;
  if (viewportHeight !== false) {
    height = (viewportHeight - mainButtonHeight) + "px";
  } else {
    height = mainButtonHeight
      ? "calc(100vh - " + mainButtonHeight + "px)"
      : "100vh";
  }
  if (viewportStableHeight !== false) {
    stable_height = (viewportStableHeight - mainButtonHeight) + "px";
  } else {
    stable_height = mainButtonHeight
      ? "calc(100vh - " + mainButtonHeight + "px)"
      : "100vh";
  }
  setCssProperty("viewport-height", height);
  setCssProperty("viewport-stable-height", stable_height);
}

function parseColorToHex(color: string) {
  color += "";
  let match: RegExpExecArray | null;
  if (/^#([0-9a-f]){6}$/i.test(color)) {
    return color.toLowerCase();
  } else if (match = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color)) {
    return ("#" + match[1] + match[1] + match[2] + match[2] + match[3] +
      match[3]).toLowerCase();
  }
  return false;
}

function isColorDark(rgb: string) {
  rgb = rgb.replace(/[\s#]/g, "");
  if (rgb.length == 3) {
    rgb = rgb[0] + rgb[0] + rgb[1] + rgb[1] + rgb[2] + rgb[2];
  }
  const r = parseInt(rgb.substr(0, 2), 16);
  const g = parseInt(rgb.substr(2, 2), 16);
  const b = parseInt(rgb.substr(4, 2), 16);
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp < 120;
}

function byteLength(str: string) {
  if (window.Blob) {
    try {
      return new Blob([str]).size;
    } catch (e) {}
  }
  let s = str.length;
  for (let i = str.length - 1; i >= 0; i--) {
    const code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--;
  }
  return s;
}

let mainButtonHeight = 0;
const MainButton = (function () {
  let isVisible = false;
  let isActive = true;
  let isProgressVisible = false;
  let buttonText = "CONTINUE";
  let buttonColor: Color = false;
  let buttonTextColor: Color = false;

  const mainButton = {} as MainButton;
  Object.defineProperty(mainButton, "text", {
    set: function (val) {
      mainButton.setParams({ text: val });
    },
    get: function () {
      return buttonText;
    },
    enumerable: true,
  });
  Object.defineProperty(mainButton, "color", {
    set: function (val) {
      mainButton.setParams({ color: val });
    },
    get: function () {
      return buttonColor || themeParams.button_color || "#2481cc";
    },
    enumerable: true,
  });
  Object.defineProperty(mainButton, "textColor", {
    set: function (val) {
      mainButton.setParams({ text_color: val });
    },
    get: function () {
      return buttonTextColor || themeParams.button_text_color || "#ffffff";
    },
    enumerable: true,
  });
  Object.defineProperty(mainButton, "isVisible", {
    set: function (val) {
      mainButton.setParams({ is_visible: val });
    },
    get: function () {
      return isVisible;
    },
    enumerable: true,
  });
  Object.defineProperty(mainButton, "isProgressVisible", {
    get: function () {
      return isProgressVisible;
    },
    enumerable: true,
  });
  Object.defineProperty(mainButton, "isActive", {
    set: function (val) {
      mainButton.setParams({ is_active: val });
    },
    get: function () {
      return isActive;
    },
    enumerable: true,
  });

  WebView.onEvent("main_button_pressed", onMainButtonPressed);

  let debugBtn: HTMLButtonElement;
  if (initParamsWebView.tgWebAppDebug) {
    debugBtn = document.createElement("tg-main-button") as any;
    const debugBtnStyle: Record<string, string> = {
      font: "600 14px/18px sans-serif",
      display: "none",
      width: "100%",
      height: "48px",
      borderRadius: "0",
      background: "no-repeat right center",
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      margin: "0",
      padding: "15px 20px",
      textAlign: "center",
      boxSizing: "border-box",
      zIndex: "10000",
    };
    for (const k in debugBtnStyle) {
      debugBtn.style[k as any] = debugBtnStyle[k];
    }
    document.addEventListener("DOMContentLoaded", function onDomLoaded(_event) {
      document.removeEventListener("DOMContentLoaded", onDomLoaded);
      document.body.appendChild(debugBtn);
      debugBtn.addEventListener("click", onMainButtonPressed, false);
    });
  }

  function onMainButtonPressed() {
    if (isActive) {
      receiveWebViewEvent("mainButtonClicked");
    }
  }

  function updateButton() {
    const color = mainButton.color;
    const text_color = mainButton.textColor;
    WebView.postEvent(
      "web_app_setup_main_button",
      false,
      isVisible
        ? {
          is_visible: true,
          is_active: isActive,
          is_progress_visible: isProgressVisible,
          text: buttonText,
          color: color,
          text_color: text_color,
        }
        : { is_visible: false },
    );
    if (initParamsWebView.tgWebAppDebug) {
      debugBtn.style.display = isVisible ? "block" : "none";
      debugBtn.style.opacity = isActive ? "1" : "0.8";
      debugBtn.style.cursor = isActive ? "pointer" : "auto";
      debugBtn.disabled = !isActive;
      debugBtn.innerText = buttonText;
      debugBtn.style.backgroundImage = isProgressVisible
        ? "url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20viewport%3D%220%200%2048%2048%22%20width%3D%2248px%22%20height%3D%2248px%22%3E%3Ccircle%20cx%3D%2250%25%22%20cy%3D%2250%25%22%20stroke%3D%22%23fff%22%20stroke-width%3D%222.25%22%20stroke-linecap%3D%22round%22%20fill%3D%22none%22%20stroke-dashoffset%3D%22106%22%20r%3D%229%22%20stroke-dasharray%3D%2256.52%22%20rotate%3D%22-90%22%3E%3Canimate%20attributeName%3D%22stroke-dashoffset%22%20attributeType%3D%22XML%22%20dur%3D%22360s%22%20from%3D%220%22%20to%3D%2212500%22%20repeatCount%3D%22indefinite%22%3E%3C%2Fanimate%3E%3CanimateTransform%20attributeName%3D%22transform%22%20attributeType%3D%22XML%22%20type%3D%22rotate%22%20dur%3D%221s%22%20from%3D%22-90%2024%2024%22%20to%3D%22630%2024%2024%22%20repeatCount%3D%22indefinite%22%3E%3C%2FanimateTransform%3E%3C%2Fcircle%3E%3C%2Fsvg%3E')"
        : "none";
      debugBtn.style.backgroundColor = color;
      debugBtn.style.color = text_color;

      mainButtonHeight = isVisible ? 48 : 0;
      if (document.documentElement) {
        document.documentElement.style.boxSizing = "border-box";
        document.documentElement.style.paddingBottom = mainButtonHeight + "px";
      }
      setViewportHeight();
    }
  }

  function setParams(params: MainButtonParams) {
    let changed = false;
    if (typeof params.text !== "undefined") {
      const text = params.text.toString().replace(/^\s+|\s+$/g, "");
      if (!text.length) {
        console.error(
          "[Telegram.WebApp] Main button text is required",
          params.text,
        );
        throw Error("WebAppMainButtonParamInvalid");
      }
      if (text.length > 64) {
        console.error("[Telegram.WebApp] Main button text is too long", text);
        throw Error("WebAppMainButtonParamInvalid");
      }
      if (buttonText !== text) {
        changed = true;
      }
      buttonText = text;
    }
    if (typeof params.color !== "undefined") {
      if (
        params.color === false ||
        params.color === null
      ) {
        if (buttonColor !== false) {
          changed = true;
        }
        buttonColor = false;
      } else {
        const color = parseColorToHex(params.color);
        if (!color) {
          console.error(
            "[Telegram.WebApp] Main button color format is invalid",
            color,
          );
          throw Error("WebAppMainButtonParamInvalid");
        }
        if (buttonColor !== color) {
          changed = true;
        }
        buttonColor = color;
      }
    }
    if (typeof params.text_color !== "undefined") {
      if (
        params.text_color === false ||
        params.text_color === null
      ) {
        if (buttonTextColor !== false) {
          changed = true;
        }
        buttonTextColor = false;
      } else {
        const text_color = parseColorToHex(params.text_color);
        if (!text_color) {
          console.error(
            "[Telegram.WebApp] Main button text color format is invalid",
            text_color,
          );
          throw Error("WebAppMainButtonParamInvalid");
        }
        if (buttonTextColor !== text_color) {
          changed = true;
        }
        buttonTextColor = text_color;
      }
    }
    if (typeof params.is_visible !== "undefined") {
      if (
        params.is_visible &&
        !mainButton.text.length
      ) {
        console.error("[Telegram.WebApp] Main button text is required");
        throw Error("WebAppMainButtonParamInvalid");
      }
      if (isVisible !== !!params.is_visible) {
        changed = true;
      }
      isVisible = !!params.is_visible;
    }
    if (typeof params.is_active !== "undefined") {
      if (isActive !== !!params.is_active) {
        changed = true;
      }
      isActive = !!params.is_active;
    }
    if (changed || (params as any).force_update) {
      updateButton();
    }
    return mainButton;
  }

  mainButton.setText = function (text) {
    return mainButton.setParams({ text: text });
  };
  mainButton.onClick = function (callback) {
    onWebViewEvent("mainButtonClicked", callback);
    return mainButton;
  };
  mainButton.offClick = function (callback) {
    offWebViewEvent("mainButtonClicked", callback);
    return mainButton;
  };
  mainButton.show = function () {
    return mainButton.setParams({ is_visible: true });
  };
  mainButton.hide = function () {
    return mainButton.setParams({ is_visible: false });
  };
  mainButton.enable = function () {
    return mainButton.setParams({ is_active: true });
  };
  mainButton.disable = function () {
    return mainButton.setParams({ is_active: false });
  };
  mainButton.showProgress = function (leaveActive) {
    isActive = !!leaveActive;
    isProgressVisible = true;
    updateButton();
    return mainButton;
  };
  mainButton.hideProgress = function () {
    if (!mainButton.isActive) {
      isActive = true;
    }
    isProgressVisible = false;
    updateButton();
    return mainButton;
  };
  mainButton.setParams = setParams;
  return mainButton;
})();

Object.defineProperty(WebApp, "initData", {
  get: function () {
    return webAppInitData;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "initDataUnsafe", {
  get: function () {
    return webAppInitDataUnsafe;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "colorScheme", {
  get: function () {
    return colorScheme;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "themeParams", {
  get: function () {
    return themeParams;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "isExpanded", {
  get: function () {
    return isExpanded;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "viewportHeight", {
  get: function () {
    return (viewportHeight === false ? window.innerHeight : viewportHeight) -
      mainButtonHeight;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "viewportStableHeight", {
  get: function () {
    return (viewportStableHeight === false
      ? window.innerHeight
      : viewportStableHeight) - mainButtonHeight;
  },
  enumerable: true,
});
Object.defineProperty(WebApp, "MainButton", {
  value: MainButton,
  enumerable: true,
});
WebApp.onEvent = function (eventType, callback) {
  onWebViewEvent(eventType, callback);
};
WebApp.offEvent = function (eventType, callback) {
  offWebViewEvent(eventType, callback);
};
WebApp.sendData = function (data) {
  if (!data || !data.length) {
    console.error("[Telegram.WebApp] Data is required", data);
    throw Error("WebAppDataInvalid");
  }
  if (byteLength(data) > 4096) {
    console.error("[Telegram.WebApp] Data is too long", data);
    throw Error("WebAppDataInvalid");
  }
  WebView.postEvent("web_app_data_send", false, { data: data });
};
WebApp.ready = function () {
  WebView.postEvent("web_app_ready");
};
WebApp.expand = function () {
  WebView.postEvent("web_app_expand");
};
WebApp.close = function () {
  WebView.postEvent("web_app_close");
};

window.Telegram.WebApp = WebApp;

setViewportHeight();

window.addEventListener("resize", onWindowResize);

WebView.onEvent("theme_changed", onThemeChanged);
WebView.onEvent("viewport_changed", onViewportChanged);
WebView.postEvent("web_app_request_theme");
WebView.postEvent("web_app_request_viewport");

export default WebApp;
