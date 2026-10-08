# قائمة فحص النشر إلى الإنتاج — Pizza Day & Night

دليل خطوة بخطوة لرفع الموقع إلى الخادم الحيّ: متغيّرات البيئة، الإعداد الأول،
البناء، ومهمّتا الأرشفة والنسخ الاحتياطي الليليتان. اتبع القائمة من الأعلى للأسفل.

> النسخة الإنجليزية: [`DEPLOY.md`](./DEPLOY.md).
>
> **الفواتير لا تُطبع على الخادم.** الخادم لا طابعة له؛ الطابعة الحرارية موصولة بجهاز
> Windows في المطعم، ووكيل الطباعة هناك هو الذي يسحب الفواتير ويطبعها — راجع
> [`agent/README.md`](./agent/README.md). اضبط `PRINT_AGENT_TOKEN` أدناه وجهّز الوكيل،
> وإلا لن تُطبع أي فاتورة.
>
> الأوامر أدناه لنظام Windows أولاً، مع مكافئ Linux/cron حيث يختلف.

---

## ١) متغيّرات البيئة (`.env.local`)

انسخ `.env.example` إلى `.env.local` واملأ القيم. يقرأ هذا الملفَّ كلٌّ من Next.js
و Prisma، و**يجب ألّا يُرفع إلى Git إطلاقاً**. القيم التي تبدأ بـ `NEXT_PUBLIC_`
فقط هي التي تصل إلى المتصفّح — كل ما عداها يبقى على الخادم.

### إلزامية — يفشل الإقلاع بدونها

| المتغيّر | ملاحظات |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/pizza_day_night`. يجب أن يشير إلى قاعدة بيانات الإنتاج. |
| `AUTH_SECRET` | مفتاح توقيع كوكي الجلسة، **٣٢ حرفاً على الأقل**. ولّد مفتاحاً جديداً (بالأسفل). لا تُعِد استخدام قيمة التطوير. |
| `NEXT_PUBLIC_SITE_URL` | النطاق العام الحقيقي، مثل `https://pizzadaynight.de` — يُستخدم للروابط المطلقة و`sitemap.xml` و`robots.txt` وروابط QR على الفاتورة. |

توليد `AUTH_SECRET` قويّ:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### اختيارية — لها قيم افتراضية آمنة، عيّنها عند الحاجة فقط

| المتغيّر | الافتراضي | الغرض |
|---|---|---|
| `STORAGE_DRIVER` | `local` | يحفظ الصور المرفوعة في `./public/uploads`. |
| `MAX_UPLOAD_MB` | `5` | أقصى حجم لرفع الصورة (١–٢٠). |
| `PAYMENTS_ENABLED` | `false` | أبقِه `false` للدفع النقدي/بالبطاقة عند التسليم فقط. تفعيله دون مزوّد فعلي يسجّل طلبات ONLINE كغير مدفوعة. |
| `PAYMENT_PROVIDER` | `none` | `none` \| `stripe` \| `paypal`. |
| `NOTIFY_WHATSAPP` / `NOTIFY_EMAIL` | فارغ | إشعارات الطلبات الجديدة. |
| `PRINT_AGENT_TOKEN` | فارغ (الطباعة معطّلة) | السر المشترك الذي يستوثق به وكيل الطباعة في المطعم. إن كان فارغاً تُجيب `/api/print/*` بـ 404 ولا تُطبع أي فاتورة. راجع [`agent/README.md`](./agent/README.md). |
| `RECEIPT_PRINTER` | فارغ (الطابعة الافتراضية) | يُستخدم فقط مع `npm run print:test` الذي يطبع على **هذا** الجهاز. الوكيل يختار طابعته من `config.json` الخاص به. |
| `ORDER_RETENTION_DAYS` | `90` | أيام الاحتفاظ بتفاصيل الطلبات قبل الحذف (تبقى الإجماليات في الأرشيف). |
| `REPORT_RETENTION_MONTHS` | `3` | عدد الأشهر الكاملة للاحتفاظ بلقطات التقارير الشهرية. |

### للتهيئة الأولى فقط (تستخدمها سكربتات الإعداد، لا وقت التشغيل)

`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` — أول حساب **مدير (MANAGER)**.
`MASTER_EMAIL` / `MASTER_PASSWORD` / `MASTER_NAME` — حساب **المالك (MASTER)**.
استخدم كلمات مرور قويّة وفريدة؛ هذه بيانات دخول حقيقية.

- [ ] أُنشئ `.env.local` على الخادم بقيم الإنتاج
- [ ] `AUTH_SECRET` سلسلة عشوائية جديدة ≥٣٢ حرفاً (وليست قيمة المثال/التطوير)
- [ ] `NEXT_PUBLIC_SITE_URL` هو النطاق الحيّ (https)
- [ ] `DATABASE_URL` يشير إلى قاعدة بيانات الإنتاج
- [ ] `PAYMENTS_ENABLED=false` ما لم يُربَط مزوّد دفع فعلاً

---

## ٢) قاعدة البيانات والحسابات لأوّل مرة

نفّذ مرّة واحدة من مجلّد المشروع بعد وضع `.env.local`:

```bash
npm ci                  # تثبيت التبعيات بدقّة
npm run db:push         # إنشاء/مزامنة المخطّط على قاعدة بيانات الإنتاج
npm run create:master   # إنشاء حساب المالك (MASTER) — يقرأ متغيّرات MASTER_*
npm run create:admin    # اختياري: إنشاء حساب مدير — يقرأ متغيّرات ADMIN_*
npm run seed:categories # اختياري: زرع أصناف القائمة الابتدائية
```

- [ ] MySQL يعمل ويمكن الوصول إليه عبر `DATABASE_URL`
- [ ] تمّت مزامنة المخطّط (`npm run db:push`)
- [ ] يوجد حساب **MASTER** واحد على الأقل (`npm run create:master`)
- [ ] تمّ التحقّق من الدخول عبر صفحة الدخول المخفيّة (مسارها في الكود، لا في البيئة)

---

## ٣) البناء والتشغيل

```bash
npm run typecheck      # صفر أخطاء
npm run lint           # صفر مشاكل
npm run build          # بناء إنتاج كامل
npm run start          # تشغيل التطبيق المبنيّ (المنفذ 3000 افتراضياً)
```

ضع عكس-بروكسي (IIS / nginx) أمامه لأجل TLS ولربط النطاق بمنفذ `npm run start`.
أبقِ العملية حيّة عبر مدير خدمات النظام (خدمة Windows / NSSM، أو `pm2`/systemd على Linux).

- [ ] `typecheck` و`lint` و`build` كلها خضراء على الخادم
- [ ] الوصول للموقع عبر HTTPS على `NEXT_PUBLIC_SITE_URL`
- [ ] العملية تُعيد التشغيل تلقائياً عند التعطّل/إعادة الإقلاع
- [ ] (عند الطباعة) `PRINT_AGENT_TOKEN` مضبوط على الخادم، ووكيل الطباعة في المطعم
      يعمل ويُظهر `✓ … printed on …` (راجع [`agent/README.md`](./agent/README.md))

---

## ٤) مهمّة الاحتفاظ الليلية (Cron)

ينتهي يوم العمل الساعة **05:00** (قاطع يوم العمل). جدوِل `npm run archive`
لِيُشغَّل **مرّة يومياً بُعيد 05:00** (مثلاً **05:15**). المهمّة:

1. تأخذ لقطة لإجماليات كل يوم في `OrderDailyArchive` (idempotent)،
2. تحذف تفاصيل الطلبات الأقدم من `ORDER_RETENTION_DAYS` (٩٠)، و
3. تحذف لقطات التقارير الأقدم من `REPORT_RETENTION_MONTHS` (٣ أشهر).

آمنة للتشغيل مرّتين أو للتعويض بعد ليلة فائتة. معاينة دون حذف شيء:

```bash
npm run archive -- --dry-run
```

### Windows — جدول المهام (Task Scheduler)

من PowerShell بصلاحيات مرتفعة (عدّل المسار):

```powershell
$proj = "C:\Users\baqir\Desktop\Pe"
$action  = New-ScheduledTaskAction -Execute "npm.cmd" -Argument "run archive" -WorkingDirectory $proj
$trigger = New-ScheduledTaskTrigger -Daily -At 5:15AM
Register-ScheduledTask -TaskName "PDN-Archive" -Action $action -Trigger $trigger -RunLevel Highest -Description "أرشفة الطلبات وتنظيف الاحتفاظ ليلياً"
```

التحقّق / التشغيل يدوياً:

```powershell
Start-ScheduledTask -TaskName "PDN-Archive"     # التشغيل الآن
Get-ScheduledTaskInfo -TaskName "PDN-Archive"   # آخر تشغيل ونتيجته (0 = نجاح)
```

### Linux — cron

```cron
# 05:15 يومياً — أرشفة الطلبات وتنظيف الاحتفاظ
15 5 * * * cd /path/to/pizza-day-night && /usr/bin/npm run archive >> /var/log/pdn-archive.log 2>&1
```

- [ ] أُنشئت مهمّة/cron لـ **05:15 يومياً**
- [ ] مجلّد العمل هو جذر المشروع (كي يُقرأ `.env.local` ويُحلّ `npm`)
- [ ] تمّت مراجعة `npm run archive -- --dry-run` مرّة وبدت صحيحة
- [ ] MySQL يعمل الساعة 05:15 (اضبط MySQL في XAMPP على البدء التلقائي مع الجهاز)
- [ ] سجّل أوّل تشغيل حقيقي نتيجة غير خطأ

---

## ٥) النسخ الاحتياطي التلقائي لقاعدة البيانات

يأخذ `scripts/backup-db.ps1` نسخة من قاعدة البيانات (عبر `mysqldump`) إلى ملفّ
`.sql` مؤرّخ داخل `backups/`، ويحذف النسخ الأقدم من `-KeepDays` (١٤ يوماً افتراضياً).
يقرأ `DATABASE_URL` من `.env.local`، ويكتشف `mysqldump` الخاص بـ XAMPP تلقائياً،
ويمرّر كلمة المرور عبر ملفّ مؤقّت (لا تظهر في سطر الأوامر). المهمّة **للقراءة فقط** —
شغّل MySQL في XAMPP أولاً؛ السكربت لا يُشغّل خادماً.

تشغيل/اختبار يدوي:

```bash
npm run backup:db
# أو مع خيارات:
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1 -OutDir D:\backups -KeepDays 30
```

جدوِله **يومياً حوالي 05:05 — قُبيل مهمّة الأرشفة (05:15)** — كي تلتقط نسخة كل
ليلة قاعدةَ البيانات *قبل* تنفيذ حذف الاحتفاظ.

### Windows — جدول المهام (Task Scheduler)

```powershell
$proj = "C:\Users\baqir\Desktop\Pe"
$action  = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$proj\scripts\backup-db.ps1`"" -WorkingDirectory $proj
$trigger = New-ScheduledTaskTrigger -Daily -At 5:05AM
Register-ScheduledTask -TaskName "PDN-Backup" -Action $action -Trigger $trigger -RunLevel Highest -Description "نسخة MySQL احتياطية ليلية قبل مهمّة الأرشفة"
```

التحقّق / التشغيل يدوياً:

```powershell
Start-ScheduledTask -TaskName "PDN-Backup"
Get-ScheduledTaskInfo -TaskName "PDN-Backup"   # LastTaskResult = 0 يعني نجاح
```

### Linux — cron

```cron
# 05:05 يومياً — نسخة احتياطية لقاعدة البيانات قبل الأرشفة
5 5 * * * cd /path/to/pizza-day-night && mysqldump --single-transaction --quick --routines --events pizza_day_night > /backups/pdn-$(date +\%Y\%m\%d).sql 2>> /var/log/pdn-backup.log
```

- [ ] `npm run backup:db` يُنتج ملفّ `.sql` في `backups/`
- [ ] جُدولت `PDN-Backup` الساعة **05:05 يومياً** (قبل `PDN-Archive` الساعة 05:15)
- [ ] مجلّد النسخ على **قرص مختلف / خارج الموقع** إن أمكن
- [ ] جُرّبت استعادة نسخة مرّة واحدة على الأقل (`mysql db < backups\pdn-*.sql`)

---

## ٦) فحوص ما قبل الإطلاق النهائية

- [ ] تنفيذ طلب اختباري كامل (ضيف + مسجَّل الدخول)؛ وطباعة فاتورة
- [ ] ظهور رسائل منطقة التوصيل / الحدّ الأدنى / خارج ساعات العمل بالألمانية
- [ ] المالك (MASTER) يعدّل الإعدادات/الساعات، والمدير (MANAGER) لا يستطيع (RBAC سليم)
- [ ] كونسول المتصفّح نظيف على `/` و`/menu` و`/checkout` (لا تحذيرات hydration/theme)
- [ ] الشكل سليم على الهاتف وسطح المكتب
- [ ] خذ نسخة احتياطية من قاعدة البيانات، ثم حوّل الـ DNS إلى الإنتاج 🚀

---

### سكربتات مفيدة

| الأمر | ما يفعله |
|---|---|
| `npm run archive` / `... -- --dry-run` | أرشفة ليلية + تنظيف الاحتفاظ (وضع المعاينة). |
| `npm run backup:db` | نسخ قاعدة البيانات إلى `backups/` وحذف القديم. |
| `npm run create:master` / `create:admin` | إنشاء حساب المالك / المدير. |
| `npm run set:role` | استرجاع/تغيير دور مستخدم من سطر الأوامر. |
| `npm run db:push` | مزامنة مخطّط Prisma مع قاعدة البيانات. |
| `npm run print:test` | اختبار طباعة الفاتورة دون لوحة التحكم. |
