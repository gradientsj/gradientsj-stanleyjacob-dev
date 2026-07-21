/* Self-contained study quiz for the articles. No dependencies.
   Markup:
     <div class="quiz" data-quiz>
       <script type="application/json" class="quiz-data">[ ... questions ... ]</script>
     </div>
   Each question: { id, qtype: "mcq"|"truefalse"|"ordering", stem, options[], correctIndex, explanation }
   - mcq: 4 options, correctIndex points to the right one.
   - truefalse: options ["True","False"], correctIndex 0 or 1.
   - ordering: options listed in the CORRECT order (the engine shuffles them), correctIndex -1. */
(function () {
  "use strict";

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function renderChoice(card, q, onAnswer) {
    var list = el("div", "quiz-opts");
    var keys = ["A", "B", "C", "D", "E", "F"];
    var answered = false;
    q.options.forEach(function (opt, i) {
      var b = el("button", "quiz-opt");
      b.type = "button";
      var key = el("span", "quiz-key", q.qtype === "truefalse" ? (i === 0 ? "T" : "F") : keys[i]);
      var text = el("span", "quiz-optxt", opt);
      b.appendChild(key); b.appendChild(text);
      b.addEventListener("click", function () {
        if (answered) return;
        answered = true;
        var correct = i === q.correctIndex;
        Array.prototype.forEach.call(list.children, function (c, ci) {
          c.disabled = true;
          if (ci === q.correctIndex) c.classList.add("is-correct");
          if (ci === i && !correct) c.classList.add("is-wrong");
        });
        onAnswer(correct);
      });
      list.appendChild(b);
    });
    card.appendChild(list);
  }

  function renderOrdering(card, q, onAnswer) {
    var items = q.options.map(function (t, i) { return { text: t, idx: i }; });
    // shuffle until it is not already in the correct order
    var guard = 0;
    do { shuffle(items); guard++; }
    while (guard < 20 && items.length > 1 && items.every(function (it, i) { return it.idx === i; }));

    var list = el("ol", "quiz-order");
    function draw() {
      list.innerHTML = "";
      items.forEach(function (it, pos) {
        var li = el("li", "quiz-order-item");
        var txt = el("span", "quiz-order-txt", it.text);
        var ctrl = el("span", "quiz-order-ctrl");
        var up = el("button", "quiz-move", "↑"); up.type = "button";
        up.setAttribute("aria-label", "Move up"); up.disabled = pos === 0;
        var dn = el("button", "quiz-move", "↓"); dn.type = "button";
        dn.setAttribute("aria-label", "Move down"); dn.disabled = pos === items.length - 1;
        up.addEventListener("click", function () {
          if (pos > 0) { var t = items[pos - 1]; items[pos - 1] = items[pos]; items[pos] = t; draw(); }
        });
        dn.addEventListener("click", function () {
          if (pos < items.length - 1) { var t = items[pos + 1]; items[pos + 1] = items[pos]; items[pos] = t; draw(); }
        });
        ctrl.appendChild(up); ctrl.appendChild(dn);
        li.appendChild(txt); li.appendChild(ctrl);
        list.appendChild(li);
      });
    }
    draw();
    card.appendChild(list);

    var check = el("button", "quiz-check", "Check order");
    check.type = "button";
    var answered = false;
    check.addEventListener("click", function () {
      if (answered) return;
      answered = true;
      var correct = items.every(function (it, i) { return it.idx === i; });
      Array.prototype.forEach.call(list.children, function (li, i) {
        li.classList.add(items[i].idx === i ? "is-correct" : "is-wrong");
        Array.prototype.forEach.call(li.querySelectorAll("button"), function (b) { b.disabled = true; });
      });
      check.disabled = true;
      onAnswer(correct);
    });
    card.appendChild(check);
  }

  function build(root) {
    var dataEl = root.querySelector(".quiz-data");
    if (!dataEl) return;
    var qs;
    try { qs = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!Array.isArray(qs) || !qs.length) return;

    var head = el("div", "quiz-head");
    var title = el("div", "quiz-title", "Test your intuition");
    var score = el("div", "quiz-score", "0 / " + qs.length + " answered");
    score.setAttribute("aria-live", "polite");
    head.appendChild(title); head.appendChild(score);
    root.appendChild(head);

    var answered = 0, correctCount = 0;
    qs.forEach(function (q, qi) {
      var card = el("div", "quiz-card");
      var stem = el("div", "quiz-stem");
      stem.appendChild(el("span", "quiz-num", String(qi + 1)));
      stem.appendChild(el("span", "quiz-stemtxt", q.stem));
      card.appendChild(stem);

      var fb = el("div", "quiz-fb");
      fb.setAttribute("aria-live", "polite");
      function onAnswer(correct) {
        answered++;
        if (correct) correctCount++;
        score.textContent = answered + " / " + qs.length + " answered · " + correctCount + " correct";
        fb.classList.add(correct ? "ok" : "no");
        var lead = el("strong", null, correct ? "Correct. " : "Not quite. ");
        fb.appendChild(lead);
        fb.appendChild(document.createTextNode(q.explanation));
        fb.classList.add("shown");
      }
      if (q.qtype === "ordering") renderOrdering(card, q, onAnswer);
      else renderChoice(card, q, onAnswer);
      card.appendChild(fb);
      root.appendChild(card);
    });
  }

  function init() {
    var nodes = document.querySelectorAll("[data-quiz]");
    Array.prototype.forEach.call(nodes, build);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
