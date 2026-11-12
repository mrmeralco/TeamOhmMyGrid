-- ==============================================================================
-- KuryenTipid / Team Ohm My Grid
-- Seed Data for Meralco Customers (Existing Utility Records)
-- Used to validate Customer Account Numbers (CAN) during user registration
-- ==============================================================================

INSERT INTO public.meralco_customers (
    can,
    sin,
    account_holder_name,
    email,
    service_address,
    rate_class,
    monthly_budget,
    household_members,
    major_appliances,
    is_registered
) VALUES
-- Account 1: Nena Villanueva (matches the UI screenshot SIN: 1234-5678-90)
(
    '1234567890',
    '1234-5678-90',
    'Nena Villanueva',
    'nena.villanueva@gmail.com',
    'Block 14 Lot 8, Sampaguita St., Quezon City, Metro Manila',
    'Residential',
    3500.00,
    5,
    ARRAY['Inverter AC (1.5 HP) x 2', 'Refrigerator (Inverter)', 'Washing Machine'],
    FALSE
),
-- Account 2: Jaeda Marthena Iral (Team Member)
(
    '1234567891',
    '1234-5678-91',
    'Jaeda Marthena Iral',
    'jaeda.iral@teamohmygrid.ph',
    'Unit 402, Katipunan Ave., Loyola Heights, Quezon City',
    'Residential',
    4200.00,
    4,
    ARRAY['Inverter AC (1.0 HP) x 2', 'Induction Cooker', 'Water Heater'],
    FALSE
),
-- Account 3: Carl Benedict Enriquez (Team Member)
(
    '1234567892',
    '1234-5678-92',
    'Carl Benedict Enriquez',
    'carl.enriquez@teamohmygrid.ph',
    '15 Malakas St., Diliman, Quezon City',
    'Residential',
    3800.00,
    3,
    ARRAY['Inverter AC (2.0 HP) x 1', 'Gaming PC', 'Smart TV 55"'],
    FALSE
),
-- Account 4: Jacob Antonio Uzel (Team Member)
(
    '1234567893',
    '1234-5678-93',
    'Jacob Antonio Uzel',
    'jacob.uzel@teamohmygrid.ph',
    '88 Magsaysay Blvd., Santa Mesa, Manila',
    'Residential',
    3000.00,
    4,
    ARRAY['Inverter AC (1.0 HP) x 1', 'Refrigerator', 'Electric Fan x 3'],
    FALSE
),
-- Account 5: Hector Escobido (Team Member)
(
    '1234567894',
    '1234-5678-94',
    'Hector Escobido',
    'hector.escobido@teamohmygrid.ph',
    '23 Boni Serrano Ave., Cubao, Quezon City',
    'Residential',
    4500.00,
    6,
    ARRAY['Window AC x 2', 'Microwave', 'Chest Freezer'],
    FALSE
),
-- Account 6: Lenard Cato Narvaza (Team Member)
(
    '1234567895',
    '1234-5678-95',
    'Lenard Cato Narvaza',
    'lenard.narvaza@teamohmygrid.ph',
    '45 West Avenue, Philam, Quezon City',
    'Residential',
    3200.00,
    3,
    ARRAY['Inverter AC (1.5 HP) x 1', 'Air Fryer', 'Laptop Setup'],
    FALSE
),
-- Account 7: Juan Dela Cruz (Sample residential account)
(
    '9876543210',
    '9876-5432-10',
    'Juan Dela Cruz',
    'juan.delacruz@gmail.com',
    '123 Rizal Ave., Caloocan City',
    'Residential',
    2800.00,
    4,
    ARRAY['Electric Fan x 4', 'Refrigerator', 'Rice Cooker'],
    FALSE
),
-- Account 8: Maria Santos (Sample residential account)
(
    '1029384756',
    '1029-3847-56',
    'Maria Santos',
    'maria.santos@gmail.com',
    '77 Acacia St., Pasig City',
    'Residential',
    5000.00,
    5,
    ARRAY['Inverter Split AC x 3', 'Double Door Refrigerator', 'Washing Machine'],
    FALSE
)
ON CONFLICT (can) DO UPDATE SET email = EXCLUDED.email;
