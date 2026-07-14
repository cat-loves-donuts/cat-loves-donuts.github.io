(function () {
  const config = window.MINI_GAME_CONFIG;

  if (!config) {
    return;
  }

  const dom = {
    gifContainer: document.getElementById('logo-container'),
    gifImage: document.getElementById('logo'),
    gameStack: document.getElementById('game-stack'),
    gameWindows: document.getElementById('game-windows'),
    totalBalanceDisplay: document.getElementById('total-balance-display'),
    currentTargetDisplay: document.getElementById('current-target-display')
  };

  if (!dom.gifContainer || !dom.gifImage || !dom.gameStack || !dom.gameWindows) {
    return;
  }

  const desktopQuery = window.matchMedia(config.desktopMediaQuery);
  const state = {
    balance: config.sharedState.startingBalance,
    reward: config.sharedState.startingReward,
    tailReward: config.sharedState.startingTailReward,
    currentTarget: null,
    runActive: false,
    interactionEnabled: true,
    coinLocked: false,
    autoFlipIntervalId: null,
    stages: {
      coinUpgradesUnlocked: false,
      coinAutoMode: false
    },
    upgradeLevels: {
      reward: 0,
      speed: 0
    },
    unlockedGames: Object.fromEntries(config.games.map((game) => [game.key, false]))
  };
  const gameElements = {};

  function formatText(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
    });
  }

  function getGameConfig(key) {
    return config.games.find((game) => game.key === key);
  }

  function getTemplateValues(game) {
    const coinGame = getGameConfig('coin');
    const rewardUpgrade = coinGame && coinGame.upgrades ? coinGame.upgrades.reward : null;
    const speedUpgrade = coinGame && coinGame.upgrades ? coinGame.upgrades.speed : null;

    return {
      balance: state.balance,
      formattedBalance: formatNumber(state.balance),
      reward: state.reward,
      nextReward: state.reward + (rewardUpgrade ? rewardUpgrade.rewardIncrement : 1),
      tailReward: state.tailReward,
      tailPlural: state.tailReward === 1 ? '' : 's',
      target: game ? game.unlockAt : '',
      formattedTarget: game ? formatNumber(game.unlockAt) : '',
      nextTarget: state.currentTarget === null ? config.progressLabels.done : formatNumber(state.currentTarget),
      cost: game && game.cost ? game.cost : '',
      formattedCost: game && game.cost ? formatNumber(game.cost) : '',
      rewardCost: rewardUpgrade ? getUpgradeCost(rewardUpgrade, state.upgradeLevels.reward) : '',
      formattedRewardCost: rewardUpgrade ? formatNumber(getUpgradeCost(rewardUpgrade, state.upgradeLevels.reward)) : '',
      speedCost: speedUpgrade ? getUpgradeCost(speedUpgrade, state.upgradeLevels.speed) : '',
      formattedSpeedCost: speedUpgrade ? formatNumber(getUpgradeCost(speedUpgrade, state.upgradeLevels.speed)) : '',
      level: speedUpgrade ? state.upgradeLevels.speed : 0,
      maxLevel: speedUpgrade ? speedUpgrade.maxLevel : 0,
      unlockTarget: coinGame ? formatNumber(coinGame.progression.upgradesUnlockAt) : '',
      increment: game && game.rewardIncrement ? game.rewardIncrement : '',
      plural: state.reward === 1 ? '' : 's'
    };
  }

  function getUpgradeCost(upgradeConfig, level) {
    if (upgradeConfig.costMode === 'linear') {
      return upgradeConfig.baseCost + ((upgradeConfig.costStep || 0) * level);
    }

    return Math.round(upgradeConfig.baseCost * Math.pow(upgradeConfig.growthFactor, level));
  }

  function shouldShowInlineUpgradeCost(cost) {
    const maxChars = config.ui && config.ui.inlineUpgradeCostMaxChars
      ? config.ui.inlineUpgradeCostMaxChars
      : 4;

    return `${cost}`.length <= maxChars;
  }

  function buildUpgradeButtonLabel(baseLabel, cost) {
    if (!shouldShowInlineUpgradeCost(cost)) {
      return baseLabel;
    }

    return `${baseLabel} (${formatNumber(cost)})`;
  }

  function getCoinTimings() {
    const coinGame = getGameConfig('coin');
    const speedConfig = coinGame.upgrades.speed;
    const cappedLevel = Math.min(state.upgradeLevels.speed, Math.max(speedConfig.maxLevel - 1, 0));
    const speedFactor = Math.max(0.1, 1 - (cappedLevel * speedConfig.levelStep));
    const cycleMs = Math.max(coinGame.timings.minCycleMs, Math.round(coinGame.timings.baseCycleMs * speedFactor));
    const flipDurationMs = Math.max(0, Math.round(cycleMs * coinGame.timings.flipRatio));
    const resultDurationMs = Math.max(0, Math.round(cycleMs * coinGame.timings.resultRatio));

    return {
      betweenStatesMs: coinGame.timings.betweenStatesMs,
      flipDurationMs,
      resultDurationMs
    };
  }

  function formatNumber(value) {
    if (value === null) {
      return config.progressLabels.done;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return value;
    }

    const threshold = config.numberFormat && config.numberFormat.scientificThreshold
      ? config.numberFormat.scientificThreshold
      : 10000;
    const digits = config.numberFormat && typeof config.numberFormat.maxFractionDigits === 'number'
      ? config.numberFormat.maxFractionDigits
      : 1;

    if (Math.abs(value) < threshold) {
      return `${value}`;
    }

    const scientific = value.toExponential(digits);
    return scientific.replace(/\.0e/, 'e').replace('e+', 'e');
  }

  function updateProgressHeader() {
    dom.totalBalanceDisplay.textContent = formatNumber(state.balance);
    dom.currentTargetDisplay.textContent = formatNumber(state.currentTarget);
  }

  function updateCurrentTarget() {
    const coinGame = getGameConfig('coin');

    if (state.runActive && !state.stages.coinUpgradesUnlocked) {
      state.currentTarget = coinGame.progression.upgradesUnlockAt;
      return;
    }

    const nextLockedGame = config.games.find((game) => game.unlockAt > 0 && !state.unlockedGames[game.key]);
    state.currentTarget = nextLockedGame ? nextLockedGame.unlockAt : null;
  }

  function renderCoinGame(game) {
    const wrapper = document.createElement('div');
    wrapper.id = `${game.key}-game`;
    wrapper.className = 'game-window hidden';
    wrapper.innerHTML = `
      <div class="game-window-title">${game.title}</div>
      <button class="coin-visual-button" data-role="action" type="button" disabled aria-label="Play ${game.title}">
        <img class="coin-visual-image" data-role="image" src="${game.assets.idleSrc}" alt="Coin game" />
      </button>
      <div class="game-window-meta" data-role="message"></div>
      <div class="game-upgrades hidden" data-role="upgrades">
        <button class="game-upgrade-button" data-role="reward-upgrade" type="button" disabled></button>
        <button class="game-upgrade-button" data-role="speed-upgrade" type="button" disabled></button>
      </div>
    `;

    gameElements[game.key] = {
      wrapper,
      message: wrapper.querySelector('[data-role="message"]'),
      button: wrapper.querySelector('[data-role="action"]'),
      image: wrapper.querySelector('[data-role="image"]'),
      upgrades: wrapper.querySelector('[data-role="upgrades"]'),
      rewardUpgradeButton: wrapper.querySelector('[data-role="reward-upgrade"]'),
      speedUpgradeButton: wrapper.querySelector('[data-role="speed-upgrade"]')
    };

    gameElements[game.key].button.addEventListener('click', () => {
      playCoinRound();
    });

    gameElements[game.key].rewardUpgradeButton.addEventListener('click', () => {
      applyRewardUpgrade();
    });

    gameElements[game.key].speedUpgradeButton.addEventListener('click', () => {
      applySpeedUpgrade();
    });

    dom.gameWindows.appendChild(wrapper);
  }

  function renderPlaceholderGame(game) {
    const wrapper = document.createElement('div');
    wrapper.id = `${game.key}-game`;
    wrapper.className = 'game-window hidden';
    wrapper.innerHTML = `
      <div class="game-window-title">${game.title}</div>
      <div class="game-window-meta" data-role="message"></div>
    `;

    gameElements[game.key] = {
      wrapper,
      message: wrapper.querySelector('[data-role="message"]')
    };

    dom.gameWindows.appendChild(wrapper);
  }

  function renderGames() {
    dom.gameWindows.innerHTML = '';

    config.games.forEach((game) => {
      if (game.type === 'coinFlip') {
        renderCoinGame(game);
        return;
      }

      if (game.type === 'placeholder') {
        renderPlaceholderGame(game);
      }
    });
  }

  function setCoinMessage(template, game, overrides) {
    const values = Object.assign({}, getTemplateValues(game), overrides || {});
    gameElements.coin.message.textContent = formatText(template, values);
    updateProgressHeader();
  }

  function updateCoinUpgradePanel() {
    const coinGame = getGameConfig('coin');
    const elements = gameElements.coin;

    if (!coinGame || !elements) {
      return;
    }

    const rewardUpgrade = coinGame.upgrades.reward;
    const speedUpgrade = coinGame.upgrades.speed;
    const rewardCost = getUpgradeCost(rewardUpgrade, state.upgradeLevels.reward);
    const speedCost = getUpgradeCost(speedUpgrade, state.upgradeLevels.speed);
    const rewardValues = Object.assign({}, getTemplateValues(coinGame), {
      formattedCost: formatNumber(rewardCost)
    });
    const speedValues = Object.assign({}, getTemplateValues(coinGame), {
      formattedCost: formatNumber(speedCost)
    });

    elements.upgrades.classList.toggle('hidden', !state.stages.coinUpgradesUnlocked);

    if (!state.stages.coinUpgradesUnlocked) {
      elements.upgrades.classList.add('hidden');
      elements.rewardUpgradeButton.disabled = true;
      elements.speedUpgradeButton.disabled = true;
      return;
    }

    elements.upgrades.classList.remove('hidden');

    elements.rewardUpgradeButton.textContent = buildUpgradeButtonLabel('Value +1', rewardCost);
    elements.rewardUpgradeButton.disabled = state.balance < rewardCost;

    if (state.stages.coinAutoMode) {
      elements.speedUpgradeButton.classList.remove('hidden');
      elements.speedUpgradeButton.textContent = 'Speed max';
      elements.speedUpgradeButton.disabled = true;
    } else {
      elements.speedUpgradeButton.classList.remove('hidden');
      elements.speedUpgradeButton.textContent = buildUpgradeButtonLabel('Speed +1/10', speedCost);
      elements.speedUpgradeButton.disabled = state.balance < speedCost;
    }
  }

  function updatePlaceholderGame(key) {
    const game = getGameConfig(key);
    const elements = gameElements[key];

    if (!game || !elements) {
      return;
    }

    const template = state.unlockedGames[key] ? game.messages.unlocked : game.messages.locked;
    elements.message.textContent = formatText(template, getTemplateValues(game));
  }

  function syncUnlockedGames() {
    config.games.forEach((game) => {
      const elements = gameElements[game.key];

      if (!elements) {
        return;
      }

      const shouldShow = state.runActive && state.unlockedGames[game.key];
      elements.wrapper.classList.toggle('hidden', !shouldShow);

      if (game.type === 'coinFlip' && shouldShow && state.interactionEnabled === false) {
        elements.button.disabled = state.coinLocked || state.stages.coinAutoMode;
      }

      if (game.type === 'placeholder') {
        updatePlaceholderGame(game.key);
      }
    });

    updateCoinUpgradePanel();
    updateProgressHeader();
  }

  function unlockEligibleGames() {
    const coinGame = getGameConfig('coin');

    if (state.balance >= coinGame.progression.upgradesUnlockAt) {
      state.stages.coinUpgradesUnlocked = true;
    }

    config.games.forEach((game) => {
      if (state.balance >= game.unlockAt) {
        state.unlockedGames[game.key] = true;
      }
    });

    updateCurrentTarget();
    syncUnlockedGames();
  }

  function resolveCoinReward(isHeads) {
    return isHeads ? state.reward : state.tailReward;
  }

  function playCoinRound() {
    const coinGame = getGameConfig('coin');

    if (!coinGame || state.coinLocked || state.stages.coinAutoMode) {
      return;
    }

    state.coinLocked = true;
    syncUnlockedGames();

    const isHeads = Math.random() >= 0.5;
    const reward = resolveCoinReward(isHeads);
    const resultSrc = isHeads ? coinGame.assets.headSrc : coinGame.assets.tailSrc;
    const resultMessage = isHeads ? coinGame.messages.heads : coinGame.messages.tails;
    const timings = getCoinTimings();

    setCoinMessage(coinGame.messages.busy, coinGame);
    gameElements.coin.image.src = coinGame.assets.flipSrc;

    setTimeout(() => {
      gameElements.coin.image.src = resultSrc;

      setTimeout(() => {
        state.balance += reward;
        setCoinMessage(resultMessage, coinGame, {
          reward,
          tailReward: reward,
          plural: reward === 1 ? '' : 's',
          tailPlural: reward === 1 ? '' : 's'
        });
        unlockEligibleGames();

        setTimeout(() => {
          gameElements.coin.image.src = coinGame.assets.idleSrc;
          state.coinLocked = false;
          syncUnlockedGames();

          if (!state.stages.coinAutoMode) {
            setCoinMessage(coinGame.messages.default, coinGame);
          }
        }, timings.betweenStatesMs);
      }, timings.resultDurationMs);
    }, timings.flipDurationMs + timings.betweenStatesMs);
  }

  function applyRewardUpgrade() {
    const coinGame = getGameConfig('coin');
    const rewardUpgrade = coinGame.upgrades.reward;
    const rewardCost = getUpgradeCost(rewardUpgrade, state.upgradeLevels.reward);

    if (!state.stages.coinUpgradesUnlocked || state.balance < rewardCost) {
      return;
    }

    state.balance -= rewardCost;
    state.reward += rewardUpgrade.rewardIncrement;
    state.upgradeLevels.reward += 1;
    syncUnlockedGames();
    setCoinMessage(coinGame.messages.default, coinGame);
  }

  function startCoinAutoMode() {
    const coinGame = getGameConfig('coin');

    if (state.autoFlipIntervalId) {
      return;
    }

    state.stages.coinAutoMode = true;
    state.coinLocked = false;
    gameElements.coin.image.src = coinGame.assets.idleSrc;
    state.autoFlipIntervalId = window.setInterval(() => {
      state.balance += state.reward;
      unlockEligibleGames();
      setCoinMessage(coinGame.messages.auto, coinGame);
    }, coinGame.timings.autoCycleMs);
  }

  function applySpeedUpgrade() {
    const coinGame = getGameConfig('coin');
    const speedUpgrade = coinGame.upgrades.speed;

    if (!state.stages.coinUpgradesUnlocked || state.stages.coinAutoMode) {
      return;
    }

    const speedCost = getUpgradeCost(speedUpgrade, state.upgradeLevels.speed);

    if (state.balance < speedCost) {
      return;
    }

    state.balance -= speedCost;
    state.upgradeLevels.speed += 1;

    if (state.upgradeLevels.speed >= speedUpgrade.maxLevel) {
      startCoinAutoMode();
    }

    syncUnlockedGames();
    setCoinMessage(state.stages.coinAutoMode ? coinGame.messages.auto : coinGame.messages.default, coinGame);
  }

  function unlockGameRun() {
    state.runActive = true;
    state.unlockedGames.coin = true;
    dom.gifContainer.classList.add('hidden');
    dom.gameStack.classList.remove('hidden');
    setCoinMessage(getGameConfig('coin').messages.intro, getGameConfig('coin'));
    unlockEligibleGames();
  }

  function bindCatInteraction() {
    dom.gifImage.addEventListener('mouseover', () => {
      if (state.interactionEnabled) {
        dom.gifImage.src = config.catAnimation.hoverSrc;
      }
    });

    dom.gifImage.addEventListener('mouseout', () => {
      if (state.interactionEnabled) {
        dom.gifImage.src = config.catAnimation.idleSrc;
      }
    });

    dom.gifImage.addEventListener('click', () => {
      dom.gifImage.src = config.catAnimation.feedSrc;
      dom.gifImage.style.pointerEvents = 'none';
      dom.gifContainer.style.cursor = 'default';
      state.interactionEnabled = false;

      setTimeout(() => {
        dom.gifImage.src = config.catAnimation.thanksSrc;
      }, config.catAnimation.feedDelayMs);

      if (desktopQuery.matches) {
        setTimeout(() => {
          unlockGameRun();
        }, config.catAnimation.unlockDelayMs);
      }
    });
  }

  function init() {
    renderGames();
    updateCurrentTarget();
    updateProgressHeader();
    setCoinMessage(getGameConfig('coin').messages.default, getGameConfig('coin'));
    config.games.forEach((game) => {
      if (game.type === 'placeholder') {
        updatePlaceholderGame(game.key);
      }
    });
    updateCoinUpgradePanel();
    bindCatInteraction();
  }

  init();
})();