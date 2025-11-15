const STORAGE_KEYS = {
  SETTINGS: 'trackerSettings'
};

const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 60,
  ozonClientId: '',
  ozonApiKey: ''
};

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

document.addEventListener('DOMContentLoaded', async () => {
  const intervalInput = document.getElementById('interval');
  const clientIdInput = document.getElementById('client-id');
  const apiKeyInput = document.getElementById('api-key');
  const toast = document.getElementById('toast');
  const settings = await loadSettings();

  intervalInput.value = settings.checkIntervalMinutes;
  clientIdInput.value = settings.ozonClientId || '';
  apiKeyInput.value = settings.ozonApiKey || '';

  document.getElementById('save').addEventListener('click', async () => {
    const intervalValue = Math.max(1, Number(intervalInput.value) || DEFAULT_SETTINGS.checkIntervalMinutes);
    const payload = {
      checkIntervalMinutes: intervalValue,
      ozonClientId: clientIdInput.value.trim(),
      ozonApiKey: apiKeyInput.value.trim()
    };

    await sendMessage({
      action: 'UPDATE_SETTINGS',
      payload
    });
    toast.hidden = false;
    toast.textContent =
      `Настройки сохранены. Проверяем каждые ${intervalValue} минут. Учетные данные API обновлены.`;
    setTimeout(() => (toast.hidden = true), 4000);
  });
});

async function loadSettings() {
  const { [STORAGE_KEYS.SETTINGS]: stored } = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}
