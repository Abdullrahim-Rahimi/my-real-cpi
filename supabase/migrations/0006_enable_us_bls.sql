-- US is now supported via the BLS ingester (src/lib/ingestion/bls.ts).
-- The COICOP -> BLS series mapping is documented in that file; some categories
-- are approximate (notably 02 alcohol/tobacco -> alcohol-only, and 11 restaurants
-- -> food-away-from-home).
--
-- OECD-only countries (CA, AU, NZ, JP, KR, IL, MX, CL, CO, CR) remain
-- is_supported=false: OECD's COICOP-1999 dataset froze at 2021-06 and the
-- COICOP-2018 dataset doesn't expose the full per-division breakdown for them.
-- See src/lib/ingestion/oecd.ts for the full investigation.

update public.countries
set is_supported = true
where code = 'US' and cpi_source = 'bls';
