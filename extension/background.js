const STORAGE_KEYS = {
  PRODUCTS: 'trackedProducts',
  SETTINGS: 'trackerSettings'
};

const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 60
};

const PRICE_CHECK_ALARM = 'ozon-price-check';

const ICON_SIZES = [16, 32, 48, 128];
const DEFAULT_NOTIFICATION_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#1d4ed8"/><text x="50%" y="58%" text-anchor="middle" font-size="72" fill="#ffffff" font-family="Arial, sans-serif">O</text></svg>'
  );

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  setDefaultActionIcon();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  setDefaultActionIcon();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PRICE_CHECK_ALARM) {
    checkAllPrices();
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
      checkAllPrices().then(() => sendResponse({ ok: true }));
      return true;
    default:
      break;
  }
});

async function ensureAlarm() {
  const settings = await getSettings();
  const periodInMinutes = Math.max(5, Number(settings.checkIntervalMinutes) || DEFAULT_SETTINGS.checkIntervalMinutes);
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
}

async function addProduct(product) {
  if (!product || !product.id || !product.currentPrice) {
    return { ok: false, error: 'Некорректные данные товара' };
  }
  const products = await getProducts();
  const now = Date.now();
  const historyEntry = { timestamp: now, price: Number(product.currentPrice) };
  products[product.id] = {
    id: product.id,
    title: product.title,
    url: product.url,
    image: product.image,
    history: [historyEntry],
    lastKnownPrice: Number(product.currentPrice),
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

  if (product.lastKnownPrice === price) {
    return;
  }

  const previousPrice = product.lastKnownPrice;
  const now = Date.now();
  product.lastKnownPrice = price;
  product.lastUpdate = now;
  product.history.push({ timestamp: now, price });
  if (product.history.length > 100) {
    product.history = product.history.slice(-100);
  }
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

async function checkAllPrices() {
  const products = await getProducts();
  const entries = Object.values(products);
  if (!entries.length) {
    await updateBadge();
    return;
  }

  for (const product of entries) {
    try {
      const freshPrice = await fetchPrice(product.url);
      if (freshPrice) {
        await updateProductPrice(product.id, freshPrice, 'alarm');
      }
    } catch (error) {
      console.warn('Не удалось обновить цену', product.id, error);
    }
  }
}

async function fetchPrice(url) {
  if (!url) return null;
  const response = await fetch(url, {
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OzonPriceTracker/1.0)',
      'Accept-Language': 'ru-RU,ru;q=0.9'
    }
  });
  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }
  const html = await response.text();
  return parsePriceFromHtml(html);
}

function parsePriceFromHtml(html) {
  if (!html) return null;
  const directMatch = html.match(/"price"\s*:\s*{\s*"price"\s*:\s*(\d+)/);
  if (directMatch) {
    return Number(directMatch[1]);
  }
  const fallbackMatch = html.match(/([0-9][0-9\s]{2,})\s*(₽|руб)/i);
  if (fallbackMatch) {
    const numbers = fallbackMatch[1].replace(/\s+/g, '');
    return Number(numbers);
  }
  return null;
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

  chrome.runtime.sendMessage({
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

  await chrome.notifications.create('price-drop-' + product.id + '-' + Date.now(), {
    type: 'basic',
    iconUrl: product.image || DEFAULT_NOTIFICATION_ICON,
    title: 'Цена снизилась! 🎉',
    message:
      product.title +
      '\nНовая цена: ' +
      product.lastKnownPrice.toLocaleString('ru-RU') +
      ' ₽',
    priority: 2
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

  await chrome.notifications.create('price-target-' + product.id + '-' + Date.now(), {
    type: 'basic',
    iconUrl: product.image || DEFAULT_NOTIFICATION_ICON,
    title: 'Цена достигла порога',
    message:
      product.title +
      '\nТекущая цена: ' +
      product.lastKnownPrice.toLocaleString('ru-RU') +
      ' ₽ (порог: ' +
      Number(product.targetPrice).toLocaleString('ru-RU') +
      ' ₽)',
    priority: 2
  });
}
