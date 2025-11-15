const STORAGE_KEYS = {
  PRODUCTS: 'trackedProducts',
  SETTINGS: 'trackerSettings'
};

const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 60,
  ozonClientId: '',
  ozonApiKey: ''
};

const PRICE_CHECK_ALARM = 'ozon-price-check';

const ICON_SIZES = [16, 32, 48, 128];
const DEFAULT_NOTIFICATION_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#1d4ed8"/><text x="50%" y="58%" text-anchor="middle" font-size="72" fill="#ffffff" font-family="Arial, sans-serif">O</text></svg>'
  );

async function requestText(url, options) {
  const settings = Object.assign(
    { headers: {}, withCredentials: true, method: 'GET', body: null, cache: 'no-store' },
    options || {}
  );
  if (!url) {
    return '';
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(settings.method || 'GET', url, true);
        xhr.withCredentials = Boolean(settings.withCredentials);
        const headerEntries = Object.entries(settings.headers || {});
        for (let i = 0; i < headerEntries.length; i += 1) {
          const [key, value] = headerEntries[i];
          if (value !== undefined && value !== null) {
            try {
              xhr.setRequestHeader(key, String(value));
            } catch (error) {
              // ignore forbidden header mutations
            }
          }
        }
        xhr.onreadystatechange = function onReadyStateChange() {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText || '');
            } else {
              reject(new Error('HTTP ' + xhr.status));
            }
          }
        };
        xhr.onerror = function onError() {
          reject(new Error('Network error'));
        };
        xhr.onabort = function onAbort() {
          reject(new Error('Request aborted'));
        };
        if (settings.body !== undefined && settings.body !== null) {
          xhr.send(settings.body);
        } else {
          xhr.send();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  const response = await fetch(url, {
    method: settings.method || 'GET',
    credentials: settings.withCredentials ? 'include' : 'omit',
    cache: settings.cache || 'no-store',
    headers: settings.headers || {},
    body: settings.body
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }
  return response.text();
}

async function requestJson(url, options) {
  const text = await requestText(url, options);
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function showWebNotification(notificationId, title, options) {
  if (typeof self === 'undefined' || !self.registration || typeof self.registration.showNotification !== 'function') {
    return false;
  }
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    return false;
  }
  try {
    const payload = Object.assign({ tag: notificationId }, options || {});
    await self.registration.showNotification(title, payload);
    return true;
  } catch (error) {
    console.warn('Не удалось отправить уведомление', error);
    return false;
  }
}

function safeSendRuntimeMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (error) {
      resolve(false);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  setDefaultActionIcon();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  setDefaultActionIcon();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PRICE_CHECK_ALARM) {
    return;
  }
  try {
    await checkAllPrices();
  } catch (error) {
    console.warn('Ошибка при фоновой проверке цен', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, payload } = message || {};
  switch (action) {
    case 'ADD_PRODUCT':
      addProduct(payload).then((result) => sendResponse(result));
      return true;
    case 'REMOVE_PRODUCT':
      removeProduct(payload.id).then((result) => sendResponse(result));
      return true;
    case 'GET_PRODUCT_STATUS':
      getProductStatus(payload).then((result) => sendResponse(result));
      return true;
    case 'SET_TARGET_PRICE':
      setProductTargetPrice(payload).then((result) => sendResponse(result));
      return true;
    case 'UPDATE_PRICE_FROM_PAGE':
      if (payload && payload.id && payload.price) {
        updateProductPrice(payload.id, payload.price, 'page');
      }
      break;
    case 'OPEN_OPTIONS':
      chrome.runtime.openOptionsPage();
      break;
    case 'UPDATE_SETTINGS':
      setSettings(payload).then(() => sendResponse({ ok: true }));
      return true;
    case 'FORCE_PRICE_CHECK':
      checkAllPrices('manual').then(() => sendResponse({ ok: true }));
      return true;
    default:
      break;
  }
});

async function ensureAlarm() {
  const settings = await getSettings();
  const periodInMinutes = Math.max(1, Number(settings.checkIntervalMinutes) || DEFAULT_SETTINGS.checkIntervalMinutes);
  chrome.alarms.create(PRICE_CHECK_ALARM, { periodInMinutes });
}

function setDefaultActionIcon() {
  const imageData = {};

  for (const size of ICON_SIZES) {
    const data = createIconImageData(size);
    if (data) {
      imageData[size] = data;
    }
  }

  if (Object.keys(imageData).length > 0) {
    chrome.action.setIcon({ imageData });
  }
}

function createIconImageData(size) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#1d4ed8';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#ffffff';
    const fontSize = Math.round(size * 0.65);
    context.font = fontSize + 'px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('O', size / 2, size / 2 + size * 0.05);
    return context.getImageData(0, 0, size, size);
  }

  if (typeof ImageData !== 'undefined') {
    const totalPixels = size * size;
    const data = new Uint8ClampedArray(totalPixels * 4);
    for (let i = 0; i < totalPixels; i += 1) {
      const offset = i * 4;
      data[offset] = 29;
      data[offset + 1] = 78;
      data[offset + 2] = 216;
      data[offset + 3] = 255;
    }
    return new ImageData(data, size, size);
  }

  return null;
}

async function getSettings() {
  const { [STORAGE_KEYS.SETTINGS]: stored } = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

async function setSettings(nextSettings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...nextSettings } });
  await ensureAlarm();
  fetchPriceFromSellerApi.warnedMissingCredentials = false;
}

async function addProduct(product) {
  if (!product || !product.id) {
    return { ok: false, error: 'Некорректные данные товара' };
  }
  const products = await getProducts();
  const now = Date.now();
  const settings = await getSettings();
  let initialPrice = normalizeOzonPrice(product.currentPrice);

  if (typeof initialPrice !== 'number' || !Number.isFinite(initialPrice) || initialPrice <= 0) {
    try {
      const apiPrice = await fetchPriceFromSellerApi(product, settings);
      if (typeof apiPrice === 'number' && Number.isFinite(apiPrice) && apiPrice > 0) {
        initialPrice = apiPrice;
      }
    } catch (error) {
      console.warn('Не удалось получить начальную цену из Seller API', error);
    }
  }

  if (typeof initialPrice !== 'number' || !Number.isFinite(initialPrice) || initialPrice <= 0) {
    return { ok: false, error: 'Не удалось получить цену товара через API Ozon' };
  }

  const historyEntry = { timestamp: now, price: Number(initialPrice) };
  products[product.id] = {
    id: product.id,
    title: product.title,
    url: product.url,
    image: product.image,
    history: [historyEntry],
    initialPrice: Number(initialPrice),
    lastKnownPrice: Number(initialPrice),
    lastUpdate: now,
    targetPrice: normalizeTargetPrice(product.targetPrice)
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
  await notifyContent(product.id);
  await updateBadge();
  return { ok: true };
}

async function removeProduct(id) {
  const products = await getProducts();
  if (products[id]) {
    delete products[id];
    await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
    await notifyContent(id, { isTracked: false });
    await updateBadge();
  }
  return { ok: true };
}

async function getProductStatus({ id, currentPrice }) {
  const products = await getProducts();
  const product = products[id];
  if (!product) {
    return { isTracked: false, currentPrice };
  }

  if (currentPrice && Number(currentPrice) !== product.lastKnownPrice) {
    await updateProductPrice(id, Number(currentPrice), 'page');
    return getProductStatus({ id });
  }

  const averagePrice = calculateAverage(product.history);
  const priceDrop = calculateDrop(product.history);

  return {
    isTracked: true,
    currentPrice: product.lastKnownPrice,
    averagePrice,
    priceDrop,
    lastUpdate: product.lastUpdate,
    targetPrice: product.targetPrice || null
  };
}

async function getProducts() {
  const { [STORAGE_KEYS.PRODUCTS]: stored } = await chrome.storage.local.get(STORAGE_KEYS.PRODUCTS);
  return stored || {};
}

async function updateProductPrice(id, price, source = 'alarm') {
  const products = await getProducts();
  const product = products[id];
  if (!product) return;

  const now = Date.now();
  const initialAdded = ensureInitialPrice(product);

  if (product.lastKnownPrice === price) {
    let needsPersist = initialAdded;
    if (!product.lastUpdate || product.lastUpdate !== now) {
      product.lastUpdate = now;
      needsPersist = true;
    }
    if (needsPersist) {
      products[id] = product;
      await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
      await notifyContent(id);
    }
    return;
  }

  const previousPrice = product.lastKnownPrice;
  product.lastKnownPrice = price;
  product.lastUpdate = now;
  product.history.push({ timestamp: now, price });
  if (product.history.length > 100) {
    product.history = product.history.slice(-100);
  }
  ensureInitialPrice(product);
  products[id] = product;
  await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
  await notifyContent(id);
  await updateBadge();

  if (source === 'alarm') {
    if (hasCrossedTargetPrice(product, previousPrice)) {
      await createTargetPriceNotification(product);
    } else {
      await createDropNotification(product);
    }
  }
}

function normalizeTargetPrice(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    const numeric = Number(digits);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return null;
}

async function setProductTargetPrice({ id, targetPrice }) {
  if (!id) {
    return { ok: false, error: 'Не передан идентификатор товара' };
  }

  const products = await getProducts();
  const product = products[id];
  if (!product) {
    return { ok: false, error: 'Товар не найден' };
  }

  product.targetPrice = normalizeTargetPrice(targetPrice);
  products[id] = product;
  await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
  await notifyContent(id);
  return { ok: true, targetPrice: product.targetPrice };
}

async function checkAllPrices(source = 'alarm') {
  const products = await getProducts();
  const entries = Object.values(products);
  if (!entries.length) {
    await updateBadge();
    return;
  }

  const settings = await getSettings();

  for (const product of entries) {
    try {
      const freshPrice = await fetchPrice(product, settings);
      if (typeof freshPrice === 'number' && Number.isFinite(freshPrice) && freshPrice > 0) {
        await updateProductPrice(product.id, freshPrice, source);
      }
    } catch (error) {
      console.warn('Не удалось обновить цену', product.id, error);
    }
  }
}

async function fetchPrice(product, settings) {
  const priceFromApi = await fetchPriceFromSellerApi(product, settings);
  if (typeof priceFromApi === 'number' && Number.isFinite(priceFromApi) && priceFromApi > 0) {
    return priceFromApi;
  }

  if (!product || !product.url) {
    return null;
  }

  return fetchPriceFromPage(product.url);
}

async function fetchPriceFromPage(url) {
  if (!url) return null;

  const apiPrice = await fetchPriceFromComposerApi(url);
  if (typeof apiPrice === 'number' && Number.isFinite(apiPrice) && apiPrice > 0) {
    return apiPrice;
  }

  const html = await requestText(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ru-RU,ru;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  return parsePriceFromHtml(html);
}

async function fetchPriceFromSellerApi(product, settings) {
  if (!product) {
    return null;
  }

  const clientId = String((settings && settings.ozonClientId) || '').trim();
  const apiKey = String((settings && settings.ozonApiKey) || '').trim();
  if (!clientId || !apiKey) {
    if (!fetchPriceFromSellerApi.warnedMissingCredentials) {
      console.warn('Укажите Client ID и API Key Ozon Seller API в настройках расширения для фонового обновления цен.');
      fetchPriceFromSellerApi.warnedMissingCredentials = true;
    }
    return null;
  }

  const filter = { visibility: 'ALL' };
  const identifiers = [];
  if (product.id) {
    identifiers.push(String(product.id));
  }
  const numericId = extractNumericId(product.id || '');
  if (numericId) {
    filter.product_id = [numericId];
    filter.sku = [numericId];
  }
  if (identifiers.length) {
    filter.offer_id = identifiers;
  }

  const body = {
    filter,
    last_id: ''
  };

  let response = null;
  try {
    response = await requestJson('https://api-seller.ozon.ru/v4/product/info/prices', {
      method: 'POST',
      withCredentials: false,
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.warn('Ошибка при обращении к Ozon Seller API', error);
    return null;
  }

  if (!response) {
    return null;
  }

  if (response.error) {
    console.warn('Ozon Seller API вернул ошибку', response.error);
    return null;
  }

  if (!response.result || !Array.isArray(response.result.items)) {
    return null;
  }

  for (const item of response.result.items) {
    if (!item) {
      continue;
    }
    const blocks = [];
    if (item.price) {
      blocks.push(item.price);
    }
    if (item.price_info) {
      blocks.push(item.price_info);
    }

    for (let b = 0; b < blocks.length; b += 1) {
      const block = blocks[b];
      if (!block) {
        continue;
      }
      const candidates = [
        block.price_with_promo,
        block.price,
        block.min_price,
        block.base_price,
        block.current_price,
        block.price_value,
        block.retail_price
      ];
      for (let i = 0; i < candidates.length; i += 1) {
        const parsed = normalizeOzonPrice(candidates[i]);
        if (typeof parsed === 'number') {
          return parsed;
        }
      }
    }

    const fallbackCandidates = [item.min_price, item.current_price, item.price_value];
    for (let j = 0; j < fallbackCandidates.length; j += 1) {
      const parsed = normalizeOzonPrice(fallbackCandidates[j]);
      if (typeof parsed === 'number') {
        return parsed;
      }
    }
  }

  return null;
}

fetchPriceFromSellerApi.warnedMissingCredentials = false;

function extractNumericId(value) {
  if (!value) {
    return null;
  }
  const digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }
  const numeric = Number(digits);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function normalizeOzonPrice(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (!cleaned) {
      return null;
    }
    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.round(numeric);
  }
  return null;
}

async function fetchPriceFromComposerApi(url) {
  let composerUrl = null;
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname + (parsedUrl.search || '');
    composerUrl = parsedUrl.origin + '/api/composer-api.bx/page/json/v2?url=' + encodeURIComponent(path || '/');
  } catch (error) {
    return null;
  }

  try {
    const data = await requestJson(composerUrl, {
      headers: {
        Accept: 'application/json,text/plain,*/*',
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!data) {
      return null;
    }

    const price = parsePriceFromComposerJson(data);
    if (typeof price === 'number' && Number.isFinite(price)) {
      return price;
    }
  } catch (error) {
    console.warn('Ошибка при запросе API Ozon', error);
  }

  return null;
}

function parsePriceFromHtml(html) {
  if (!html) return null;

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const fromDoc =
        parsePriceFromMeta(doc) ||
        parsePriceFromStructuredData(doc) ||
        parsePriceFromWidgets(doc);
      if (typeof fromDoc === 'number' && Number.isFinite(fromDoc)) {
        return fromDoc;
      }
    } catch (error) {
      // ignore DOM parser errors and fall back to regex parsing
    }
  }

  const normalizedHtml = normalizePriceHtml(html);
  const fromJsonStrings = parsePriceFromJsonStrings(normalizedHtml);
  if (typeof fromJsonStrings === 'number' && Number.isFinite(fromJsonStrings)) {
    return fromJsonStrings;
  }

  const fallbackMatch = normalizedHtml.match(/([0-9][0-9\s.,]{2,})\s*(₽|руб\.?|RUB|&#8381;)/i);
  if (fallbackMatch) {
    const numbers = fallbackMatch[1].replace(/[^0-9]/g, '');
    if (numbers) {
      return Number(numbers);
    }
  }

  return null;
}

function parsePriceFromComposerJson(data) {
  return extractPriceCandidate(data, new Set());
}

function extractPriceCandidate(node, seen) {
  if (node === null || node === undefined) {
    return null;
  }

  if (typeof node === 'number') {
    if (Number.isFinite(node) && node > 0) {
      return Math.round(node);
    }
    return null;
  }

  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const nested = extractPriceCandidate(parsed, seen);
        if (typeof nested === 'number' && Number.isFinite(nested)) {
          return nested;
        }
      }
    } catch (error) {
      // ignore invalid JSON strings
    }

    const normalized = normalizePriceHtml(trimmed);
    const fromJsonString = parsePriceFromJsonStrings(normalized);
    if (typeof fromJsonString === 'number' && Number.isFinite(fromJsonString)) {
      return fromJsonString;
    }

    const fromRawNumber = extractNumber(trimmed);
    if (typeof fromRawNumber === 'number' && Number.isFinite(fromRawNumber) && /₽|руб|RUB/i.test(trimmed)) {
      return fromRawNumber;
    }

    return null;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const price = extractPriceCandidate(node[i], seen);
      if (typeof price === 'number' && Number.isFinite(price)) {
        return price;
      }
    }
    return null;
  }

  if (typeof node === 'object') {
    if (seen.has(node)) {
      return null;
    }
    seen.add(node);

    const directKeys = [
      'price',
      'finalPrice',
      'finalPriceValue',
      'priceValue',
      'currentPrice',
      'convertedPrice',
      'priceAmount',
      'totalPrice',
      'priceWithDiscount'
    ];

    for (let i = 0; i < directKeys.length; i += 1) {
      const key = directKeys[i];
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const candidate = extractPriceCandidate(node[key], seen);
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          return candidate;
        }
      }
    }

    const values = Object.keys(node);
    for (let i = 0; i < values.length; i += 1) {
      const price = extractPriceCandidate(node[values[i]], seen);
      if (typeof price === 'number' && Number.isFinite(price)) {
        return price;
      }
    }
  }

  return null;
}

function normalizePriceHtml(html) {
  return String(html)
    .replace(/&nbsp;|&#160;|&#8239;/gi, ' ')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;|&#38;/gi, '&')
    .replace(/&#x20bd;|&#8381;/gi, '₽');
}

function parsePriceFromJsonStrings(html) {
  const patterns = [
    /"finalPrice"\s*:\s*{[^}]*"price"\s*:\s*("?)([0-9\s.,]+)\1/i,
    /"currentPrice"\s*:\s*("?)([0-9\s.,]+)\1/i,
    /"priceValue"\s*:\s*("?)([0-9\s.,]+)\1/i,
    /"convertedPrice"\s*:\s*("?)([0-9\s.,]+)\1/i,
    /"rubPrice"\s*:\s*("?)([0-9\s.,]+)\1/i,
    /"price"\s*:\s*{[^}]*"amount"\s*:\s*("?)([0-9\s.,]+)\1/i
  ];

  for (let i = 0; i < patterns.length; i += 1) {
    const match = html.match(patterns[i]);
    if (match) {
      const price = extractNumber(match[2]);
      if (typeof price === 'number' && Number.isFinite(price)) {
        return price;
      }
    }
  }

  const genericPattern = /"price"\s*:\s*("?)([0-9\s.,]{3,})\1/gi;
  let genericMatch = genericPattern.exec(html);
  let bestPrice = null;
  while (genericMatch) {
    const price = extractNumber(genericMatch[2]);
    if (typeof price === 'number' && Number.isFinite(price)) {
      if (!bestPrice || price > bestPrice) {
        bestPrice = price;
      }
    }
    genericMatch = genericPattern.exec(html);
  }

  return bestPrice;
}

function parsePriceFromMeta(doc) {
  const node = doc.querySelector('meta[itemprop="price"], [itemprop="price"]');
  if (!node) {
    return null;
  }
  const candidate = node.getAttribute('content') || node.textContent;
  return extractNumber(candidate);
}

function parsePriceFromStructuredData(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i += 1) {
    try {
      const data = JSON.parse(scripts[i].textContent || '{}');
      if (!data) {
        continue;
      }
      if (data.offers && typeof data.offers === 'object') {
        if (Array.isArray(data.offers)) {
          for (let j = 0; j < data.offers.length; j += 1) {
            const offer = data.offers[j];
            if (offer && offer.price) {
              const price = extractNumber(String(offer.price));
              if (typeof price === 'number' && Number.isFinite(price)) {
                return price;
              }
            }
          }
        } else if (data.offers.price) {
          const price = extractNumber(String(data.offers.price));
          if (typeof price === 'number' && Number.isFinite(price)) {
            return price;
          }
        }
      }
      if (data.price) {
        const price = extractNumber(String(data.price));
        if (typeof price === 'number' && Number.isFinite(price)) {
          return price;
        }
      }
    } catch (error) {
      // ignore malformed JSON blocks
    }
  }
  return null;
}

function parsePriceFromWidgets(doc) {
  const priceContainer = doc.querySelector(
    '[data-widget="webCurrentPrice"], [data-widget="webDetailBlock"], [data-widget="webPricing"], [data-widget="webMainPrice"], [data-widget="webSale"]'
  );
  if (!priceContainer) {
    return null;
  }

  const textNodes = priceContainer.querySelectorAll('span, div, p, strong');
  for (let i = 0; i < textNodes.length; i += 1) {
    const text = textNodes[i].textContent || '';
    if (/\d/.test(text) && /₽|руб|RUB/i.test(text)) {
      const price = extractNumber(text);
      if (typeof price === 'number' && Number.isFinite(price)) {
        return price;
      }
    }
  }

  const fallback = priceContainer.textContent || '';
  return extractNumber(fallback);
}

function extractNumber(text) {
  if (!text) return null;
  const numbers = String(text).replace(/[^0-9]/g, '');
  if (!numbers) return null;
  return Number(numbers);
}

function calculateAverage(history) {
  if (!history || !history.length) return null;
  const total = history.reduce((sum, entry) => sum + entry.price, 0);
  return Math.round(total / history.length);
}

function calculateDrop(history) {
  if (!history || history.length < 2) return null;
  const prices = history.map((entry) => entry.price);
  const maxPrice = Math.max(...prices);
  const currentPrice = prices[prices.length - 1];
  const drop = maxPrice - currentPrice;
  return drop > 0 ? drop : 0;
}

function ensureInitialPrice(product) {
  if (!product) return false;
  const stored = typeof product.initialPrice === 'number' ? product.initialPrice : NaN;
  if (Number.isFinite(stored) && stored > 0) {
    return false;
  }

  let sourcePrice = null;
  if (product.history && product.history.length) {
    const firstEntry = product.history[0];
    if (firstEntry && Number.isFinite(Number(firstEntry.price))) {
      sourcePrice = Number(firstEntry.price);
    }
  }

  if (!Number.isFinite(sourcePrice) && Number.isFinite(Number(product.lastKnownPrice))) {
    sourcePrice = Number(product.lastKnownPrice);
  }

  if (Number.isFinite(sourcePrice) && sourcePrice > 0) {
    product.initialPrice = Math.round(sourcePrice);
    return true;
  }
  return false;
}

async function notifyContent(id, overrides = {}) {
  const products = await getProducts();
  const product = products[id];
  const payload = { id, ...overrides };

  if (product) {
    payload.isTracked = true;
    payload.currentPrice = product.lastKnownPrice;
    payload.averagePrice = calculateAverage(product.history);
    payload.priceDrop = calculateDrop(product.history);
    payload.lastUpdate = product.lastUpdate;
    payload.targetPrice = product.targetPrice || null;
  } else if (typeof payload.isTracked === 'undefined') {
    payload.isTracked = false;
  }

  await safeSendRuntimeMessage({
    action: 'PRODUCT_STATUS_UPDATED',
    payload
  });
}

async function updateBadge() {
  const products = await getProducts();
  const tracked = Object.keys(products).length;
  if (tracked > 0) {
    chrome.action.setBadgeText({ text: String(tracked) });
    chrome.action.setBadgeBackgroundColor({ color: '#2d6bff' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function createDropNotification(product) {
  if (!product || !product.history || product.history.length < 2) return;
  const drop = calculateDrop(product.history);
  if (!drop) return;

  await showWebNotification('price-drop-' + product.id, 'Цена снизилась! 🎉', {
    body:
      product.title +
      '\nНовая цена: ' +
      product.lastKnownPrice.toLocaleString('ru-RU') +
      ' ₽',
    icon: product.image || DEFAULT_NOTIFICATION_ICON,
    badge: DEFAULT_NOTIFICATION_ICON,
    renotify: true,
    data: { productId: product.id, type: 'drop' }
  });
}

function hasCrossedTargetPrice(product, previousPrice) {
  if (!product || !product.targetPrice) {
    return false;
  }
  const target = Number(product.targetPrice);
  if (!Number.isFinite(target) || target <= 0) {
    return false;
  }
  const before = Number(previousPrice);
  if (!Number.isFinite(before)) {
    return product.lastKnownPrice <= target;
  }
  return before > target && product.lastKnownPrice <= target;
}

async function createTargetPriceNotification(product) {
  if (!product || !product.targetPrice) return;

  await showWebNotification('price-target-' + product.id, 'Цена достигла порога', {
    body:
      product.title +
      '\nТекущая цена: ' +
      product.lastKnownPrice.toLocaleString('ru-RU') +
      ' ₽ (порог: ' +
      Number(product.targetPrice).toLocaleString('ru-RU') +
      ' ₽)',
    icon: product.image || DEFAULT_NOTIFICATION_ICON,
    badge: DEFAULT_NOTIFICATION_ICON,
    renotify: true,
    data: { productId: product.id, type: 'target' }
  });
}
