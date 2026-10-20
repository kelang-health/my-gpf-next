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

## Investment insights (2026-10-20)

หลังเข้าสู่ระบบ หน้า Portfolio เพิ่ม Current / Maximum Drawdown, กราฟ underwater, ผลตอบแทนช่วงที่เลือก, ความผันผวน annualized, อัตราฟื้นกลับยอด, ระยะต่ำกว่ายอด, best/worst observation return, positive-return frequency, รายเดือน, การกระจุกตัวตามแผน และตารางเทียบแผนบนวันร่วมกัน

เลือกทั้งหมด / ปีล่าสุดในฐาน / 90 วัน / 30 วันได้ รองรับโหมดซ่อนข้อมูลและล้างข้อมูลเมื่อออกจากระบบ

วิธี: ใช้หน่วยปัจจุบันคงที่คูณ NAV ย้อนหลัง เป็น hypothetical current-holdings basket ไม่ใช่ประวัติการถือจริงหรือบัญชี TWR/XIRR ไม่มีการส่งข้อมูลจาก Google Sheets ไปเก็บใน repository โมดูลใช้ข้อมูลจาก authenticated backend เดิมในหน่วยความจำ browser เท่านั้น

ความผันผวนใช้ sample standard deviation ของ simple returns × √252 เมื่อมีอย่างน้อย 20 returns; NAV ที่ขาด/ศูนย์/ติดลบถูกข้ามและแสดงจำนวนวันที่ใช้ได้ วันที่ซ้ำใช้แถวสุดท้ายและเรียงวันใหม่

ตัวเลขกำไรเดิมเปลี่ยนชื่อจาก True YTD เป็นกำไรเทียบฐานทุนเพื่อไม่สื่อว่าเป็นผลตอบแทนที่ปรับเวลาเงินนำส่งแล้ว แยกการโหลด NAV จากความล้มเหลวของข้อมูลตลาดประกอบ

Validation: สูตรทดสอบ deterministic drawdown/recovery/missing NAV/date/volatility ผ่าน; ทดสอบ component ด้วย NAV จริงและหน่วยสมมติใน browser, เปลี่ยนช่วง, privacy, empty state, logout และหน้าจอ 390px ผ่าน ยังไม่ได้ยืนยัน authentication/backend deployment หรือผลพอร์ตส่วนบุคคลหลัง login จริง

Formula reference: https://help.portfolio-performance.info/en/reference/view/reports/performance/
