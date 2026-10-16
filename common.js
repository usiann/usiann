// =========================================================
// ♡ 共用程式 ♡
// 每一頁都會用到的東西放在這裡：連接 Supabase、會員選單、錯誤訊息翻譯
// =========================================================

// Supabase 連線設定
// 這兩個本來就是公開的，可以放在網頁裡
// ⚠️ 絕對不要把 secret key 或資料庫密碼放進這裡
const SUPABASE_URL = "https://bjazzbwituoyosmekgjw.supabase.co";
const SUPABASE_KEY = "sb_publishable_iD3n4Co3V-Y0a4EsurGdFA_VD73lNd6";

// db 就是我們用來跟 Supabase 溝通的工具
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 網站所在的位置，例如 https://usiann.github.io/usiann/
// 寄驗證信、Google 登入完成後，要跳回網站時會用到
const SITE_BASE = new URL(".", window.location.href).href;

// 新手賣家要通過幾件商品審核才能升級
// ⚠️ 這個數字要跟資料庫裡的設定一樣，改的時候兩邊都要改
const TRUSTED_APPROVALS_NEEDED = 2;

// 角色分類
// ⚠️ 要新增角色時，資料庫裡的設定也要一起改，請找我幫忙
const CATEGORIES = [
    { id: "hello-kitty", name: "Hello Kitty", icon: "🎀" },
    { id: "pompompurin", name: "布丁狗", icon: "🍮" },
    { id: "cinnamoroll", name: "大耳狗", icon: "☁️" },
    { id: "usahana", name: "花小兔", icon: "🌸" },
    { id: "kuromi", name: "酷洛米", icon: "💜" }
];

// 商品狀況（要跟資料庫裡的設定一樣）
const CONDITIONS = ["全新", "近全新", "保存良好", "有使用痕跡", "有明顯瑕疵"];

// Web3Forms 的通行碼（Access Key）
// 填了之後，「聯絡我們」和「檢舉」都會寄一份通知到 usiann.contact@gmail.com
// 這組通行碼可以公開，放在網頁裡沒關係
// 要換通行碼時，改下面雙引號裡的內容
const WEB3FORMS_KEY = "2bb08e17-b8eb-48b1-aef8-ff6fa2ee7e3d";

// 寄通知信到管理員的 Gmail
// fields 是信件內容，例如 { subject: "標題", "商品": "花小兔吊飾" }
// 寄信失敗不會影響網站（資料庫裡一樣有紀錄）
async function sendEmailNotice(fields) {
    if (!WEB3FORMS_KEY) {
        return;
    }
    try {
        await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(Object.assign(
                { access_key: WEB3FORMS_KEY, from_name: "usiann 網站通知" },
                fields
            ))
        });
    } catch (error) {
        // 寄信失敗不用處理，管理頁一樣看得到
    }
}

// 商品照片放在 Supabase 的哪個圖片空間
const IMAGE_BUCKET = "product-images";

// 把照片在圖片空間裡的位置，轉成可以顯示的網址
function getImageUrl(path) {
    return db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// 用角色代號找角色名稱，例如 "usahana" → "花小兔"
function getCategoryName(id) {
    const category = CATEGORIES.find(function(c) { return c.id === id; });
    return category ? category.name : id;
}


// 取得現在登入的會員，沒有登入就回傳 null
async function getCurrentUser() {
    const { data } = await db.auth.getSession();
    return data.session ? data.session.user : null;
}

// 這一頁一定要登入才能用：沒登入就帶去登入頁
async function requireLogin() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = "login.html";
        return null;
    }
    return user;
}

// 取得自己的會員資料（暱稱、等級、通過審核數量等）
async function getMyProfile() {
    const { data, error } = await db.rpc("my_profile");
    if (error || !data || data.length === 0) {
        return null;
    }
    return data[0];
}


// 把 Supabase 的英文錯誤訊息翻成中文
function translateError(error) {
    const message = (error && error.message) || "";

    if (message.includes("Invalid login credentials")) {
        return "email 或密碼不正確";
    }
    if (message.includes("Email not confirmed")) {
        return "這個 email 還沒有驗證，請到信箱點驗證信裡的連結";
    }
    if (message.includes("User already registered")) {
        return "這個 email 已經註冊過了，請直接登入";
    }
    if (message.includes("Password should be")) {
        return "密碼太簡單了，請至少 8 個字";
    }
    if (message.includes("rate limit") || message.includes("security purposes")) {
        return "操作太頻繁了，請稍等一下再試";
    }
    if (message.includes("Unable to validate email") || message.includes("invalid format")) {
        return "email 格式不正確";
    }
    if (message.includes("not authorized")) {
        return "目前網站還在測試中，暫時不開放這個 email 註冊";
    }
    if (message.includes("provider is not enabled")) {
        return "Google 登入還沒開放，請先用 email 登入";
    }
    // 資料庫的檢查沒通過
    if (message.includes("products_link_check")) {
        return "賣貨便連結不正確，請貼上 https://myship.7-11.com.tw/ 開頭的網址";
    }
    if (message.includes("products_images_check")) {
        return "照片要 1 到 5 張";
    }
    if (message.includes("products_name_check")) {
        return "商品名稱要 1 到 50 個字";
    }
    if (message.includes("products_price_check")) {
        return "價格要在 1 到 1,000,000 之間";
    }
    if (message.includes("products_description_check")) {
        return "商品說明最多 1000 個字";
    }
    if (message.includes("profiles_nickname_check")) {
        return "暱稱要 1 到 20 個字";
    }
    if (message.includes("contact_messages_email_check")) {
        return "email 格式不正確";
    }
    if (message.includes("contact_messages_subject_check")) {
        return "標題要 1 到 100 個字";
    }
    if (message.includes("contact_messages_message_check")) {
        return "內容要 1 到 2000 個字";
    }
    if (message.includes("row-level security")) {
        return "你沒有權限做這件事，請重新登入再試一次";
    }
    if (message.includes("maximum allowed size") || message.includes("too large")) {
        return "照片檔案太大了，請換一張試試";
    }
    if (message.includes("mime type")) {
        return "照片格式不支援，請用 JPG 或 PNG";
    }
    if (message.includes("Failed to fetch")) {
        return "連線失敗，請檢查網路後再試一次";
    }

    // 沒有翻譯到的訊息（例如資料庫寫的中文錯誤）直接顯示
    return message || "發生錯誤，請稍後再試";
}


// 頁面最上面的會員選單
// 沒登入：顯示「登入 / 註冊」
// 已登入：顯示「嗨，暱稱 ♡」和「我的帳號」
async function renderUserMenu() {
    const menu = document.getElementById("user-menu");
    if (!menu) {
        return;
    }

    const user = await getCurrentUser();
    menu.textContent = "";

    if (!user) {
        const loginLink = document.createElement("a");
        loginLink.href = "login.html";
        loginLink.textContent = "登入 / 註冊";
        menu.appendChild(loginLink);
        return;
    }

    const profile = await getMyProfile();

    const greeting = document.createElement("span");
    greeting.textContent =
        "嗨，" + (profile ? profile.nickname : "新朋友") + " ♡";

    const sellLink = document.createElement("a");
    sellLink.href = "sell.html";
    sellLink.textContent = "上架商品";

    const myProductsLink = document.createElement("a");
    myProductsLink.href = "my-products.html";
    myProductsLink.textContent = "我的商品";

    const favoritesLink = document.createElement("a");
    favoritesLink.href = "favorites.html";
    favoritesLink.textContent = "我的收藏";

    const accountLink = document.createElement("a");
    accountLink.href = "account.html";
    accountLink.textContent = "我的帳號";

    menu.append(greeting, sellLink, myProductsLink, favoritesLink, accountLink);

    // 管理員才看得到「管理頁」
    if (profile && profile.is_admin) {
        const adminLink = document.createElement("a");
        adminLink.href = "admin.html";
        adminLink.textContent = "管理頁";
        menu.appendChild(adminLink);
    }
}

renderUserMenu();


// 每一頁的頁尾自動加上「聯絡我們」（用新分頁打開）
function addContactLink() {
    const footer = document.querySelector("footer");
    if (!footer || window.location.pathname.endsWith("contact.html")) {
        return;
    }

    const line = document.createElement("p");
    const link = document.createElement("a");
    link.href = "contact.html";
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "footer-link";
    link.textContent = "聯絡我們";
    line.appendChild(link);

    // 放在免責聲明的上面（沒有免責聲明就放最後）
    footer.insertBefore(line, footer.querySelector(".disclaimer"));
}

addContactLink();


// =========================================================
// 收藏（愛心）
// =========================================================

// 我收藏了哪些商品（只讀一次，整頁共用）
let favoriteIdsPromise = null;

function loadMyFavoriteIds() {
    if (!favoriteIdsPromise) {
        favoriteIdsPromise = (async function() {
            const ids = new Set();
            const user = await getCurrentUser();
            if (!user) {
                return ids;
            }
            const { data } = await db.from("favorites").select("product_id");
            (data || []).forEach(function(row) {
                ids.add(row.product_id);
            });
            return ids;
        })();
    }
    return favoriteIdsPromise;
}

// 收藏或取消收藏
// 回傳 true = 現在是收藏的、false = 取消了、null = 沒登入
async function toggleFavorite(productId) {
    const user = await getCurrentUser();
    if (!user) {
        if (window.confirm("登入後就可以收藏喔 ♡\n要現在去登入嗎？")) {
            window.location.href = "login.html";
        }
        return null;
    }

    const ids = await loadMyFavoriteIds();

    if (ids.has(productId)) {
        const { error } = await db
            .from("favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("product_id", productId);
        if (error) {
            throw error;
        }
        ids.delete(productId);
        return false;
    }

    const { error } = await db
        .from("favorites")
        .insert({ product_id: productId });
    // 23505 = 已經收藏過了，當作成功
    if (error && error.code !== "23505") {
        throw error;
    }
    ids.add(productId);
    return true;
}

// 做出一個愛心按鈕
// withText = true：顯示「♡ 加入收藏」（商品頁用）
// withText = false：只顯示愛心（商品卡片用）
// onChange：收藏狀態改變後要做什麼（可以不給）
function makeFavoriteButton(productId, withText, onChange) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = withText ? "favorite-button with-text" : "favorite-button";

    function paint(isFavorite) {
        button.classList.toggle("on", isFavorite);
        button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
        button.setAttribute("aria-label", isFavorite ? "取消收藏" : "加入收藏");
        if (withText) {
            button.textContent = isFavorite ? "♥ 已收藏" : "♡ 加入收藏";
        } else {
            button.textContent = isFavorite ? "♥" : "♡";
        }
    }

    paint(false);
    loadMyFavoriteIds().then(function(ids) {
        paint(ids.has(productId));
    });

    button.addEventListener("click", async function(event) {
        // 不要讓卡片的連結被點到
        event.preventDefault();
        event.stopPropagation();

        button.disabled = true;
        try {
            const result = await toggleFavorite(productId);
            if (result !== null) {
                paint(result);
                if (onChange) {
                    onChange(result);
                }
            }
        } catch (error) {
            window.alert(translateError(error));
        }
        button.disabled = false;
    });

    return button;
}


// 在表單下方顯示訊息
// type 是 "error"（錯誤，粉紅色）或 "success"（成功，綠色）
function showMessage(element, text, type) {
    element.textContent = text;
    element.className = "form-message " + type;
    element.hidden = false;
}
