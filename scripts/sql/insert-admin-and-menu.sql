-- ===========================================================================
--  Pizza Day & Night — إدخال مباشر إلى قاعدة البيانات (MySQL / MariaDB)
--
--  الطريق المعتاد لإضافة المواد هو لوحة التحكم المخفية (/manage-9f3a).
--  هذا الملف بديل يدوي، مفيد للإدخال بالجملة أو عندما تريد كتابة الصفوف بنفسك.
--
--  ⚠ عدّل القيم أولاً ثم نفّذ. الملف كما هو يدخل قيماً تجريبية.
--
--  التنفيذ:
--    phpMyAdmin ← قاعدة pizza_day_night ← تبويب SQL ← الصق ونفّذ
--    أو من الطرفية:
--      D:\xampp\mysql\bin\mysql.exe -u root pizza_day_night < scripts/sql/insert-admin-and-menu.sql
--
--  قواعد تسري على كل الجداول هنا:
--    • عمود id ليس تلقائياً — اكتب نصاً فريداً، أو ولّده بـ REPLACE(UUID(), '-', '')
--    • عمود updatedAt بلا قيمة افتراضية — مرّر NOW(3) في كل INSERT و UPDATE
--    • عمود createdAt يملأ نفسه، فيمكن تركه خارج قائمة الأعمدة
-- ===========================================================================

SET NAMES utf8mb4;

-- إن كان اسم قاعدتك مختلفاً، غيّره هنا (وفي DATABASE_URL داخل .env.local):
USE pizza_day_night;


-- ─── 1) حساب مدير لتسجيل الدخول ───────────────────────────────────────────
--
-- كلمة المرور تُخزَّن كـ bcrypt hash، و MySQL لا يستطيع توليدها. ولّدها أولاً:
--
--     npm run hash:password -- "كلمة المرور التي تريدها"
--
-- وانسخ الناتج (يبدأ بـ $2b$12$ وطوله 60 حرفاً) مكان القيمة أدناه.
--
-- ⚠ إن نفّذت السطر دون استبدال الهاش، سيُنشأ حساب مدير لا يمكن الدخول به أبداً،
--   لأن MySQL يقبل أي نص في هذا العمود. تحقّق بالاستعلام في نهاية الملف.
--
-- البريد يجب أن يكون بأحرف صغيرة، لأن نموذج الدخول يحوّل ما يُكتب إلى أحرف صغيرة.

INSERT INTO users (id, email, name, phone, passwordHash, role, updatedAt)
VALUES (
  REPLACE(UUID(), '-', ''),
  'manager@example.com',
  'مدير المطعم',
  '0721 8601726',
  '$2b$12$ضع_الهاش_المولَّد_هنا',
  'ADMIN',
  NOW(3)
);

-- ثم سجّل الدخول من /manage-9f3a/login بالبريد وكلمة المرور نفسها.
--
-- ولترقية مستخدم موجود إلى مدير، أو لتغيير كلمة مروره، استعمل UPDATE بدل INSERT:
--
--   UPDATE users
--      SET role = 'ADMIN',
--          passwordHash = '$2b$12$الهاش_الجديد',
--          updatedAt = NOW(3)
--    WHERE email = 'manager@example.com';


-- ─── 2) تصنيف (قسم في القائمة) ────────────────────────────────────────────
--
-- slug: أحرف إنجليزية صغيرة وأرقام وشرطات فقط، وفريد لكل تصنيف — يظهر في الرابط.
-- sortOrder: ترتيب الأقسام في الصفحة (الأصغر أولاً). isActive: 1 ظاهر / 0 مخفي.

INSERT INTO categories (id, nameAr, nameDe, slug, imageUrl, sortOrder, isActive, updatedAt)
VALUES ('cat-example', 'اسم التصنيف', 'Kategoriename', 'example-category', NULL, 1, 1, NOW(3));


-- ─── 3) المواد (الأصناف) ──────────────────────────────────────────────────
--
--  categoryId      : id تصنيف موجود (الصنف يُحذف تلقائياً مع تصنيفه)
--  price           : السعر باليورو بنقطة عشرية، مثل 8.50
--  discountPercent : نسبة خصم من 0 إلى 90
--  discountPrice   : سعر نهائي صريح — إن وُضع تجاهَل discountPercent، ويجب أن يكون أقل من price
--  imageUrl        : مسار صورة مرفوعة من اللوحة مثل '/uploads/abc.webp'، أو NULL
--  isAvailable     : 1 متاح للطلب / 0 غير متاح
--  isFeatured      : 1 يظهر ضمن الأصناف المميّزة
--  tags, allergens : مصفوفة JSON نصية مثل '["vegetarian"]' أو NULL (يجب أن تكون JSON صالحاً)
--  sortOrder       : ترتيب الصنف داخل تصنيفه

INSERT INTO menu_items
  (id, categoryId, nameAr, nameDe, descriptionAr, descriptionDe,
   price, discountPercent, discountPrice, imageUrl,
   isAvailable, isFeatured, tags, allergens, sortOrder, updatedAt)
VALUES
  (REPLACE(UUID(), '-', ''), 'cat-example',
   'اسم الصنف بالعربية', 'Name auf Deutsch',
   'وصف مختصر بالعربية', 'Kurze Beschreibung',
   8.50, 0, NULL, NULL,
   1, 0, NULL, NULL, 1, NOW(3)),

  (REPLACE(UUID(), '-', ''), 'cat-example',
   'صنف عليه خصم 20%', 'Gericht mit Rabatt',
   NULL, NULL,
   12.00, 20, NULL, NULL,
   1, 1, '["spicy"]', '["gluten"]', 2, NOW(3));

-- إضافة صنف دون معرفة id التصنيف — يبحث عنه بالـ slug:

INSERT INTO menu_items (id, categoryId, nameAr, nameDe, price, sortOrder, updatedAt)
SELECT REPLACE(UUID(), '-', ''), c.id, 'صنف ثالث', 'Drittes Gericht', 9.90, 3, NOW(3)
  FROM categories c
 WHERE c.slug = 'example-category';


-- ─── 4) استعلامات صيانة جاهزة ─────────────────────────────────────────────
--
-- مكتوبة كتعليق عمداً حتى لا تُنفَّذ بالخطأ عند تشغيل الملف كاملاً.
-- انسخ ما تحتاجه، أزل علامتي -- ، وعدّل الشروط.
--
--   -- عرض القائمة الحالية:
--   SELECT c.nameAr AS التصنيف, i.nameAr AS الصنف, i.price, i.discountPercent, i.isAvailable
--     FROM menu_items i
--     JOIN categories c ON c.id = i.categoryId
--    ORDER BY c.sortOrder, i.sortOrder;
--
--   -- تغيير سعر صنف:
--   UPDATE menu_items SET price = 9.50, updatedAt = NOW(3) WHERE id = 'ضع_المعرّف';
--
--   -- إخفاء صنف مؤقتاً (يبقى في القائمة لكن لا يُطلب):
--   UPDATE menu_items SET isAvailable = 0, updatedAt = NOW(3) WHERE id = 'ضع_المعرّف';
--
--   -- حذف صنف:
--   DELETE FROM menu_items WHERE id = 'ضع_المعرّف';
--
--   -- حذف تصنيف ومعه كل أصنافه (ON DELETE CASCADE):
--   DELETE FROM categories WHERE slug = 'example-category';
--
--   -- عرض المدراء:
--   SELECT id, email, name, createdAt FROM users WHERE role = 'ADMIN';


-- ─── 4-ب) الأدوار: ماستر / مدير / زبون ────────────────────────────────────
--
--   MASTER   : كل شيء — الأطباق والأصناف ومناطق التوصيل ولوحة الأرقام،
--              وهو الدور الوحيد الذي يقبله رابط الدخول السري.
--   ADMIN    : المدير اليومي — الطلبات والإعدادات فقط. يدخل من /login العادي
--              ويصل إلى اللوحة من رابط «لوحة التحكم» في القائمة العلوية.
--   CUSTOMER : زبون، لا وصول إلى اللوحة إطلاقاً.
--
-- الأسهل من الطرفية:  npm run set:role -- master owner@example.com
-- أو مباشرة بالـ SQL:
--
--   UPDATE users SET role = 'MASTER',   updatedAt = NOW(3) WHERE email = 'owner@example.com';
--   UPDATE users SET role = 'ADMIN',    updatedAt = NOW(3) WHERE email = 'manager@example.com';
--   UPDATE users SET role = 'CUSTOMER', updatedAt = NOW(3) WHERE email = 'someone@example.com';
--
--   -- من يملك أي دور:
--   SELECT email, name, role FROM users ORDER BY role, email;


-- ─── 5) فحص ذاتي: حسابات لا يمكن الدخول بها ───────────────────────────────
--
-- هاش bcrypt طوله 60 حرفاً دائماً. أي صف يظهر هنا كلمة مروره غير صالحة —
-- غالباً لأن الهاش لم يُستبدل عند الإدخال — والدخول به مستحيل حتى تُصلحه بـ:
--   npm run hash:password -- "كلمة المرور"
--   UPDATE users SET passwordHash = 'الهاش', updatedAt = NOW(3) WHERE email = '…';

SELECT email, role, CHAR_LENGTH(passwordHash) AS hash_length
  FROM users
 WHERE CHAR_LENGTH(passwordHash) <> 60
    OR passwordHash NOT LIKE '$2%';
