-- ===========================================================================
--  Pizza Day & Night — إنشاء حساب الماستر (MySQL / MariaDB)
--
--  الماستر هو حساب المالك: كامل لوحة التحكم، وهو الدور الوحيد الذي يقبله
--  باب الدخول المخفي /manage-9f3a/login.
--
--  الطريق الأسهل هو السكربت:  npm run create:master
--  هذا الملف بديل يدوي عندما تريد الإدخال مباشرة إلى القاعدة.
--
--  التنفيذ:
--    phpMyAdmin ← قاعدة pizza_day_night ← تبويب SQL ← الصق ونفّذ
--    أو من الطرفية:
--      D:\xampp\mysql\bin\mysql.exe -u root pizza_day_night < scripts/sql/create-master.sql
--
--  ملاحظات على الأعمدة:
--    • id ليس تلقائياً — نولّده هنا بـ REPLACE(UUID(), '-', '')
--    • updatedAt بلا قيمة افتراضية — نمرّر NOW(3)
--    • createdAt يملأ نفسه
--    • passwordHash تجزئة bcrypt جاهزة أدناه — لا تكتب كلمة المرور نصاً صريحاً
-- ===========================================================================

SET NAMES utf8mb4;

-- إن كان اسم قاعدتك مختلفاً، غيّره هنا (وفي DATABASE_URL داخل .env.local):
USE pizza_day_night;

-- ---------------------------------------------------------------------------
--  الحساب
--    البريد        : master@pizzadaynight.de
--    كلمة المرور   : Master@Pizza2026      ← غيّرها بعد أول دخول
--    التجزئة أدناه هي bcrypt (cost 12) لكلمة المرور هذه بالذات.
--
--  إن أردت بريداً أو كلمة مرور أخرى: بدّل البريد هنا، وولّد تجزئة جديدة بـ
--    npm run hash:password -- "كلمة-المرور-الجديدة"
--  ثم ضع الناتج مكان القيمة أدناه.
-- ---------------------------------------------------------------------------

INSERT INTO users (id, email, name, phone, passwordHash, role, updatedAt)
VALUES (
  REPLACE(UUID(), '-', ''),
  'master@pizzadaynight.de',
  'Master',
  NULL,
  '$2b$12$Hx1FJuzjWMQ3qa4Bi5NJzOKP8wr0Jysz5CSuh4bByhwZEKRNhkvCa',
  'MASTER',
  NOW(3)
)
ON DUPLICATE KEY UPDATE
  name         = VALUES(name),
  passwordHash = VALUES(passwordHash),
  role         = 'MASTER',
  updatedAt    = NOW(3);

-- ---------------------------------------------------------------------------
--  تحقّق: يجب أن يظهر صف واحد دوره MASTER
-- ---------------------------------------------------------------------------

SELECT id, email, name, role, createdAt
FROM users
WHERE role = 'MASTER';

-- ---------------------------------------------------------------------------
--  (اختياري) ترقية حساب موجود إلى ماستر بدل إنشاء حساب جديد:
--
--    UPDATE users SET role = 'MASTER', updatedAt = NOW(3)
--    WHERE email = 'baqir7710@gmail.com';
--
--  (اختياري) تحويل حساب إلى مدير يومي (طلبات وتقارير وإعدادات فقط):
--
--    UPDATE users SET role = 'ADMIN', updatedAt = NOW(3)
--    WHERE email = 'manager@example.com';
-- ---------------------------------------------------------------------------
