import { describe, expect, test } from "vitest";
import {
  extractHostname,
  hostMatchesDomain,
  isUrlWhitelisted,
} from "./whitelist";

describe("extractHostname", () => {
  test("returns lowercase hostname without www.", () => {
    expect(extractHostname("https://www.GSS.gov.gh/page")).toBe("gss.gov.gh");
    expect(extractHostname("https://data.bls.gov/")).toBe("data.bls.gov");
  });

  test("rejects non-http(s) schemes", () => {
    expect(extractHostname("javascript:alert(1)")).toBeNull();
    expect(extractHostname("file:///etc/passwd")).toBeNull();
    expect(extractHostname("ftp://example.com/")).toBeNull();
  });

  test("rejects malformed URLs", () => {
    expect(extractHostname("not a url")).toBeNull();
    expect(extractHostname("")).toBeNull();
    expect(extractHostname("//noscheme.com")).toBeNull();
  });
});

describe("hostMatchesDomain", () => {
  test("exact match", () => {
    expect(hostMatchesDomain("gss.gov.gh", "gss.gov.gh")).toBe(true);
  });

  test("true subdomain", () => {
    expect(hostMatchesDomain("data.gss.gov.gh", "gss.gov.gh")).toBe(true);
    expect(hostMatchesDomain("a.b.gss.gov.gh", "gss.gov.gh")).toBe(true);
  });

  test("non-subdomain prefix is NOT a match (security)", () => {
    // The classic spoofing attack — without the leading dot check this would pass.
    expect(hostMatchesDomain("evilgss.gov.gh", "gss.gov.gh")).toBe(false);
    expect(hostMatchesDomain("gss.gov.gh.attacker.com", "gss.gov.gh")).toBe(false);
  });

  test("case-insensitive", () => {
    expect(hostMatchesDomain("DATA.GSS.GOV.GH", "gss.gov.gh")).toBe(true);
  });
});

describe("isUrlWhitelisted", () => {
  const ghana = ["gss.gov.gh", "bog.gov.gh"];

  test("accepts URL whose host suffix-matches an entry", () => {
    expect(isUrlWhitelisted("https://www.gss.gov.gh/cpi.pdf", ghana)).toBe(true);
    expect(isUrlWhitelisted("https://data.bog.gov.gh/index.html", ghana)).toBe(
      true,
    );
  });

  test("rejects URL not on the list", () => {
    expect(isUrlWhitelisted("https://example.com/cpi.pdf", ghana)).toBe(false);
    expect(isUrlWhitelisted("https://gss.gov.fake/cpi.pdf", ghana)).toBe(false);
  });

  test("rejects javascript: and other dangerous schemes even if host matches", () => {
    expect(
      isUrlWhitelisted("javascript:alert(1)//gss.gov.gh", ghana),
    ).toBe(false);
  });

  test("empty whitelist rejects everything", () => {
    expect(isUrlWhitelisted("https://gss.gov.gh/", [])).toBe(false);
  });

  test("rejects spoofing via bare-string prefix", () => {
    expect(isUrlWhitelisted("https://evilgss.gov.gh/", ghana)).toBe(false);
  });
});
