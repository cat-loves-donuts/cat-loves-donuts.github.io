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
    maxFractionDigits: 1
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
      type: 'placeholder',
      title: 'Game 02',
      unlockAt: 50,
      messages: {
        locked: 'Reach {target} coins to unlock this window.',
        unlocked: 'Second game slot unlocked. A new rule set can go here.'
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