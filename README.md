# myGPF Next

หน้าเว็บ myGPF ปรับดีไซน์ใหม่จาก https://github.com/apiwatmeethong-pixel/my_GPF

## ใช้งานบน GitHub Pages

1. สร้าง repository ใหม่ชื่อ `my-gpf-next` ในบัญชีที่ต้องการ
2. อัปโหลดไฟล์ในโฟลเดอร์นี้เข้า root ของ repository
3. ไปที่ Settings → Pages → Deploy from a branch → main → / (root) → Save
4. เปิด URL ที่ GitHub Pages แสดงหลัง deployment สำเร็จ

## ข้อมูลเดิม

ใช้ Google Apps Script endpoint เดิมใน `index.html` และโหลด `my_GPF_FRONTEND_HOTFIX.js` เดิม จึงไม่ต้องย้าย Google Sheet เพื่อเปลี่ยนดีไซน์หน้าเว็บ การใช้งานจริงขึ้นกับสิทธิ์และความพร้อมของ backend เดิม ไม่ได้คัดลอกฐานข้อมูลหรือเปลี่ยนบัญชีผู้ใช้

เปลี่ยนดีไซน์เพิ่มเติมได้ใน `redesign.css` โดยไม่แก้ JavaScript เดิม

## การตรวจสอบ

- JavaScript ผ่านการตรวจ syntax
- inline application scripts และ element IDs เดิมไม่เปลี่ยน
- ยังไม่ได้ยืนยันการเข้าสู่ระบบ การบันทึกข้อมูล หรือการเรียก API ด้วยบัญชีจริง
- ต้องเชื่อมอินเทอร์เน็ตเพื่อโหลดฟอนต์และไลบรารี CDN ตามเว็บเดิม

Source retrieved and redesigned: 2026-10-20.
