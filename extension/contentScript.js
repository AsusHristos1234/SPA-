(function () {
  if (!window.location.hostname.includes('ozon.ru')) {
    return;
  }

  const widgetId = 'ozon-price-tracker-widget';
  if (document.getElementById(widgetId)) {
    return;
  }

  const state = {
    productId: null,
    title: null,
    image: null,
    price: null,
    category: null,
    categoryPath: [],
    isTracked: false,
    lastUpdate: null,
    averagePrice: null,
    priceDrop: null
  };

  function parseProductId() {
    const url = window.location.pathname;
    const fromIdPattern = url.match(/id\/(\d{5,})/);
    if (fromIdPattern) {
      return fromIdPattern[1];
    }
    const fromProductPattern = url.match(/product\/[\w-]*?(\d{5,})\/?/);
    if (fromProductPattern) {
      return fromProductPattern[1];
    }
    const digits = url.match(/(\d{5,})/);
    return digits ? digits[1] : null;
  }

  function parsePriceFromMeta() {
    const metaNode = document.querySelector('meta[itemprop="price"], [itemprop="price"]');
    if (!metaNode) {
      return null;
    }
    const candidate = metaNode.getAttribute('content') || metaNode.textContent;
    return extractNumber(candidate);
  }

  function parsePriceFromStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
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
                if (price) {
                  return price;
                }
              }
            }
          } else if (data.offers.price) {
            const price = extractNumber(String(data.offers.price));
            if (price) {
              return price;
            }
          }
        }
        if (data.price) {
          const price = extractNumber(String(data.price));
          if (price) {
            return price;
          }
        }
      } catch (error) {
        // ignore malformed JSON blocks
      }
    }
    return null;
  }

  function parsePriceFromWidgets() {
    const priceContainer = document.querySelector('[data-widget="webCurrentPrice"], [data-widget="webDetailBlock"], [data-widget="webPricing"], [data-widget="webMainPrice"], [data-widget="webSale"]');
    if (!priceContainer) {
      return null;
    }

    const priceTextCandidate = Array.from(priceContainer.querySelectorAll('span, div, p, strong'))
      .map((node) => node.textContent || '')
      .find((text) => /\d/.test(text) && /₽|руб|RUB/i.test(text));

    if (!priceTextCandidate) {
      const fallback = priceContainer.textContent || '';
      return extractNumber(fallback);
    }

    return extractNumber(priceTextCandidate);
  }

  function parsePrice() {
    return (
      parsePriceFromMeta() ||
      parsePriceFromStructuredData() ||
      parsePriceFromWidgets()
    );
  }

  function extractNumber(text) {
    if (!text) return null;
    const numbers = text.replace(/[^0-9]/g, '');
    if (!numbers) return null;
    return Number(numbers);
  }

  function parseTitle() {
    const heading = document.querySelector('[data-widget="webProductHeading"] h1, h1, [itemprop="name"]');
    return heading ? heading.textContent.trim() : document.title;
  }

  function parseImage() {
    const metaOg = document.querySelector('meta[property="og:image"]');
    if (metaOg && metaOg.content) {
      return metaOg.content;
    }
    const img = document.querySelector('img');
    return img ? img.src : null;
  }

  function parseCategoryPathFromMeta(title) {
    const nodes = document.querySelectorAll(
      'meta[itemprop="category"], meta[property="product:category"], meta[name="category"], meta[name="product:category"]'
    );
    const parts = [];
    nodes.forEach((node) => {
      const content = node.getAttribute('content') || node.getAttribute('value') || node.textContent;
      if (!content) return;
      content
        .split(/[,>\n\r|\\/]+/)
        .map((part) => part.trim())
        .forEach((part) => {
          if (part) {
            parts.push(part);
          }
        });
    });
    return sanitizeCategoryParts(parts, title);
  }

  function parseCategoryPathFromStructuredData(title) {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const collected = [];
    for (let i = 0; i < scripts.length; i += 1) {
      try {
        const data = JSON.parse(scripts[i].textContent || '{}');
        if (!data) {
          continue;
        }
        if (Array.isArray(data)) {
          data.forEach((item) => {
            const names = extractCategoriesFromLdJson(item);
            if (names.length) {
              collected.push(...names);
            }
          });
        } else {
          const names = extractCategoriesFromLdJson(data);
          if (names.length) {
            collected.push(...names);
          }
        }
      } catch (error) {
        // ignore malformed JSON blocks
      }
    }
    return sanitizeCategoryParts(collected, title);
  }

  function extractCategoriesFromLdJson(data) {
    if (!data || typeof data !== 'object') {
      return [];
    }
    if (data['@type'] === 'BreadcrumbList' && Array.isArray(data.itemListElement)) {
      const parts = [];
      data.itemListElement.forEach((item) => {
        if (!item) return;
        if (item.name) {
          parts.push(item.name);
        } else if (item.item && item.item.name) {
          parts.push(item.item.name);
        }
      });
      return parts;
    }
    if (data.category && typeof data.category === 'string') {
      return data.category.split(/[,>\n\r|\\/]+/);
    }
    return [];
  }

  function parseCategoryPathFromBreadcrumbs(title) {
    const widget = document.querySelector(
      '[data-widget="webBreadcrumbs"], nav[aria-label*="крош" i], nav[aria-label*="bread" i]'
    );
    if (!widget) {
      return [];
    }
    const nodes = widget.querySelectorAll('a span, a, li span');
    const parts = [];
    nodes.forEach((node) => {
      const text = node.textContent ? node.textContent.trim() : '';
      if (text) {
        parts.push(text);
      }
    });
    return sanitizeCategoryParts(parts, title);
  }

  function sanitizeCategoryParts(parts, title) {
    if (!Array.isArray(parts)) {
      return [];
    }
    const unique = [];
    const seen = new Set();
    const loweredTitle = title ? title.trim().toLocaleLowerCase('ru-RU') : '';
    for (let i = 0; i < parts.length; i += 1) {
      const raw = parts[i];
      if (!raw && raw !== 0) {
        continue;
      }
      const normalized = String(raw)
        .replace(/\s+/g, ' ')
        .trim();
      if (!normalized) {
        continue;
      }
      if (/^главная$/i.test(normalized)) {
        continue;
      }
      const lowered = normalized.toLocaleLowerCase('ru-RU');
      if (loweredTitle && lowered === loweredTitle) {
        continue;
      }
      if (seen.has(lowered)) {
        continue;
      }
      seen.add(lowered);
      unique.push(normalized);
    }
    return unique;
  }

  function parseCategoryPath(title) {
    const fromMeta = parseCategoryPathFromMeta(title);
    if (fromMeta.length) {
      return fromMeta;
    }
    const fromStructured = parseCategoryPathFromStructuredData(title);
    if (fromStructured.length) {
      return fromStructured;
    }
    const fromBreadcrumbs = parseCategoryPathFromBreadcrumbs(title);
    if (fromBreadcrumbs.length) {
      return fromBreadcrumbs;
    }
    return [];
  }

  function derivePrimaryCategory(categoryPath) {
    if (!Array.isArray(categoryPath) || !categoryPath.length) {
      return null;
    }
    return categoryPath[0] || categoryPath[categoryPath.length - 1] || null;
  }

  function updateState() {
    state.productId = parseProductId();
    state.title = parseTitle();
    state.image = parseImage();
    state.price = parsePrice();
    const categories = parseCategoryPath(state.title);
    state.categoryPath = categories;
    state.category = derivePrimaryCategory(categories);
  }

  function createWidget() {
    const wrapper = document.createElement('div');
    wrapper.id = widgetId;
    wrapper.className = 'ozon-tracker-panel';

    wrapper.innerHTML = `
      <div class="ozon-tracker-header">
        <span class="ozon-tracker-title">Отслеживание цены</span>
        <button type="button" class="ozon-tracker-close" title="Скрыть">×</button>
      </div>
      <div class="ozon-tracker-body">
        <div class="ozon-tracker-info">
          <div class="ozon-tracker-product"></div>
          <div class="ozon-tracker-price"></div>
          <div class="ozon-tracker-average"></div>
          <div class="ozon-tracker-drop"></div>
          <div class="ozon-tracker-updated"></div>
        </div>
        <div class="ozon-tracker-actions">
          <button type="button" class="ozon-tracker-action ozon-track-add">Добавить в отслеживание</button>
          <button type="button" class="ozon-tracker-action ozon-track-remove" hidden>Убрать из отслеживания</button>
          <a class="ozon-tracker-options" href="#">Настройки проверки</a>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    const closeBtn = wrapper.querySelector('.ozon-tracker-close');
    closeBtn.addEventListener('click', () => {
      wrapper.remove();
    });

    const addButton = wrapper.querySelector('.ozon-track-add');
    const removeButton = wrapper.querySelector('.ozon-track-remove');

    addButton.addEventListener('click', () => {
      updateState();
      if (!state.productId || !state.price) {
        showToast('Не удалось определить цену товара. Обновите страницу.');
        return;
      }
      chrome.runtime.sendMessage({
        action: 'ADD_PRODUCT',
        payload: {
          id: state.productId,
          title: state.title,
          url: window.location.href,
          image: state.image,
          currentPrice: state.price,
          category: state.category,
          categoryPath: state.categoryPath
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message);
          return;
        }
        if (response && response.ok) {
          showToast('Товар добавлен в отслеживание.');
          refreshStatus();
        }
      });
    });

    removeButton.addEventListener('click', () => {
      if (!state.productId) return;
      chrome.runtime.sendMessage({
        action: 'REMOVE_PRODUCT',
        payload: { id: state.productId }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(chrome.runtime.lastError.message);
          return;
        }
        if (response && response.ok) {
          showToast('Товар удалён из отслеживания.');
          refreshStatus();
        }
      });
    });

    wrapper.querySelector('.ozon-tracker-options').addEventListener('click', (event) => {
      event.preventDefault();
      chrome.runtime.sendMessage({ action: 'OPEN_OPTIONS' });
    });

    return wrapper;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'ozon-tracker-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function renderStatus(wrapper) {
    const productNode = wrapper.querySelector('.ozon-tracker-product');
    const priceNode = wrapper.querySelector('.ozon-tracker-price');
    const avgNode = wrapper.querySelector('.ozon-tracker-average');
    const dropNode = wrapper.querySelector('.ozon-tracker-drop');
    const updatedNode = wrapper.querySelector('.ozon-tracker-updated');
    const addButton = wrapper.querySelector('.ozon-track-add');
    const removeButton = wrapper.querySelector('.ozon-track-remove');

    productNode.textContent = state.title || 'Неизвестный товар';

    if (state.price) {
      priceNode.textContent = `Текущая цена: ${state.price.toLocaleString('ru-RU')} ₽`;
    } else {
      priceNode.textContent = 'Текущая цена не найдена';
    }

    if (state.isTracked) {
      addButton.hidden = true;
      removeButton.hidden = false;
      if (typeof state.averagePrice === 'number') {
        avgNode.textContent = `Средняя цена: ${state.averagePrice.toLocaleString('ru-RU')} ₽`;
      } else {
        avgNode.textContent = 'Средняя цена: нет данных';
      }
      if (typeof state.priceDrop === 'number') {
        const prefix = state.priceDrop > 0 ? 'Снижение' : 'Изменений нет';
        dropNode.textContent = state.priceDrop > 0 ? `${prefix}: −${state.priceDrop.toLocaleString('ru-RU')} ₽` : prefix;
      } else {
        dropNode.textContent = 'История цены отсутствует';
      }
      if (state.lastUpdate) {
        const date = new Date(state.lastUpdate);
        updatedNode.textContent = `Обновлено: ${date.toLocaleString('ru-RU')}`;
      } else {
        updatedNode.textContent = 'Ещё не обновлялось';
      }
    } else {
      addButton.hidden = false;
      removeButton.hidden = true;
      avgNode.textContent = 'Средняя цена: —';
      dropNode.textContent = 'Снижение цены: —';
      updatedNode.textContent = 'История отсутствует';
    }
  }

  function refreshStatus() {
    updateState();
    if (!state.productId) {
      return;
    }
    chrome.runtime.sendMessage({
      action: 'GET_PRODUCT_STATUS',
      payload: { id: state.productId, currentPrice: state.price }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError.message);
        return;
      }
      if (!response) return;
      state.isTracked = Boolean(response.isTracked);
      state.averagePrice = response.averagePrice;
      state.priceDrop = response.priceDrop;
      state.lastUpdate = response.lastUpdate;
      if (response.currentPrice && !state.price) {
        state.price = response.currentPrice;
      }
      if (widget) {
        renderStatus(widget);
      }
    });
  }

  const widget = createWidget();
  refreshStatus();

  const observer = new MutationObserver(() => {
    const newPrice = parsePrice();
    if (newPrice && newPrice !== state.price) {
      state.price = newPrice;
      renderStatus(widget);
      if (state.isTracked) {
        chrome.runtime.sendMessage({
          action: 'UPDATE_PRICE_FROM_PAGE',
          payload: { id: state.productId, price: newPrice }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'PRODUCT_STATUS_UPDATED' && message.payload && message.payload.id === state.productId) {
      state.averagePrice = message.payload.averagePrice;
      state.priceDrop = message.payload.priceDrop;
      state.lastUpdate = message.payload.lastUpdate;
      state.price = message.payload.currentPrice || state.price;
      state.isTracked = message.payload.isTracked;
      renderStatus(widget);
    }
  });
})();
