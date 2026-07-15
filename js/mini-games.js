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
    unlockedGames: Object.fromEntries(config.games.map((game) => [game.key, false])),
    marketUpgrades: Object.fromEntries(
      config.games
        .filter((game) => game.type === 'marketTrading')
        .map((game) => [game.key, { positionInfo: false, marketSignal: false }])
    )
  };
  const gameElements = {};
  const marketGames = {};

  function formatText(template, values) {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : '';
    });
  }

  function getGameConfig(key) {
    return config.games.find((game) => game.key === key);
  }

  function getTradingUpgradeState(key) {
    return state.marketUpgrades[key] || { positionInfo: false, marketSignal: false };
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

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundToPrecision(value, digits) {
    const factor = Math.pow(10, digits);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function trimTrailingZeros(value) {
    return value.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/^-0$/, '0');
  }

  function getDisplayDigits() {
    return config.numberFormat && typeof config.numberFormat.maxFractionDigits === 'number'
      ? config.numberFormat.maxFractionDigits
      : 4;
  }

  function randomBetween(min, max) {
    return min + ((max - min) * Math.random());
  }

  function randomInteger(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function pickWeightedItem(items) {
    const totalWeight = items.reduce((sum, item) => sum + Math.max(item.weight || 0, 0), 0);

    if (totalWeight <= 0) {
      return items[0];
    }

    let cursor = Math.random() * totalWeight;

    for (let index = 0; index < items.length; index += 1) {
      cursor -= Math.max(items[index].weight || 0, 0);

      if (cursor <= 0) {
        return items[index];
      }
    }

    return items[items.length - 1];
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
    const digits = getDisplayDigits();
    const absoluteValue = Math.abs(value);
    const smallThreshold = Math.pow(10, -digits);

    if (absoluteValue === 0) {
      return '0';
    }

    if (absoluteValue >= threshold || absoluteValue < smallThreshold) {
      const scientific = value.toExponential(digits);
      return scientific
        .replace(/(\.\d*?[1-9])0+e/, '$1e')
        .replace(/\.0+e/, 'e')
        .replace('e+', 'e');
    }

    return trimTrailingZeros(value.toFixed(digits));
  }

  function formatSignedNumber(value) {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${formatNumber(value)}`;
  }

  function estimatePositionPnl(position, currentPrice) {
    const direction = position.side === 'long' ? 1 : -1;
    return roundToPrecision(direction * ((currentPrice - position.entryPrice) * position.quantity), 8);
  }

  function estimateExitFee(position, currentPrice, feeRate) {
    return roundToPrecision(position.quantity * currentPrice * feeRate, 8);
  }

  function estimatePositionEquity(game, position, currentPrice) {
    const pnl = estimatePositionPnl(position, currentPrice);
    const exitFee = estimateExitFee(position, currentPrice, game.trade.feeRate);
    return roundToPrecision(position.marginBalance + pnl - exitFee, 8);
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

  function createMarketRegime(game) {
    const regime = {
      trendBias: roundToPrecision((Math.random() - 0.5) * game.market.driftStrength, 8),
      momentum: 0,
      lastReturn: 0,
      shockCooldown: 0,
      anchorPrice: game.market.startingPrice,
      activeRegimeKey: 'trend',
      regimeTicksRemaining: 0,
      event: null
    };

    rollVolatilityState(game, regime, true);
    return regime;
  }

  function getActiveVolatilityState(game, regime) {
    return game.market.regimes[regime.activeRegimeKey] || game.market.regimes.trend;
  }

  function rollVolatilityState(game, regime, dampenShock) {
    const stateOptions = Object.keys(game.market.regimes).map((key) => {
      const option = Object.assign({ key }, game.market.regimes[key]);

      if (dampenShock) {
        if (key === 'violent') {
          option.weight *= 0.45;
        }

        if (key === 'manic') {
          option.weight *= 0.2;
        }
      }

      return option;
    });
    const selected = pickWeightedItem(stateOptions);

    regime.activeRegimeKey = selected.key;
    regime.regimeTicksRemaining = randomInteger(selected.minTicks, selected.maxTicks);
  }

  function maybeShiftVolatilityState(game, regime, dampenShock) {
    if (regime.regimeTicksRemaining > 0) {
      regime.regimeTicksRemaining -= 1;
    }

    const shiftChance = dampenShock
      ? game.market.volatilityStateShiftChance * 0.2
      : game.market.volatilityStateShiftChance;

    if (regime.regimeTicksRemaining <= 0 || Math.random() < shiftChance) {
      rollVolatilityState(game, regime, dampenShock);
    }
  }

  function createMarketEvent(game, dampenShock) {
    if (dampenShock || Math.random() >= game.market.eventChance) {
      return null;
    }

    const profile = pickWeightedItem(game.market.eventProfiles);
    const direction = profile.direction === 0 ? (Math.random() < 0.5 ? -1 : 1) : profile.direction;

    return {
      key: profile.key,
      direction,
      ticksRemaining: randomInteger(profile.minTicks, profile.maxTicks),
      drift: randomBetween(profile.driftMin, profile.driftMax) * direction,
      volMultiplier: profile.volMultiplier,
      wickMultiplier: profile.wickMultiplier,
      wickSkew: profile.wickSkew,
      shockMultiplier: profile.shockMultiplier,
      whipsaw: Boolean(profile.whipsaw),
      huntBothSides: Boolean(profile.huntBothSides)
    };
  }

  function buildTradingCandle(tradingState, game, dampenShock) {
    const previousPrice = tradingState.currentPrice;
    const regime = tradingState.regime;
    const market = game.market;
    let event = regime.event;

    maybeShiftVolatilityState(game, regime, dampenShock);

    if (!event || event.ticksRemaining <= 0) {
      regime.event = createMarketEvent(game, dampenShock);
      event = regime.event;
    }

    const activeState = getActiveVolatilityState(game, regime);
    const regimeShiftChance = dampenShock ? market.regimeShiftChance * 0.35 : market.regimeShiftChance;

    if (Math.random() < regimeShiftChance) {
      regime.trendBias = clampNumber(
        regime.trendBias + (((Math.random() - 0.5) * 2) * market.regimeShiftRange),
        -market.maxDriftBias,
        market.maxDriftBias
      );
      regime.anchorPrice = roundToPrecision(
        previousPrice * (1 + ((Math.random() - 0.5) * market.regimeShiftRange)),
        8
      );
    }

    const anchorGap = (regime.anchorPrice - previousPrice) / Math.max(previousPrice, 1);
    const meanReversion = anchorGap * market.meanReversionStrength * activeState.meanReversionMultiplier;
    const noiseScale = dampenShock
      ? market.volatility * activeState.volMultiplier * 0.45
      : market.volatility * activeState.volMultiplier * (0.75 + (Math.random() * 0.7));
    const noise = ((((Math.random() + Math.random() + Math.random()) / 3) - 0.5) * 2) * noiseScale;

    regime.momentum = clampNumber(
      (regime.momentum * 0.35) + (regime.lastReturn * market.momentumCarry * activeState.trendMultiplier),
      -market.maxMomentum,
      market.maxMomentum
    );

    let shock = 0;
    const shockChance = !dampenShock
      ? market.shockChance * activeState.shockMultiplier * (event ? event.shockMultiplier : 1)
      : 0;

    if (!dampenShock) {
      if (regime.shockCooldown > 0) {
        regime.shockCooldown -= 1;
      }

      if (regime.shockCooldown === 0 && Math.random() < shockChance) {
        shock = (Math.random() < 0.5 ? -1 : 1) * (market.shockRange * (0.45 + (Math.random() * 0.85)));
        regime.shockCooldown = market.shockCooldownTicks;
        regime.trendBias = clampNumber(
          regime.trendBias + (shock * 0.2),
          -market.maxDriftBias,
          market.maxDriftBias
        );
      }
    }

    const eventDrift = event ? event.drift : 0;
    const nextReturn = clampNumber(
      (regime.trendBias * activeState.trendMultiplier) + regime.momentum + meanReversion + noise + eventDrift + shock,
      -market.maxStepChange,
      market.maxStepChange
    );

    regime.lastReturn = nextReturn;
    regime.anchorPrice = roundToPrecision((regime.anchorPrice * 0.96) + (previousPrice * 0.04), 8);

    const open = previousPrice;
    let close = Math.max(market.minPrice, previousPrice * (1 + nextReturn));
    const baseDirection = Math.sign(nextReturn || regime.trendBias || (Math.random() - 0.5)) || 1;
    let upperWickFactor = 0.55 + Math.random();
    let lowerWickFactor = 0.55 + Math.random();

    if (baseDirection >= 0) {
      upperWickFactor += market.wickTrendFollowChance;
    } else {
      lowerWickFactor += market.wickTrendFollowChance;
    }

    if (event) {
      if (event.huntBothSides) {
        upperWickFactor += event.wickSkew;
        lowerWickFactor += event.wickSkew;
      } else if (event.direction >= 0) {
        upperWickFactor += event.wickSkew;
      } else {
        lowerWickFactor += event.wickSkew;
      }

      if (event.whipsaw) {
        close = open * (1 + (nextReturn * 0.45));

        if (baseDirection >= 0) {
          lowerWickFactor += event.wickSkew * 1.1;
        } else {
          upperWickFactor += event.wickSkew * 1.1;
        }
      }
    }

    close = roundToPrecision(Math.max(market.minPrice, close), 8);

    const wickRange = (market.wickBase + (Math.abs(nextReturn) * 0.55) + (noiseScale * market.wickVolatilityFactor) + (Math.abs(shock) * market.wickShockMultiplier))
      * activeState.wickMultiplier
      * (event ? event.wickMultiplier : 1)
      * (0.55 + Math.random());
    const upperAnchor = Math.max(open, close);
    const lowerAnchor = Math.min(open, close);
    const high = roundToPrecision(upperAnchor * (1 + (wickRange * upperWickFactor)), 8);
    const low = roundToPrecision(Math.max(market.minPrice, lowerAnchor * (1 - (wickRange * lowerWickFactor))), 8);

    if (event) {
      event.ticksRemaining -= 1;

      if (event.ticksRemaining <= 0) {
        regime.event = null;
      }
    }

    return {
      open: roundToPrecision(open, 8),
      high,
      low,
      close,
      regimeKey: regime.activeRegimeKey,
      eventKey: event ? event.key : null
    };
  }

  function buildInitialTradingHistory(game) {
    const regime = createMarketRegime(game);
    const seedState = {
      currentPrice: game.market.startingPrice,
      regime
    };
    const history = [game.market.startingPrice];
    const candles = [{
      open: game.market.startingPrice,
      high: game.market.startingPrice,
      low: game.market.startingPrice,
      close: game.market.startingPrice,
      regimeKey: regime.activeRegimeKey,
      eventKey: null
    }];

    while (history.length < game.market.historyLength) {
      const nextCandle = buildTradingCandle(seedState, game, true);
      history.push(nextCandle.close);
      candles.push(nextCandle);
      seedState.currentPrice = nextCandle.close;
    }

    return {
      history,
      candles,
      regime
    };
  }

  function createTradingState(game) {
    const seededMarket = buildInitialTradingHistory(game);
    const priceHistory = seededMarket.history;
    const candleHistory = seededMarket.candles;

    return {
      priceHistory,
      candleHistory,
      currentPrice: priceHistory[priceHistory.length - 1],
      lastCandle: candleHistory[candleHistory.length - 1],
      regime: seededMarket.regime,
      leverage: game.trade.leverages[0],
      allocationPercent: game.trade.defaultAllocation,
      activePosition: null,
      timerId: null,
      countdownId: null,
      nextTickAt: 0,
      chartAnimationId: null,
      statusMessage: game.messages.idle,
      started: false
    };
  }

  function renderTradingGame(game) {
    const wrapper = document.createElement('div');
    wrapper.id = `${game.key}-game`;
    wrapper.className = 'game-window trading-window hidden';
    wrapper.innerHTML = `
      <div class="game-window-title">${game.title}</div>
      <div class="trading-topline">
        <span class="trading-price" data-role="price"></span>
        <span class="trading-countdown" data-role="countdown"></span>
      </div>
      <canvas class="trading-chart" data-role="chart" width="${game.market.chart.width}" height="${game.market.chart.height}"></canvas>
      <div class="trading-controls">
        <label class="trading-slider-row" data-role="slider-row">
          <span class="trading-allocation" data-role="allocation-label"></span>
          <input data-role="allocation" type="range" min="${game.trade.minAllocation}" max="${game.trade.maxAllocation}" value="${game.trade.defaultAllocation}" step="${game.trade.allocationStep}" />
        </label>
        <div class="trading-control-row">
          <select data-role="leverage"></select>
          <button class="trading-action-button" data-role="close" type="button" disabled>Close</button>
        </div>
        <div class="trading-control-row">
          <button class="trading-action-button" data-role="long" type="button">Long</button>
          <button class="trading-action-button" data-role="short" type="button">Short</button>
        </div>
      </div>
        <div class="trading-upgrades" data-role="upgrades">
          <button class="game-upgrade-button trading-upgrade-button" data-role="position-info-upgrade" type="button"></button>
          <button class="game-upgrade-button trading-upgrade-button" data-role="market-signal-upgrade" type="button"></button>
        </div>
        <div class="trading-info hidden" data-role="position-info"></div>
        <div class="trading-info hidden" data-role="market-signal"></div>
      <div class="game-window-meta" data-role="message"></div>
    `;

    const leverageSelect = wrapper.querySelector('[data-role="leverage"]');
    game.trade.leverages.forEach((leverage) => {
      const option = document.createElement('option');
      option.value = leverage;
      option.textContent = `${leverage}x`;
      leverageSelect.appendChild(option);
    });

    gameElements[game.key] = {
      wrapper,
      price: wrapper.querySelector('[data-role="price"]'),
      countdown: wrapper.querySelector('[data-role="countdown"]'),
      chart: wrapper.querySelector('[data-role="chart"]'),
      allocationLabel: wrapper.querySelector('[data-role="allocation-label"]'),
      allocationInput: wrapper.querySelector('[data-role="allocation"]'),
      leverageSelect,
      longButton: wrapper.querySelector('[data-role="long"]'),
      shortButton: wrapper.querySelector('[data-role="short"]'),
      closeButton: wrapper.querySelector('[data-role="close"]'),
      upgrades: wrapper.querySelector('[data-role="upgrades"]'),
      positionInfoUpgradeButton: wrapper.querySelector('[data-role="position-info-upgrade"]'),
      marketSignalUpgradeButton: wrapper.querySelector('[data-role="market-signal-upgrade"]'),
      positionInfo: wrapper.querySelector('[data-role="position-info"]'),
      marketSignal: wrapper.querySelector('[data-role="market-signal"]'),
      message: wrapper.querySelector('[data-role="message"]')
    };

    marketGames[game.key] = createTradingState(game);

    gameElements[game.key].allocationInput.addEventListener('input', (event) => {
      marketGames[game.key].allocationPercent = Number(event.target.value);
      updateTradingDisplays(game.key);
    });

    leverageSelect.addEventListener('change', (event) => {
      marketGames[game.key].leverage = Number(event.target.value);
      updateTradingDisplays(game.key);
    });

    gameElements[game.key].longButton.addEventListener('click', () => {
      openTradingPosition(game.key, 'long');
    });

    gameElements[game.key].shortButton.addEventListener('click', () => {
      openTradingPosition(game.key, 'short');
    });

    gameElements[game.key].closeButton.addEventListener('click', () => {
      closeTradingPosition(game.key, 'manual');
    });

    gameElements[game.key].positionInfoUpgradeButton.addEventListener('click', () => {
      purchaseTradingUpgrade(game.key, 'positionInfo');
    });

    gameElements[game.key].marketSignalUpgradeButton.addEventListener('click', () => {
      purchaseTradingUpgrade(game.key, 'marketSignal');
    });

    dom.gameWindows.appendChild(wrapper);
  }

  function renderGames() {
    dom.gameWindows.innerHTML = '';

    config.games.forEach((game) => {
      if (game.type === 'coinFlip') {
        renderCoinGame(game);
        return;
      }

      if (game.type === 'marketTrading') {
        renderTradingGame(game);
        return;
      }

      if (game.type === 'placeholder') {
        renderPlaceholderGame(game);
      }
    });
  }

  function formatTradingPrice(price) {
    return `${formatNumber(price)}U`;
  }

  function updateTradingUpgradePanel(key) {
    const game = getGameConfig(key);
    const elements = gameElements[key];
    const upgrades = getTradingUpgradeState(key);

    if (!game || !elements || !game.upgrades) {
      return;
    }

    const positionInfoConfig = game.upgrades.positionInfo;
    const marketSignalConfig = game.upgrades.marketSignal;

    elements.positionInfoUpgradeButton.textContent = upgrades.positionInfo
      ? positionInfoConfig.activeLabel
      : buildUpgradeButtonLabel(positionInfoConfig.title, positionInfoConfig.cost);
    elements.positionInfoUpgradeButton.disabled = upgrades.positionInfo || state.balance < positionInfoConfig.cost;

    elements.marketSignalUpgradeButton.textContent = upgrades.marketSignal
      ? marketSignalConfig.activeLabel
      : buildUpgradeButtonLabel(marketSignalConfig.title, marketSignalConfig.cost);
    elements.marketSignalUpgradeButton.disabled = upgrades.marketSignal || state.balance < marketSignalConfig.cost;
  }

  function canShowTradingWicks(key) {
    const upgrades = getTradingUpgradeState(key);
    return Boolean(upgrades.marketSignal);
  }

  function buildTradingInfoRow(label, value) {
    return `<div class="trading-info-row"><span>${label}</span><span>${value}</span></div>`;
  }

  function describeTradingSignal(game, tradingState) {
    if (tradingState.regime.event) {
      if (tradingState.regime.event.key === 'whipsaw') {
        return 'Whipsaw trap';
      }

      if (tradingState.regime.event.key === 'liquidation_hunt') {
        return 'Stop-hunt chaos';
      }

      if (tradingState.regime.event.direction > 0) {
        return 'Squeeze pressure';
      }

      return 'Flush pressure';
    }

    if (tradingState.regime.activeRegimeKey === 'manic') {
      return 'Manic volatility';
    }

    if (tradingState.regime.activeRegimeKey === 'violent') {
      return 'Violent swings';
    }

    const recentSeries = tradingState.priceHistory.slice(-6);
    const recentMove = recentSeries.length > 1
      ? (recentSeries[recentSeries.length - 1] - recentSeries[0]) / recentSeries[0]
      : 0;
    const recentReturns = [];

    for (let index = 1; index < recentSeries.length; index += 1) {
      recentReturns.push((recentSeries[index] - recentSeries[index - 1]) / recentSeries[index - 1]);
    }

    const averageVolatility = recentReturns.length
      ? recentReturns.reduce((sum, current) => sum + Math.abs(current), 0) / recentReturns.length
      : 0;
    const directionalScore = recentMove + (tradingState.regime.trendBias * 1.4) + tradingState.regime.momentum;

    if (averageVolatility > game.market.volatility * 1.1 && Math.abs(directionalScore) < 0.008) {
      return 'Rough / mixed';
    }

    if (directionalScore > 0.018) {
      return 'Bullish pressure';
    }

    if (directionalScore > 0.006) {
      return 'Soft bullish';
    }

    if (directionalScore < -0.018) {
      return 'Bearish pressure';
    }

    if (directionalScore < -0.006) {
      return 'Soft bearish';
    }

    if (averageVolatility < game.market.volatility * 0.55) {
      return 'Quiet / coiling';
    }

    return 'Sideways / mixed';
  }

  function describeLiquidationWarning(game, tradingState) {
    if (!tradingState.activePosition) {
      return 'No position';
    }

    const referenceCandle = tradingState.lastCandle || {
      high: tradingState.currentPrice,
      low: tradingState.currentPrice
    };
    const nearestThreat = tradingState.activePosition.side === 'long'
      ? referenceCandle.low
      : referenceCandle.high;
    const equity = estimatePositionEquity(game, tradingState.activePosition, nearestThreat);
    const distanceRatio = Math.abs(nearestThreat - tradingState.activePosition.liquidationPrice)
      / Math.max(tradingState.currentPrice, 1);

    if (equity <= tradingState.activePosition.maintenanceMargin * 1.4 || distanceRatio <= 0.015) {
      return 'Critical';
    }

    if (equity <= tradingState.activePosition.maintenanceMargin * 2.2 || distanceRatio <= 0.04) {
      return 'Danger';
    }

    if (distanceRatio <= 0.08) {
      return 'Watch';
    }

    return 'Safe';
  }

  function updateTradingInfoPanels(key) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];
    const elements = gameElements[key];
    const upgrades = getTradingUpgradeState(key);

    if (!game || !tradingState || !elements) {
      return;
    }

    elements.positionInfo.classList.toggle('hidden', !upgrades.positionInfo);
    elements.marketSignal.classList.toggle('hidden', !upgrades.marketSignal);

    if (upgrades.positionInfo) {
      if (tradingState.activePosition) {
        const pnl = estimatePositionPnl(tradingState.activePosition, tradingState.currentPrice);
        const equity = estimatePositionEquity(game, tradingState.activePosition, tradingState.currentPrice);
        elements.positionInfo.innerHTML = [
          buildTradingInfoRow('Side', `${tradingState.activePosition.side} ${tradingState.activePosition.leverage}x`),
          buildTradingInfoRow('Entry', formatTradingPrice(tradingState.activePosition.entryPrice)),
          buildTradingInfoRow('Liq', formatTradingPrice(tradingState.activePosition.liquidationPrice)),
          buildTradingInfoRow('PnL', formatSignedNumber(pnl)),
          buildTradingInfoRow('Equity', formatNumber(equity))
        ].join('');
      } else {
        elements.positionInfo.innerHTML = [
          buildTradingInfoRow('Ready', `${tradingState.allocationPercent}% / ${tradingState.leverage}x`),
          buildTradingInfoRow('Entry', 'Waiting')
        ].join('');
      }
    }

    if (upgrades.marketSignal) {
      const currentCandle = tradingState.lastCandle || {
        high: tradingState.currentPrice,
        low: tradingState.currentPrice
      };
      elements.marketSignal.innerHTML = [
        buildTradingInfoRow('Tone', describeTradingSignal(game, tradingState)),
        buildTradingInfoRow('Liq risk', describeLiquidationWarning(game, tradingState)),
        buildTradingInfoRow('Tick', `${formatTradingPrice(currentCandle.low)} / ${formatTradingPrice(currentCandle.high)}`)
      ].join('');
    }
  }

  function syncTradingControls(key) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];
    const elements = gameElements[key];

    if (!game || !tradingState || !elements) {
      return;
    }

    const hasPosition = Boolean(tradingState.activePosition);
    const canOpenNewPosition = !hasPosition && state.balance > 0;

    elements.allocationInput.disabled = hasPosition;
    elements.leverageSelect.disabled = hasPosition;
    elements.longButton.disabled = !canOpenNewPosition;
    elements.shortButton.disabled = !canOpenNewPosition;
    elements.closeButton.disabled = !hasPosition;
  }

  function drawTradingChart(key, series) {
    const game = getGameConfig(key);
    const elements = gameElements[key];

    if (!game || !elements) {
      return;
    }

    const canvas = elements.chart;
    const context = canvas.getContext('2d');
    const chartConfig = game.market.chart;
    const tradingState = marketGames[key];
    const padding = chartConfig.padding;
    const width = canvas.width;
    const height = canvas.height;
    const candles = tradingState && tradingState.candleHistory ? tradingState.candleHistory : [];
    const minValue = Math.min(...series);
    const maxValue = Math.max(...series);
    const range = Math.max(maxValue - minValue, 1);
    const verticalPadding = range * 0.2;
    const low = minValue - verticalPadding;
    const high = maxValue + verticalPadding;
    const drawableWidth = width - padding.left - padding.right;
    const drawableHeight = height - padding.top - padding.bottom;
    const topBound = padding.top + 1;
    const bottomBound = height - padding.bottom - 1;
    const points = series.map((value, index) => {
      const x = padding.left + ((drawableWidth / Math.max(series.length - 1, 1)) * index);
      const normalized = (value - low) / Math.max(high - low, 1);
      const y = height - padding.bottom - (normalized * drawableHeight);

      return { x, y };
    });
    const openPoints = candles.length === points.length
      ? candles.map((candle, index) => {
        const normalized = (candle.open - low) / Math.max(high - low, 1);
        const y = height - padding.bottom - (normalized * drawableHeight);
        return { x: points[index].x, y };
      })
      : [];

    context.clearRect(0, 0, width, height);
    context.strokeStyle = chartConfig.gridColor;
    context.lineWidth = 1;

    for (let gridIndex = 0; gridIndex < 3; gridIndex += 1) {
      const y = padding.top + ((drawableHeight / 2) * gridIndex);
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(width - padding.right, y);
      context.stroke();
    }

    if (canShowTradingWicks(key) && candles.length === points.length && openPoints.length === points.length) {
      let wickCompression = 1;

      candles.forEach((candle, index) => {
        const bodyCenterY = (openPoints[index].y + points[index].y) / 2;
        const highRawY = height - padding.bottom - (((candle.high - low) / Math.max(high - low, 1)) * drawableHeight);
        const lowRawY = height - padding.bottom - (((candle.low - low) / Math.max(high - low, 1)) * drawableHeight);
        const highDeviation = Math.max(0, bodyCenterY - highRawY);
        const lowDeviation = Math.max(0, lowRawY - bodyCenterY);

        if (highDeviation > 0) {
          wickCompression = Math.min(wickCompression, Math.max(0, (bodyCenterY - topBound) / highDeviation));
        }

        if (lowDeviation > 0) {
          wickCompression = Math.min(wickCompression, Math.max(0, (bottomBound - bodyCenterY) / lowDeviation));
        }
      });

      wickCompression = clampNumber(wickCompression, 0.12, 1);
      context.strokeStyle = chartConfig.wickColor || chartConfig.gridColor;
      context.lineWidth = 1;

      candles.forEach((candle, index) => {
        const x = points[index].x;
        const bodyCenterY = (openPoints[index].y + points[index].y) / 2;
        const highRawY = height - padding.bottom - (((candle.high - low) / Math.max(high - low, 1)) * drawableHeight);
        const lowRawY = height - padding.bottom - (((candle.low - low) / Math.max(high - low, 1)) * drawableHeight);
        const highDeviation = Math.max(0, bodyCenterY - highRawY) * wickCompression;
        const lowDeviation = Math.max(0, lowRawY - bodyCenterY) * wickCompression;
        const highY = Math.max(topBound, bodyCenterY - highDeviation);
        const lowY = Math.min(bottomBound, bodyCenterY + lowDeviation);

        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.stroke();
      });
    }

    context.strokeStyle = chartConfig.lineColor;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);

    for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
      const currentPoint = points[pointIndex];
      const nextPoint = points[pointIndex + 1];
      const midX = (currentPoint.x + nextPoint.x) / 2;
      const midY = (currentPoint.y + nextPoint.y) / 2;
      context.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY);
    }

    const lastPoint = points[points.length - 1];
    context.lineTo(lastPoint.x, lastPoint.y);
    context.stroke();

    context.fillStyle = chartConfig.dotColor;
    context.beginPath();
    context.arc(lastPoint.x, lastPoint.y, 2.5, 0, Math.PI * 2);
    context.fill();
  }

  function animateTradingChart(key, fromSeries, toSeries) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];

    if (!game || !tradingState) {
      return;
    }

    if (tradingState.chartAnimationId) {
      window.cancelAnimationFrame(tradingState.chartAnimationId);
    }

    const startedAt = performance.now();

    function step(now) {
      const progress = Math.min((now - startedAt) / game.market.animationMs, 1);
      const interpolatedSeries = toSeries.map((targetValue, index) => {
        const startValue = fromSeries[index];
        return startValue + ((targetValue - startValue) * progress);
      });

      drawTradingChart(key, interpolatedSeries);

      if (progress < 1) {
        tradingState.chartAnimationId = window.requestAnimationFrame(step);
      } else {
        tradingState.chartAnimationId = null;
      }
    }

    tradingState.chartAnimationId = window.requestAnimationFrame(step);
  }

  function updateTradingDisplays(key) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];
    const elements = gameElements[key];

    if (!game || !tradingState || !elements) {
      return;
    }

    const remainingMs = tradingState.nextTickAt ? Math.max(0, tradingState.nextTickAt - Date.now()) : game.market.tickMs;
    elements.price.textContent = formatTradingPrice(tradingState.currentPrice);
    elements.countdown.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
    elements.allocationLabel.textContent = `Use ${tradingState.allocationPercent}%`;
    elements.leverageSelect.value = `${tradingState.leverage}`;
    elements.message.textContent = tradingState.statusMessage;

    updateTradingUpgradePanel(key);
    updateTradingInfoPanels(key);
    syncTradingControls(key);
  }

  function maybeLiquidateTradingPosition(key, candle) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];

    if (!game || !tradingState || !tradingState.activePosition) {
      return false;
    }

    const { activePosition } = tradingState;
    const wickHit = activePosition.side === 'long'
      ? candle.low <= activePosition.liquidationPrice
      : candle.high >= activePosition.liquidationPrice;
    const markPrice = wickHit ? activePosition.liquidationPrice : tradingState.currentPrice;
    const equity = estimatePositionEquity(game, activePosition, markPrice);
    const liquidated = wickHit || equity <= activePosition.maintenanceMargin;

    if (!liquidated) {
      return false;
    }

    tradingState.activePosition = null;
    tradingState.statusMessage = wickHit ? game.messages.wickLiquidated : game.messages.liquidated;
    updateTradingDisplays(key);

    return true;
  }

  function resolveTradingTick(key) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];

    if (!game || !tradingState) {
      return;
    }

    const previousSeries = tradingState.priceHistory.slice();
    const previousCandles = tradingState.candleHistory.slice();
    const nextCandle = buildTradingCandle(tradingState, game, false);
    const nextPrice = nextCandle.close;
    const nextSeries = previousSeries.slice(1);
    nextSeries.push(nextPrice);
    const nextCandles = previousCandles.slice(1);

    if (tradingState.activePosition) {
      tradingState.activePosition.holdTicks += 1;
      maybeApplyHighLeverageHunt(game, tradingState.activePosition, nextCandle);
    }

    nextCandles.push(nextCandle);

    tradingState.priceHistory = nextSeries;
    tradingState.candleHistory = nextCandles;
    tradingState.lastCandle = nextCandle;
    tradingState.currentPrice = nextPrice;
    tradingState.nextTickAt = Date.now() + game.market.tickMs;
    animateTradingChart(key, previousSeries, nextSeries);

    if (!maybeLiquidateTradingPosition(key, nextCandle) && tradingState.activePosition) {
      tradingState.statusMessage = game.messages.positionOpen;
    }

    updateTradingDisplays(key);
  }

  function startTradingGameLoop(key) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];

    if (!game || !tradingState || tradingState.started) {
      return;
    }

    tradingState.started = true;
    tradingState.nextTickAt = Date.now() + game.market.tickMs;
    drawTradingChart(key, tradingState.priceHistory);
    tradingState.timerId = window.setInterval(() => {
      resolveTradingTick(key);
    }, game.market.tickMs);
    tradingState.countdownId = window.setInterval(() => {
      updateTradingDisplays(key);
    }, 100);
    updateTradingDisplays(key);
  }

  function maybeApplyHighLeverageHunt(game, position, candle) {
    const hiddenHunt = game.trade.hiddenHunt;

    if (!hiddenHunt || position.leverage < hiddenHunt.minLeverage) {
      return false;
    }

    if (position.holdTicks <= hiddenHunt.startAfterTicks) {
      return false;
    }

    const extraTicks = position.holdTicks - hiddenHunt.startAfterTicks - 1;
    const leverageFactor = Math.pow(position.leverage / hiddenHunt.minLeverage, hiddenHunt.leverageExponent);
    const huntChance = position.holdTicks >= hiddenHunt.guaranteedAfterTicks
      ? 1
      : Math.min(0.98, hiddenHunt.baseChance * Math.pow(hiddenHunt.growthFactor, Math.max(extraTicks, 0)) * leverageFactor);

    if (Math.random() >= huntChance) {
      return false;
    }

    const overshootRatio = randomBetween(hiddenHunt.overshootMin, hiddenHunt.overshootMax);

    if (position.side === 'long') {
      candle.low = Math.min(candle.low, roundToPrecision(position.liquidationPrice * (1 - overshootRatio), 8));
      candle.high = Math.max(candle.high, candle.close, candle.open);
    } else {
      candle.high = Math.max(candle.high, roundToPrecision(position.liquidationPrice * (1 + overshootRatio), 8));
      candle.low = Math.min(candle.low, candle.close, candle.open);
    }

    candle.eventKey = 'high_leverage_hunt';
    return true;
  }

  function openTradingPosition(key, side) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];

    if (!game || !tradingState || tradingState.activePosition) {
      return;
    }

    const committedMargin = roundToPrecision(state.balance * (tradingState.allocationPercent / 100), 8);

    if (committedMargin <= 0) {
      return;
    }

    const notional = roundToPrecision(committedMargin * tradingState.leverage, 8);
    const entryFee = roundToPrecision(notional * game.trade.feeRate, 8);
    const marginBalance = roundToPrecision(committedMargin - entryFee, 8);
    const maintenanceMargin = roundToPrecision(notional * game.trade.maintenanceMarginRate, 8);

    if (marginBalance <= maintenanceMargin) {
      return;
    }

    const quantity = roundToPrecision(notional / tradingState.currentPrice, 8);
    const liquidationMove = (marginBalance - maintenanceMargin) / Math.max(quantity, 1e-8);
    const liquidationPrice = side === 'long'
      ? tradingState.currentPrice - liquidationMove
      : tradingState.currentPrice + liquidationMove;

    state.balance = roundToPrecision(state.balance - committedMargin, 8);
    tradingState.activePosition = {
      side,
      leverage: tradingState.leverage,
      committedMargin,
      marginBalance,
      maintenanceMargin,
      notional,
      quantity,
      entryPrice: tradingState.currentPrice,
      liquidationPrice: roundToPrecision(Math.max(game.market.minPrice, liquidationPrice), 8),
      feesPaid: entryFee,
      holdTicks: 0
    };
    tradingState.statusMessage = `${game.messages.positionOpen} ${side} ${tradingState.leverage}x.`;
    updateProgressHeader();
    updateTradingDisplays(key);
  }

  function closeTradingPosition(key, reason) {
    const game = getGameConfig(key);
    const tradingState = marketGames[key];

    if (!game || !tradingState || !tradingState.activePosition) {
      return;
    }

    const { activePosition } = tradingState;
    const pnl = estimatePositionPnl(activePosition, tradingState.currentPrice);
    const closeFee = estimateExitFee(activePosition, tradingState.currentPrice, game.trade.feeRate);
    const settlement = Math.max(0, activePosition.marginBalance + pnl - closeFee);
    const realizedPnl = roundToPrecision(settlement - activePosition.committedMargin, 8);

    state.balance = roundToPrecision(state.balance + settlement, 8);
    tradingState.activePosition = null;
    tradingState.statusMessage = reason === 'manual'
      ? `${game.messages.closed} ${formatSignedNumber(realizedPnl)}.`
      : game.messages.liquidated;
    unlockEligibleGames();
    updateTradingDisplays(key);
  }

  function purchaseTradingUpgrade(key, upgradeKey) {
    const game = getGameConfig(key);
    const upgrades = getTradingUpgradeState(key);
    const upgradeConfig = game && game.upgrades ? game.upgrades[upgradeKey] : null;

    if (!game || !upgradeConfig || upgrades[upgradeKey]) {
      return;
    }

    if (state.balance < upgradeConfig.cost) {
      return;
    }

    state.balance = roundToPrecision(state.balance - upgradeConfig.cost, 8);
    upgrades[upgradeKey] = true;
    marketGames[key].statusMessage = upgradeKey === 'positionInfo'
      ? game.messages.infoUnlocked
      : game.messages.signalUnlocked;
    updateProgressHeader();
    updateTradingDisplays(key);
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

      if (game.type === 'marketTrading') {
        if (shouldShow) {
          startTradingGameLoop(game.key);
          updateTradingDisplays(game.key);
        }
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