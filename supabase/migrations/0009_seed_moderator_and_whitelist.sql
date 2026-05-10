-- Bootstrap the contributor/moderator system.
--
-- 1. Grant the founding account (riseadvisorycompany@gmail.com) the moderator
--    role for every country. Moderators are global by intent: the
--    country_code on a 'moderator' row is decorative (we use 'US' as the
--    default home country, but is_moderator() ignores it).
-- 2. Seed the source-URL whitelist for countries we already auto-ingest, so
--    that future community submissions for those countries (in case auto-
--    ingest breaks) have a valid allowlist out of the box.

-- ---- 1. Grant moderator role ----
-- Idempotent: if the user doesn't exist yet (account not created), this is
-- a no-op and the bootstrap step is repeated by hand later.
insert into public.country_contributors (user_id, country_code, role, status, approved_at)
select id, 'US', 'moderator', 'active', now()
  from auth.users
 where email = 'riseadvisorycompany@gmail.com'
on conflict (user_id, country_code, role) do update
  set status = 'active', approved_at = coalesce(country_contributors.approved_at, now());

-- ---- 2. Seed source-URL whitelist for already-supported countries ----
-- For Eurostat-covered countries we keep eurostat.ec.europa.eu; for the US,
-- bls.gov. These give community fallback contributors a starting allowlist.
insert into public.country_source_whitelist (country_code, domain, description) values
  -- Eurostat-covered (Eurostat itself is the canonical fallback for community submissions)
  ('GB', 'ec.europa.eu',         'Eurostat HICP'),
  ('GB', 'ons.gov.uk',           'UK Office for National Statistics'),
  ('NO', 'ec.europa.eu',         'Eurostat HICP'),
  ('NO', 'ssb.no',               'Statistics Norway'),
  ('IS', 'ec.europa.eu',         'Eurostat HICP'),
  ('IS', 'statice.is',           'Statistics Iceland'),
  ('CH', 'ec.europa.eu',         'Eurostat HICP'),
  ('CH', 'bfs.admin.ch',         'Federal Statistical Office of Switzerland'),
  ('TR', 'ec.europa.eu',         'Eurostat HICP'),
  ('TR', 'data.tuik.gov.tr',     'Turkish Statistical Institute'),
  ('AT', 'ec.europa.eu',         'Eurostat HICP'),
  ('AT', 'statistik.at',         'Statistics Austria'),
  ('BE', 'ec.europa.eu',         'Eurostat HICP'),
  ('BE', 'statbel.fgov.be',      'Statbel'),
  ('BG', 'ec.europa.eu',         'Eurostat HICP'),
  ('BG', 'nsi.bg',               'NSI Bulgaria'),
  ('HR', 'ec.europa.eu',         'Eurostat HICP'),
  ('HR', 'dzs.gov.hr',           'Croatian Bureau of Statistics'),
  ('CY', 'ec.europa.eu',         'Eurostat HICP'),
  ('CY', 'cystat.gov.cy',        'Statistical Service of Cyprus'),
  ('CZ', 'ec.europa.eu',         'Eurostat HICP'),
  ('CZ', 'czso.cz',              'Czech Statistical Office'),
  ('DK', 'ec.europa.eu',         'Eurostat HICP'),
  ('DK', 'dst.dk',               'Statistics Denmark'),
  ('EE', 'ec.europa.eu',         'Eurostat HICP'),
  ('EE', 'stat.ee',              'Statistics Estonia'),
  ('FI', 'ec.europa.eu',         'Eurostat HICP'),
  ('FI', 'stat.fi',              'Statistics Finland'),
  ('FR', 'ec.europa.eu',         'Eurostat HICP'),
  ('FR', 'insee.fr',             'INSEE'),
  ('DE', 'ec.europa.eu',         'Eurostat HICP'),
  ('DE', 'destatis.de',          'Federal Statistical Office of Germany'),
  ('GR', 'ec.europa.eu',         'Eurostat HICP'),
  ('GR', 'statistics.gr',        'Hellenic Statistical Authority'),
  ('HU', 'ec.europa.eu',         'Eurostat HICP'),
  ('HU', 'ksh.hu',               'Hungarian Central Statistical Office'),
  ('IE', 'ec.europa.eu',         'Eurostat HICP'),
  ('IE', 'cso.ie',               'CSO Ireland'),
  ('IT', 'ec.europa.eu',         'Eurostat HICP'),
  ('IT', 'istat.it',             'Italian National Institute of Statistics'),
  ('LV', 'ec.europa.eu',         'Eurostat HICP'),
  ('LV', 'stat.gov.lv',          'Central Statistical Bureau of Latvia'),
  ('LT', 'ec.europa.eu',         'Eurostat HICP'),
  ('LT', 'osp.stat.gov.lt',      'Statistics Lithuania'),
  ('LU', 'ec.europa.eu',         'Eurostat HICP'),
  ('LU', 'statistiques.public.lu','STATEC'),
  ('MT', 'ec.europa.eu',         'Eurostat HICP'),
  ('MT', 'nso.gov.mt',           'NSO Malta'),
  ('NL', 'ec.europa.eu',         'Eurostat HICP'),
  ('NL', 'cbs.nl',               'Statistics Netherlands'),
  ('PL', 'ec.europa.eu',         'Eurostat HICP'),
  ('PL', 'stat.gov.pl',          'Statistics Poland'),
  ('PT', 'ec.europa.eu',         'Eurostat HICP'),
  ('PT', 'ine.pt',               'Statistics Portugal'),
  ('RO', 'ec.europa.eu',         'Eurostat HICP'),
  ('RO', 'insse.ro',             'National Institute of Statistics Romania'),
  ('SK', 'ec.europa.eu',         'Eurostat HICP'),
  ('SK', 'statistics.sk',        'Statistical Office of Slovakia'),
  ('SI', 'ec.europa.eu',         'Eurostat HICP'),
  ('SI', 'stat.si',              'Statistical Office of Slovenia'),
  ('ES', 'ec.europa.eu',         'Eurostat HICP'),
  ('ES', 'ine.es',               'INE Spain'),
  ('SE', 'ec.europa.eu',         'Eurostat HICP'),
  ('SE', 'scb.se',               'Statistics Sweden'),
  -- US: BLS
  ('US', 'bls.gov',              'US Bureau of Labor Statistics')
on conflict (country_code, domain) do nothing;
