const STORAGE_KEYS = {
  SETTINGS: 'trackerSettings'
};

const DEFAULT_SETTINGS = {
  checkIntervalMinutes: 60
};

document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('interval');
  const toast = document.getElementById('toast');
  const settings = await loadSettings();
  input.value = settings.checkIntervalMinutes;

  document.getElementById('save').addEventListener('click', async () => {
    const value = Math.max(1, Number(input.value) || DEFAULT_SETTINGS.checkIntervalMinutes);
    await chrome.runtime.sendMessage({
      action: 'UPDATE_SETTINGS',
      payload: { checkIntervalMinutes: value }
    });
    toast.hidden = false;
    toast.textContent = `Настройки сохранены. Проверяем каждые ${value} минут.`;
    setTimeout(() => (toast.hidden = true), 4000);
  });
});

async function loadSettings() {
  const { [STORAGE_KEYS.SETTINGS]: stored } = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}
