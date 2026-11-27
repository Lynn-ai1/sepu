# 色譜試色小程式

這是給微信開發者工具打開的試色專案，不是已上線的正式版，也不是網頁發布。

算法與網頁預覽相同，程式在 `shared/adjust.js`。這是近似算法，不是 iPhone「照片」的「調整」，也不會得到相同結果。增豔和陰影只顯示數字，不畫進畫面。自然飽和度有自己的曲線，沒有用飽和度代替。

## 打開專案

1. 安裝 [微信開發者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 選擇「導入專案」。目錄選這個 repo 的根目錄（裡面要有 `project.config.json`），不是只選本資料夾。
3. AppID 保持 `touristappid` 即可在工具裡預覽。這是開發者工具的測試號占位，不是真實 AppID。不要用它上傳、發布，也不要把它換成猜來的號碼。

匯入後打開頁面 `pages/trial/trial`。可以選「暖色育膚」或「清冷人像」，從相簿選照片或用內建色塊，比較原圖與近似預覽，調套用強度，再存回相簿。

基礎庫請用 3.5.5 或更新（`project.config.json` 的 `libVersion`）。試色用 Canvas 2D 讀寫像素。

## 日後貼上真實 AppID

有了自己的小程式 AppID 之後，只改根目錄 `project.config.json` 的 `appid` 欄位。工具若另外寫了 `project.private.config.json`，那個檔不要提交。

上傳或真機預覽之前，還要在微信公眾平台填「用戶隱私保護指引」，至少包含這兩項，否則相簿介面會被擋住：

- 選中的照片或視頻信息：對應 `wx.chooseMedia`（從相簿選一張圖）
- 相簿（僅寫入）：對應 `wx.saveImageToPhotosAlbum`（把近似預覽存回相簿）

`app.json` 裡的 `scope.writePhotosAlbum` 說明文字是存回相簿時給使用者看的。選圖由系統相簿介面完成，不另做登入。

這個步驟不要登入上傳。等 AppID 和隱私指引都齊了，再在開發者工具裡用「預覽」或「上傳」做開發版。
