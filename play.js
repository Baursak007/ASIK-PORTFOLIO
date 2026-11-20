(function () {
  function lang() { return window.I18N ? window.I18N.lang : "en"; }
  function pick(o) { return o[lang()]; }
  var BACK = { en: "Back to menu", ru: "Назад в меню" };
  var tree = {
    start: {
      text: { en: "Hi! I'm Asik's demo bot — what would you like to know?", ru: "Привет! Я демо-бот Asik — что вас интересует?" },
      options: [
        { label: { en: "Show the Arqa project", ru: "Показать проект Arqa" }, next: "arqa" },
        { label: { en: "How much does a site or bot cost?", ru: "Сколько стоит сайт или бот?" }, next: "price" },
        { label: { en: "Contact Asik", ru: "Связаться с Asik" }, next: "contact" }
      ]
    },
    arqa: {
      text: { en: "Arqa is a barbershop landing page with online booking — you can open the live site", ru: "Arqa — лендинг для барбершопа с онлайн-записью — можно открыть работающий сайт" },
      options: [
        { label: { en: "Open the Arqa site", ru: "Открыть сайт Arqa" }, href: "https://baursak007.github.io/Arqa-barbershop/" },
        { label: BACK, next: "start" }
      ]
    },
    price: {
      text: { en: "Prices:\n• Landing pages: from $150\n• Chatbots: from $100\n• Site + bot + CRM: from $400\n\nThe exact price depends on the task", ru: "Цены:\n• Лендинги — от $150\n• Чат-боты — от $100\n• Сайт + бот + CRM — от $400\n\nТочная цена зависит от задачи" },
      options: [
        { label: { en: "Message on Telegram", ru: "Написать в Telegram" }, href: "https://t.me/Auramonster" },
        { label: BACK, next: "start" }
      ]
    },
    contact: {
      text: { en: "Asik replies in Telegram and WhatsApp:", ru: "Asik отвечает в Telegram и WhatsApp:" },
      options: [
        { label: { en: "Telegram @Auramonster", ru: "Telegram @Auramonster" }, href: "https://t.me/Auramonster" },
        { label: { en: "WhatsApp", ru: "WhatsApp" }, href: "https://wa.me/77479473841" },
        { label: BACK, next: "start" }
      ]
    }
  };

  var chat = null, typing = null, options = null;
  var token = 0;

  function addMsg(text, who) {
    var m = document.createElement("div");
    m.className = "msg " + who;
    m.textContent = text;
    chat.appendChild(m);
    chat.scrollTop = chat.scrollHeight;
  }

  function show(key) {
    var step = tree[key];
    var my = ++token;
    options.innerHTML = "";
    typing.textContent = window.I18N ? window.I18N.t("typing") : "typing…";
    setTimeout(function () {
      if (my !== token) return;
      typing.textContent = "";
      addMsg(pick(step.text), "bot");
      step.options.forEach(function (opt) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = pick(opt.label);
        b.addEventListener("click", function () {
          if (opt.href) { window.open(opt.href, "_blank", "noopener"); return; }
          addMsg(pick(opt.label), "me");
          show(opt.next);
        });
        options.appendChild(b);
      });
    }, 450);
  }

  function reset() { token++; if (chat) chat.innerHTML = ""; show("start"); }
  function init() {
    chat = document.getElementById("chat");
    typing = document.getElementById("typing");
    options = document.getElementById("options");
    if (!chat) return;
    chat.innerHTML = "";
    var rb = document.getElementById("reset");
    if (rb) rb.addEventListener("click", reset);
    show("start");
  }
  document.addEventListener("langchange", function () { if (document.getElementById("chat")) reset(); });
  window.initPlay = init; // called again when the Play page is opened without a reload
  init();
})();
