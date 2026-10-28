# توثيق مشروع نظام إدارة الفندق

> هذا الملف مبني على الكود الفعلي في المشروع. كل ما هو مذكور كـ«منفَّذ» موجود ومُختبر، وما هو غير موجود مذكور في قسم القيود (القسم 32).

## 1. نظرة عامة
نظام لإدارة الفندق: غرف، نزلاء، حجوزات، تسجيل دخول/خروج، مدفوعات، خدمات إضافية، تدبير منزلي، صيانة، تقارير، موظفون بصلاحيات. واجهة عربية (RTL) وإنجليزية (LTR).

## 2. الأهداف
- منع الحجز المزدوج من الخادم لا من الواجهة فقط.
- حساب الأسعار والمجاميع على الخادم فقط (لا يُوثق بأي رقم قادم من المتصفح).
- أرقام لوحة التحكم والتقارير من قاعدة البيانات مباشرة.
- حفظ السجلات المالية والتاريخية (لا حذف لحجز/دفعة).

## 3. التقنيات
| الطبقة | التقنية |
|---|---|
| الواجهة | React 18, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Recharts, Lucide, react-hot-toast |
| الخادم | Node.js (ESM), Express 4, Mongoose 8, Zod, JWT, bcryptjs, Helmet, express-rate-limit, express-mongo-sanitize |
| قاعدة البيانات | MongoDB |
| الاختبارات | Vitest + Supertest |

## 4. معمارية الواجهة (`client/src`)
- `api/client.js`: نسخة Axios بمسار نسبي `/api` (لا منافذ ثابتة). يُطلق حدث `auth:expired` عند 401.
- `context/AuthContext.jsx`: حالة الجلسة (`loading | anon | authed | offline`)، الإعدادات، دالة `can(...roles)`.
- `context/I18nContext.jsx`: الترجمة. النص الإنجليزي هو المفتاح، و`i18n/ar.js` يحوّله للعربية، وأي نص مفقود يظهر بالإنجليزية. يضبط `dir` و`lang` على `<html>` ويحفظ اللغة في `localStorage`.
- `components/ui.jsx`: مكتبة المكوّنات (Modal, DataTable, Badge, Pagination, Confirm, Stat, Tabs...).
- `components/ResourcePage.jsx`: صفحة CRUD عامة (غرف، نزلاء، خدمات، موظفون).
- `components/ReservationForm.jsx`, `PaymentForm.jsx`, `PrintDoc.jsx`: نموذج الحجز مع عرض السعر من الخادم، تسجيل الدفعات، مستند الطباعة.
- `pages/*`: Dashboard, AvailableRooms, ReservedRooms, Rooms, Guests, Reservations, ReservationDetail, Reception, Payments, Services, Housekeeping, Maintenance, Reports, Employees, Settings, Profile, Login.
- `layouts/AppLayout.jsx`: الشريط الجانبي القابل للطي، البحث، الإشعارات، قائمة المستخدم، مسار التنقل.
- إذا لم يستجب الخادم تظهر شاشة «تعذّر الاتصال بالخادم» بدل واجهة تبدو سليمة.

## 5. معمارية الخادم (`server`)
- `server.js`: الاتصال بالقاعدة، إنشاء الفهارس، إنشاء أول مدير، بذر البيانات التجريبية (تطوير فقط)، الإيقاف الآمن.
- `app.js`: ربط الـ middleware والمسارات؛ يخدم `client/dist` في الإنتاج.
- `routes/`: طبقة HTTP (صلاحيات + تحقق + استدعاء الخدمات).
- `services/`: منطق الأعمال: `reservationService`, `availabilityService`, `occupancyService`, `pricing`, `paymentService`, `guestService`, `reportService`, `settingsService`.
- `validators/schemas.js`: مخططات Zod لكل طلب كتابة.
- `middlewares/`: `auth.js` (JWT + الأدوار)، `common.js` (التحقق ومعالج الأخطاء المركزي).
- `bootstrap.js`: أول مدير + بيانات العرض. `seed-cli.js`: أمر `npm run seed`.

## 6. معمارية قاعدة البيانات
مجموعات (Collections): `users, rooms, guests, reservations, payments, services, housekeepingtasks, maintenancerequests, auditlogs, hotelsettings`.

## 7. هيكل المجلدات
```
hotel-management-system/
├─ package.json            # npm workspaces + سكربتات الجذر
├─ .env.example            # قالب الإعدادات (بدون أسرار)
├─ README.md  PROJECT_DOCUMENTATION_AR.md
├─ scripts/setup-env.js    # ينشئ .env من القالب (يعمل على ويندوز)
├─ client/                 # React + Vite
│  └─ src/ api components context hooks i18n layouts pages utils
└─ server/
   ├─ config/ env.js db.js
   ├─ models/ routes/ services/ validators/ middlewares/ utils/ tests/
   └─ app.js server.js bootstrap.js seed-cli.js
```

## 8. أهم الملفات
| الملف | الدور |
|---|---|
| `server/services/reservationService.js` | إنشاء/تعديل/تأكيد/إلغاء الحجز، تسجيل الدخول والخروج، الرسوم |
| `server/services/availabilityService.js` | الغرف المشغولة والمتاحة لفترة |
| `server/services/occupancyService.js` | حالة كل غرفة في تاريخ معيّن |
| `server/services/pricing.js` | حساب المجاميع والضريبة والخصم |
| `server/services/paymentService.js` | الدفعات، الاسترداد، حساب `paid` |
| `server/config/env.js` | قراءة المتغيرات والتحقق منها |
| `server/config/db.js` | الاتصال بـ MongoDB (حقيقي أو مؤقت للتطوير) |

## 9. النماذج والعلاقات
- **User**: name, email (فريد), password (مشفّرة، `select:false`), role, active, mustChangePassword.
- **Room**: number (فريد), type, floor, capacity, beds, pricePerNight, description, amenities[], image (رابط), status, housekeepingStatus, timestamps.
- **Guest**: fullName, phone, email, nationality, idType+idNumber (فهرس فريد جزئي), address, dateOfBirth, notes, active.
- **Reservation**: reference (فريد `RSV-YYYYMMDD-XXXXX`), guest→Guest, rooms[{room→Room, rate}], checkIn, checkOut, nights, adults, children, status, charges[] (خدمات مضمّنة بلقطة الاسم والسعر), roomTotal, servicesTotal, subtotal, discount, taxRate, tax, total, paid, notes, cancelReason...
- **Payment**: reference (`PAY-...`), reservation→Reservation, guest→Guest, amount, method, status, kind (`payment|deposit`), transactionRef, paidAt, notes, recordedBy→User, refundedAmount, refunds[], idempotencyKey (فهرس فريد جزئي).
- **Service**, **HousekeepingTask**, **MaintenanceRequest**, **AuditLog**, **HotelSettings** (عملة، ضريبة، منطقة زمنية، سياسة الخصم، طرق دفع إضافية).

العلاقات: Reservation ← Guest (واحد لمتعدد)، Reservation ↔ Room (متعدد لمتعدد عبر `rooms[]`)، Payment → Reservation و Guest.

## 10. نقاط الـ API
كل الردود: `{ "success": true, "data": ..., "meta": {page,limit,total,pages} }` أو `{ "success": false, "message": "...", "details": ... }`. كل المسارات تحت `/api`.

| المسار | الوصف | الصلاحية |
|---|---|---|
| `GET /health` | حالة الخادم وقاعدة البيانات (503 إن لم تتصل) | عام |
| `POST /auth/login` / `logout` / `change-password`, `GET /auth/me` | الجلسة | عام / مسجّل |
| `GET/POST/PATCH /users` | الموظفون | قراءة: مدير عام، مدير، استقبال. كتابة: مدير عام، مدير |
| `GET /rooms` | بحث/فلترة (`search,floor,type,status,minPrice,maxPrice,sort,page,limit`) | الجميع |
| `GET /rooms/availability` | الغرف الفارغة لفترة (`checkIn,checkOut,guests,type,minPrice,maxPrice`) | الجميع |
| `GET /rooms/occupancy?date=` | حالة كل غرفة في تاريخ | الجميع |
| `GET /rooms/:id`, `POST/PATCH/DELETE` | CRUD الغرف | كتابة: مدير عام، مدير |
| `GET/POST/PATCH/DELETE /guests` | النزلاء (حذف = تعطيل إن وُجد سجل) | استقبال، مدير |
| `GET /reservations` | قائمة (`search,status,view,from,to,checkInFrom/To,checkOutFrom/To,createdFrom/To`) | استقبال، مدير، محاسب |
| `POST /reservations/quote` | عرض السعر من الخادم | استقبال، مدير |
| `GET /reservations/arrivals`, `/in-house` | وصول اليوم / المقيمون | — |
| `POST /reservations` / `PATCH /:id` | إنشاء / تعديل | استقبال، مدير |
| `POST /reservations/:id/confirm｜cancel｜no-show｜check-in｜check-out` | دورة حياة الحجز | استقبال، مدير |
| `POST/DELETE /reservations/:id/charges` | إضافة/إزالة خدمة | استقبال، مدير |
| `GET/POST /payments`, `POST /payments/:id/refund` | الدفعات والاسترداد (الاسترداد: مدير عام، مدير، محاسب) | — |
| `GET/POST/PATCH/DELETE /services` | الخدمات | كتابة: مدير |
| `GET/POST/PATCH /housekeeping`, `/maintenance` | التنظيف والصيانة | حسب الدور |
| `GET /dashboard/summary?date=`, `/revenue`, `/occupancy`, `/notifications` | اللوحة | — |
| `GET /reports/revenue｜occupancy｜reservations｜payments｜guests` (`?from&to&group&format=csv`) | التقارير | مدير عام، مدير، محاسب |
| `GET/PUT /settings`, `GET /audit` | الإعدادات وسجل التدقيق | — |

### أمثلة حقيقية
```http
POST /api/reservations/quote
{ "checkIn": "2026-11-14", "checkOut": "2026-11-16", "adults": 2, "roomIds": ["<id>"] }
```
```json
{ "success": true, "data": { "nights": 2, "taxRate": 14,
  "rooms": [{ "number": "104", "type": "deluxe", "rate": 1800, "subtotal": 3600 }],
  "charges": [], "roomTotal": 3600, "servicesTotal": 0, "subtotal": 3600, "discount": 0, "tax": 504, "total": 4104 } }
```
خطأ تواريخ: `{ "success": false, "message": "Check-out must be after check-in" }` (400).
تعارض حجز: `409` برسالة `Room 101 is already booked for the selected dates`.
```http
GET /api/rooms/occupancy?date=2026-10-25
```
```json
{ "success": true, "data": { "date": "2026-10-25",
  "counts": { "total": 20, "available": 16, "reserved": 2, "occupied": 1, "cleaning": 0, "maintenance": 1 },
  "rooms": [{ "number": "105", "state": "reserved", "reservation": { "reference": "RSV-20261024-7DCE8", "status": "confirmed", "guest": "Marco Rossi" } }] } }
```
```json
GET /api/health  ->  { "status": "ok", "database": { "state": "connected", "mode": "external", "persistent": true } }
```

## 11. المصادقة والصلاحيات
- تسجيل الدخول يضع JWT في كوكي `httpOnly` و`SameSite=Lax` (و`Secure` في الإنتاج)؛ كلمات المرور بـ bcrypt (تكلفة 12).
- رسالة موحّدة للبيانات الخاطئة (لا كشف لوجود الحساب). حدّ 20 محاولة/15 دقيقة.
- الأدوار: `super_admin, admin, receptionist, accountant, housekeeping`. التحقق في الخادم عبر `authorize(...)`؛ إخفاء الواجهة للراحة فقط.
- `mustChangePassword`: أي طلب خارج `/api/auth` يُرفض بـ403 (`PASSWORD_CHANGE_REQUIRED`) حتى تغيير كلمة المرور.
- المدير لا يستطيع إنشاء/تعديل مدير عام؛ لا يمكن تعطيل آخر مدير عام.
- رقم الهوية يُقنَّع في القوائم (`****1111`) ويظهر كاملاً لمدير عام/مدير/استقبال فقط.

## 12. سير عمل الغرف
إضافة/تعديل/عرض/حذف. الحذف مرفوض (409) إن وُجدت حجوزات نشطة أو سجل حجوزات سابق (يُنصح بوضعها «صيانة»). لا يمكن تغيير الحالة يدوياً إلى «مشغولة» (تأتي من تسجيل الدخول)، ولا تعديل حالة غرفة مشغولة.

## 13. سير عمل النزلاء
منع التكرار: نفس رقم الهوية، أو نفس الاسم + الهاتف (409). الحذف: تعطيل إن كان للنزيل حجوزات، وحذف فعلي إن لم يكن. الملف يعرض: عدد الإقامات، إجمالي الإنفاق، الرصيد المستحق، وسجل الحجوزات.

## 14. سير عمل الحجز
`pending → confirmed → checked_in → checked_out`، ومن `pending/confirmed` يمكن `cancelled` أو `no_show`.
1. `POST /reservations/quote` يعرض السعر والتفاصيل.
2. `POST /reservations` يتحقق من: صيغة التواريخ، الخروج بعد الدخول، عدم كون الدخول في الماضي (بتوقيت الفندق)، ≤ 365 ليلة، وجود الغرف، عدم الصيانة، **عدم التعارض**، **السعة ≥ البالغين + الأطفال**، ثم يحسب السعر من أسعار قاعدة البيانات ويحفظ.
3. التأكيد يعيد فحص التوفر. التعديل مسموح لـ `pending/confirmed` فقط ويحتفظ بسعر الغرفة الأصلي للغرف المحتفظ بها.
4. الخصم: المدير العام/المدير بلا حد؛ موظف الاستقبال حتى النسبة في الإعدادات (افتراضي 10%)؛ غيرهم ممنوع.

## 15. قواعد الدخول والخروج
- **الدخول شامل والخروج غير شامل**: الحجز يغطي الليالي من `checkIn` حتى `checkOut - 1`. يمكن لنزيل أن يدخل في يوم خروج نزيل آخر.
- تسجيل الدخول: الحجز `confirmed`، التاريخ اليوم بين الدخول والخروج، الغرف ليست مشغولة/قيد التنظيف/صيانة. يسجّل الوقت الفعلي ويضع الغرف «مشغولة»، وقد يسجّل عربوناً.
- تسجيل الخروج: الحجز `checked_in`؛ يُرفض (409) إن بقي رصيد إلا مع `allowOutstanding=true` (يُسجَّل `outstandingAtCheckout`). يضع الغرف «قيد التنظيف/متسخة» وينشئ مهمة تنظيف. لا يمكن الخروج مرتين.

## 16. حساب الغرف المتاحة
غرفة متاحة لفترة `[checkIn, checkOut)` إذا:
1. حالتها ليست `maintenance`، **و**
2. لا يوجد حجز بحالة `pending/confirmed/checked_in` يتقاطع معها، أي `existing.checkIn < requested.checkOut` **و** `existing.checkOut > requested.checkIn`.

حالة الغرفة المخزّنة وحدها لا تحدد التوفر؛ لذلك حجز مستقبلي لا يجعل الغرفة «غير متاحة» لتواريخ سابقة. الغرفة قيد التنظيف لا تمنع حجز تواريخ مستقبلية، لكنها تمنع تسجيل الدخول حتى تصبح جاهزة.

## 17. حساب الغرف المشغولة (لتاريخ D)
`occupancyService.roomStates(D)`، بالأسبقية:
1. **maintenance**: حالة الغرفة صيانة.
2. **occupied**: حجز `checked_in` يغطي D (وللماضي أيضاً `checked_out` يغطي D؛ واليوم يُحسب النزيل المتأخر عن الخروج).
3. **cleaning**: اليوم فقط، والغرفة قيد التنظيف.
4. **reserved**: حجز `pending/confirmed` يغطي D (لم يصل النزيل).
5. **available**: غير ذلك.

الحجز المستقبلي **لا** يُحسب «مشغولاً». نسبة الإشغال = المشغولة ÷ إجمالي الغرف. يوم الخروج لا يُحسب مشغولاً.

## 18. منع تعارض الحجوزات
- التحقق في الخادم عند الإنشاء والتعديل والتأكيد، بالقاعدة في القسم 16.
- التزامن: عمليات الحجز/التعديل/التأكيد/الدخول/الخروج/الدفع تمر عبر **قفل تسلسلي داخل عملية Node واحدة** (`withLock`). اختبار آلي يرسل 8 طلبات متزامنة لنفس الغرفة فينجح واحد ويُرفض 7.
- **لماذا لا Transactions؟** معاملات MongoDB تحتاج replica set؛ الخادم المنفرد (Standalone) لا يدعمها. لذلك لم نعتمد عليها.
- **قيد مهم**: القفل لا يعمل عبر عدة نسخ من الخادم. للتشغيل متعدد النسخ: شغّل MongoDB كـ replica set (حتى بعقدة واحدة: `mongod --replSet rs0` ثم `rs.initiate()`)، واستخدم `mongoose.startSession().withTransaction(...)` مع وثيقة قفل لكل غرفة/ليلة. هذا غير منفَّذ حالياً.

## 19. المدفوعات والحسابات
- **تسجيل يدوي فقط**: لا توجد بوابة دفع حقيقية. لا تُخزَّن أرقام البطاقات؛ حقل `transactionRef` اختياري يُدخل يدوياً.
- `total = (roomTotal + servicesTotal - discount) + tax`. `paid = Σ(amount - refundedAmount)` للدفعات `completed/partially_refunded/refunded`. `balance = total - paid`.
- حالة الدفع للحجز (`paymentStatus`): `unpaid` / `partial` / `paid`؛ وللملغى: `refund_due` إن بقي مال محصَّل، وإلا `none`.
- رفض الدفع الزائد عن الرصيد (409). منع التكرار بمفتاح `idempotencyKey` (يولّده النموذج لكل فتحة).
- الاسترداد: مدير عام/مدير/محاسب، السبب إلزامي، لا يتجاوز المتبقي، ويُسجَّل في سجل التدقيق. إلغاء الحجز **لا** يرد المال تلقائياً؛ يُنشأ استرداد يدوي من صفحة المدفوعات.
- **قاعدة الإيراد**: «المحصَّل» = مدفوعات فعلية بعد الاستردادات حسب تاريخ الدفع (توقيت الفندق). «المحجوز» = مجموع الحجوزات غير الملغاة/عدم الحضور حسب تاريخ الوصول. يُعرضان منفصلين في التقارير.

## 20. إحصاءات لوحة التحكم
`GET /dashboard/summary?date=`: أعداد الغرف حسب الحالة في التاريخ (القسم 17)، وصول/مغادرة اليوم، الحجوزات النشطة (`checked_in`)، القادمة (`pending/confirmed` بدخول بعد اليوم)، الملغاة، إجمالي النزلاء، إيراد اليوم والشهر (محصَّل)، المستحقات (`total - paid > 0` للحجوزات المؤكدة/المقيمة/المنتهية)، وآخر الحجوزات والدفعات. صفحتا «الغرف المتاحة» و«الغرف المحجوزة» تعرضان التفاصيل.

## 21. متغيرات البيئة (`.env`)
| المتغير | الوصف |
|---|---|
| `PORT` | منفذ الـ API (افتراضي 5000) |
| `NODE_ENV` | `development` أو `production` |
| `MONGODB_URI` | رابط MongoDB. فارغ في التطوير = قاعدة مؤقتة في الذاكرة. **مطلوب** في الإنتاج |
| `JWT_SECRET` | سر عشوائي ≥ 32 حرفاً (مطلوب في الإنتاج) |
| `JWT_EXPIRES_IN` | مدة الجلسة (8h) |
| `ADMIN_NAME/EMAIL/PASSWORD` | أول مدير عام (مطلوبة في الإنتاج، كلمة المرور ≥ 10) |
| `SEED_DEMO` | `true` لبذر بيانات تجريبية في التطوير |
| `CLIENT_ORIGIN` | فقط إذا استُضيفت الواجهة على نطاق مختلف (CORS) |
| `CLIENT_PORT` | منفذ Vite (5173) |

متغير ناقص في الإنتاج يوقف التشغيل برسالة تذكر كل المتغيرات الناقصة. لا يوجد رجوع صامت لقاعدة محلية: إن فشل الاتصال برابط مُعَدّ يتوقف الخادم بخطأ واضح.

## 22. المتطلبات
Node.js ≥ 18.18 و npm. MongoDB اختياري في التطوير (مطلوب للحفظ الدائم والإنتاج).

## 23. تثبيت المكتبات (ويندوز PowerShell)
```powershell
cd hotel-management-system
npm install
```
أمر واحد من الجذر يثبّت الواجهة والخادم (npm workspaces).

## 24. إعداد MongoDB
- **محلي**: ثبّت MongoDB Community Server (تعمل كخدمة ويندوز على `127.0.0.1:27017`) ثم:
  ```powershell
  npm run setup:env
  notepad .env      # MONGODB_URI=mongodb://127.0.0.1:27017/hotel_management
  ```
- **Atlas**: أنشئ Cluster مجاني، أضف مستخدماً وعنوان IP مسموحاً، وانسخ الرابط `mongodb+srv://USER:PASS@cluster.../hotel_management` إلى `MONGODB_URI`.
- **بدون إعداد (تطوير)**: اترك `MONGODB_URI` فارغاً؛ تُستخدم قاعدة مؤقتة (تحتاج اتصال إنترنت مرة واحدة لتنزيل MongoDB) **وتضيع البيانات عند الإيقاف**.

## 25. التشغيل
```powershell
npm run dev
```
الواجهة: `http://localhost:5173`، الـ API: `http://localhost:5000`. أول دخول (تطوير): `admin@hotel.local` / `Admin@12345` ثم تغيير كلمة المرور إجبارياً. حسابات العرض الأخرى مذكورة في README.
بيانات تجريبية في قاعدة دائمة: `npm run seed` (ويدعم `-- --force`).

## 26. بناء الواجهة والإنتاج
```powershell
npm run build
$env:NODE_ENV="production"; $env:MONGODB_URI="..."; $env:JWT_SECRET="..."; $env:ADMIN_EMAIL="owner@example.com"; $env:ADMIN_PASSWORD="كلمة-قوية-طويلة"
npm start
```
في الإنتاج يخدم Express الواجهة المبنية والـ API من نفس المنفذ.

## 27. الاختبارات
```powershell
npm test                       # قاعدة مؤقتة في الذاكرة
$env:TEST_MONGODB_URI="mongodb://127.0.0.1:27017"; npm test   # على MongoDB موجود
npm run lint
```
41 اختباراً تغطي: الصحة، المصادقة، الصلاحيات، CRUD الغرف والنزلاء، التواريخ غير الصالحة، التعارض، التزامن، الصيانة، الخصم، الدخول/الخروج، المدفوعات والاسترداد، التدبير، لوحة التحكم، التقارير، حالات الإشغال بالتاريخ، والفلاتر.

## 28. أخطاء شائعة
| الخطأ | الحل |
|---|---|
| `Cannot connect to MongoDB` | شغّل MongoDB أو صحّح `MONGODB_URI` أو أفرغه في التطوير |
| `Could not start the temporary in-memory MongoDB` | فشل تنزيل الملف (لا إنترنت). ثبّت MongoDB وعيّن `MONGODB_URI` |
| `Port 5000 is already in use` | غيّر `PORT` في `.env` |
| واجهة «تعذّر الاتصال بالخادم» | الـ API متوقف؛ راجع سطور `[api]` في الطرفية |
| خروج من الجلسة عند كل إعادة تشغيل | عيّن `JWT_SECRET` ثابتاً |
| `403 PASSWORD_CHANGE_REQUIRED` | غيّر كلمة المرور من الشاشة |
| `JWT_SECRET must be set...` في الإنتاج | عرّف المتغيرات المذكورة في الرسالة |

## 29. إضافة ميزة جديدة
1. نموذج في `server/models` (+ فهارس).
2. مخطط Zod في `validators/schemas.js`.
3. منطق الأعمال في `services/` (وليس داخل المسار).
4. مسار في `routes/` مع `protect` و`authorize` ثم تسجيله في `app.js`.
5. اختبار في `server/tests`.
6. صفحة في `client/src/pages` (يمكن استخدام `ResourcePage`) + عنصر في `NAV` + ترجمة في `i18n/ar.js`.

## 30. الأمان
كوكي `httpOnly`، bcrypt، Helmet، تحديد المحاولات، تحقق Zod لكل كتابة، تنقية مشغّلات NoSQL، حد 100KB للطلب، حماية CSV من حقن المعادلات، عدم إرجاع كلمات المرور، سجل تدقيق، إلزام تغيير كلمة المرور الأولية، لا أسرار في المستودع (`.env` مُتجاهَل). لا يوجد رفع ملفات (صور الغرف روابط فقط).

## 31. النشر
1. MongoDB مُدار (Atlas) أو خادم خاص. 2. عيّن متغيرات الإنتاج (القسم 21). 3. `npm install && npm run build && npm start`. 4. ضع الخادم خلف Nginx/وكيل HTTPS (الكوكي `Secure` في الإنتاج) مع `trust proxy` مفعّل مسبقاً. 5. راقب `GET /api/health`. 6. للتوسّع لأكثر من نسخة طبّق ملاحظة القسم 18.

## 32. القيود والتحسينات المستقبلية
**قيود حالية**
- قفل الحجز يعمل داخل عملية واحدة (القسم 18).
- لا بوابة دفع؛ البطاقة تُسجَّل يدوياً.
- لا رفع صور؛ روابط فقط.
- «تنزيل التأكيد/الفاتورة» عبر طباعة المتصفح (حفظ كـ PDF).
- إلغاء حجز مدفوع لا يولّد استرداداً تلقائياً.
- عرض أوضاع الغرف المستقبلية يعتمد على الحجوزات فقط؛ الصيانة تُطبَّق على كل التواريخ لأنها حالة حالية.
- لم يُجرَّب العرض البصري على متصفح حقيقي في بيئة التطوير هذه (فُحص البناء والـ lint والـ API).

**تحسينات مقترحة (غير منفَّذة)**: معاملات MongoDB مع replica set، تكامل بوابة دفع، رفع صور، إرسال البريد/الرسائل، تقارير PDF، اختبارات واجهة (Playwright)، دعم عملات متعددة.
