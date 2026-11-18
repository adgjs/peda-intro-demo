/* DOM wiring for the bandit game. All game rules live in bandit.js. */
(function () {
  'use strict';

  var B = window.Bandit;
  var STORAGE_KEY = 'bandit-demo-game-v1';
  var TAP_GUARD_MS = 250;   // ignore a second tap this soon after the last one
  var FLY_MS = 420;
  var COUNT_MS = 300;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var scoreEl = document.getElementById('score');
  var scoreLabelEl = document.getElementById('score-label');
  var turnsEl = document.getElementById('turns');
  var progressEl = document.getElementById('progress-bar');
  var hintEl = document.getElementById('hint');
  var againEl = document.getElementById('again');

  var arms = Array.prototype.map.call(document.querySelectorAll('.arm'), function (el) {
    return {
      el: el,
      history: el.querySelector('.history'),
      chips: el.querySelector('.chips'),
      lever: el.querySelector('.lever')
    };
  });

  var game = load() || B.newGame();
  var shownScore = game.total;
  var countFrame = 0;
  var lastTap = -Infinity;

  // ---------- Persistence (survives an accidental reload) ----------

  function load() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      return B.isValidGame(saved) ? saved : null;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    } catch (e) { /* private mode etc.: play on without persistence */ }
  }

  // ---------- Rendering ----------

  function makeChip(reward) {
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = reward;
    return chip;
  }

  function showScore(value) {
    shownScore = value;
    scoreEl.textContent = value;
  }

  function countScoreTo(target) {
    cancelAnimationFrame(countFrame);
    if (reduceMotion.matches) {
      showScore(target);
      return;
    }
    var from = shownScore;
    var start = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - start) / COUNT_MS);
      showScore(Math.round(from + (target - from) * t));
      if (t < 1) countFrame = requestAnimationFrame(step);
    })(start);
  }

  function renderStatus() {
    var over = B.isOver(game);
    turnsEl.textContent = game.turn + ' / ' + B.TURNS + ' turns';
    progressEl.style.width = (100 * game.turn / B.TURNS) + '%';
    scoreLabelEl.textContent = over ? 'Final score' : 'Score';
    hintEl.hidden = over;
    againEl.hidden = !over;
    arms.forEach(function (arm) { arm.lever.disabled = over; });
  }

  function renderAll() {
    cancelAnimationFrame(countFrame);
    arms.forEach(function (arm, i) {
      arm.chips.textContent = '';
      game.history[i].forEach(function (reward) {
        arm.chips.prepend(makeChip(reward));   // newest first in the DOM
      });
      arm.history.scrollTop = 0;
    });
    if (game.last !== null) arms[game.last].chips.firstElementChild.classList.add('latest');
    showScore(game.total);
    renderStatus();
  }

  // ---------- Animation ----------

  function flyReward(arm, chip, reward) {
    var from = arm.lever.getBoundingClientRect();
    var to = chip.getBoundingClientRect();
    var x0 = from.left + from.width / 2;
    var y0 = from.top + from.height / 2;
    var dx = to.left + to.width / 2 - x0;
    var dy = to.top + to.height / 2 - y0;

    var floater = document.createElement('span');
    floater.className = 'floater';
    floater.textContent = '+' + reward;
    floater.style.left = x0 + 'px';
    floater.style.top = y0 + 'px';
    arm.el.appendChild(floater);   // inside the arm so it picks up the arm's color

    var anim = floater.animate([
      { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.9)', opacity: 1, offset: 0.3 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.7)', opacity: 1 }
    ], { duration: FLY_MS, easing: 'cubic-bezier(0.3, 0.6, 0.3, 1)' });
    anim.onfinish = anim.oncancel = function () { floater.remove(); };
  }

  function pop(el, scale, ms) {
    if (reduceMotion.matches || !el.animate) return;
    el.animate(
      [{ transform: 'scale(' + scale + ')' }, { transform: 'scale(1)' }],
      { duration: ms, easing: 'ease-out' }
    );
  }

  // ---------- Input ----------

  function onPull(i) {
    var now = performance.now();
    if (B.isOver(game) || now - lastTap < TAP_GUARD_MS) return;
    lastTap = now;

    var reward = B.pull(game, i);
    save();

    var arm = arms[i];
    var previous = document.querySelector('.chip.latest');
    if (previous) previous.classList.remove('latest');

    var chip = makeChip(reward);
    chip.classList.add('latest');
    arm.chips.prepend(chip);
    arm.history.scrollTop = 0;

    if (!reduceMotion.matches && chip.animate) {
      chip.classList.add('fresh');
      flyReward(arm, chip, reward);
    }

    countScoreTo(game.total);
    renderStatus();
    pop(scoreEl, B.isOver(game) ? 1.35 : 1.08, B.isOver(game) ? 600 : 220);
  }

  arms.forEach(function (arm, i) {
    arm.lever.addEventListener('click', function () { onPull(i); });
  });

  againEl.addEventListener('click', function () {
    game = B.newGame();
    save();
    renderAll();
  });

  // iOS Safari only applies :active styles when a touch listener exists.
  document.addEventListener('touchstart', function () {}, { passive: true });

  renderAll();
})();
