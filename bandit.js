/*
 * Three-armed bandit: reward distributions and game state.
 *
 * No DOM access in this file, so the same table and sampler can be reused
 * outside the game page (e.g. for simulations in the lecture slides).
 */
(function (root) {
  'use strict';

  var TURNS = 40;

  // The reward distributions, left to right. They are deliberately fixed and
  // identical for every player so that scores can be compared in a lecture.
  // Reward = round(Normal(mean, sd)); with integer means and no clamping the
  // expected reward of each arm is exactly its mean.
  var ARMS = [
    { mean: 12, sd: 3 },
    { mean: 10, sd: 3 },
    { mean: 15, sd: 3 }
  ];

  // false: button i always pays from ARMS[i].
  // true:  the distributions are dealt to the buttons at random each game
  //        (same three distributions, so scores stay comparable).
  var SHUFFLE_ARMS = false;

  // Standard normal draw (Box-Muller). `rng` returns uniforms in [0, 1).
  function standardNormal(rng) {
    rng = rng || Math.random;
    var u = 1 - rng(); // (0, 1], keeps log() finite
    var v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sampleReward(arm, rng) {
    return Math.round(arm.mean + arm.sd * standardNormal(rng));
  }

  function newGame(rng) {
    rng = rng || Math.random;
    var order = ARMS.map(function (_, i) { return i; });
    if (SHUFFLE_ARMS) {
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }
    }
    return {
      order: order,                                   // button index -> ARMS index
      turn: 0,                                        // pulls made so far
      total: 0,                                       // undiscounted sum of rewards
      last: null,                                     // button pressed most recently
      history: ARMS.map(function () { return []; })   // rewards per button, oldest first
    };
  }

  function isOver(game) {
    return game.turn >= TURNS;
  }

  // Press button `button`. Returns the reward, or null once the game is over.
  function pull(game, button, rng) {
    if (isOver(game)) return null;
    var reward = sampleReward(ARMS[game.order[button]], rng);
    game.history[button].push(reward);
    game.total += reward;
    game.turn += 1;
    game.last = button;
    return reward;
  }

  // Structural check for a game restored from storage.
  function isValidGame(game) {
    if (!game || !Array.isArray(game.order) || !Array.isArray(game.history)) return false;
    if (game.order.length !== ARMS.length || game.history.length !== ARMS.length) return false;
    var seen = {};
    for (var i = 0; i < ARMS.length; i++) {
      var o = game.order[i];
      if (!Number.isInteger(o) || o < 0 || o >= ARMS.length || seen[o]) return false;
      seen[o] = true;
    }
    var count = 0;
    var sum = 0;
    for (var b = 0; b < ARMS.length; b++) {
      var h = game.history[b];
      if (!Array.isArray(h)) return false;
      for (var k = 0; k < h.length; k++) {
        if (!Number.isInteger(h[k])) return false;
        sum += h[k];
      }
      count += h.length;
    }
    if (count !== game.turn || sum !== game.total || count > TURNS) return false;
    if (count === 0) return game.last === null;
    return Number.isInteger(game.last) && game.last >= 0 && game.last < ARMS.length &&
      game.history[game.last].length > 0;
  }

  var api = {
    TURNS: TURNS,
    ARMS: ARMS,
    SHUFFLE_ARMS: SHUFFLE_ARMS,
    standardNormal: standardNormal,
    sampleReward: sampleReward,
    newGame: newGame,
    isOver: isOver,
    pull: pull,
    isValidGame: isValidGame
  };

  root.Bandit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
