window.MINI_GAME_CONFIG = {
  desktopMediaQuery: '(min-width: 992px) and (hover: hover) and (pointer: fine)',
  catAnimation: {
    hoverSrc: '/assets/logo_point.gif',
    idleSrc: '/assets/logo_stay.gif',
    feedSrc: '/assets/logo_feed.gif',
    thanksSrc: '/assets/logo_thx.gif',
    feedDelayMs: 3300,
    unlockDelayMs: 4300
  },
  progressLabels: {
    balance: 'Balance',
    target: 'Target',
    done: 'Done'
  },
  sharedState: {
    startingBalance: 0,
    startingReward: 1,
    startingTailReward: 0
  },
  numberFormat: {
    scientificThreshold: 10000,
    maxFractionDigits: 4
  },
  ui: {
    inlineUpgradeCostMaxChars: 4
  },
  games: [
    {
      key: 'coin',
      type: 'coinFlip',
      title: 'Flip The Coin',
      unlockAt: 0,
      assets: {
        idleSrc: '/assets/coin_flip_frezze.png',
        flipSrc: '/assets/coin_flip_move.gif',
        headSrc: '/assets/coin_flip_head.gif',
        tailSrc: '/assets/coin_flip_back.gif'
      },
      timings: {
        betweenStatesMs: 300,
        baseCycleMs: 2000,
        minCycleMs: 200,
        autoCycleMs: 800,
        flipRatio: 0.6,
        resultRatio: 0.4
      },
      progression: {
        upgradesUnlockAt: 10
      },
      upgrades: {
        reward: {
          key: 'reward',
          title: 'Heads Upgrade',
          baseCost: 10,
          costMode: 'exponential',
          growthFactor: 2,
          rewardIncrement: 1,
          messages: {
            locked: 'Reach {unlockTarget} to unlock upgrades.',
            ready: 'Spend {formattedCost} to raise heads to +{nextReward}.',
            success: 'Heads reward upgraded to +{reward}.',
            auto: 'Heads now gives +{reward}.'
          }
        },
        speed: {
          key: 'speed',
          title: 'Speed Upgrade',
          baseCost: 10,
          costMode: 'linear',
          costStep: 0,
          maxLevel: 5,
          levelStep: 0.2,
          messages: {
            locked: 'Reach {unlockTarget} to unlock upgrades.',
            ready: 'Spend {formattedCost} to speed up the flip. Lv {level}/{maxLevel}.',
            success: 'Flip speed increased. Lv {level}/{maxLevel}.',
            maxed: 'Auto mode active at 0.2s per cycle.'
          }
        }
      },
      messages: {
        default: 'Heads +{reward}, tails +{tailReward}.',
        intro: 'Heads +{reward}, tails +{tailReward}. Reach {nextTarget} to unlock the next step.',
        heads: 'Heads. You earned {reward} coin{plural}.',
        tails: 'Tails. You earned {tailReward} coin{tailPlural}.',
        busy: 'The coin is flipping...',
        auto: 'Auto flip is running.'
      }
    },
    {
      key: 'game2',
      type: 'marketTrading',
      title: 'Buy Crypto',
      unlockAt: 50,
      market: {
        tickMs: 8000,
        startingPrice: 1000,
        historyLength: 24,
        minPrice: 50,
        driftStrength: 0.008,
        volatility: 0.014,
        regimeShiftChance: 0.18,
        regimeShiftRange: 0.008,
        volatilityStateShiftChance: 0.14,
        momentumCarry: 0.42,
        meanReversionStrength: 0.06,
        maxDriftBias: 0.012,
        maxMomentum: 0.012,
        maxStepChange: 0.065,
        shockChance: 0.1,
        shockRange: 0.08,
        shockCooldownTicks: 2,
        wickBase: 0.0025,
        wickVolatilityFactor: 0.72,
        wickShockMultiplier: 1.9,
        wickTrendFollowChance: 0.24,
        regimes: {
          calm: {
            weight: 0.24,
            minTicks: 2,
            maxTicks: 5,
            volMultiplier: 0.4,
            wickMultiplier: 0.45,
            trendMultiplier: 0.75,
            meanReversionMultiplier: 1.35,
            shockMultiplier: 0.5
          },
          trend: {
            weight: 0.46,
            minTicks: 3,
            maxTicks: 7,
            volMultiplier: 0.82,
            wickMultiplier: 0.72,
            trendMultiplier: 1.2,
            meanReversionMultiplier: 0.82,
            shockMultiplier: 1
          },
          violent: {
            weight: 0.22,
            minTicks: 2,
            maxTicks: 4,
            volMultiplier: 1.28,
            wickMultiplier: 1.08,
            trendMultiplier: 1.1,
            meanReversionMultiplier: 0.62,
            shockMultiplier: 1.35
          },
          manic: {
            weight: 0.08,
            minTicks: 2,
            maxTicks: 3,
            volMultiplier: 1.75,
            wickMultiplier: 1.55,
            trendMultiplier: 0.95,
            meanReversionMultiplier: 0.42,
            shockMultiplier: 1.75
          }
        },
        eventChance: 0.28,
        eventProfiles: [
          {
            key: 'squeeze_up',
            weight: 0.22,
            minTicks: 2,
            maxTicks: 4,
            direction: 1,
            driftMin: 0.016,
            driftMax: 0.042,
            volMultiplier: 1.75,
            wickMultiplier: 1.85,
            wickSkew: 0.75,
            shockMultiplier: 1.25
          },
          {
            key: 'flush_down',
            weight: 0.24,
            minTicks: 2,
            maxTicks: 4,
            direction: -1,
            driftMin: 0.018,
            driftMax: 0.048,
            volMultiplier: 1.95,
            wickMultiplier: 2,
            wickSkew: 0.85,
            shockMultiplier: 1.35
          },
          {
            key: 'whipsaw',
            weight: 0.045,
            minTicks: 2,
            maxTicks: 3,
            direction: 0,
            driftMin: 0.008,
            driftMax: 0.028,
            volMultiplier: 2.2,
            wickMultiplier: 2.9,
            wickSkew: 1.35,
            shockMultiplier: 1.45,
            whipsaw: true,
            huntBothSides: true
          },
          {
            key: 'liquidation_hunt',
            weight: 0.035,
            minTicks: 1,
            maxTicks: 3,
            direction: 0,
            driftMin: 0.005,
            driftMax: 0.018,
            volMultiplier: 1.45,
            wickMultiplier: 3.4,
            wickSkew: 1.8,
            shockMultiplier: 1.15,
            huntBothSides: true
          }
        ],
        animationMs: 300,
        chart: {
          width: 150,
          height: 76,
          padding: {
            top: 8,
            right: 6,
            bottom: 10,
            left: 6
          },
          lineColor: '#d48416',
          dotColor: '#b85c00',
          wickColor: 'rgba(184, 92, 0, 0.28)',
          gridColor: 'rgba(34, 34, 34, 0.12)'
        }
      },
      trade: {
        leverages: [5, 10, 25],
        feeRate: 0.006,
        maintenanceMarginRate: 0.015,
        hiddenHunt: {
          minLeverage: 25,
          startAfterTicks: 2,
          baseChance: 0.08,
          growthFactor: 1.85,
          leverageExponent: 1.15,
          guaranteedAfterTicks: 8,
          overshootMin: 0.006,
          overshootMax: 0.028
        },
        minAllocation: 10,
        maxAllocation: 100,
        defaultAllocation: 25,
        allocationStep: 5
      },
      upgrades: {
        positionInfo: {
          key: 'positionInfo',
          title: 'Info I',
          cost: 25,
          activeLabel: 'Info I on'
        },
        marketSignal: {
          key: 'marketSignal',
          title: 'Signal I',
          cost: 40,
          activeLabel: 'Signal I on'
        }
      },
      messages: {
        locked: 'Reach {target} coins to unlock this window.',
        idle: 'Watch the line and choose a side.',
        positionOpen: 'Position open. Wait or close manually.',
        closed: 'Position closed.',
        liquidated: 'Liquidated. Margin lost.',
        wickLiquidated: 'Liquidated by a wick spike.',
        unlocked: 'Second game unlocked.',
        infoUnlocked: 'Position info unlocked.',
        signalUnlocked: 'Fuzzy signal unlocked.'
      }
    },
    {
      key: 'game3',
      type: 'placeholder',
      title: 'Game 03',
      unlockAt: 1000,
      messages: {
        locked: 'Reach {target} coins to unlock this window.',
        unlocked: 'Third game slot unlocked. Rule set can be added here later.'
      }
    },
    {
      key: 'game4',
      type: 'placeholder',
      title: 'Game 04',
      unlockAt: 100000,
      messages: {
        locked: 'Reach {target} coins to unlock this window.',
        unlocked: 'Fourth game slot unlocked. Rule set can be added here later.'
      }
    }
  ]
};