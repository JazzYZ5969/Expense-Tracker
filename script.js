// Budgie – a rule-based expense tracker bot. Data is saved in the browser (localStorage).
const KEY = "budgie-data";
const state = JSON.parse(localStorage.getItem(KEY) || "null") || { tx: [], budget: 0 };
const $ = id => document.getElementById(id);
const peso = n => "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const month = () => new Date().toISOString().slice(0, 7);

// Keywords the bot uses to guess a category. Add your own words here.
const CATS = {
  food: "food lunch dinner breakfast snack meal coffee groceries grocery drink",
  transport: "transport fare jeep bus tricycle grab gas gasoline commute taxi",
  school: "school tuition books book project printing print supplies",
  bills: "bill bills electricity water internet wifi rent phone load",
  fun: "fun movie game games shopping clothes netflix",
  health: "health medicine doctor vitamins"
};

const HELP = `Hi! I’m Budgie 🤖 Try typing:
• spent 150 on lunch
• got 500 allowance
• set budget 5000
• how much on food?
• summary
• budget left
• undo
• clear all`;

function categorize(text) {
  const words = text.toLowerCase().split(/[^a-z]+/);
  for (const [cat, list] of Object.entries(CATS)) {
    if (words.some(w => list.split(" ").includes(w))) return cat;
  }
  return "other";
}

const amountOf = t => {
  const m = t.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const totals = () => state.tx.reduce(
  (a, t) => { t.type === "income" ? a.inc += t.amount : a.exp += t.amount; return a; },
  { inc: 0, exp: 0 }
);

const monthSpent = () => state.tx
  .filter(t => t.type === "expense" && t.date.startsWith(month()))
  .reduce((s, t) => s + t.amount, 0);

function add(type, text, amount) {
  const cat = type === "income" ? "income" : categorize(text);
  const note = text
    .replace(/[\d,.₱]+/g, " ")
    .replace(/\b(spent|spend|paid|pay|bought|buy|on|for|i|a|an|the|php|peso|pesos|received|got|earned|my|add|income|expense|of)\b/gi, " ")
    .replace(/\s+/g, " ").trim() || cat;
  state.tx.push({ id: Date.now(), type, amount, cat, note, date: new Date().toISOString() });
  save(); render();

  let msg = type === "income"
    ? `Added income of ${peso(amount)} (${note}). 💵`
    : `Logged ${peso(amount)} for ${note} under ${cat}. ✅`;
  if (type === "expense" && state.budget) {
    const pct = monthSpent() / state.budget * 100;
    if (pct >= 100) msg += `\n⚠️ You’re over your monthly budget (${pct.toFixed(0)}%).`;
    else if (pct >= 80) msg += `\n⚠️ Careful: ${pct.toFixed(0)}% of your budget is used.`;
  }
  return msg;
}

function reply(text) {
  const t = text.toLowerCase().trim();
  const amt = amountOf(t);

  if (/^(hi|hello|hey|help|\?)/.test(t)) return HELP;

  if (/\bundo\b|delete last|remove last/.test(t)) {
    const last = state.tx.pop();
    if (!last) return "There’s nothing to undo yet.";
    save(); render();
    return `Removed “${last.note}” (${peso(last.amount)}).`;
  }

  if (/clear all|reset/.test(t)) {
    if (!confirm("Delete all your data?")) return "Okay, nothing was deleted.";
    state.tx = []; state.budget = 0; save(); render();
    return "All data cleared. Fresh start! 🌱";
  }

  if (/budget/.test(t)) {
    if (amt && !/left|remain|status|how/.test(t)) {
      state.budget = amt; save(); render();
      return `Monthly budget set to ${peso(amt)}.`;
    }
    if (!state.budget) return "No budget yet. Try “set budget 5000”.";
    const spent = monthSpent(), left = state.budget - spent;
    return `This month you spent ${peso(spent)} of ${peso(state.budget)} (${(spent / state.budget * 100).toFixed(0)}%).\n` +
      (left >= 0 ? `Left: ${peso(left)}` : `Over by ${peso(-left)}`);
  }

  if (!amt && /how much|summary|balance|report|total/.test(t)) {
    const m = t.match(/(?:on|for)\s+(.+)$/);
    const cat = m ? categorize(m[1]) : "other";
    if (cat !== "other") {
      const sum = state.tx.filter(x => x.type === "expense" && x.cat === cat).reduce((s, x) => s + x.amount, 0);
      return `You’ve spent ${peso(sum)} on ${cat} so far.`;
    }
    const { inc, exp } = totals();
    return `Income: ${peso(inc)}\nExpenses: ${peso(exp)}\nBalance: ${peso(inc - exp)}`;
  }

  if (amt) {
    if (/\b(earned|received|got|income|salary|allowance|deposit)\b/.test(t)) return add("income", text, amt);
    return add("expense", text, amt);
  }

  return "I didn’t get that 🤔 Try “spent 150 on lunch” or type “help”.";
}

function render() {
  const { inc, exp } = totals();
  $("balance").textContent = peso(inc - exp);
  $("income").textContent = peso(inc);
  $("expenses").textContent = peso(exp);

  const spent = monthSpent();
  const pct = state.budget ? Math.min(100, spent / state.budget * 100) : 0;
  $("budgetText").textContent = state.budget ? `${peso(spent)} / ${peso(state.budget)}` : "Not set";
  $("budgetFill").style.width = pct + "%";
  $("budgetFill").className = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";

  const list = $("list");
  list.innerHTML = state.tx.length ? "" : '<li class="empty">No transactions yet.</li>';
  [...state.tx].reverse().slice(0, 30).forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = '<div><b></b><small></small></div><span></span><button title="Delete">✕</button>';
    li.querySelector("b").textContent = t.note;
    li.querySelector("small").textContent = `${t.cat} · ${new Date(t.date).toLocaleDateString()}`;
    const val = li.querySelector("span");
    val.textContent = (t.type === "income" ? "+" : "−") + peso(t.amount);
    val.className = t.type === "income" ? "pos" : "neg";
    li.querySelector("button").onclick = () => {
      state.tx = state.tx.filter(x => x.id !== t.id);
      save(); render();
    };
    list.appendChild(li);
  });

  const by = {};
  state.tx.filter(t => t.type === "expense").forEach(t => { by[t.cat] = (by[t.cat] || 0) + t.amount; });
  const max = Math.max(1, ...Object.values(by));
  const cats = $("cats");
  cats.innerHTML = Object.keys(by).length ? "" : '<p class="empty">Nothing to show yet.</p>';
  Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => {
    const row = document.createElement("div");
    row.className = "cat";
    row.innerHTML = '<span></span><div class="bar"><div></div></div><em></em>';
    row.children[0].textContent = c;
    row.querySelector(".bar div").style.width = (v / max * 100) + "%";
    row.children[2].textContent = peso(v);
    cats.appendChild(row);
  });
}

function say(text, who) {
  const d = document.createElement("div");
  d.className = "msg " + who;
  d.textContent = text;
  $("messages").appendChild(d);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function send(text) {
  text = text.trim();
  if (!text) return;
  say(text, "user");
  setTimeout(() => say(reply(text), "bot"), 300);
}

$("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  send($("chatInput").value);
  $("chatInput").value = "";
});
document.querySelectorAll(".chips button").forEach(b => { b.onclick = () => send(b.dataset.msg); });

render();
say(HELP, "bot");
