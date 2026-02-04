document.addEventListener("DOMContentLoaded", () => {

// ==== 設定你的試算表 ====
const SPREADSHEET_ID = "1tdpM1QqVYRb9mFNOSG2Ef8GeKVDlfQ-WaHNTQVpmkzI";
const SUMMARY_SHEET = "總團務狀態";
const CUSTOMER_SHEET = "客人團務";
const FAQ_SHEET = "FAQ&注意事項";
const CHANNEL_SHEET = "特典&通路狀態"; // ✅ 左欄通路、第一列版本名，A1可空白
/* ===============================
   ✅ CC Chip 顏色設定（集中管理）
   =============================== */
const CHIP_COLOR_MAP = {
  // 付款方式
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

  // 匯款狀態
  "未匯款": { bg: "#fecfc8", text: "#a12524" },
  "已收到款項": { bg: "#d5ecc1", text: "#4f8f63" },
  "-": { bg: "#ffe4a2", text: "#856b36" },

  // 團務狀態
  "待官方出貨": { bg: "#fecfc8", text: "#a12524" },
  "已抵達集運": { bg: "#ffe4a2", text: "#856b36" },
  "已申請配送回台": { bg: "#e6cef2", text: "#7b5aa6" },
  "📦可下單": { bg: "#c1e1f1", text: "#548ac1" },
  "可下單": { bg: "#c1e1f1", text: "#548ac1" },
  "✅CC出貨完畢": { bg: "#fbcaaf", text: "#8d522b" },
  "CC出貨完畢": { bg: "#fbcaaf", text: "#8d522b" },
  "團務完成": { bg: "#d5ecc1", text: "#4f8f63" }
};

// 共用：讀取 Google Sheet (GViz) —— 強制轉字串，避免 0 之類被吃掉
async function fetchSheet(sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;

  const res = await fetch(url);
  const text = await res.text();

  const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonStr);

  const cols = json.table.cols.map((c, idx) =>
    (c.label && c.label.trim()) ? c.label.trim() : `col_${idx}`
  );

  return json.table.rows.map(r => {
    const obj = {};
    r.c.forEach((cell, i) => {
      const key = cols[i];
      if (!cell) {
        obj[key] = "";
      } else {
        const raw = (cell.f !== undefined && cell.f !== null && cell.f !== "")
          ? cell.f
          : cell.v;
        obj[key] = (raw !== null && raw !== undefined) ? String(raw) : "";
      }
    });
    return obj;
  });
}

// ===== 總團務進度 =====
let summaryLoaded = false;

async function loadSummary() {
  const container = document.getElementById("summary-list");
  container.innerHTML = '<div class="small">讀取中…</div>';

  try {
    const data = await fetchSheet(SUMMARY_SHEET);

    if (!data || data.length === 0) {
      container.innerHTML =
        '<div class="no-data">「總團務進度」目前沒有任何資料。</div>';
      return;
    }

    const grouped = {};

    data.forEach(row => {
      const rawItem =
        row["ITEM"] ||
        row["item"] ||
        row["團務名稱"] ||
        row["col_0"] ||
        "";
      const item = String(rawItem).trim();
      if (!item || ["ITEM", "item", "團務名稱"].includes(item)) return;

      const rawStatus =
        row["Activity type"] ??
        row["Activity type "] ??
        row["活動狀態"] ??
        row["col_1"] ??
        "";
      const status = String(rawStatus).trim();
      if (!status) return;
      if (status === "全數出貨完畢") return;

      const rawNote =
        row["Notes"] ||
        row["備註"] ||
        row["col_2"] ||
        "";
      const note = String(rawNote).trim();

      const rawUrl =
        row["表單網址"] ||
        row["表單連結"] ||
        row["col_3"] ||
        "";
      const formUrl = String(rawUrl).trim();

      if (!grouped[status]) grouped[status] = [];
      grouped[status].push({ item, note, formUrl });
    });

    const preferredOrder = [
      "持續接單中",
      "待官方出貨",
      "官方已出貨",
      "已申請配送回台",
      "CC出貨中"
    ];

    const statusList = Object.keys(grouped).sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);

      if (ia === -1 && ib === -1) {
        return a.localeCompare(b, "zh-Hant");
      }
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    if (!statusList.length) {
      container.innerHTML =
        '<div class="no-data">目前沒有進行中的團務，或全部都已全數出貨完畢 🎉</div>';
      return;
    }

    container.innerHTML = "";

    statusList.forEach(status => {
      const card = document.createElement("div");
      card.className = "card";

      let html = `<div class="status">${status}</div>`;

      grouped[status].forEach((entry, idx) => {
        html += `
            ${idx > 0 ? '<hr class="sub-sep" />' : ''}
            <p><span class="label">團務名稱：</span>${entry.item}</p>
          `;
        if (entry.note) {
          const noteHtml = entry.note.replace(/\n/g, "<br>");
          html += `<p><span class="label">備註：</span>${noteHtml}</p>`;
        }
        if (entry.formUrl) {
          html += `<p><span class="label">填單連結：</span><a class="summary-link" href="${entry.formUrl}" target="_blank" rel="noopener noreferrer">查看表單</a></p>`;
        }
      });

      card.innerHTML = html;
      container.appendChild(card);
    });

    summaryLoaded = true;
  } catch (err) {
    console.error(err);
    container.innerHTML =
      '<div class="no-data">載入總團務進度時發生錯誤，請稍後再試。</div>';
  }
}

// ===== 客人查詢 =====
let customerCache = null;
// ===== 客人查詢：chip 顯示規則（只影響訂單查詢）=====
function renderCustomerChip(text) {
  const t = String(text || "");
  if (!t.trim()) return "";

  // 🔥 關鍵：完全忽略空白與大小寫，只看「字母」
  const normalized = t.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "").toLowerCase();

  let color = null;
  for (const [k, v] of Object.entries(CHIP_COLOR_MAP)) {
    const kNorm = k.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "").toLowerCase();
    if (kNorm === normalized) {
      color = v;
      break;
    }
  }

  if (color) {
    return '<span class="chip" style="background:' + color.bg +
      '; color:' + color.text + ';">' + t + '</span>';
  }

  return '<span class="chip chip-default">' + t + '</span>';
}


async function searchCustomer(name) {
  const resultList = document.getElementById("result-list");
  resultList.innerHTML = "";

  if (!name.trim()) {
    resultList.innerHTML =
      '<div class="no-data">請先輸入本名再查詢唷～</div>';
    return;
  }

  try {
    if (!customerCache) {
      customerCache = await fetchSheet(CUSTOMER_SHEET);
    }

    const matches = customerCache.filter(
      row => String(row["客人姓名"]).trim() === name.trim()
    );

    if (!matches.length) {
      resultList.innerHTML =
        '<div class="no-data">查無資料，請確認姓名是否與填單時相同。</div>';
      return;
    }

    // ✅ 過濾掉「團務完成」：不顯示給客人
    const visibleMatches = matches.filter(row => {
      const status = String(row["團務狀態"] ?? "").trim();
      return status !== "團務完成";
    });

    // ✅ 就算全部都完成被隱藏，也一樣顯示「查無資料...」
    if (!visibleMatches.length) {
      resultList.innerHTML =
        '<div class="no-data">查無資料，請確認姓名是否與填單時相同。</div>';
      return;
    }

    const safe = (row, key) => (row[key] ?? "");

    let html = `
    <div class="table-wrapper">
      <table class="order-table">
        <thead>
          <tr>
            <th>團務名稱</th>
            <th>付款方式</th>
            <th>匯款狀態</th>
            <th>團務狀態</th>
            <th>備註</th>
          </tr>
        </thead>
        <tbody>
          `;

    visibleMatches.forEach(row => {
      html += `
          <tr>
            <td>${safe(row, "團務名稱")}</td>
            <td>${renderCustomerChip(safe(row, "付款方式"))}</td>
            <td>${renderCustomerChip(safe(row, "匯款狀態"))}</td>
            <td>${renderCustomerChip(safe(row, "團務狀態"))}</td>
            <td>${safe(row, "備註")}</td>
          </tr>
        `;
    });


    html += `
        </tbody>
      </table>
    </div>
    `;

    resultList.innerHTML = html;
  } catch (err) {
    console.error(err);
    resultList.innerHTML =
      '<div class="no-data">查詢時發生錯誤，請稍後再試或私訊CC </div>';
  }
}

// ===== FAQ：從 FAQ 工作表讀取、依分類顯示 =====
let faqLoaded = false;

const FAQ_CATEGORY_COLORS = {
  "下單與訂購": "#f7e7d7",
  "匯款與帳務": "#fce2dd",
  "二補相關": "#e3f2da",
  "進度相關": "#e3f0fb",
  "配送相關": "#f4e9ff",
  "開箱/售後": "#fff5d9",
  "其他常見問題": "#e9edf1"
};

function nl2br(text) {
  return String(text).replace(/\n/g, "<br>");
}

async function loadFAQ() {
  const container = document.getElementById("faq-list");
  container.innerHTML = '<div class="small">讀取中…</div>';

  try {
    const data = await fetchSheet(FAQ_SHEET);
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="no-data">目前尚未設定 FAQ 資料。</div>';
      return;
    }

    const grouped = {};
    const order = [];

    data.forEach(row => {
      const cat = String(
        row["分類"] || row["Category"] || row["col_0"] || ""
      ).trim();
      const q = String(
        row["問題"] || row["Question"] || row["col_1"] || ""
      ).trim();
      const a = String(
        row["答案"] || row["答"] || row["回覆"] || row["Answer"] || row["col_2"] || ""
      ).trim();

      if (!cat || cat === "分類" || cat === "ITEM" || cat === "item") return;
      if (!q) return;

      if (!grouped[cat]) {
        grouped[cat] = [];
        order.push(cat);
      }
      grouped[cat].push({ q, a });
    });

    if (!order.length) {
      container.innerHTML = '<div class="no-data">FAQ 尚未填寫內容。</div>';
      return;
    }

    let html = "";

    order.forEach(category => {
      const items = grouped[category];
      const bg = FAQ_CATEGORY_COLORS[category] || "#f1f3f5";

      html += `<div class="faq-category-card">`;
      html += `<div class="faq-category-header" style="background:${bg};">
          ${category}
        </div>`;

      items.forEach(item => {
        html += `
            <details class="faq-item">
              <summary>
                <span>${item.q}</span>
                <span class="faq-arrow">▸</span>
              </summary>
              <div class="faq-answer">${nl2br(item.a)}</div>
            </details>
          `;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
    faqLoaded = true;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-data">載入 FAQ 時發生錯誤，請稍後再試。</div>';
  }
}

// ===== 通路/特典狀態 =====
let channelLoaded = false;

function getChipClass(text) {
  const t = String(text || "").trim();
  if (!t) return "chip-gray";

  if (t.includes("有特典")) return "chip-green";
  if (t.includes("無特典")) return "chip-red";
  if (t.includes("品切")) return "chip-purple";
  if (t.includes("斷貨")) return "chip-gray";

  return "chip-blue";
}

function renderChip(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const cls = getChipClass(t);
  return `<span class="chip ${cls}">${t}</span>`;
}

/**
 * ✅ 分頁顯示規則（你要的）
 * - 工作表第一列 = 版本名稱列（A1 可以空白）
 * - 第二列起 = 通路資料列（A 欄通路）
 * - 只要存在「任一個版本欄」有填狀態，tab 才顯示
 */
async function initChannelTabVisibility() {
  try {
    const data = await fetchSheet(CHANNEL_SHEET);
    if (!data || data.length < 2) return;

    const headers = Object.keys(data[0] || {});
    if (!headers.length) return;

    const channelKey = headers[0];
    const versionKeys = headers.slice(1);

    const rows = data.slice(1).filter(r => String(r[channelKey] || "").trim());

    // ✅ 必須有「某一個版本欄位」至少有一格有內容，才顯示 tab
    const hasAnyStatus = versionKeys.some(vKey =>
      rows.some(r => String(r[vKey] || "").trim())
    );

    if (hasAnyStatus) {
      const tab = document.getElementById("channel-tab");
      if (tab) tab.style.display = "";
    }
  } catch (e) {
    console.error("initChannelTabVisibility error:", e);
  }
}

/**
 * ✅ 顯示規則（你要的）
 * - 橫排顯示：第一列的版本名稱
 * - 只顯示「有資料的版本欄」（整欄都空就不顯示）
 */
async function loadChannelStatus() {
  const container = document.getElementById("channel-list");
  container.innerHTML = '<div class="small">讀取中…</div>';

  try {
    const data = await fetchSheet(CHANNEL_SHEET);
    if (!data || data.length < 2) {
      container.innerHTML = '<div class="no-data">目前沒有公告通路/特典狀態。</div>';
      return;
    }

    const rawHeaders = Object.keys(data[0] || {});
    if (!rawHeaders.length) {
      container.innerHTML = '<div class="no-data">目前沒有公告通路/特典狀態。</div>';
      return;
    }

    const channelKey = rawHeaders[0];        // col_0（通路）
    const versionKeys = rawHeaders.slice(1);  // col_1 ~ col_n

    // 第一列 = 版本名稱列
    const versionRow = data[0];

    // 第二列起 = 通路資料列
    const rows = data.slice(1).filter(r => {
      const channel = String(r[channelKey] || "").trim();
      return !!channel;
    });

    if (!rows.length) {
      container.innerHTML = '<div class="no-data">目前沒有公告通路/特典狀態。</div>';
      return;
    }

    // 只顯示「至少有一格有資料」的版本欄
    const activeVersions = versionKeys.filter(vKey =>
      rows.some(r => String(r[vKey] || "").trim())
    );

    if (!activeVersions.length) {
      container.innerHTML = '<div class="no-data">目前沒有公告通路/特典狀態。</div>';
      return;
    }

    let html = `
      <div class="table-wrapper">
        <table class="order-table channel-table">
          <thead>
            <tr>
              <th>通路</th>
              ${activeVersions.map(vKey => {
      const name = String(versionRow[vKey] || "").trim();
      return `<th>${name || ""}</th>`;
    }).join("")}
            </tr>
          </thead>
          <tbody>
            `;

    rows.forEach(r => {
      html += `<tr>`;
      html += `<td><span class="label">${String(r[channelKey] || "").trim()}</span></td>`;

      activeVersions.forEach(vKey => {
        const val = String(r[vKey] || "").trim();
        html += `<td>${renderChip(val)}</td>`;
      });

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    </div>
    `;

    container.innerHTML = html;
    channelLoaded = true;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-data">載入通路/特典狀態時發生錯誤，請稍後再試。</div>';
  }
}

// ===== 分頁切換 =====
function switchPage(pageId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  if (pageId === "summary-page" && !summaryLoaded) {
    loadSummary();
  }
  if (pageId === "channel-page" && !channelLoaded) {
    loadChannelStatus();
  }
  if (pageId === "faq-page" && !faqLoaded) {
    loadFAQ();
  }
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    switchPage(btn.dataset.page);
  });
});

// 綁定查詢表單
document.getElementById("search-form")
  .addEventListener("submit", function(e) {
    e.preventDefault();
    const name = document.getElementById("customer-name").value;
    searchCustomer(name);
  });

// ✅ 初始化：有資料（且至少有一個版本有狀態）才顯示「通路/特典狀態」分頁
initChannelTabVisibility();
  });
