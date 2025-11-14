const { STORAGE_KEYS, createRenderer } = window.ProductsView;

const CATEGORY_ALL_KEY = '__all__';
const UNCATEGORIZED_KEY = '__uncategorized__';

const list = document.getElementById('product-list');
const template = document.getElementById('product-template');
const refreshButton = document.getElementById('refresh');
const openOptionsButton = document.getElementById('open-options');
const categoryList = document.getElementById('category-list');

let allProducts = [];
let selectedCategory = CATEGORY_ALL_KEY;

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

const renderer = createRenderer({
  listElement: list,
  templateElement: template,
  collapsedByDefault: true,
  syncRowToggles: true,
  sendMessage,
  onChange: async () => {
    await loadProducts();
  }
});

if (openOptionsButton) {
  openOptionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

if (refreshButton) {
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Обновляем...';
    try {
      await sendMessage({ action: 'FORCE_PRICE_CHECK' });
      await loadProducts();
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Обновить цены';
    }
  });
}

if (categoryList) {
  categoryList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button || button.disabled) {
      return;
    }
    const { category } = button.dataset;
    if (!category || category === selectedCategory) {
      return;
    }
    selectedCategory = category;
    renderCategories(allProducts);
    renderProducts();
  });
}

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
  const products = Object.values(stored || {}).map(normalizeProductForView);
  allProducts = products;
  if (selectedCategory !== CATEGORY_ALL_KEY) {
    const hasSelected = allProducts.some((product) => product.categoryKey === selectedCategory);
    if (!hasSelected) {
      selectedCategory = CATEGORY_ALL_KEY;
    }
  }
  renderCategories(allProducts);
  renderProducts();
}

function renderProducts() {
  const items =
    selectedCategory === CATEGORY_ALL_KEY
      ? allProducts
      : allProducts.filter((product) => product.categoryKey === selectedCategory);
  renderer.render(items);
}

function renderCategories(products) {
  if (!categoryList) {
    return;
  }
  categoryList.innerHTML = '';
  if (!products.length) {
    categoryList.appendChild(createCategoryItem(CATEGORY_ALL_KEY, 'Все товары', 0, true, true));
    return;
  }

  const categoriesMap = new Map();
  products.forEach((product) => {
    const key = product.categoryKey || UNCATEGORIZED_KEY;
    const label = product.categoryLabel || 'Без категории';
    const entry = categoriesMap.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      categoriesMap.set(key, { key, label, count: 1 });
    }
  });

  const fragment = document.createDocumentFragment();
  fragment.appendChild(
    createCategoryItem(CATEGORY_ALL_KEY, 'Все товары', products.length, selectedCategory === CATEGORY_ALL_KEY)
  );

  const sorted = Array.from(categoriesMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' })
  );
  sorted.forEach(({ key, label, count }) => {
    fragment.appendChild(createCategoryItem(key, label, count, selectedCategory === key));
  });

  categoryList.appendChild(fragment);
}

function createCategoryItem(key, label, count, isActive, disabled = false) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tracker__category-button' + (isActive ? ' tracker__category-button--active' : '');
  button.dataset.category = key;
  button.disabled = Boolean(disabled);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'tracker__category-label';
  labelSpan.textContent = label;

  const countSpan = document.createElement('span');
  countSpan.className = 'tracker__category-count';
  countSpan.textContent = String(count);

  button.appendChild(labelSpan);
  button.appendChild(countSpan);
  item.appendChild(button);
  return item;
}

function normalizeProductForView(product) {
  const categoryPath = extractCategoryPath(product);
  const categoryLabel = getCategoryLabel(product, categoryPath);
  const categoryKey = createCategoryKey(categoryLabel);
  return {
    ...product,
    categoryPath,
    categoryLabel,
    categoryKey
  };
}

function extractCategoryPath(product) {
  if (!product) {
    return [];
  }
  const rawPath = Array.isArray(product.categoryPath) ? product.categoryPath : [];
  const seen = new Set();
  const normalized = [];
  for (let i = 0; i < rawPath.length; i += 1) {
    const part = normalizeCategoryPart(rawPath[i], product.title);
    if (!part) {
      continue;
    }
    const key = part.toLocaleLowerCase('ru-RU');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(part);
  }
  return normalized;
}

function normalizeCategoryPart(part, title) {
  if (!part && part !== 0) {
    return null;
  }
  const normalized = String(part)
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return null;
  }
  if (/^главная$/i.test(normalized)) {
    return null;
  }
  const lowered = normalized.toLocaleLowerCase('ru-RU');
  const loweredTitle = title ? String(title).trim().toLocaleLowerCase('ru-RU') : '';
  if (loweredTitle && lowered === loweredTitle) {
    return null;
  }
  return normalized;
}

function getCategoryLabel(product, categoryPath) {
  if (product && typeof product.category === 'string') {
    const trimmed = product.category.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  if (Array.isArray(categoryPath) && categoryPath.length) {
    return categoryPath[0];
  }
  return 'Без категории';
}

function createCategoryKey(label) {
  if (!label) {
    return UNCATEGORIZED_KEY;
  }
  const slug = label
    .toLocaleLowerCase('ru-RU')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return slug || UNCATEGORIZED_KEY;
}
