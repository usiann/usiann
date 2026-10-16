// =========================================================
// ♡ 商品列表共用程式 ♡
// 首頁和賣家頁都會用到：商品卡片、三種顯示方式、載入更多
// （要先載入 common.js 才能用）
// =========================================================

// 一次載入幾件商品
const PRODUCT_PAGE_SIZE = 24;


// 把上架時間變成「多久以前」，像 IG 那樣
// 例如：剛剛、15 分鐘前、5 小時前、3 天前、2 週前、1 個月前
// 滿 4 週算 1 個月；超過 6 週就直接顯示日期，例如 2026/8/1
function timeAgo(dateText) {
    const minutes = Math.floor((Date.now() - new Date(dateText).getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) {
        return "剛剛";
    }
    if (minutes < 60) {
        return minutes + " 分鐘前";
    }
    if (hours < 24) {
        return hours + " 小時前";
    }
    if (days < 7) {
        return days + " 天前";
    }
    if (days < 28) {
        return Math.floor(days / 7) + " 週前";
    }
    if (days < 42) {
        return "1 個月前";
    }
    return new Date(dateText).toLocaleDateString("zh-TW") + " ";
}


// 做出一張商品卡片（點了到商品頁，右上角有愛心）
// onFavoriteChange：收藏狀態改變後要做什麼（可以不給）
function makeCard(product, onFavoriteChange) {
    const card = document.createElement("div");
    card.className = "item-card" + (product.is_sold ? " sold" : "");

    // 卡片裡可以點的部分（照片和文字）
    const link = document.createElement("a");
    link.className = "item-link";
    link.href = "product.html?id=" + product.id;

    const imageBox = document.createElement("div");
    imageBox.className = "item-image";

    const img = document.createElement("img");
    img.src = getImageUrl(product.images[0]);
    img.alt = product.name;
    img.loading = "lazy";
    imageBox.appendChild(img);

    // 預購、代購：照片左上角放小標籤（現貨不放，看起來比較乾淨）
    if (product.sale_type && product.sale_type !== "in_stock") {
        const badge = document.createElement("span");
        badge.className = "sale-badge";
        badge.textContent = getSaleTypeName(product.sale_type);
        imageBox.appendChild(badge);
    }

    // 已售出：照片蓋上 SOLD OUT
    if (product.is_sold) {
        const overlay = document.createElement("div");
        overlay.className = "sold-overlay";
        overlay.setAttribute("role", "img");
        overlay.setAttribute("aria-label", "已售出");
        imageBox.appendChild(overlay);
    }

    const body = document.createElement("div");
    body.className = "item-body";

    const name = document.createElement("h3");
    name.className = "item-name";
    name.textContent = product.name;

    const meta = document.createElement("p");
    meta.className = "item-meta";
    meta.textContent = getCategoryName(product.category) + "・" + product.condition;

    const price = document.createElement("p");
    price.className = "item-price";
    price.textContent = "NT$ " + product.price.toLocaleString("zh-TW");

    // 以下兩行只有「條列」會顯示
    const details = document.createElement("p");
    details.className = "item-details";
    details.textContent = product.description || "賣家沒有填寫說明";

    const extra = document.createElement("p");
    extra.className = "item-extra";
    extra.textContent = timeAgo(product.created_at) + "上架";

    body.append(name, meta, price, details, extra);
    link.append(imageBox, body);

    // 愛心按鈕（放在連結外面，點愛心不會跳到商品頁）
    const favoriteButton = makeFavoriteButton(product.id, false, function(isFavorite) {
        if (onFavoriteChange) {
            onFavoriteChange(isFavorite, card);
        }
    });

    card.append(link, favoriteButton);
    return card;
}


// 顯示方式：中圖 / 條列 / 大圖（會記住買家上次的選擇）
// grid 是放商品卡片的地方
function setupViewSwitch(grid) {
    const storageKey = "usiann-view";
    const buttons = document.querySelectorAll(".view-switch button");

    function setView(view) {
        grid.className = "item-grid view-" + view;
        buttons.forEach(function(button) {
            button.classList.toggle("active", button.dataset.view === view);
        });
        try {
            localStorage.setItem(storageKey, view);
        } catch (error) {
            // 瀏覽器不讓存也沒關係，下次就用預設的中圖
        }
    }

    buttons.forEach(function(button) {
        button.addEventListener("click", function() {
            setView(button.dataset.view);
        });
    });

    let savedView = "medium";
    try {
        savedView = localStorage.getItem(storageKey) || "medium";
    } catch (error) {
        // 同上
    }
    setView(["medium", "list", "large"].includes(savedView) ? savedView : "medium");
}


// 分批讀商品的工具
// options 裡要放：
//   grid           放商品卡片的地方
//   loadMoreButton 「載入更多」按鈕
//   loading        「讀取中…」文字
//   noResults      找不到商品時顯示的文字
//   emptyText      找不到商品時要說什麼
//   applyFilters   加上篩選條件的函式（例如只看某個角色、某位賣家）
//   getSort        （可以不給）回傳排序方式：newest / price-asc / price-desc
//   onCount        （可以不給）拿到商品總數時要做什麼
// 用法：loader.load(true) 重新讀；按「載入更多」會自動讀下一批
function createProductLoader(options) {
    let loadedCount = 0;
    // 每次讀取都編一個號碼，只顯示最新那次的結果
    // （避免快速切換篩選時，舊的結果蓋掉新的）
    let latestRequest = 0;

    async function load(reset) {
        if (reset) {
            loadedCount = 0;
            options.grid.textContent = "";
            options.loading.hidden = false;
            options.noResults.hidden = true;
            options.loadMoreButton.hidden = true;
        }

        const thisRequest = ++latestRequest;
        options.loadMoreButton.disabled = true;
        options.loadMoreButton.textContent = "讀取中…";

        let query = db
            .from("products")
            .select("id, name, category, condition, price, description, images, is_sold, created_at, sale_type", { count: "exact" })
            .eq("status", "published");

        query = options.applyFilters(query);

        // 已售出的排在後面
        query = query.order("is_sold", { ascending: true });

        const sort = options.getSort ? options.getSort() : "newest";
        if (sort === "price-asc") {
            query = query.order("price", { ascending: true });
        } else if (sort === "price-desc") {
            query = query.order("price", { ascending: false });
        }
        query = query
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .range(loadedCount, loadedCount + PRODUCT_PAGE_SIZE - 1);

        const { data, error, count } = await query;

        // 讀取期間又換了條件，這次的結果就不要了
        if (thisRequest !== latestRequest) {
            return;
        }

        options.loading.hidden = true;
        options.loadMoreButton.disabled = false;
        options.loadMoreButton.textContent = "載入更多";

        if (error) {
            options.noResults.textContent = translateError(error);
            options.noResults.hidden = false;
            options.loadMoreButton.hidden = true;
            return;
        }

        data.forEach(function(product) {
            options.grid.appendChild(makeCard(product));
        });
        loadedCount += data.length;

        const total = count || 0;
        if (options.onCount) {
            options.onCount(total);
        }

        options.noResults.textContent = options.emptyText;
        options.noResults.hidden = total > 0;

        // 還有沒載入的商品，才顯示「載入更多」
        options.loadMoreButton.hidden = loadedCount >= total;
    }

    options.loadMoreButton.addEventListener("click", function() {
        load(false);
    });

    return { load: load };
}
