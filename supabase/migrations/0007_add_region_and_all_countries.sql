-- Add region column to countries (for grouping the picker by continent)
-- and insert every remaining ISO 3166-1 country we didn't seed initially.
--
-- The earlier seed (0003) only covered ~66 large/notable economies. The
-- product spec is "all countries selectable, 'coming soon' for unsupported"
-- so we backfill the rest of the world here. New rows are flagged
-- is_supported=false; existing rows keep their flags via on conflict do nothing.
--
-- Region values: 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania'
-- (UN M49 broad geographic regions, with TR in Europe per Eurostat usage and
-- AM/AZ/GE in Asia per UN convention.)

alter table public.countries
  add column if not exists region text;

-- Backfill region for the existing 66 rows.
update public.countries set region = case code
  -- Europe (Eurostat-covered + others)
  when 'GB' then 'Europe' when 'NO' then 'Europe' when 'IS' then 'Europe'
  when 'CH' then 'Europe' when 'TR' then 'Europe' when 'AT' then 'Europe'
  when 'BE' then 'Europe' when 'BG' then 'Europe' when 'HR' then 'Europe'
  when 'CY' then 'Europe' when 'CZ' then 'Europe' when 'DK' then 'Europe'
  when 'EE' then 'Europe' when 'FI' then 'Europe' when 'FR' then 'Europe'
  when 'DE' then 'Europe' when 'GR' then 'Europe' when 'HU' then 'Europe'
  when 'IE' then 'Europe' when 'IT' then 'Europe' when 'LV' then 'Europe'
  when 'LT' then 'Europe' when 'LU' then 'Europe' when 'MT' then 'Europe'
  when 'NL' then 'Europe' when 'PL' then 'Europe' when 'PT' then 'Europe'
  when 'RO' then 'Europe' when 'SK' then 'Europe' when 'SI' then 'Europe'
  when 'ES' then 'Europe' when 'SE' then 'Europe' when 'RU' then 'Europe'
  when 'UA' then 'Europe'
  -- Americas
  when 'US' then 'Americas' when 'CA' then 'Americas' when 'MX' then 'Americas'
  when 'CL' then 'Americas' when 'CO' then 'Americas' when 'CR' then 'Americas'
  when 'BR' then 'Americas' when 'AR' then 'Americas' when 'PE' then 'Americas'
  -- Asia
  when 'IL' then 'Asia' when 'JP' then 'Asia' when 'KR' then 'Asia'
  when 'CN' then 'Asia' when 'IN' then 'Asia' when 'ID' then 'Asia'
  when 'PH' then 'Asia' when 'TH' then 'Asia' when 'VN' then 'Asia'
  when 'MY' then 'Asia' when 'SG' then 'Asia' when 'HK' then 'Asia'
  when 'TW' then 'Asia' when 'SA' then 'Asia' when 'AE' then 'Asia'
  when 'BD' then 'Asia' when 'PK' then 'Asia'
  -- Africa
  when 'ZA' then 'Africa' when 'NG' then 'Africa' when 'KE' then 'Africa'
  when 'EG' then 'Africa'
  -- Oceania
  when 'AU' then 'Oceania' when 'NZ' then 'Oceania'
  else region
end
where region is null;

alter table public.countries
  alter column region set not null;

create index if not exists countries_region_idx on public.countries (region, name);

-- Now insert every other ISO 3166-1 country we don't have yet.
-- All are is_supported=false (cpi_source=null) until ingestion is wired.
insert into public.countries (code, iso3, name, currency, cpi_source, is_supported, region) values
  -- Europe (rest)
  ('AL', 'ALB', 'Albania',                'ALL', null, false, 'Europe'),
  ('AD', 'AND', 'Andorra',                'EUR', null, false, 'Europe'),
  ('BY', 'BLR', 'Belarus',                'BYN', null, false, 'Europe'),
  ('BA', 'BIH', 'Bosnia and Herzegovina', 'BAM', null, false, 'Europe'),
  ('FO', 'FRO', 'Faroe Islands',          'DKK', null, false, 'Europe'),
  ('GI', 'GIB', 'Gibraltar',              'GIP', null, false, 'Europe'),
  ('GG', 'GGY', 'Guernsey',               'GBP', null, false, 'Europe'),
  ('IM', 'IMN', 'Isle of Man',            'GBP', null, false, 'Europe'),
  ('JE', 'JEY', 'Jersey',                 'GBP', null, false, 'Europe'),
  ('XK', 'XKX', 'Kosovo',                 'EUR', null, false, 'Europe'),
  ('LI', 'LIE', 'Liechtenstein',          'CHF', null, false, 'Europe'),
  ('MK', 'MKD', 'North Macedonia',        'MKD', null, false, 'Europe'),
  ('MD', 'MDA', 'Moldova',                'MDL', null, false, 'Europe'),
  ('MC', 'MCO', 'Monaco',                 'EUR', null, false, 'Europe'),
  ('ME', 'MNE', 'Montenegro',             'EUR', null, false, 'Europe'),
  ('SM', 'SMR', 'San Marino',             'EUR', null, false, 'Europe'),
  ('RS', 'SRB', 'Serbia',                 'RSD', null, false, 'Europe'),
  ('VA', 'VAT', 'Vatican City',           'EUR', null, false, 'Europe'),
  -- Asia (rest)
  ('AF', 'AFG', 'Afghanistan',            'AFN', null, false, 'Asia'),
  ('AM', 'ARM', 'Armenia',                'AMD', null, false, 'Asia'),
  ('AZ', 'AZE', 'Azerbaijan',             'AZN', null, false, 'Asia'),
  ('BH', 'BHR', 'Bahrain',                'BHD', null, false, 'Asia'),
  ('BT', 'BTN', 'Bhutan',                 'BTN', null, false, 'Asia'),
  ('BN', 'BRN', 'Brunei',                 'BND', null, false, 'Asia'),
  ('KH', 'KHM', 'Cambodia',               'KHR', null, false, 'Asia'),
  ('GE', 'GEO', 'Georgia',                'GEL', null, false, 'Asia'),
  ('IR', 'IRN', 'Iran',                   'IRR', null, false, 'Asia'),
  ('IQ', 'IRQ', 'Iraq',                   'IQD', null, false, 'Asia'),
  ('JO', 'JOR', 'Jordan',                 'JOD', null, false, 'Asia'),
  ('KZ', 'KAZ', 'Kazakhstan',             'KZT', null, false, 'Asia'),
  ('KW', 'KWT', 'Kuwait',                 'KWD', null, false, 'Asia'),
  ('KG', 'KGZ', 'Kyrgyzstan',             'KGS', null, false, 'Asia'),
  ('LA', 'LAO', 'Laos',                   'LAK', null, false, 'Asia'),
  ('LB', 'LBN', 'Lebanon',                'LBP', null, false, 'Asia'),
  ('MO', 'MAC', 'Macao SAR',              'MOP', null, false, 'Asia'),
  ('MV', 'MDV', 'Maldives',               'MVR', null, false, 'Asia'),
  ('MN', 'MNG', 'Mongolia',               'MNT', null, false, 'Asia'),
  ('MM', 'MMR', 'Myanmar',                'MMK', null, false, 'Asia'),
  ('NP', 'NPL', 'Nepal',                  'NPR', null, false, 'Asia'),
  ('KP', 'PRK', 'North Korea',            'KPW', null, false, 'Asia'),
  ('OM', 'OMN', 'Oman',                   'OMR', null, false, 'Asia'),
  ('PS', 'PSE', 'Palestine',              'ILS', null, false, 'Asia'),
  ('QA', 'QAT', 'Qatar',                  'QAR', null, false, 'Asia'),
  ('LK', 'LKA', 'Sri Lanka',              'LKR', null, false, 'Asia'),
  ('SY', 'SYR', 'Syria',                  'SYP', null, false, 'Asia'),
  ('TJ', 'TJK', 'Tajikistan',             'TJS', null, false, 'Asia'),
  ('TL', 'TLS', 'Timor-Leste',            'USD', null, false, 'Asia'),
  ('TM', 'TKM', 'Turkmenistan',           'TMT', null, false, 'Asia'),
  ('UZ', 'UZB', 'Uzbekistan',             'UZS', null, false, 'Asia'),
  ('YE', 'YEM', 'Yemen',                  'YER', null, false, 'Asia'),
  -- Americas (rest)
  ('AG', 'ATG', 'Antigua and Barbuda',    'XCD', null, false, 'Americas'),
  ('BS', 'BHS', 'Bahamas',                'BSD', null, false, 'Americas'),
  ('BB', 'BRB', 'Barbados',               'BBD', null, false, 'Americas'),
  ('BZ', 'BLZ', 'Belize',                 'BZD', null, false, 'Americas'),
  ('BO', 'BOL', 'Bolivia',                'BOB', null, false, 'Americas'),
  ('CU', 'CUB', 'Cuba',                   'CUP', null, false, 'Americas'),
  ('DM', 'DMA', 'Dominica',               'XCD', null, false, 'Americas'),
  ('DO', 'DOM', 'Dominican Republic',     'DOP', null, false, 'Americas'),
  ('EC', 'ECU', 'Ecuador',                'USD', null, false, 'Americas'),
  ('SV', 'SLV', 'El Salvador',            'USD', null, false, 'Americas'),
  ('GD', 'GRD', 'Grenada',                'XCD', null, false, 'Americas'),
  ('GT', 'GTM', 'Guatemala',              'GTQ', null, false, 'Americas'),
  ('GY', 'GUY', 'Guyana',                 'GYD', null, false, 'Americas'),
  ('HT', 'HTI', 'Haiti',                  'HTG', null, false, 'Americas'),
  ('HN', 'HND', 'Honduras',               'HNL', null, false, 'Americas'),
  ('JM', 'JAM', 'Jamaica',                'JMD', null, false, 'Americas'),
  ('NI', 'NIC', 'Nicaragua',              'NIO', null, false, 'Americas'),
  ('PA', 'PAN', 'Panama',                 'PAB', null, false, 'Americas'),
  ('PY', 'PRY', 'Paraguay',               'PYG', null, false, 'Americas'),
  ('PR', 'PRI', 'Puerto Rico',            'USD', null, false, 'Americas'),
  ('KN', 'KNA', 'Saint Kitts and Nevis',  'XCD', null, false, 'Americas'),
  ('LC', 'LCA', 'Saint Lucia',            'XCD', null, false, 'Americas'),
  ('VC', 'VCT', 'Saint Vincent and the Grenadines', 'XCD', null, false, 'Americas'),
  ('SR', 'SUR', 'Suriname',               'SRD', null, false, 'Americas'),
  ('TT', 'TTO', 'Trinidad and Tobago',    'TTD', null, false, 'Americas'),
  ('UY', 'URY', 'Uruguay',                'UYU', null, false, 'Americas'),
  ('VE', 'VEN', 'Venezuela',              'VES', null, false, 'Americas'),
  -- Africa (rest)
  ('DZ', 'DZA', 'Algeria',                'DZD', null, false, 'Africa'),
  ('AO', 'AGO', 'Angola',                 'AOA', null, false, 'Africa'),
  ('BJ', 'BEN', 'Benin',                  'XOF', null, false, 'Africa'),
  ('BW', 'BWA', 'Botswana',               'BWP', null, false, 'Africa'),
  ('BF', 'BFA', 'Burkina Faso',           'XOF', null, false, 'Africa'),
  ('BI', 'BDI', 'Burundi',                'BIF', null, false, 'Africa'),
  ('CV', 'CPV', 'Cabo Verde',             'CVE', null, false, 'Africa'),
  ('CM', 'CMR', 'Cameroon',               'XAF', null, false, 'Africa'),
  ('CF', 'CAF', 'Central African Republic', 'XAF', null, false, 'Africa'),
  ('TD', 'TCD', 'Chad',                   'XAF', null, false, 'Africa'),
  ('KM', 'COM', 'Comoros',                'KMF', null, false, 'Africa'),
  ('CD', 'COD', 'DR Congo',               'CDF', null, false, 'Africa'),
  ('CG', 'COG', 'Congo',                  'XAF', null, false, 'Africa'),
  ('CI', 'CIV', 'Côte d''Ivoire',         'XOF', null, false, 'Africa'),
  ('DJ', 'DJI', 'Djibouti',               'DJF', null, false, 'Africa'),
  ('GQ', 'GNQ', 'Equatorial Guinea',      'XAF', null, false, 'Africa'),
  ('ER', 'ERI', 'Eritrea',                'ERN', null, false, 'Africa'),
  ('SZ', 'SWZ', 'Eswatini',               'SZL', null, false, 'Africa'),
  ('ET', 'ETH', 'Ethiopia',               'ETB', null, false, 'Africa'),
  ('GA', 'GAB', 'Gabon',                  'XAF', null, false, 'Africa'),
  ('GM', 'GMB', 'Gambia',                 'GMD', null, false, 'Africa'),
  ('GH', 'GHA', 'Ghana',                  'GHS', null, false, 'Africa'),
  ('GN', 'GIN', 'Guinea',                 'GNF', null, false, 'Africa'),
  ('GW', 'GNB', 'Guinea-Bissau',          'XOF', null, false, 'Africa'),
  ('LS', 'LSO', 'Lesotho',                'LSL', null, false, 'Africa'),
  ('LR', 'LBR', 'Liberia',                'LRD', null, false, 'Africa'),
  ('LY', 'LBY', 'Libya',                  'LYD', null, false, 'Africa'),
  ('MG', 'MDG', 'Madagascar',             'MGA', null, false, 'Africa'),
  ('MW', 'MWI', 'Malawi',                 'MWK', null, false, 'Africa'),
  ('ML', 'MLI', 'Mali',                   'XOF', null, false, 'Africa'),
  ('MR', 'MRT', 'Mauritania',             'MRU', null, false, 'Africa'),
  ('MU', 'MUS', 'Mauritius',              'MUR', null, false, 'Africa'),
  ('MA', 'MAR', 'Morocco',                'MAD', null, false, 'Africa'),
  ('MZ', 'MOZ', 'Mozambique',             'MZN', null, false, 'Africa'),
  ('NA', 'NAM', 'Namibia',                'NAD', null, false, 'Africa'),
  ('NE', 'NER', 'Niger',                  'XOF', null, false, 'Africa'),
  ('RW', 'RWA', 'Rwanda',                 'RWF', null, false, 'Africa'),
  ('ST', 'STP', 'São Tomé and Príncipe',  'STN', null, false, 'Africa'),
  ('SN', 'SEN', 'Senegal',                'XOF', null, false, 'Africa'),
  ('SC', 'SYC', 'Seychelles',             'SCR', null, false, 'Africa'),
  ('SL', 'SLE', 'Sierra Leone',           'SLE', null, false, 'Africa'),
  ('SO', 'SOM', 'Somalia',                'SOS', null, false, 'Africa'),
  ('SS', 'SSD', 'South Sudan',            'SSP', null, false, 'Africa'),
  ('SD', 'SDN', 'Sudan',                  'SDG', null, false, 'Africa'),
  ('TZ', 'TZA', 'Tanzania',               'TZS', null, false, 'Africa'),
  ('TG', 'TGO', 'Togo',                   'XOF', null, false, 'Africa'),
  ('TN', 'TUN', 'Tunisia',                'TND', null, false, 'Africa'),
  ('UG', 'UGA', 'Uganda',                 'UGX', null, false, 'Africa'),
  ('ZM', 'ZMB', 'Zambia',                 'ZMW', null, false, 'Africa'),
  ('ZW', 'ZWE', 'Zimbabwe',               'ZWL', null, false, 'Africa'),
  -- Oceania (rest)
  ('FJ', 'FJI', 'Fiji',                   'FJD', null, false, 'Oceania'),
  ('KI', 'KIR', 'Kiribati',               'AUD', null, false, 'Oceania'),
  ('MH', 'MHL', 'Marshall Islands',       'USD', null, false, 'Oceania'),
  ('FM', 'FSM', 'Micronesia',             'USD', null, false, 'Oceania'),
  ('NR', 'NRU', 'Nauru',                  'AUD', null, false, 'Oceania'),
  ('PW', 'PLW', 'Palau',                  'USD', null, false, 'Oceania'),
  ('PG', 'PNG', 'Papua New Guinea',       'PGK', null, false, 'Oceania'),
  ('WS', 'WSM', 'Samoa',                  'WST', null, false, 'Oceania'),
  ('SB', 'SLB', 'Solomon Islands',        'SBD', null, false, 'Oceania'),
  ('TO', 'TON', 'Tonga',                  'TOP', null, false, 'Oceania'),
  ('TV', 'TUV', 'Tuvalu',                 'AUD', null, false, 'Oceania'),
  ('VU', 'VUT', 'Vanuatu',                'VUV', null, false, 'Oceania')
on conflict (code) do nothing;
