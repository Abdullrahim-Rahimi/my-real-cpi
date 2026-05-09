-- COICOP 2018 — 12 top-level divisions used by OECD, Eurostat, and most national stats offices.
-- Source: UN Statistics Division.

insert into public.coicop_categories (code, name, short_name, description, display_order) values
  ('01', 'Food and non-alcoholic beverages',           'Food & groceries',           'Groceries, fresh food, soft drinks, coffee, tea',                                  1),
  ('02', 'Alcoholic beverages, tobacco and narcotics', 'Alcohol & tobacco',          'Beer, wine, spirits, cigarettes',                                                  2),
  ('03', 'Clothing and footwear',                       'Clothing & footwear',        'Apparel, shoes, dry cleaning, repairs',                                            3),
  ('04', 'Housing, water, electricity, gas and other fuels', 'Housing & utilities',  'Rent, mortgage interest, water, electricity, gas, heating fuel',                   4),
  ('05', 'Furnishings, household equipment and routine household maintenance', 'Household goods', 'Furniture, appliances, kitchenware, cleaning supplies',                  5),
  ('06', 'Health',                                       'Health',                    'Medicines, doctor visits, dental, hospital, health insurance out-of-pocket',       6),
  ('07', 'Transport',                                    'Transport',                 'Fuel, vehicle purchase, public transport, ride-share, vehicle maintenance',        7),
  ('08', 'Information and communication',                'Communication',             'Mobile phone, internet, postal services, devices',                                 8),
  ('09', 'Recreation, sport and culture',                'Recreation & culture',      'Streaming, books, sports, hobbies, holidays, gaming',                              9),
  ('10', 'Education services',                           'Education',                 'Tuition, school fees, courses',                                                   10),
  ('11', 'Restaurants and accommodation services',       'Eating out & travel',       'Restaurants, takeout, cafes, hotels',                                             11),
  ('12', 'Insurance and financial services',             'Insurance & financial',     'Personal care, insurance premiums, banking fees, other miscellaneous services',   12)
on conflict (code) do update set
  name          = excluded.name,
  short_name    = excluded.short_name,
  description   = excluded.description,
  display_order = excluded.display_order;
