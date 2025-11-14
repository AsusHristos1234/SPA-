const { STORAGE_KEYS, createRenderer } = window.ProductsView;

const list = document.getElementById('product-list');
const template = document.getElementById('product-template');
const refreshButton = document.getElementById('refresh');
const openOptionsButton = document.getElementById('open-options');

let allProducts = [];

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
  allProducts = Object.values(stored || {});
  renderer.render(allProducts);
}
