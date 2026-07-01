const STORAGE_KEY = "ledgerly-state-v1";
const VAT_RATE = 0.15;
let currentSession = null;
let authMode = "signup";
let saveTimer = null;

const defaultAccounts = [
  { id: "bank", name: "Bank", type: "asset", system: true },
  { id: "sales", name: "Sales revenue", type: "income" },
  { id: "service-income", name: "Service income", type: "income" },
  { id: "repairs", name: "Repairs and maintenance", type: "expense" },
  { id: "bank-charges", name: "Bank charges", type: "expense" },
  { id: "rent", name: "Rent", type: "expense" },
  { id: "fuel", name: "Fuel and travel", type: "expense" },
  { id: "software", name: "Software subscriptions", type: "expense" },
  { id: "drawings", name: "Owner drawings", type: "equity" },
];

const sampleRows = [
  { date: "2026-06-01", description: "Card machine settlement", amount: 18450, accountId: "sales", vat: "included", note: "Weekly takings" },
  { date: "2026-06-02", description: "FNB monthly account fee", amount: -295, accountId: "bank-charges", vat: "none", note: "" },
  { date: "2026-06-03", description: "Workshop roof repair", amount: -2350, accountId: "repairs", vat: "included", note: "" },
  { date: "2026-06-05", description: "Client EFT - Khumalo Projects", amount: 9200, accountId: "service-income", vat: "included", note: "" },
  { date: "2026-06-07", description: "Sasol fuel", amount: -1180.5, accountId: "fuel", vat: "included", note: "" },
  { date: "2026-06-10", description: "Shop rent", amount: -7400, accountId: "rent", vat: "none", note: "" },
  { date: "2026-06-13", description: "Canva subscription", amount: -229, accountId: "software", vat: "included", note: "" },
  { date: "2026-06-16", description: "Cash deposit", amount: 6850, accountId: "", vat: "none", note: "" },
  { date: "2026-06-18", description: "Owner transfer", amount: -3000, accountId: "drawings", vat: "none", note: "" },
];

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Could not load Ledgerly data", error);
    }
  }

  return {
    businessName: "Moyo Trading Co.",
    accounts: defaultAccounts,
    transactions: [],
    budgets: {
      sales: 45000,
      "service-income": 18000,
      repairs: 3000,
      "bank-charges": 450,
      rent: 7400,
      fuel: 2500,
      software: 750,
    },
    invoices: [],
  };
}

function saveState() {
  if (!currentSession?.user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  if (dom.saveStatus) dom.saveStatus.textContent = "Saving...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) throw new Error("Could not save");
      if (dom.saveStatus) dom.saveStatus.textContent = "Saved";
    } catch (error) {
      if (dom.saveStatus) dom.saveStatus.textContent = "Save failed";
      console.error(error);
    }
  }, 250);
}

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 2,
});

const dom = {
  title: document.querySelector("#view-title"),
  navItems: document.querySelectorAll(".nav-item"),
  views: document.querySelectorAll(".view"),
  businessName: document.querySelector("#business-name"),
  csvFile: document.querySelector("#csv-file"),
  loadSample: document.querySelector("#load-sample"),
  clearTransactions: document.querySelector("#clear-transactions"),
  transactionTable: document.querySelector("#transaction-table"),
  search: document.querySelector("#transaction-search"),
  transactionFilter: document.querySelector("#transaction-filter"),
  accountForm: document.querySelector("#account-form"),
  accountName: document.querySelector("#account-name"),
  accountType: document.querySelector("#account-type"),
  accountList: document.querySelector("#account-list"),
  accountBars: document.querySelector("#account-bars"),
  analyticsFilter: document.querySelector("#analytics-filter"),
  budgetPulse: document.querySelector("#budget-pulse"),
  budgetEditor: document.querySelector("#budget-editor"),
  saveBudgets: document.querySelector("#save-budgets"),
  generalLedger: document.querySelector("#general-ledger"),
  trialBalance: document.querySelector("#trial-balance"),
  exportLedger: document.querySelector("#export-ledger"),
  exportTrial: document.querySelector("#export-trial"),
  exportVat: document.querySelector("#export-vat"),
  vatReport: document.querySelector("#vat-report"),
  vatOutputTotal: document.querySelector("#vat-output-total"),
  vatInputTotal: document.querySelector("#vat-input-total"),
  vatNetTotal: document.querySelector("#vat-net-total"),
  dashboardHeadline: document.querySelector("#dashboard-headline"),
  dashboardSubline: document.querySelector("#dashboard-subline"),
  allocationRate: document.querySelector("#allocation-rate"),
  allocationFill: document.querySelector("#allocation-fill"),
  invoicePipeline: document.querySelector("#invoice-pipeline"),
  invoiceCount: document.querySelector("#invoice-count"),
  vatPosition: document.querySelector("#vat-position"),
  vatPositionLabel: document.querySelector("#vat-position-label"),
  invoiceForm: document.querySelector("#invoice-form"),
  invoiceClient: document.querySelector("#invoice-client"),
  invoiceDescription: document.querySelector("#invoice-description"),
  invoiceAmount: document.querySelector("#invoice-amount"),
  invoiceVat: document.querySelector("#invoice-vat"),
  invoiceDue: document.querySelector("#invoice-due"),
  invoiceList: document.querySelector("#invoice-list"),
  authScreen: document.querySelector("#auth-screen"),
  authForm: document.querySelector("#auth-form"),
  authTabs: document.querySelectorAll(".auth-tab"),
  authName: document.querySelector("#auth-name"),
  authBusiness: document.querySelector("#auth-business"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authSubmit: document.querySelector("#auth-submit"),
  authHint: document.querySelector("#auth-hint"),
  authError: document.querySelector("#auth-error"),
  logout: document.querySelector("#logout"),
  sessionUser: document.querySelector("#session-user"),
  saveStatus: document.querySelector("#save-status"),
  activatePlan: document.querySelector("#activate-plan"),
  settingsActivatePlan: document.querySelector("#settings-activate-plan"),
  subscriptionStatus: document.querySelector("#subscription-status"),
  paymentMessage: document.querySelector("#payment-message"),
  exportData: document.querySelector("#export-data"),
  deleteConfirmation: document.querySelector("#delete-confirmation"),
  deleteAccount: document.querySelector("#delete-account"),
  deleteMessage: document.querySelector("#delete-message"),
  incomeTotal: document.querySelector("#income-total"),
  expenseTotal: document.querySelector("#expense-total"),
  netTotal: document.querySelector("#net-total"),
  unallocatedTotal: document.querySelector("#unallocated-total"),
  incomeCount: document.querySelector("#income-count"),
  expenseCount: document.querySelector("#expense-count"),
};

function accountOptions(selectedId = "") {
  return state.accounts
    .filter((account) => account.id !== "bank")
    .map((account) => `<option value="${account.id}" ${account.id === selectedId ? "selected" : ""}>${escapeHtml(account.name)} (${account.type})</option>`)
    .join("");
}

function render() {
  state.invoices ||= [];
  document.body.classList.toggle("authenticated", Boolean(currentSession?.user));
  if (currentSession?.user) {
    dom.sessionUser.textContent = currentSession.user.email;
    dom.subscriptionStatus.textContent = currentSession.business?.subscriptionStatus || "Trial";
  }
  dom.businessName.value = state.businessName;
  renderMetrics();
  renderDashboardInsights();
  renderTransactions();
  renderAccounts();
  renderInvoices();
  renderAnalytics();
  renderBudgets();
  renderReports();
}

function renderMetrics() {
  const allocated = state.transactions.filter((tx) => tx.accountId);
  const income = allocated.filter((tx) => tx.amount > 0);
  const expenses = allocated.filter((tx) => tx.amount < 0);
  const incomeTotal = income.reduce((sum, tx) => sum + tx.amount, 0);
  const expenseTotal = Math.abs(expenses.reduce((sum, tx) => sum + tx.amount, 0));
  const net = state.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const unallocated = state.transactions.filter((tx) => !tx.accountId).length;

  dom.incomeTotal.textContent = money.format(incomeTotal);
  dom.expenseTotal.textContent = money.format(expenseTotal);
  dom.netTotal.textContent = money.format(net);
  dom.unallocatedTotal.textContent = String(unallocated);
  dom.incomeCount.textContent = `${income.length} income transactions`;
  dom.expenseCount.textContent = `${expenses.length} expense transactions`;
}

function renderDashboardInsights() {
  const totalTransactions = state.transactions.length;
  const allocatedTransactions = state.transactions.filter((tx) => tx.accountId).length;
  const allocationRate = totalTransactions ? Math.round((allocatedTransactions / totalTransactions) * 100) : 0;
  const openInvoices = state.invoices.filter((invoice) => invoice.status !== "paid");
  const pipeline = openInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const vat = buildVatReport();
  const netVat = vat.outputTotal - vat.inputTotal;

  dom.dashboardHeadline.textContent = totalTransactions
    ? `${allocationRate}% of imported transactions are allocated`
    : "Your books are ready for review";
  dom.dashboardSubline.textContent = totalTransactions
    ? `${allocatedTransactions} of ${totalTransactions} bank lines are classified. ${openInvoices.length} invoice${openInvoices.length === 1 ? "" : "s"} still open.`
    : "Import a bank statement or load sample data to see your business pulse.";
  dom.allocationRate.textContent = `${allocationRate}%`;
  dom.allocationFill.style.width = `${allocationRate}%`;
  dom.invoicePipeline.textContent = money.format(pipeline);
  dom.invoiceCount.textContent = `${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}`;
  dom.vatPosition.textContent = money.format(Math.abs(netVat));
  dom.vatPositionLabel.textContent = netVat > 0 ? "Estimated VAT payable" : netVat < 0 ? "Estimated VAT refund" : "No VAT activity yet";
}

function renderTransactions() {
  const query = dom.search.value.trim().toLowerCase();
  const filter = dom.transactionFilter.value;
  const filtered = state.transactions.filter((tx) => {
    const account = findAccount(tx.accountId);
    const text = `${tx.date} ${tx.description} ${tx.amount} ${account?.name || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "unallocated" && !tx.accountId) ||
      (filter === "income" && tx.amount > 0) ||
      (filter === "expense" && tx.amount < 0);
    return matchesQuery && matchesFilter;
  });

  if (!filtered.length) {
    dom.transactionTable.innerHTML = document.querySelector("#empty-state-template").innerHTML;
    return;
  }

  dom.transactionTable.innerHTML = filtered
    .map((tx) => {
      const amountClass = tx.amount >= 0 ? "money-in" : "money-out";
      return `
        <tr>
          <td>${escapeHtml(tx.date)}</td>
          <td>
            <strong>${escapeHtml(tx.description)}</strong><br />
            <span class="status-pill ${tx.accountId ? "done" : ""}">${tx.accountId ? "Allocated" : "Needs account"}</span>
          </td>
          <td class="${amountClass}">${money.format(tx.amount)}</td>
          <td>
            <select data-action="account" data-id="${tx.id}">
              <option value="">Choose account...</option>
              ${accountOptions(tx.accountId)}
            </select>
          </td>
          <td>
            <select data-action="vat" data-id="${tx.id}">
              <option value="none" ${tx.vat === "none" ? "selected" : ""}>No VAT</option>
              <option value="included" ${tx.vat === "included" ? "selected" : ""}>VAT included</option>
              <option value="excluded" ${tx.vat === "excluded" ? "selected" : ""}>VAT excluded</option>
            </select>
          </td>
          <td><input data-action="note" data-id="${tx.id}" type="text" value="${escapeAttribute(tx.note || "")}" placeholder="Optional note" /></td>
        </tr>
      `;
    })
    .join("");
}

function renderAccounts() {
  dom.accountList.innerHTML = state.accounts
    .map((account) => {
      const total = account.id === "bank" ? state.transactions.reduce((sum, tx) => sum + tx.amount, 0) : accountActivity(account.id);
      return `
        <div class="account-card">
          <div>
            <strong>${escapeHtml(account.name)}</strong>
            <div class="account-type">${account.type} account</div>
          </div>
          <div>
            <strong>${money.format(total)}</strong>
            ${account.system ? "" : `<button class="remove-account" data-remove-account="${account.id}">Remove</button>`}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderInvoices() {
  const invoices = [...state.invoices].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  dom.invoiceList.innerHTML = invoices.length
    ? invoices
        .map((invoice) => `
          <article class="invoice-card">
            <header>
              <div>
                <strong>${escapeHtml(invoice.client)}</strong>
                <p>${escapeHtml(invoice.description)}</p>
              </div>
              <strong>${money.format(invoice.total)}</strong>
            </header>
            <p>Due ${escapeHtml(invoice.dueDate || "No due date")} · ${invoice.vatMode === "included" ? "VAT included" : "No VAT"} · ${escapeHtml(invoice.status)}</p>
            <div class="invoice-actions">
              <button class="secondary small" data-invoice-status="paid" data-id="${invoice.id}">Mark paid</button>
              <button class="ghost small" data-invoice-status="sent" data-id="${invoice.id}">Mark sent</button>
              <button class="ghost danger small" data-remove-invoice="${invoice.id}">Delete</button>
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state"><strong>No invoices yet.</strong><br />Create an invoice to track expected income.</div>`;
}

function renderAnalytics() {
  const filter = dom.analyticsFilter.value;
  const accounts = state.accounts
    .filter((account) => account.id !== "bank")
    .filter((account) => filter === "all" || account.type === filter)
    .map((account) => ({ ...account, total: Math.abs(accountActivity(account.id)) }))
    .filter((account) => account.total > 0)
    .sort((a, b) => b.total - a.total);

  const max = Math.max(...accounts.map((account) => account.total), 1);
  dom.accountBars.innerHTML = accounts.length
    ? accounts
        .map((account) => `
          <div class="bar-row">
            <header>
              <strong>${escapeHtml(account.name)}</strong>
              <span>${money.format(account.total)}</span>
            </header>
            <div class="bar-track"><div class="bar-fill" style="width: ${(account.total / max) * 100}%"></div></div>
          </div>
        `)
        .join("")
    : `<div class="empty-state"><strong>No allocated activity yet.</strong><br />Allocate transactions to see account analytics.</div>`;
}

function renderBudgets() {
  const budgetAccounts = state.accounts.filter((account) => ["income", "expense"].includes(account.type));
  dom.budgetEditor.innerHTML = budgetAccounts
    .map((account) => `
      <div class="budget-row">
        <div>
          <strong>${escapeHtml(account.name)}</strong>
          <div class="account-type">${account.type === "income" ? "Income target" : "Expense budget"}</div>
        </div>
        <input data-budget-account="${account.id}" type="number" min="0" step="50" value="${state.budgets[account.id] || 0}" />
      </div>
    `)
    .join("");

  const rows = budgetAccounts
    .map((account) => {
      const actual = Math.abs(accountActivity(account.id));
      const target = Number(state.budgets[account.id] || 0);
      const percent = target > 0 ? Math.min((actual / target) * 100, 140) : 0;
      const danger = account.type === "expense" && percent > 100;
      const warning = percent > 80 && percent <= 100;
      const label = account.type === "income" ? `${Math.round(percent)}% of target earned` : `${Math.round(percent)}% of budget used`;
      return { account, actual, target, percent, danger, warning, label };
    })
    .filter((row) => row.target > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5);

  dom.budgetPulse.innerHTML = rows.length
    ? rows
        .map((row) => `
          <div class="budget-card">
            <header>
              <strong>${escapeHtml(row.account.name)}</strong>
              <span>${row.label}</span>
            </header>
            <div class="budget-track">
              <div class="budget-fill ${row.danger ? "danger" : row.warning ? "warning" : ""}" style="width: ${Math.min(row.percent, 100)}%"></div>
            </div>
            <p>${money.format(row.actual)} of ${money.format(row.target)}</p>
          </div>
        `)
        .join("")
    : `<div class="empty-state"><strong>No budgets yet.</strong><br />Set monthly targets to monitor spending and income.</div>`;
}

function renderReports() {
  const ledger = buildLedger();
  const trial = buildTrialBalance(ledger);
  const vat = buildVatReport();

  dom.generalLedger.innerHTML = ledger.length
    ? ledger
        .map((entry) => `
          <tr>
            <td>${escapeHtml(entry.date)}</td>
            <td>${escapeHtml(entry.accountName)}</td>
            <td>${escapeHtml(entry.description)}</td>
            <td>${entry.debit ? money.format(entry.debit) : ""}</td>
            <td>${entry.credit ? money.format(entry.credit) : ""}</td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="5" class="empty-state"><strong>No ledger entries yet.</strong><br />Allocate transactions first.</td></tr>`;

  dom.trialBalance.innerHTML = trial.length
    ? trial
        .map((row) => `
          <tr>
            <td>${escapeHtml(row.accountName)}</td>
            <td>${row.debit ? money.format(row.debit) : ""}</td>
            <td>${row.credit ? money.format(row.credit) : ""}</td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="3" class="empty-state"><strong>No trial balance yet.</strong></td></tr>`;

  dom.vatOutputTotal.textContent = money.format(vat.outputTotal);
  dom.vatInputTotal.textContent = money.format(vat.inputTotal);
  dom.vatNetTotal.textContent = money.format(vat.outputTotal - vat.inputTotal);
  dom.vatReport.innerHTML = vat.rows.length
    ? vat.rows
        .map((row) => `
          <tr>
            <td>${escapeHtml(row.date)}</td>
            <td>${escapeHtml(row.description)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${money.format(row.amount)}</td>
            <td>${money.format(row.vat)}</td>
          </tr>
        `)
        .join("")
    : `<tr><td colspan="5" class="empty-state"><strong>No VAT entries yet.</strong><br />Set VAT on processed transactions or create VAT invoices.</td></tr>`;
}

function buildLedger() {
  return state.transactions
    .filter((tx) => tx.accountId)
    .flatMap((tx) => {
      const account = findAccount(tx.accountId);
      if (!account) return [];
      const value = Math.abs(tx.amount);
      if (tx.amount >= 0) {
        return [
          entry(tx, "bank", value, 0),
          entry(tx, tx.accountId, 0, value),
        ];
      }
      return [
        entry(tx, tx.accountId, value, 0),
        entry(tx, "bank", 0, value),
      ];
    });
}

function buildTrialBalance(ledger) {
  const grouped = new Map();
  ledger.forEach((entry) => {
    const current = grouped.get(entry.accountId) || { accountId: entry.accountId, accountName: entry.accountName, debit: 0, credit: 0 };
    current.debit += entry.debit;
    current.credit += entry.credit;
    grouped.set(entry.accountId, current);
  });

  return Array.from(grouped.values()).map((row) => {
    const net = row.debit - row.credit;
    return {
      accountName: row.accountName,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? Math.abs(net) : 0,
    };
  });
}

function buildVatReport() {
  const transactionRows = state.transactions
    .filter((tx) => tx.vat && tx.vat !== "none")
    .map((tx) => {
      const vat = calculateVat(tx.amount, tx.vat);
      const income = tx.amount > 0;
      return {
        date: tx.date,
        description: tx.description,
        type: income ? "Output VAT" : "Input VAT",
        amount: Math.abs(tx.amount),
        vat,
        output: income ? vat : 0,
        input: income ? 0 : vat,
      };
    });

  const invoiceRows = state.invoices
    .filter((invoice) => invoice.vatMode === "included")
    .map((invoice) => ({
      date: invoice.createdAt?.slice(0, 10) || "",
      description: `Invoice: ${invoice.client} - ${invoice.description}`,
      type: "Output VAT",
      amount: invoice.total,
      vat: invoice.vat,
      output: invoice.vat,
      input: 0,
    }));

  const rows = [...transactionRows, ...invoiceRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return {
    rows,
    outputTotal: rows.reduce((sum, row) => sum + row.output, 0),
    inputTotal: rows.reduce((sum, row) => sum + row.input, 0),
  };
}

function calculateVat(amount, vatMode) {
  const value = Math.abs(Number(amount) || 0);
  if (vatMode === "included") return value * (VAT_RATE / (1 + VAT_RATE));
  if (vatMode === "excluded") return value * VAT_RATE;
  return 0;
}

function entry(tx, accountId, debit, credit) {
  const account = findAccount(accountId);
  return {
    date: tx.date,
    accountId,
    accountName: account?.name || "Unknown account",
    description: tx.description,
    debit,
    credit,
  };
}

function accountActivity(accountId) {
  return state.transactions
    .filter((tx) => tx.accountId === accountId)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function importCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return;

  const headers = rows[0].map((header) => normalize(header));
  const findIndex = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const dateIndex = findIndex("date", "transactiondate", "postingdate");
  const descriptionIndex = findIndex("description", "details", "narrative", "reference", "memo");
  const amountIndex = findIndex("amount", "value");
  const debitIndex = findIndex("debit", "withdrawal", "moneyout", "paidout");
  const creditIndex = findIndex("credit", "deposit", "moneyin", "paidin");

  const hasDebitCreditColumns = debitIndex >= 0 || creditIndex >= 0;
  const existingHashes = new Set(state.transactions.map((tx) => tx.importHash).filter(Boolean));
  let skippedDuplicates = 0;
  const imported = rows.slice(1).map((cells, index) => {
    const debit = parseMoney(cells[debitIndex]);
    const credit = parseMoney(cells[creditIndex]);
    const amount = hasDebitCreditColumns ? credit - debit : parseMoney(cells[amountIndex]);
    const date = cleanCell(cells[dateIndex]) || new Date().toISOString().slice(0, 10);
    const description = cleanCell(cells[descriptionIndex]) || `Imported transaction ${index + 1}`;
    const importHash = transactionHash(date, description, amount);
    if (existingHashes.has(importHash)) {
      skippedDuplicates += 1;
      return null;
    }
    existingHashes.add(importHash);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
      date,
      description,
      amount,
      accountId: guessAccount(description, amount),
      vat: "none",
      note: "",
      importHash,
      importedAt: new Date().toISOString(),
    };
  }).filter((tx) => tx && Number.isFinite(tx.amount) && tx.amount !== 0);

  state.transactions = [...state.transactions, ...imported];
  saveState();
  render();
  if (skippedDuplicates && dom.saveStatus) {
    dom.saveStatus.textContent = `Skipped ${skippedDuplicates} duplicate${skippedDuplicates === 1 ? "" : "s"}`;
  }
}

function guessAccount(description, amount) {
  const text = String(description || "").toLowerCase();
  const rules = [
    ["bank-charges", ["fee", "charge", "monthly account", "service fee"]],
    ["fuel", ["fuel", "sasol", "engen", "shell", "bp"]],
    ["rent", ["rent", "lease"]],
    ["software", ["subscription", "software", "canva", "xero", "adobe"]],
    ["repairs", ["repair", "maintenance", "plumber", "electrician"]],
    ["sales", ["settlement", "card machine", "cash deposit", "sale"]],
  ];
  const match = rules.find(([, words]) => words.some((word) => text.includes(word)));
  if (match) return match[0];
  return amount > 0 ? "sales" : "";
}

function parseMoney(value) {
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim();
  const negative = raw.includes("(") && raw.includes(")");
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned) || 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function cleanCell(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return cleanCell(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findAccount(id) {
  return state.accounts.find((account) => account.id === id);
}

function transactionHash(date, description, amount) {
  return `${normalize(date)}|${normalize(description)}|${Number(amount).toFixed(2)}`;
}

function slug(value) {
  const base = normalize(value).replace(/[^a-z0-9]+/g, "-") || "account";
  let id = base;
  let counter = 2;
  while (findAccount(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  return id;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

async function init() {
  try {
    const sessionResponse = await fetch("/api/session");
    currentSession = await sessionResponse.json();
    if (currentSession?.user) {
      const stateResponse = await fetch("/api/state");
      if (!stateResponse.ok) throw new Error("Could not load workspace");
      const payload = await stateResponse.json();
      state = payload.state;
      render();
    } else {
      document.body.classList.remove("authenticated");
    }
  } catch (error) {
    dom.authError.textContent = "Could not connect to Ledgerly. Check that the server is running.";
    console.error(error);
  }
}

function setAuthMode(mode) {
  authMode = mode;
  dom.authTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === mode));
  const signingUp = mode === "signup";
  dom.authName.style.display = signingUp ? "" : "none";
  dom.authBusiness.style.display = signingUp ? "" : "none";
  dom.authSubmit.textContent = signingUp ? "Create Ledgerly account" : "Sign in";
  dom.authHint.textContent = signingUp
    ? "Creating an account signs you in automatically."
    : "Use the same email and password you used when creating the account.";
  dom.authPassword.setAttribute("autocomplete", signingUp ? "new-password" : "current-password");
  dom.authError.textContent = "";
}

async function submitAuth(event) {
  event.preventDefault();
  dom.authSubmit.disabled = true;
  dom.authError.textContent = "";

  const endpoint = authMode === "signup" ? "/api/signup" : "/api/login";
  const payload = {
    name: dom.authName.value,
    businessName: dom.authBusiness.value,
    email: dom.authEmail.value,
    password: dom.authPassword.value,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Authentication failed");
    currentSession = data;
    const stateResponse = await fetch("/api/state");
    state = (await stateResponse.json()).state;
    dom.authPassword.value = "";
    render();
  } catch (error) {
    dom.authError.textContent = authMode === "login"
      ? `${error.message}. If this was an older demo account, create a new account because free Render storage can reset.`
      : error.message;
  } finally {
    dom.authSubmit.disabled = false;
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  currentSession = null;
  document.body.classList.remove("authenticated");
  dom.authPassword.value = "";
}

async function activateSubscription() {
  dom.paymentMessage.textContent = "Opening subscription checkout...";
  try {
    const response = await fetch("/api/subscription/checkout", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || "Payment is not configured yet");
    window.location.href = data.checkoutUrl;
  } catch (error) {
    dom.paymentMessage.textContent = error.message;
  }
}

function exportMyData() {
  window.location.href = "/api/export-data";
}

async function deleteMyAccount() {
  dom.deleteMessage.textContent = "";
  try {
    const response = await fetch("/api/delete-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: dom.deleteConfirmation.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not delete account");
    currentSession = null;
    state = loadState();
    document.body.classList.remove("authenticated");
    dom.deleteConfirmation.value = "";
    dom.authPassword.value = "";
  } catch (error) {
    dom.deleteMessage.textContent = error.message;
  }
}

function createInvoice(event) {
  event.preventDefault();
  const amount = Number(dom.invoiceAmount.value) || 0;
  if (!dom.invoiceClient.value.trim() || !dom.invoiceDescription.value.trim() || amount <= 0) return;
  const vatMode = dom.invoiceVat.value;
  const vat = vatMode === "included" ? amount * VAT_RATE : 0;
  const total = amount + vat;
  state.invoices.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `invoice-${Date.now()}`,
    client: dom.invoiceClient.value.trim(),
    description: dom.invoiceDescription.value.trim(),
    amount,
    vat,
    total,
    vatMode,
    dueDate: dom.invoiceDue.value,
    status: "draft",
    createdAt: new Date().toISOString(),
  });
  dom.invoiceForm.reset();
  saveState();
  render();
}

dom.navItems.forEach((button) => {
  button.addEventListener("click", () => {
    dom.navItems.forEach((item) => item.classList.remove("active"));
    dom.views.forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}`).classList.add("active");
    dom.title.textContent = button.textContent;
  });
});

document.querySelectorAll("[data-jump-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(`.nav-item[data-view="${button.dataset.jumpView}"]`)?.click();
  });
});

dom.businessName.addEventListener("input", (event) => {
  state.businessName = event.target.value;
  saveState();
});

dom.csvFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  importCsv(await file.text());
  event.target.value = "";
});

dom.loadSample.addEventListener("click", () => {
  state.transactions = sampleRows.map((row, index) => ({ ...row, id: `sample-${Date.now()}-${index}` }));
  saveState();
  render();
});

dom.clearTransactions.addEventListener("click", () => {
  state.transactions = [];
  saveState();
  render();
});

dom.transactionTable.addEventListener("change", (event) => {
  const id = event.target.dataset.id;
  const tx = state.transactions.find((transaction) => transaction.id === id);
  if (!tx) return;
  if (event.target.dataset.action === "account") tx.accountId = event.target.value;
  if (event.target.dataset.action === "vat") tx.vat = event.target.value;
  saveState();
  render();
});

dom.transactionTable.addEventListener("input", (event) => {
  const id = event.target.dataset.id;
  const tx = state.transactions.find((transaction) => transaction.id === id);
  if (!tx || event.target.dataset.action !== "note") return;
  tx.note = event.target.value;
  saveState();
});

dom.search.addEventListener("input", renderTransactions);
dom.transactionFilter.addEventListener("change", renderTransactions);
dom.analyticsFilter.addEventListener("change", renderAnalytics);

dom.accountForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = dom.accountName.value.trim();
  if (!name) return;
  state.accounts.push({ id: slug(name), name, type: dom.accountType.value });
  dom.accountForm.reset();
  saveState();
  render();
});

dom.accountList.addEventListener("click", (event) => {
  const id = event.target.dataset.removeAccount;
  if (!id) return;
  state.accounts = state.accounts.filter((account) => account.id !== id);
  state.transactions = state.transactions.map((tx) => tx.accountId === id ? { ...tx, accountId: "" } : tx);
  delete state.budgets[id];
  saveState();
  render();
});

dom.invoiceForm.addEventListener("submit", createInvoice);

dom.invoiceList.addEventListener("click", (event) => {
  const status = event.target.dataset.invoiceStatus;
  const removeId = event.target.dataset.removeInvoice;
  if (status) {
    const invoice = state.invoices.find((item) => item.id === event.target.dataset.id);
    if (!invoice) return;
    invoice.status = status;
    saveState();
    render();
  }
  if (removeId) {
    state.invoices = state.invoices.filter((invoice) => invoice.id !== removeId);
    saveState();
    render();
  }
});

dom.saveBudgets.addEventListener("click", () => {
  document.querySelectorAll("[data-budget-account]").forEach((input) => {
    state.budgets[input.dataset.budgetAccount] = Number(input.value) || 0;
  });
  saveState();
  render();
});

dom.exportLedger.addEventListener("click", () => {
  const rows = [["Date", "Account", "Description", "Debit", "Credit"], ...buildLedger().map((entry) => [entry.date, entry.accountName, entry.description, entry.debit, entry.credit])];
  downloadCsv("ledgerly-general-ledger.csv", rows);
});

dom.exportTrial.addEventListener("click", () => {
  const rows = [["Account", "Debit", "Credit"], ...buildTrialBalance(buildLedger()).map((row) => [row.accountName, row.debit, row.credit])];
  downloadCsv("ledgerly-trial-balance.csv", rows);
});

dom.exportVat.addEventListener("click", () => {
  const vat = buildVatReport();
  const rows = [
    ["Date", "Description", "Type", "Amount", "VAT"],
    ...vat.rows.map((row) => [row.date, row.description, row.type, row.amount, row.vat]),
    [],
    ["Output VAT", vat.outputTotal],
    ["Input VAT", vat.inputTotal],
    ["Estimated payable/refund", vat.outputTotal - vat.inputTotal],
  ];
  downloadCsv("ledgerly-vat-report.csv", rows);
});

dom.authTabs.forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode));
});

dom.authForm.addEventListener("submit", submitAuth);
dom.logout.addEventListener("click", logout);
dom.activatePlan.addEventListener("click", activateSubscription);
dom.settingsActivatePlan.addEventListener("click", activateSubscription);
dom.exportData.addEventListener("click", exportMyData);
dom.deleteAccount.addEventListener("click", deleteMyAccount);

setAuthMode("signup");
init();
