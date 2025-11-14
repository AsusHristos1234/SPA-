const STORAGE_KEYS = {
  PRODUCTS: 'trackedProducts'
};

const list = document.getElementById('product-list');
const template = document.getElementById('product-template');
const refreshButton = document.getElementById('refresh');
const openOptionsButton = document.getElementById('open-options');

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

openOptionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
refreshButton.addEventListener('click', async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Обновляем...';
  try {
    await chrome.runtime.sendMessage({ action: 'FORCE_PRICE_CHECK' });
    await loadProducts();
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Обновить цены';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'PRODUCT_STATUS_UPDATED') {
    loadProducts();
  }
});

async function loadProducts() {
  const { [STORAGE_KEYS.PRODUCTS]: stored } = await chrome.storage.local.get(STORAGE_KEYS.PRODUCTS);
  const products = Object.values(stored || {});
  renderProducts(products);
}

function renderProducts(products) {
  list.innerHTML = '';
  if (!products.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'Список отслеживания пуст. Откройте карточку товара и нажмите «Добавить в отслеживание».';
    list.appendChild(empty);
    return;
  }

  products.sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0));

  for (const product of products) {
    const node = template.content.firstElementChild.cloneNode(true);
    const image = node.querySelector('.product-card__image');
    const title = node.querySelector('.product-card__title');
    const baseline = node.querySelector('.product-card__baseline');
    const price = node.querySelector('.product-card__price');
    const stats = node.querySelector('.product-card__stats');
    const chartSvg = node.querySelector('.product-card__chart-graph');
    const chartCaption = node.querySelector('.product-card__chart-caption');
    const thresholdContainer = node.querySelector('.product-card__threshold');
    const thresholdInput = node.querySelector('.product-card__threshold-input');
    const thresholdStatus = node.querySelector('.product-card__threshold-status');
    const link = node.querySelector('.product-card__link');
    const remove = node.querySelector('.product-card__remove');
    const toggle = node.querySelector('.product-card__toggle');

    if (product.image) {
      image.src = product.image;
      image.alt = product.title || 'Товар Ozon';
    } else {
      image.remove();
    }

    title.textContent = product.title || 'Товар без названия';
    const initialPrice = getInitialPrice(product);
    if (baseline) {
      baseline.textContent = `Цена при добавлении: ${formatPrice(initialPrice)}`;
    }
    price.textContent = `Текущая цена: ${formatPrice(product.lastKnownPrice)}`;

    const average = calculateAverage(product.history);
    const drop = calculateDrop(product.history);
    const lastUpdate = product.lastUpdate ? new Date(product.lastUpdate).toLocaleString('ru-RU') : '—';

    const pieces = [`Средняя: ${average ? formatPrice(average) : 'нет данных'}`, `Обновлено: ${lastUpdate}`];
    if (drop) {
      pieces.unshift(`Снижение: −${formatPrice(drop)}`);
    }
    stats.textContent = pieces.join(' • ');

    renderPriceChart(chartSvg, chartCaption, product.history, product.id);

    if (thresholdContainer && thresholdInput && thresholdStatus) {
      const placeholder = product.lastKnownPrice ? Math.max(0, product.lastKnownPrice - 100) : '';
      if (placeholder) {
        thresholdInput.placeholder = placeholder.toString();
      }
      if (typeof product.targetPrice === 'number' && Number.isFinite(product.targetPrice)) {
        thresholdInput.value = product.targetPrice;
      } else {
        thresholdInput.value = '';
      }
      updateThresholdStatus(thresholdStatus, product.targetPrice);

      thresholdInput.addEventListener('change', () => {
        saveTargetPrice(product.id, thresholdInput, thresholdStatus);
      });
      thresholdInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          thresholdInput.blur();
        }
      });
      thresholdInput.addEventListener('input', () => {
        thresholdStatus.classList.remove('product-card__threshold-status--error');
      });
    }

    link.href = product.url;

    remove.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ action: 'REMOVE_PRODUCT', payload: { id: product.id } });
      loadProducts();
    });

    if (toggle) {
      setCardCollapsedState(node, toggle, true);
      toggle.addEventListener('click', () => {
        const collapsed = node.classList.contains('product-card--collapsed');
        setCardCollapsedState(node, toggle, !collapsed);
      });
    }

    list.appendChild(node);
  }
}

function formatPrice(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function calculateAverage(history) {
  if (!history || !history.length) return null;
  const total = history.reduce((sum, entry) => sum + entry.price, 0);
  return Math.round(total / history.length);
}

function calculateDrop(history) {
  if (!history || history.length < 2) return null;
  const prices = history.map((entry) => entry.price);
  const max = Math.max(...prices);
  const current = prices[prices.length - 1];
  const drop = max - current;
  return drop > 0 ? drop : 0;
}

function renderPriceChart(svg, captionNode, history, productId) {
  if (!svg) return;

  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  const pointsLimit = 32;
  const recent = (history || []).slice(-pointsLimit);
  const series = [];

  for (const entry of recent) {
    const price = entry && Number(entry.price);
    if (Number.isFinite(price)) {
      series.push({
        price,
        timestamp: entry && entry.timestamp ? Number(entry.timestamp) : null
      });
    }
  }

  if (!series.length) {
    svg.classList.add('product-card__chart-graph--empty');
    if (captionNode) {
      captionNode.textContent = 'История цен появится после нескольких обновлений.';
    }
    return;
  }

  svg.classList.remove('product-card__chart-graph--empty');

  const width = 200;
  const height = 60;
  const minPrice = Math.min.apply(null, series.map((item) => item.price));
  const maxPrice = Math.max.apply(null, series.map((item) => item.price));
  const range = maxPrice - minPrice || 1;
  const step = series.length > 1 ? width / (series.length - 1) : 0;

  const points = series.map((item, index) => {
    const x = series.length === 1 ? width / 2 : index * step;
    const ratio = (item.price - minPrice) / range;
    const y = height - ratio * height;
    return { x, y };
  });

  const gradientId = buildGradientId(productId);
  const defs = createSvgElement('defs');
  const gradient = createSvgElement('linearGradient');
  gradient.setAttribute('id', gradientId);
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('y2', '1');

  const stopTop = createSvgElement('stop');
  stopTop.setAttribute('offset', '0%');
  stopTop.setAttribute('stop-color', '#2563eb');
  stopTop.setAttribute('stop-opacity', '0.28');
  gradient.appendChild(stopTop);

  const stopBottom = createSvgElement('stop');
  stopBottom.setAttribute('offset', '100%');
  stopBottom.setAttribute('stop-color', '#2563eb');
  stopBottom.setAttribute('stop-opacity', '0');
  gradient.appendChild(stopBottom);

  defs.appendChild(gradient);
  svg.appendChild(defs);

  const lineCommands = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const command = (index === 0 ? 'M ' : 'L ') + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
    lineCommands.push(command);
  }

  const areaCommands = lineCommands.slice();
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  areaCommands.push('L ' + lastPoint.x.toFixed(2) + ' ' + height.toFixed(2));
  areaCommands.push('L ' + firstPoint.x.toFixed(2) + ' ' + height.toFixed(2));
  areaCommands.push('Z');

  const area = createSvgElement('path');
  area.setAttribute('d', areaCommands.join(' '));
  area.setAttribute('class', 'product-card__chart-area');
  area.setAttribute('fill', 'url(#' + gradientId + ')');
  svg.appendChild(area);

  const line = createSvgElement('path');
  line.setAttribute('d', lineCommands.join(' '));
  line.setAttribute('class', 'product-card__chart-line');
  svg.appendChild(line);

  const highlight = createSvgElement('circle');
  highlight.setAttribute('cx', lastPoint.x.toFixed(2));
  highlight.setAttribute('cy', lastPoint.y.toFixed(2));
  highlight.setAttribute('r', '3.6');
  highlight.setAttribute('class', 'product-card__chart-dot');
  svg.appendChild(highlight);

  if (captionNode) {
    if (series.length === 1) {
      captionNode.textContent = 'История: пока только одно значение цены.';
    } else if (maxPrice === minPrice) {
      captionNode.textContent = 'История: ' + series.length + ' обновлений без изменения цены.';
    } else {
      captionNode.textContent =
        'История: ' +
        series.length +
        ' обновлений, диапазон ' +
        formatPrice(minPrice) +
        ' — ' +
        formatPrice(maxPrice) +
        '.';
    }
  }
}

function buildGradientId(productId) {
  const base = typeof productId === 'undefined' ? 'default' : String(productId);
  const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return 'chartGradient-' + (sanitized || 'item') + '-' + suffix;
}

function createSvgElement(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

async function saveTargetPrice(productId, input, statusNode) {
  if (!productId) return;
  const { value, valid } = parseTargetInput(input.value || '');

  if (!valid) {
    showThresholdError(statusNode, 'Введите положительное число или оставьте поле пустым.');
    return;
  }

  try {
    const response = await sendMessage({
      action: 'SET_TARGET_PRICE',
      payload: { id: productId, targetPrice: value }
    });
    if (!response || response.ok === false) {
      throw new Error('save_failed');
    }
    const saved = response && typeof response.targetPrice === 'number' ? response.targetPrice : null;
    if (saved) {
      input.value = saved;
    } else if (!value) {
      input.value = '';
    }
    updateThresholdStatus(statusNode, saved);
  } catch (error) {
    showThresholdError(statusNode, 'Не удалось сохранить порог. Попробуйте позже.');
  }
}

function parseTargetInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, valid: true };
  }
  const normalized = trimmed.replace(/\D/g, '');
  if (!normalized) {
    return { value: null, valid: false };
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { value: null, valid: false };
  }
  return { value: Math.round(numeric), valid: true };
}

function updateThresholdStatus(node, targetPrice) {
  if (!node) return;
  node.classList.remove('product-card__threshold-status--active', 'product-card__threshold-status--error');
  if (typeof targetPrice === 'number' && Number.isFinite(targetPrice) && targetPrice > 0) {
    node.textContent = `Уведомим при цене ≤ ${formatPrice(targetPrice)}`;
    node.classList.add('product-card__threshold-status--active');
  } else {
    node.textContent = 'Укажите цену, чтобы получить уведомление.';
  }
}

function showThresholdError(node, message) {
  if (!node) return;
  node.classList.remove('product-card__threshold-status--active');
  node.classList.add('product-card__threshold-status--error');
  node.textContent = message;
}

function setCardCollapsedState(card, toggle, collapsed) {
  if (!card) return;
  card.classList.toggle('product-card--collapsed', collapsed);
  if (toggle) {
    toggle.setAttribute('aria-expanded', (!collapsed).toString());
    const title = collapsed ? 'Показать подробности' : 'Скрыть подробности';
    toggle.title = title;
    toggle.setAttribute('aria-label', title);
    toggle.textContent = collapsed ? '▸' : '▾';
  }
}

function getInitialPrice(product) {
  if (!product) return null;
  const candidate = typeof product.initialPrice === 'number' ? product.initialPrice : null;
  if (Number.isFinite(candidate)) {
    return candidate;
  }
  if (product.history && product.history.length) {
    const firstEntry = product.history[0];
    const price = firstEntry && Number(firstEntry.price);
    if (Number.isFinite(price)) {
      return price;
    }
  }
  return Number.isFinite(product.lastKnownPrice) ? product.lastKnownPrice : null;
}
