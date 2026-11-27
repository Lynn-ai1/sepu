# 色譜 sepu

Static, client-only approximate preview for two starter photo recipes. There is no backend and no account.

Open [`preview/index.html`](preview/index.html) in a browser.

This preview is an approximate algorithm. It is not iPhone Photos Adjust, and it does not claim the same result. 增豔 (Brilliance) and 陰影 (Shadows) are regional adjustments and are not applied to the picture. 自然飽和度 (Vibrance) is not implemented as ordinary saturation.

## 在本機打開

不需要安裝，也沒有伺服器。用瀏覽器打開 `preview/index.html`。

若瀏覽器不允許直接開啟本機腳本，在專案目錄執行：

```bash
python3 -m http.server 8765
```

然後打開 <http://127.0.0.1:8765/preview/>。

照片只在這台裝置的瀏覽器裡處理，不會上傳。

要直接看內建色塊，網址加上 `?sample=1`。要改看清冷人像，再加上 `?recipe=cool-portrait`。

## 這不是 iPhone 相簿

這份試色是近似算法，不是 iPhone「照片」的「調整」，也不會得到相同結果。

- 增豔和陰影是區域調整。預覽只顯示配方數字，不把它們算進畫面。
- 自然飽和度按顏色濃淡和膚色分開處理，沒有用普通飽和度代替。
- 清晰度、畫質、雜點消除、暈邊只做粗略的空間處理。清晰度、畫質、雜點消除的負值沒有核定過的畫面，所以負值不計算。
- Apple 沒有公開各滑桿公式。這裡的強弱是預覽自己的係數，不是相簿刻度。
- 工作圖長邊最多 1600 像素。比較和儲存用的是這張工作圖，不是原檔尺寸。
- 兩組示範配方（暖色育膚、清冷人像）的狀態是 `starter-demo-unverified`。數值沒有在 iPhone 相簿驗證，這次也沒有改。

配方格式與數值鎖在 [`schema/v1-recipe-schema.json`](schema/v1-recipe-schema.json)，說明在 [`schema/v1-recipe-schema.md`](schema/v1-recipe-schema.md)。

## 這個預覽做什麼

1. 選「暖色育膚」或「清冷人像」。
2. 從裝置選一張照片，或先用內建色塊。
3. 並排或滑動比較原圖與近似預覽。
4. 用套用強度縮放整份配方。強度是整數 0–100。0 回到原圖。數字四捨五入，.5 遠離 0。例如曝光 +5 在強度 50 會變成 +3。
5. 儲存 PNG。若瀏覽器沒有直接下載，頁面會留下連結和圖片，可以長按儲存。

介面用台灣繁體顯示名，順序是：曝光、增豔、亮部、陰影、對比、亮度、黑點、飽和度、自然飽和度、色溫、色調、清晰度（Sharpness）、畫質（Definition）、雜點消除、暈邊。

簡體同義與 `nameZhHans` 留在 schema 檔，給之後的文字辨識用。這個頁面不顯示那些名稱。

網頁預覽和微信小程式共用 `miniprogram/shared/adjust.js`，沒有第二套算法。

## 微信小程式（試色，尚未上傳）

用微信開發者工具導入本專案根目錄（含 `project.config.json`）。`appid` 現在是 `touristappid`，這是開發者工具的測試號占位，不是真實 AppID。不要拿它登入上傳或發布。

打開方式、日後貼上自己的 AppID，以及相簿權限，寫在 [`miniprogram/README.md`](miniprogram/README.md)。

小程式只做試色：選兩組起始示範配方、從相簿或內建色塊取圖、比較原圖與近似預覽、調強度、存回相簿。照片只留在裝置上。沒有登入、文字辨識、收藏、分享卡或後端。

## 測試

```bash
node --test
```

或 `npm test`。

## 還沒有做

教程文字辨識、收藏、微信分享卡、登入、上線部署。小程式專案可以在開發者工具裡打開，但還沒有上傳。
