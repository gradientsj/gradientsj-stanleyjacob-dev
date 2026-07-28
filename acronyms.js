/* Accessible acronym expansion for technical articles.
   The visible article stays concise; hover, keyboard focus, and native
   assistive technology expose each term's full form. */
(function () {
  "use strict";

  var TERMS = {
    A2C: "Advantage Actor-Critic",
    API: "Application Programming Interface",
    CPU: "Central Processing Unit",
    DPO: "Direct Preference Optimization",
    DQN: "Deep Q-Network",
    GAE: "Generalized Advantage Estimation",
    GPU: "Graphics Processing Unit",
    GRPO: "Group Relative Policy Optimization",
    IPO: "Identity Preference Optimization",
    KL: "Kullback–Leibler",
    KTO: "Kahneman–Tversky Optimization",
    LLM: "Large Language Model",
    MDP: "Markov Decision Process",
    ML: "Machine Learning",
    ORPO: "Odds Ratio Preference Optimization",
    PPO: "Proximal Policy Optimization",
    RL: "Reinforcement Learning",
    RLHF: "Reinforcement Learning from Human Feedback",
    RLOO: "REINFORCE Leave-One-Out",
    SFT: "Supervised Fine-Tuning",
    SGD: "Stochastic Gradient Descent",
    SimPO: "Simple Preference Optimization",
    TD: "Temporal Difference",
    TRL: "Transformer Reinforcement Learning",
    TRPO: "Trust Region Policy Optimization"
  };
  var SKIP = { A: 1, ABBR: 1, CODE: 1, KBD: 1, PRE: 1, SCRIPT: 1, STYLE: 1, SVG: 1, TEXTAREA: 1 };
  var pattern = new RegExp("\\b(" + Object.keys(TERMS).sort(function (a, b) {
    return b.length - a.length;
  }).join("|") + ")\\b", "g");

  function shouldSkip(node) {
    var el = node.parentElement;
    while (el) {
      if (SKIP[el.tagName] || el.classList.contains("katex")) return true;
      if (el.matches("article.prose")) return false;
      el = el.parentElement;
    }
    return true;
  }

  function expand(scope) {
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var nodes = [], node;
    while ((node = walker.nextNode())) {
      pattern.lastIndex = 0;
      if (!shouldSkip(node) && pattern.test(node.nodeValue)) nodes.push(node);
    }
    pattern.lastIndex = 0;

    nodes.forEach(function (textNode) {
      var text = textNode.nodeValue, frag = document.createDocumentFragment();
      var last = 0, match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text))) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        var abbr = document.createElement("abbr");
        abbr.className = "technical-acronym";
        abbr.title = TERMS[match[0]];
        abbr.tabIndex = 0;
        abbr.setAttribute("aria-label", match[0] + ": " + TERMS[match[0]]);
        abbr.textContent = match[0];
        frag.appendChild(abbr);
        last = match.index + match[0].length;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("article.prose"), expand);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
