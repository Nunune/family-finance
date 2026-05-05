-- Seed default categories (idempotent)
INSERT INTO "Category" ("id", "name", "icon", "color", "type", "isDefault")
VALUES
  ('cat_anUong',    'Ăn uống',    '🍜', '#F97316', 'EXPENSE', true),
  ('cat_diChuyen',  'Di chuyển',  '🚗', '#3B82F6', 'EXPENSE', true),
  ('cat_hoaDon',    'Hóa đơn',    '💡', '#EAB308', 'EXPENSE', true),
  ('cat_muaSam',    'Mua sắm',    '🛍️', '#EC4899', 'EXPENSE', true),
  ('cat_giaoDoc',   'Giáo dục',   '📚', '#8B5CF6', 'EXPENSE', true),
  ('cat_sucKhoe',   'Sức khỏe',   '🏥', '#10B981', 'EXPENSE', true),
  ('cat_giaiTri',   'Giải trí',   '🎮', '#6366F1', 'EXPENSE', true),
  ('cat_khacChi',   'Khác (chi)', '📦', '#6B7280', 'EXPENSE', true),
  ('cat_luong',     'Lương',      '💰', '#10B981', 'INCOME',  true),
  ('cat_thuong',    'Thưởng',     '🎁', '#F59E0B', 'INCOME',  true),
  ('cat_dauTu',     'Đầu tư',     '📈', '#3B82F6', 'INCOME',  true),
  ('cat_khacThu',   'Khác (thu)', '💵', '#6B7280', 'INCOME',  true)
ON CONFLICT ("name") DO NOTHING;
