document.addEventListener("DOMContentLoaded", () => {
  const SPREADSHEET_ID = "1tdpM1QqVYRb9mFNOSG2Ef8GeKVDlfQ-WaHNTQVpmkzI";
  const GAS_URL = "https://script.google.com/macros/s/AKfycby5ZbpVmVG4TCgxoiybhCC-LixhB3s-bnBssP_AfxxZRq2IYQV7xGO4wuGp0QCLa7ctKg/exec";

  const SUMMARY_SHEET = "總團務狀態"; 
  const CUSTOMER_SHEET = "客人團務";
  const FAQ_SHEET = "FAQ&注意事項";
  const CHANNEL_SHEET = "特典&通路狀態";
  const ORDER_ITEMS_SHEET = "上架商品";

  const CHIP_COLOR_MAP = {
    "銀行轉帳-國泰": { bg: "#418167", text: "#bfe3c6" },
    "銀行轉帳-中信": { bg: "#a5494c", text: "#f1b7af" },
    "銀行轉帳-台新": { bg: "#fcd97c", text: "#856b36" },
    "銀行轉帳-Line Bank": { bg: "#4572a7", text: "#aacfea" },
    "銀行轉帳-玉山": { bg: "#e6cef2", text: "#7b5aa6" },
    "iPass money": { bg: "#8f8f8f", text: "#f2f2f2" },
    "國泰無卡": { bg: "#84d0b4", text: "#2f7f64" },
    "中信無卡": { bg: "#d5928b", text: "#8f2f32" },
    "台新無卡": { bg: "#ffe4a2", text: "#856b36" },
    "貨到付款": { bg: "#fbcaaf", text: "#8d522b" },
    "未匯款": { bg: "#fecfc8", text: "#a12524" },
    "已收到款項": { bg: "#d5ecc1", text: "#4f8f63" },
    "-": { bg: "#ffe4a2", text: "#856b36" },
    "待官方出貨": { bg: "#fecfc8", text: "#a12524" },
    "已抵達集運": { bg: "#ffe4a2", text: "#856b36" },
    "已申請配送回台": { bg: "#e6cef2", text: "#7b5aa6" },
    "📦可下單": { bg: "#c1e1f1", text: "#548ac1" },
    "可下單": { bg: "#c1e1f1", text: "#548ac1" },
    "✅CC出貨完畢": { bg: "#fbcaaf", text: "#8d522b" },
    "CC出貨完畢": { bg: "#fbcaaf", text: "#8d522b" },
    "團務完成": { bg: "#d5ecc1", text: "#4f8f63" }
  };

  const FAQ_COLORS = [
    { bg: "#f7e7d7", text: "#5b4634" },
    { bg: "#e3f0fb", text: "#345e7b" },
    { bg: "#e7f4ea", text: "#2f6b3d" },
    { bg: "#efe7fb", text: "#5a3a8b" },
    { bg: "#fde7e7", text: "#8b2f2f" }
  ];

  function findVal(row, options, fallbackIdx) {
    const keys = Object.keys(row);
    for (let opt of options) {
      const match = keys.find(k => k.trim().toLowerCase() === opt.toLowerCase());
      if (match && row[match]) return String(row[match]).trim();
    }
    return row[`col_${fallbackIdx}`] ? String(row[`col_${fallbackIdx}`]).trim() : "";
  }

  async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const json = JSON.parse(jsonStr);
      const cols = json.table.cols.map((c, i) => (c.label && c.label.trim()) ? c.label.trim() : `col_${i}`);
      return json.table.rows.map(r => {
        const obj = {};
        r.c.forEach((cell, i) => {
          const key = cols[i];
          if (!cell) { obj[key] = ""; } 
          else {
            const val = (cell.f !== undefined && cell.f !== null && cell.f !== "") ? cell.f : cell.v;
            obj[key] = (val !== null && val !== undefined) ? String(val) : "";
          }
        });
        return obj;
      });
    } catch (e) { return []; }
  }

  const menuToggle = document.getElementById("menu-toggle");
  const sideNav = document.getElementById("side-nav");
  const menuOverlay = document.getElementById("menu-overlay");
  function toggleMenu() {
    menuToggle.classList.toggle("open");
    sideNav.classList.toggle("open");
    menuOverlay.classList.toggle("show");
  }
  menuToggle.onclick = toggleMenu;
  menuOverlay.onclick = toggleMenu;

  function renderChip(text) {
    const t = String(text || ""); if (!t.trim()) return "";
    const norm = t.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "").toLowerCase();
    let color = null;
    for (const [k, v] of Object.entries(CHIP_COLOR_MAP)) {
      if (k.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "").toLowerCase() === norm) { color = v; break; }
    }
    return color ? `<span class="chip" style="background:${color.bg}; color:${color.text};">${t}</span>` : `<span class="chip">${t}</span>`;
  }

  let customerCache = null;
  async function searchCustomer(name) {
    const resList = document.getElementById("result-list"); resList.innerHTML = "";
    if (!name.trim()) return;
    if (!customerCache) customerCache = await fetchSheet(CUSTOMER_SHEET);

    // 【修改核心邏輯】過濾掉狀態為空的列，只讀取你填過狀態的資料
    const matches = customerCache.filter(r => {
      const cName = findVal(r, ["客人姓名"], 0);
      const cStatus = findVal(r, ["團務狀態"], 4);
      return cName === name.trim() && cStatus !== "" && cStatus !== "團務完成";
    });

    if (!matches.length) { resList.innerHTML = '<div class="no-data">查無已核對之資料，若剛填單請待CC處理。</div>'; return; }
    let html = `<div class="table-wrapper"><table class="order-table"><thead><tr><th>團務名稱</th><th>付款</th><th>匯款</th><th>狀態</th><th>備註</th></tr></thead><tbody>`;
    matches.forEach(r => {
      html += `<tr><td>${findVal(r, ["團務名稱"], 1)}</td><td>${renderChip(findVal(r, ["付款方式"], 2))}</td><td>${renderChip(findVal(r, ["匯款狀態"], 3))}</td><td>${renderChip(findVal(r, ["團務狀態"], 4))}</td><td>${findVal(r, ["備註"], 5)}</td></tr>`;
    });
    resList.innerHTML = html + "</tbody></table></div>";
  }

  let summaryLoaded = false;
  async function loadSummary() {
    const container = document.getElementById("summary-list");
    container.innerHTML = '<div class="small">讀取中…</div>';
    const data = await fetchSheet(SUMMARY_SHEET);
    if (!data.length) { container.innerHTML = '<div class="no-data">目前無資料</div>'; return; }
    const grouped = {};
    data.forEach(row => {
      const item = findVal(row, ["ITEM"], 0);
      const status = findVal(row, ["Activity type"], 1);
      if (!item || !status || status === "全數出貨完畢" || item === "ITEM") return;
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push({ item, note: findVal(row, ["Notes"], 2), url: findVal(row, ["表單網址"], 3) });
    });
    container.innerHTML = "";
    Object.keys(grouped).forEach(status => {
      const card = document.createElement("div"); card.className = "card";
      let html = `<div class="status">${status}</div>`;
      grouped[status].forEach((e, i) => {
        html += `${i>0 ? '<hr class="sub-sep">' : ''}<p><span class="label">名稱 ： </span>${e.item}</p>`;
        if (e.note) html += `<p><span class="label">備註 ： </span>${e.note.replace(/\n/g,"<br>")}</p>`;
        if (e.url) html += `<p><a class="summary-link" href="${e.url}" target="_blank">👉 查看表單網址</a></p>`;
      });
      card.innerHTML = html; container.appendChild(card);
    });
    summaryLoaded = true;
  }

  let faqLoaded = false;
  async function loadFAQ() {
    const container = document.getElementById("faq-list");
    container.innerHTML = "讀取中...";
    const data = await fetchSheet(FAQ_SHEET);
    const grouped = {};
    const order = [];
    data.forEach(r => {
      const cat = findVal(r, ["分類"], 0) || "常見問題";
      const q = findVal(r, ["問題"], 1);
      const a = findVal(r, ["答案"], 2);
      if (!q || cat === "分類") return;
      if (!grouped[cat]) { grouped[cat] = []; order.push(cat); }
      grouped[cat].push({ q, a });
    });
    container.innerHTML = "";
    order.forEach((cat, index) => {
      const color = FAQ_COLORS[index % FAQ_COLORS.length];
      let html = `<div class="faq-category-card"><div class="faq-category-header" style="background:${color.bg}; color:${color.text};">${cat}</div>`;
      grouped[cat].forEach(item => {
        html += `<details class="faq-item"><summary><span>${item.q}</span> <span class="faq-arrow">▸</span></summary><div class="faq-answer">${item.a.replace(/\n/g,"<br>")}</div></details>`;
      });
      container.innerHTML += html + `</div>`;
    });
    faqLoaded = true;
  }

  let channelLoaded = false;
  async function loadChannelStatus() {
    const container = document.getElementById("channel-list");
    container.innerHTML = '<div class="small">讀取中…</div>';
    const data = await fetchSheet(CHANNEL_SHEET);
    if (!data.length || data.length < 2) { container.innerHTML = "無資料"; return; }

    const headers = Object.keys(data[0] || {});
    const channelKey = headers[0];
    const versionKeys = headers.slice(1);
    const versionRow = data[0]; 
    const rows = data.slice(1).filter(r => String(r[channelKey] || "").trim());
    const activeVersions = versionKeys.filter(vKey => rows.some(r => String(r[vKey] || "").trim()));

    function getChannelChipCls(text) {
      const t = String(text || "");
      if (t.includes("有特典")) return "chip-green";
      if (t.includes("無特典")) return "chip-red";
      if (t.includes("品切")) return "chip-purple";
      if (t.includes("斷貨")) return "chip-gray";
      return "chip-blue";
    }

    let html = `<div class="table-wrapper"><table class="order-table channel-table"><thead><tr><th>通路</th>${activeVersions.map(vKey => `<th>${String(versionRow[vKey]||"").trim()}</th>`).join("")}</tr></thead><tbody>`;
    rows.forEach(r => {
      html += `<tr><td><span class="label">${String(r[channelKey]||"").trim()}</span></td>`;
      activeVersions.forEach(vKey => {
        const val = String(r[vKey]||"").trim();
        html += `<td>${val ? `<span class="chip ${getChannelChipCls(val)}">${val}</span>` : ""}</td>`;
      });
      html += `</tr>`;
    });
    container.innerHTML = html + "</tbody></table></div>";
    channelLoaded = true;
  }

  let orderProducts = [];
  let cart = [];
  let campaignGroups = {}; 
  async function initOrderPage() {
    if (orderProducts.length) return;
    orderProducts = await fetchSheet(ORDER_ITEMS_SHEET);
    const campaigns = [...new Set(orderProducts.map(p => findVal(p, ["團務名稱"], 0)))].filter(v => v && v !== "團務名稱");
    const select = document.getElementById("campaign-select");
    select.innerHTML = '<option value="">-- 請選擇團務 --</option>';
    campaigns.forEach(c => { select.innerHTML += `<option value="${c}">${c}</option>`; });
    select.onchange = (e) => renderOrderProducts(e.target.value);
  }

  function renderOrderProducts(camp) {
    const container = document.getElementById("order-product-list");
    if (!camp) { container.style.display = "none"; return; }
    container.style.display = "grid"; container.innerHTML = "";
    campaignGroups = {};
    orderProducts.filter(p => findVal(p, ["團務名稱"], 0) === camp).forEach(p => {
      const cat = findVal(p, ["分類"], 1);
      if (!campaignGroups[cat]) campaignGroups[cat] = { camp, name: cat, price: findVal(p, ["單價"], 3), img: findVal(p, ["照片網址"], 4), variants: [] };
      campaignGroups[cat].variants.push(findVal(p, ["款式"], 2));
    });
    Object.keys(campaignGroups).forEach(cat => {
      const d = campaignGroups[cat];
      const card = document.createElement("div"); card.className = "product-card";
      card.onclick = () => openProductModal(cat);
      card.innerHTML = `<img src="${d.img||''}" loading="lazy"><div class="p-category">${cat}</div><div class="p-price">$${d.price}</div><div class="small" style="color:#76a5c2; margin-top:5px;">點擊選款式</div>`;
      container.appendChild(card);
    });
  }

  window.openProductModal = (catName) => {
    const d = campaignGroups[catName];
    document.getElementById("detail-img-container").innerHTML = `<img src="${d.img||''}" style="width:100%; border-radius:15px;">`;
    document.getElementById("detail-title").textContent = d.name;
    document.getElementById("detail-price").textContent = `$${d.price}`;
    document.getElementById("detail-qty").value = 1;
    const sel = document.getElementById("detail-variant-select");
    sel.innerHTML = d.variants.map(v => `<option value="${v}">${v}</option>`).join("");
    document.getElementById("add-to-cart-btn").onclick = () => {
      const variant = sel.value; const qty = parseInt(document.getElementById("detail-qty").value);
      const existing = cart.find(i => i.camp === d.camp && i.cat === d.name && i.variant === variant);
      if (existing) { existing.qty += qty; } else { cart.push({ camp: d.camp, cat: d.name, variant, price: d.price, qty }); }
      updateCartUI(); closeProductModal();
    };
    document.getElementById("product-detail-modal").style.display = "block";
  };
  window.closeProductModal = () => { document.getElementById("product-detail-modal").style.display = "none"; };
  window.changeDetailQty = (v) => { let i = document.getElementById("detail-qty"); i.value = Math.max(1, parseInt(i.value) + v); };

  function updateCartUI() {
    document.getElementById("cart-count").textContent = cart.reduce((acc, i) => acc + i.qty, 0);
    let total = 0;
    document.getElementById("cart-items-container").innerHTML = cart.map((item, idx) => {
      const sub = Number(item.price) * item.qty; total += sub;
      return `<div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:10px;">
        <div><b>${item.cat}</b><br><span class="small">${item.variant} x ${item.qty}</span></div>
        <div style="font-weight:700;">$${sub} <span onclick="removeFromCart(${idx})" style="color:red; cursor:pointer; margin-left:10px;">✕</span></div>
      </div>`;
    }).join("");
    document.getElementById("cart-total-amount").textContent = total;
  }
  window.removeFromCart = (idx) => { cart.splice(idx, 1); updateCartUI(); };
  window.toggleCartModal = () => { const m = document.getElementById("cart-modal"); m.style.display = m.style.display==='block'?'none':'block'; };

  document.getElementById("order-submit-form").onsubmit = async function(e) {
    e.preventDefault(); 
    if(!cart.length) return alert("購物車是空的唷！");

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "處理中...";

    const orderData = {
      campaign: cart[0].camp,
      name: document.getElementById("form-order-name").value,
      lineName: document.getElementById("form-order-line").value,
      phone: document.getElementById("form-order-phone").value,
      email: document.getElementById("form-order-email").value,
      sortPreference: document.getElementById("form-order-sort").value || "無",
      total: document.getElementById("cart-total-amount").textContent,
      cartArray: cart 
    };

    try {
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify(orderData)
      });

      alert("訂單已成功送出！🧸\n資料已同步至後台，請前往 LINE 收取自動發送的資訊。");

      cart = [];
      updateCartUI();
      toggleCartModal();
      this.reset(); 

    } catch (error) {
      alert("送出失敗，請檢查網路或部署權限設定！");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "確認下單";
    }
  };

  function switchPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === id));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.page === id));
    if (id === "summary-page" && !summaryLoaded) loadSummary();
    if (id === "faq-page" && !faqLoaded) loadFAQ();
    if (id === "order-page") initOrderPage();
    if (id === "channel-page" && !channelLoaded) loadChannelStatus();
    if (sideNav.classList.contains("open")) toggleMenu();
  }
  document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => switchPage(b.dataset.page));
  document.getElementById("search-form").onsubmit = (e) => { e.preventDefault(); searchCustomer(document.getElementById("customer-name").value); };

  async function initChannelTabVisibility() {
    try {
      const data = await fetchSheet(CHANNEL_SHEET);
      if (data.length > 1) document.getElementById("channel-tab").style.display = "";
    } catch(e) {}
  }
  initChannelTabVisibility();
});
