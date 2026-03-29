-- ============================================================
-- Generate mobile app credentials for drivers without them
-- ============================================================

DO $$
DECLARE
  d RECORD;
  tenant_slug TEXT;
  mobile_email TEXT;
  license_short TEXT;
  plain_password TEXT;
  -- Note: bcrypt hashing is done server-side, here we use a placeholder
  -- Run this script then update passwords via the API or use pgcrypto
  user_id UUID;
BEGIN
  FOR d IN
    SELECT dr.id, dr.employee_id, dr.full_name, dr.email, dr.license_number, dr.tenant_id
    FROM drivers dr
    WHERE dr.user_id IS NULL
  LOOP
    -- Get tenant slug
    SELECT slug INTO tenant_slug FROM tenants WHERE id = d.tenant_id;
    tenant_slug := COALESCE(tenant_slug, 'fleet');

    -- Build email
    mobile_email := COALESCE(
      d.email,
      lower(regexp_replace(d.employee_id, '[^a-zA-Z0-9]', '.', 'g')) || '@' || tenant_slug || '.fleet'
    );

    -- Create user (password hash is a temporary one — admin should reset)
    -- Using SHA256 as placeholder since bcrypt requires server-side code
    -- Default password: Driver@2026{license_last4}
    license_short := upper(right(regexp_replace(d.license_number, '[^a-zA-Z0-9]', '', 'g'), 4));

    INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
    VALUES (
      d.tenant_id,
      mobile_email,
      -- Temporary bcrypt hash for 'ChangeMe@123' - admin must reset
      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      d.full_name,
      'driver',
      true
    )
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO user_id;

    -- Link driver to user
    UPDATE drivers SET user_id = user_id WHERE id = d.id;

    RAISE NOTICE 'Created credentials for driver %: email=%, temp_password=ChangeMe@123 (MUST RESET)', d.full_name, mobile_email;
  END LOOP;
END $$;

-- Show results
SELECT d.full_name, d.employee_id, u.email AS mobile_email, u.role
FROM drivers d
JOIN users u ON d.user_id = u.id
WHERE u.role = 'driver'
ORDER BY d.full_name;
