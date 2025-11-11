const fs = require('fs');
const path = require('path');

const API_TIMEOUT = 35; // seconds for long polling

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Не найден токен. Перед запуском установите переменную окружения BOT_TOKEN.');
  process.exit(1);
}

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

const DATA_FILES = {
  monsters: path.join(__dirname, 'data', 'monsters.json'),
  items: path.join(__dirname, 'data', 'items.json'),
  locations: path.join(__dirname, 'data', 'locations.json'),
};

let monsters = [];
let items = [];
let locations = [];
let monstersById = new Map();
let itemsById = new Map();
let locationsById = new Map();

function loadJsonFile(filePath, fallback = []) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Не удалось прочитать ${filePath}:`, error.message);
    return fallback;
  }
}

function saveJsonFile(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function rebuildIndexes() {
  monstersById = new Map(monsters.map((monster) => [monster.id, monster]));
  itemsById = new Map(items.map((item) => [item.id, item]));
  locationsById = new Map(locations.map((location) => [location.id, location]));
}

function refreshData() {
  monsters = loadJsonFile(DATA_FILES.monsters);
  items = loadJsonFile(DATA_FILES.items);
  locations = loadJsonFile(DATA_FILES.locations);
  rebuildIndexes();
}

refreshData();

function getMonster(id) {
  return monstersById.get(id);
}

function getItem(id) {
  return itemsById.get(id);
}

function getLocation(id) {
  return locationsById.get(id);
}

function itemName(id) {
  return getItem(id)?.name || id;
}

function formatItemList(ids) {
  if (!ids || ids.length === 0) {
    return 'пусто';
  }
  return ids.map((id) => itemName(id)).join(', ');
}

function locationTitle(id, fallback) {
  return getLocation(id)?.title || fallback;
}

function locationDescription(id, fallback = '') {
  return getLocation(id)?.description || fallback;
}

const sessions = new Map();

function createNewState() {
  return {
    stage: 'villageGate',
    hp: 20,
    mana: 10,
    gold: 5,
    inventory: ['tattered_cloak'],
    log: [],
  };
}

function resolveStep(stepKey, state) {
  const stepFactory = STEPS[stepKey];
  if (!stepFactory) {
    return undefined;
  }
  return typeof stepFactory === 'function' ? stepFactory(state) : stepFactory;
}

const STEPS = {
  villageGate: () => ({
    title: locationTitle('villageGate', 'Ворота деревни Эльдруин'),
    description:
      `${locationDescription('villageGate', 'Вы стоите у ворот деревни.')} ` +
      'Ночь сгущается, и вдалеке слышны волчьи завывания. Отсюда можно пройти в таверну, на рыночную площадь или сразу отправиться в тёмный лес.',
    options: [
      {
        text: `Зайти в таверну «${locationTitle('tavern', 'Лунный кабан')}»`,
        next: 'tavern',
        apply: (state) => {
          state.hp = Math.min(state.hp + 3, 20);
          state.gold = Math.max(state.gold - 1, 0);
          return {
            text: `Вы заказали тёплый суп. Силы восстановлены (+3 ОЗ), но вам пришлось заплатить 1 золотой.`,
          };
        },
      },
      {
        text: 'Исследовать рыночную площадь',
        next: 'market',
        apply: (state) => {
          state.gold += 3;
          if (!state.inventory.includes('lucky_amulet')) {
            state.inventory.push('lucky_amulet');
          }
          return {
            text: 'Торговец заметил в вас искру отваги и подарил амулет. В кошельке теперь на 3 золотых больше!',
          };
        },
      },
      {
        text: 'Отправиться в тёмный лес',
        next: 'forestEntrance',
        apply: () => ({ text: 'Вы смело шагаете в сторону шепчущих ветвей.' }),
      },
    ],
  }),
  tavern: () => ({
    title: locationTitle('tavern', 'Таверна «Лунный кабан»'),
    description:
      `${locationDescription('tavern', 'Гул голосов и запах пряностей заполняют зал.')}` +
      ' Хозяин таверны рассказывает о древнем артефакте — Сердце Бури. Оно спрятано в руинах вглуби леса.',
    options: [
      {
        text: 'Согласиться помочь тавернщику',
        next: 'forestEntrance',
        apply: (state) => {
          if (!state.inventory.includes('ruins_map')) {
            state.inventory.push('ruins_map');
          }
          return {
            text: 'Хозяин благодарит вас и вручает карту руин. Вы чувствуете ответственность за деревню.',
          };
        },
      },
      {
        text: 'Остаться и прислушаться к разговорам',
        next: 'villageGate',
        apply: (state) => {
          state.mana = Math.min(state.mana + 2, 10);
          return {
            text: 'Вы узнали пару полезных заклинаний (+2 Маны) и решили вернуться к воротам.',
          };
        },
      },
    ],
  }),
  market: () => ({
    title: locationTitle('market', 'Рыночная площадь'),
    description:
      `${locationDescription('market', 'Площадь полна торговцев.')}` +
      ' Один старик показывает свёрток с травами, другой предлагает услугу зачарования.',
    options: [
      {
        text: `Купить ${itemName('healing_herbs')} (2 золота)`,
        next: 'villageGate',
        apply: (state) => {
          if (state.gold < 2) {
            return {
              text: 'У вас не хватает золота, торговец печально качает головой.',
              next: 'market',
            };
          }
          state.gold -= 2;
          state.inventory.push('healing_herbs');
          const healValue = getItem('healing_herbs')?.effects?.heal ?? 5;
          state.hp = Math.min(state.hp + healValue, 20);
          return {
            text: `${itemName('healing_herbs')} приятно пахнут. Вы накладываете повязку и восстанавливаете силы (+${healValue} ОЗ).`,
          };
        },
      },
      {
        text: `Оплатить зачарование оружия (3 золота)`,
        next: 'villageGate',
        apply: (state) => {
          if (state.gold < 3) {
            return {
              text: 'Мастер-колдун требует 3 золотых, но у вас недостаточно средств.',
              next: 'market',
            };
          }
          state.gold -= 3;
          if (!state.inventory.includes('enchanted_blade')) {
            state.inventory.push('enchanted_blade');
          }
          state.log.push('Ваш клинок теперь светится мягким голубым сиянием.');
          return { text: 'Клинок наполнился магией, ваши атаки станут сильнее.' };
        },
      },
      {
        text: 'Встретить карлика-ремесленника',
        next: 'forestEntrance',
        apply: (state) => {
          state.gold += 1;
          return {
            text: 'Карлик рассказывает о тропе мимо волчьего логова и вручает вам 1 золотой на удачу.',
          };
        },
      },
    ],
  }),
  forestEntrance: (state) => ({
    title: locationTitle('forestEntrance', 'Тёмный лес'),
    description:
      `${locationDescription('forestEntrance', 'Сквозь ветви доносится едва слышный шёпот.')}` +
      ' Тропинка разделяется: налево — волчье логово, направо — руины храма.',
    options: [
      {
        text: 'Пойти к волчьему логову',
        next: 'wolfDen',
        apply: () => ({ text: 'Вы ступаете на мягкий мох, стараясь не выдать своё присутствие.' }),
      },
      {
        text: 'Следовать к руинам храма',
        next: 'ancientRuins',
        apply: (state) => {
          if (!state.inventory.includes('ruins_map')) {
            state.hp = Math.max(state.hp - 3, 0);
            return {
              text: 'Без карты вы блуждали и поцарапались о ветви (-3 ОЗ), но всё же нашли путь.',
            };
          }
          return { text: 'Карта помогает без труда добраться до руин.' };
        },
      },
      {
        text: 'Разбить лагерь и отдохнуть',
        next: 'forestEntrance',
        apply: (state) => {
          state.hp = Math.min(state.hp + 2, 20);
          state.mana = Math.min(state.mana + 1, 10);
          return { text: 'Небольшой костёр позволяет перевести дух (+2 ОЗ, +1 Мана).' };
        },
      },
    ],
  }),
  wolfDen: () => {
    const monster = getMonster('forest_wolf');
    const location = getLocation('wolfDen');
    const descriptionParts = [location?.description || 'В темноте блестят глаза хищника.'];
    if (monster) {
      descriptionParts.push(`Перед вами ${monster.name}. ${monster.description}`);
    }
    return {
      title: location?.title || 'Логово волков',
      description: descriptionParts.join(' '),
      options: [
        {
          text: `Атаковать с ${itemName('enchanted_blade')}`,
          next: 'forestEntrance',
          apply: (state) => {
            const hasSword = state.inventory.includes('enchanted_blade');
            const damage = hasSword ? 0 : 4;
            state.hp = Math.max(state.hp - damage, 0);
            state.gold += monster?.reward?.gold ?? 4;
            if (monster?.reward?.items) {
              monster.reward.items.forEach((itemId) => state.inventory.push(itemId));
            }
            const swordText = hasSword
              ? 'Магия клинка ослепляет волка. Вы побеждаете без единой царапины.'
              : 'Без зачарования бой даётся тяжело. Вы получаете царапины (-4 ОЗ), но побеждаете.';
            return { text: `${swordText} В логове вы находите ${monster?.reward?.gold ?? 4} золотых.` };
          },
        },
        {
          text: 'Применить заклинание сна',
          next: 'forestEntrance',
          apply: (state) => {
            if (state.mana < 3) {
              return {
                text: 'Вы пытаетесь соткать заклинание, но маны не хватает. Приходится отступить.',
                next: 'forestEntrance',
              };
            }
            state.mana -= 3;
            state.gold += 2;
            return { text: 'Заклинание мягко погружает волков в сон. Вы бесшумно забираете 2 золотых.' };
          },
        },
        {
          text: 'Отступить',
          next: 'forestEntrance',
          apply: () => ({ text: 'Вы решаете не рисковать и возвращаетесь к развилке.' }),
        },
      ],
    };
  },
  ancientRuins: (state) => {
    const location = getLocation('ancientRuins');
    const guardian = getMonster('ruin_specter');
    return {
      title: location?.title || 'Древние руины',
      description:
        `${location?.description || 'Разрушенный храм, в стенах которого ещё звучит эхо магии.'} ` +
        (guardian
          ? `У входа в руины стоит ${guardian.name}. Его глаза вспыхивают, когда вы приближаетесь.`
          : 'У входа возвышается каменный страж.'),
      options: [
        {
          text: 'Предъявить амулет удачи',
          next: 'stormHeart',
          apply: (state) => {
            if (!state.inventory.includes('lucky_amulet')) {
              state.hp = Math.max(state.hp - 5, 0);
              return {
                text: 'Без амулета страж наносит вам удар (-5 ОЗ) и вы вынуждены отступить.',
                next: 'ancientRuins',
              };
            }
            return { text: 'Страж кланяется амулету и пропускает вас внутрь.' };
          },
        },
        {
          text: 'Сразиться со стражем',
          next: 'stormHeart',
          apply: (state) => {
            const weaponBonus = state.inventory.includes('enchanted_blade') ? 0 : 5;
            state.hp = Math.max(state.hp - weaponBonus, 0);
            state.mana = Math.max(state.mana - 2, 0);
            const text =
              weaponBonus === 0
                ? 'Зачарованный клинок рассеивает каменную броню. Победа даётся легко, хотя вы устали (-2 Маны).'
                : 'Без магического оружия бой суров (-5 ОЗ, -2 Маны), но вы побеждаете.';
            if (guardian?.reward?.items) {
              guardian.reward.items.forEach((itemId) => {
                if (!state.inventory.includes(itemId)) {
                  state.inventory.push(itemId);
                }
              });
            }
            state.gold += guardian?.reward?.gold ?? 0;
            return { text };
          },
        },
        {
          text: `Использовать ${itemName('healing_herbs')}`,
          next: 'ancientRuins',
          apply: (state) => {
            const index = state.inventory.indexOf('healing_herbs');
            if (index === -1) {
              return { text: 'В сумке пусто. Лечебных трав не осталось.', next: 'ancientRuins' };
            }
            state.inventory.splice(index, 1);
            const healValue = getItem('healing_herbs')?.effects?.heal ?? 6;
            state.hp = Math.min(state.hp + healValue, 20);
            return { text: `Вы завариваете травы и восстанавливаете силы (+${healValue} ОЗ). Страж терпеливо ждёт.` };
          },
        },
      ],
    };
  },
  stormHeart: () => {
    const location = getLocation('heartChamber');
    const guardian = getMonster('ancient_guardian');
    return {
      title: location?.title || 'Сердце Бури',
      description:
        `${location?.description || 'В центре зала сияет кристалл Сердца Бури.'} ` +
        'Когда вы протягиваете руки, воздух наполняется электричеством.' +
        (guardian
          ? ` Кажется, эхо ${guardian.name} всё ещё витает рядом, напоминая о цене победы.`
          : ''),
      options: [
        {
          text: 'Забрать артефакт и вернуться в деревню',
          next: 'victory',
          apply: (state) => {
            if (!state.inventory.includes('storm_heart')) {
              state.inventory.push('storm_heart');
            }
            state.gold += 10;
            return {
              text: 'Энергия наполняет вас, но вы чувствуете, что деревне нужен этот свет. Вы берёте артефакт и направляетесь домой.',
            };
          },
        },
        {
          text: 'Попытаться поглотить мощь артефакта',
          next: 'defeat',
          apply: () => ({ text: 'Сила Сердца Бури слишком велика. Вспышка света — и всё исчезает...' }),
        },
      ],
    };
  },
  victory: () => ({
    title: 'Триумф героя',
    description:
      'Вы возвращаетесь в Эльдруин. Жители встречают вас аплодисментами, а тавернщик устраивает пир в вашу честь. Деревня спасена! 🎉',
    options: [],
  }),
  defeat: () => ({
    title: 'Гибель героя',
    description:
      'Сила артефакта оказалась сильнее. Ваши подвиги будут помнить, но путешествие окончено. Попробуйте снова, выбрав иной путь.',
    options: [],
  }),
};

function buildKeyboard(stepKey, state) {
  const step = resolveStep(stepKey, state);
  if (!step || !step.options || step.options.length === 0) {
    return undefined;
  }
  const buttons = step.options.map((option, index) => [
    {
      text: option.text,
      callback_data: `${stepKey}|${index}`,
    },
  ]);
  return { inline_keyboard: buttons };
}

function formatStatus(state) {
  return [
    `❤ Здоровье: ${state.hp}`,
    `🔮 Мана: ${state.mana}`,
    `🪙 Золото: ${state.gold}`,
    `🎒 Инвентарь: ${formatItemList(state.inventory)}`,
    state.log.length ? `📝 Памятные события:\n- ${state.log.slice(-5).join('\n- ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callApi(method, payload) {
  const response = await fetch(`${API_URL}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка Telegram API: ${response.status} ${text}`);
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API вернул ошибку: ${data.description}`);
  }
  return data.result;
}

async function sendMessage(chatId, text, extra = {}) {
  return callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  });
}

async function editMessage(chatId, messageId, text, extra = {}) {
  return callApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    ...extra,
  });
}

async function answerCallbackQuery(callbackQueryId, text) {
  return callApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

async function handleStart(chatId, userId) {
  const state = createNewState();
  sessions.set(userId, state);
  await sendMessage(
    chatId,
    '🌟 *Добро пожаловать в "Легенды Эльдруина"!*\n\nЭто пошаговое приключение в стиле фэнтези. Вы управляете героем с помощью кнопок под сообщениями. В любой момент используйте команду /status, чтобы узнать текущее состояние.',
  );
  await sendStep(chatId, userId);
}

async function sendStep(chatId, userId) {
  const state = sessions.get(userId);
  if (!state) {
    return;
  }
  const step = resolveStep(state.stage, state);
  if (!step) {
    await sendMessage(chatId, 'Неизвестный этап приключения. Попробуйте /restart.');
    return;
  }
  const keyboard = buildKeyboard(state.stage, state);
  const statusText = formatStatus(state);
  const message = `*${step.title}*\n\n${step.description}\n\n${statusText}`;
  await sendMessage(chatId, message, keyboard ? { reply_markup: keyboard } : undefined);
  if (!keyboard) {
    await sendMessage(chatId, 'Приключение завершено! Введите /restart, чтобы начать заново.');
  }
}

async function handleCallback(update) {
  const callback = update.callback_query;
  const { id: callbackId, data, message, from } = callback;
  const userId = from.id;
  const state = sessions.get(userId);
  if (!state) {
    await answerCallbackQuery(callbackId, 'Игра ещё не начата. Используйте /start.');
    return;
  }
  const [stepKey, optionIndexRaw] = data.split('|');
  if (stepKey !== state.stage) {
    await answerCallbackQuery(callbackId, 'Эта кнопка больше неактуальна.');
    return;
  }
  const optionIndex = Number(optionIndexRaw);
  const step = resolveStep(stepKey, state);
  const option = step?.options?.[optionIndex];
  if (!option) {
    await answerCallbackQuery(callbackId, 'Неизвестный выбор.');
    return;
  }

  const result = option.apply(state) ?? {};
  const resultText = typeof result === 'string' ? result : result.text || 'Вы сделали выбор.';
  const nextStageFromResult = typeof result === 'object' && result.next ? result.next : undefined;

  if (state.hp <= 0) {
    state.stage = 'defeat';
  } else {
    state.stage = nextStageFromResult || option.next;
  }

  await answerCallbackQuery(callbackId, 'Выбор принят!');

  if (message) {
    try {
      await editMessage(
        message.chat.id,
        message.message_id,
        `*${step.title}*\n\n${step.description}\n\n${formatStatus(state)}\n\n_Выбор сделан._`,
        { reply_markup: { inline_keyboard: [] } },
      );
    } catch (error) {
      console.error('Не удалось обновить сообщение:', error.message);
    }
  }

  await sendMessage(update.callback_query.message.chat.id, resultText);
  await sendStep(update.callback_query.message.chat.id, userId);
}

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

function parseJsonArgument(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function upsertEntry(collection, entry) {
  const index = collection.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    collection[index] = { ...collection[index], ...entry };
  } else {
    collection.push(entry);
  }
}

function deleteEntry(collection, id) {
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) {
    collection.splice(index, 1);
    return true;
  }
  return false;
}

function formatCollection(collection) {
  if (!collection.length) {
    return 'Список пуст.';
  }
  return collection
    .map((item) => `• ${item.id} — ${item.name || item.title || 'без названия'}`)
    .join('\n');
}

async function tryHandleAdminCommand(message) {
  const { text, chat, from } = message;
  if (!text.startsWith('/')) {
    return false;
  }
  const command = text.split(' ')[0];
  if (!['/admin', '/list_monsters', '/list_items', '/list_locations', '/add_monster', '/add_item', '/add_location', '/delete_monster', '/delete_item', '/delete_location', '/reload_data'].includes(command)) {
    return false;
  }
  if (!isAdmin(from.id)) {
    await sendMessage(chat.id, 'Эта команда доступна только администраторам.');
    return true;
  }

  const argument = text.slice(command.length).trim();

  switch (command) {
    case '/admin':
      await sendMessage(
        chat.id,
        'Админ-команды:\n' +
          '/list_monsters — показать всех монстров\n' +
          '/list_items — показать все предметы\n' +
          '/list_locations — показать все локации\n' +
          '/add_monster {json} — добавить или обновить монстра\n' +
          '/add_item {json} — добавить или обновить предмет\n' +
          '/add_location {json} — добавить или обновить локацию\n' +
          '/delete_monster ID — удалить монстра\n' +
          '/delete_item ID — удалить предмет\n' +
          '/delete_location ID — удалить локацию\n' +
          '/reload_data — перечитать файлы данных',
      );
      return true;
    case '/list_monsters':
      await sendMessage(chat.id, formatCollection(monsters));
      return true;
    case '/list_items':
      await sendMessage(chat.id, formatCollection(items));
      return true;
    case '/list_locations':
      await sendMessage(chat.id, formatCollection(locations));
      return true;
    case '/add_monster': {
      const payload = parseJsonArgument(argument);
      if (!payload || !payload.id) {
        await sendMessage(chat.id, 'Нужно передать JSON с полем id.');
        return true;
      }
      upsertEntry(monsters, payload);
      saveJsonFile(DATA_FILES.monsters, monsters);
      refreshData();
      await sendMessage(chat.id, `Монстр ${payload.id} сохранён.`);
      return true;
    }
    case '/add_item': {
      const payload = parseJsonArgument(argument);
      if (!payload || !payload.id) {
        await sendMessage(chat.id, 'Нужно передать JSON с полем id.');
        return true;
      }
      upsertEntry(items, payload);
      saveJsonFile(DATA_FILES.items, items);
      refreshData();
      await sendMessage(chat.id, `Предмет ${payload.id} сохранён.`);
      return true;
    }
    case '/add_location': {
      const payload = parseJsonArgument(argument);
      if (!payload || !payload.id) {
        await sendMessage(chat.id, 'Нужно передать JSON с полем id.');
        return true;
      }
      upsertEntry(locations, payload);
      saveJsonFile(DATA_FILES.locations, locations);
      refreshData();
      await sendMessage(chat.id, `Локация ${payload.id} сохранена.`);
      return true;
    }
    case '/delete_monster': {
      if (!argument) {
        await sendMessage(chat.id, 'Укажите идентификатор монстра.');
        return true;
      }
      if (deleteEntry(monsters, argument)) {
        saveJsonFile(DATA_FILES.monsters, monsters);
        refreshData();
        await sendMessage(chat.id, `Монстр ${argument} удалён.`);
      } else {
        await sendMessage(chat.id, 'Монстр с таким ID не найден.');
      }
      return true;
    }
    case '/delete_item': {
      if (!argument) {
        await sendMessage(chat.id, 'Укажите идентификатор предмета.');
        return true;
      }
      if (deleteEntry(items, argument)) {
        saveJsonFile(DATA_FILES.items, items);
        refreshData();
        await sendMessage(chat.id, `Предмет ${argument} удалён.`);
      } else {
        await sendMessage(chat.id, 'Предмет с таким ID не найден.');
      }
      return true;
    }
    case '/delete_location': {
      if (!argument) {
        await sendMessage(chat.id, 'Укажите идентификатор локации.');
        return true;
      }
      if (deleteEntry(locations, argument)) {
        saveJsonFile(DATA_FILES.locations, locations);
        refreshData();
        await sendMessage(chat.id, `Локация ${argument} удалена.`);
      } else {
        await sendMessage(chat.id, 'Локация с таким ID не найдена.');
      }
      return true;
    }
    case '/reload_data':
      refreshData();
      await sendMessage(chat.id, 'Данные перечитаны из файлов.');
      return true;
    default:
      return false;
  }
}

async function handleMessage(update) {
  const message = update.message;
  if (!message || !message.text) {
    return;
  }
  const text = message.text.trim();
  const chatId = message.chat.id;
  const userId = message.from.id;

  if (await tryHandleAdminCommand(message)) {
    return;
  }

  if (text === '/start') {
    await handleStart(chatId, userId);
    return;
  }
  if (text === '/restart') {
    sessions.set(userId, createNewState());
    await sendMessage(chatId, '🔄 Игра начата заново!');
    await sendStep(chatId, userId);
    return;
  }
  if (text === '/status') {
    const state = sessions.get(userId);
    if (!state) {
      await sendMessage(chatId, 'Игра ещё не начата. Используйте /start.');
      return;
    }
    await sendMessage(chatId, `Текущий статус героя:\n\n${formatStatus(state)}`);
    return;
  }
  if (text === '/help') {
    await sendMessage(
      chatId,
      'Используйте кнопки под сообщениями, чтобы выбирать действия. Команды: /start — начать, /restart — начать заново, /status — показать состояние героя.',
    );
    return;
  }
  await sendMessage(chatId, 'Неизвестная команда. Используйте кнопки выбора или введите /help.');
}

async function pollUpdates() {
  let offset = 0;
  console.log('Бот запущен. Ожидание событий...');
  while (true) {
    try {
      const response = await fetch(`${API_URL}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeout: API_TIMEOUT,
          offset,
          allowed_updates: ['message', 'callback_query'],
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ошибка сети: ${response.status} ${text}`);
      }
      const data = await response.json();
      if (!data.ok) {
        throw new Error(`Ошибка Telegram API: ${data.description}`);
      }
      const updates = data.result;
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          await handleMessage(update);
        } else if (update.callback_query) {
          await handleCallback(update);
        }
      }
    } catch (error) {
      console.error('Произошла ошибка при получении обновлений:', error.message);
      console.error('Перезапуск запроса через 5 секунд...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

pollUpdates();

process.on('SIGINT', () => {
  console.log('Остановка бота...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Остановка бота...');
  process.exit(0);
});
