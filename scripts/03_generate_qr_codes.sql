-- ============================================================
-- Generate QR codes for vehicles that don't have one
-- ============================================================

UPDATE vehicles
SET qr_code = 'cloudnext://bus/' || id::text
WHERE qr_code IS NULL;

-- Verify
SELECT id, registration, qr_code FROM vehicles WHERE qr_code IS NOT NULL LIMIT 10;
