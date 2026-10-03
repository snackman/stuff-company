/**
 * PDF generators for tax forms (W-9 / W-8BEN / W-8BEN-E), ported from
 * rsv.pizza (backend/src/services/taxFormPdf.service.ts, pdf-lib based).
 * Each generator draws a faithful rendering of the IRS form and returns a
 * Buffer. W-8BEN-E covers Parts I, III and XXIX; FFIs need a paper form.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
function drawField(page, opts) {
  const { x, y, width, height, label, value, font, boldFont, fontSize = 10 } = opts;
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    color: rgb(1, 1, 1)
  });
  if (label) {
    page.drawText(label, {
      x: x + 3,
      y: y - 10,
      size: 7,
      font: boldFont || font,
      color: rgb(0.3, 0.3, 0.3)
    });
  }
  if (value) {
    const valueY = label ? y - height + 6 : y - height + 10;
    // stuff.company: user input may contain characters the standard
    // Helvetica (WinAnsi) font can't encode, or be wider than the box.
    let text = toWinAnsi(font, String(value));
    let size = fontSize;
    const maxW = width - 8;
    while (size > 6 && font.widthOfTextAtSize(text, size) > maxW) size -= 0.5;
    while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxW) text = text.slice(0, -2) + "\u2026";
    page.drawText(text, {
      x: x + 4,
      y: valueY,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  }
}
const charsetCache = /* @__PURE__ */ new WeakMap();
function toWinAnsi(font, text) {
  let set = charsetCache.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsetCache.set(font, set);
  }
  let out = "";
  for (const ch of text.replace(/\s+/g, " ").normalize("NFC")) {
    const cp = ch.codePointAt(0);
    if (set.has(cp)) out += ch;
    else {
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      out += [...base].every((c) => set.has(c.codePointAt(0))) ? base : "?";
    }
  }
  return out;
}
function drawCheckbox(page, opts) {
  const { x, y, checked, label, font } = opts;
  page.drawRectangle({
    x,
    y: y - 10,
    width: 10,
    height: 10,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    color: rgb(1, 1, 1)
  });
  if (checked) {
    page.drawText("X", { x: x + 1.5, y: y - 9, size: 9, font, color: rgb(0, 0, 0) });
  }
  if (label) {
    page.drawText(label, { x: x + 14, y: y - 9, size: 8, font, color: rgb(0, 0, 0) });
  }
}
function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}
function todayIso() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
function formatW9CityStateZip(data) {
  const city = data.city?.trim();
  const state = data.state?.trim();
  const zip = data.zipCode?.trim();
  if (city || state || zip) {
    const cityState = [city, state].filter((s) => !!s && s.length > 0).join(", ");
    return [cityState, zip].filter((s) => !!s && s.length > 0).join(" ");
  }
  return data.cityStateZip?.trim() || "";
}
function formatW8CityLine(city, stateProvince, postalCode) {
  const c = city?.trim();
  const sp = stateProvince?.trim();
  const pc = postalCode?.trim();
  const cityState = [c, sp].filter((s) => !!s && s.length > 0).join(", ");
  return [cityState, pc].filter((s) => !!s && s.length > 0).join(" ");
}
async function generateW9PDF(data, refId) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  page.drawRectangle({ x: 0, y: 740, width: W, height: 52, color: rgb(0.15, 0.15, 0.15) });
  page.drawText("Form W-9", { x: 30, y: 762, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Request for Taxpayer Identification Number and Certification", {
    x: 30,
    y: 748,
    size: 9,
    font,
    color: rgb(0.85, 0.85, 0.85)
  });
  page.drawText("Department of the Treasury \u2014 Internal Revenue Service", {
    x: 340,
    y: 762,
    size: 8,
    font,
    color: rgb(0.85, 0.85, 0.85)
  });
  page.drawText("Rev. March 2024", {
    x: 340,
    y: 748,
    size: 8,
    font,
    color: rgb(0.7, 0.7, 0.7)
  });
  page.drawText("Go to www.irs.gov/FormW9 for instructions and the latest information.", {
    x: 340,
    y: 738,
    size: 6.5,
    font,
    color: rgb(0.7, 0.7, 0.7)
  });
  let y = 730;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "1  Name (as shown on your income tax return). Name is required; do not leave blank.",
    value: data.name,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "2  Business name/disregarded entity name, if different from above",
    value: data.businessName || "",
    font,
    boldFont: bold
  });
  y -= 40;
  page.drawText(
    "3a Federal tax classification of the person whose name is entered on line 1. Check only ONE of the following seven boxes:",
    { x: 33, y: y - 2, size: 7, font: bold, color: rgb(0.3, 0.3, 0.3) }
  );
  y -= 16;
  const classifications = [
    { key: "individual", label: "Individual/Sole prop." },
    { key: "c_corp", label: "C Corp" },
    { key: "s_corp", label: "S Corp" },
    { key: "partnership", label: "Partnership" },
    { key: "trust_estate", label: "Trust/Estate" },
    { key: "llc_c", label: "LLC" },
    { key: "other", label: "Other" }
  ];
  let cx = 33;
  for (const cls of classifications) {
    const checked = data.taxClassification === cls.key || cls.key === "llc_c" && ["llc_c", "llc_s", "llc_p"].includes(data.taxClassification);
    drawCheckbox(page, { x: cx, y, checked, label: cls.label, font });
    cx += font.widthOfTextAtSize(cls.label, 8) + 28;
  }
  y -= 18;
  const isPartnershipOrTrust = data.taxClassification === "partnership" || data.taxClassification === "trust_estate" || data.taxClassification === "llc_p";
  drawCheckbox(page, {
    x: 33,
    y,
    checked: !!(isPartnershipOrTrust && data.hasForeignPartnersOrOwners),
    label: '3b If on line 3a you checked "Partnership," "Trust/estate," or "LLC" (Partnership/Trust), AND you are providing',
    font
  });
  y -= 13;
  page.drawText(
    "    this form to a partnership, trust, or estate in which you have an ownership interest, check this box if you have",
    { x: 33, y: y - 2, size: 7, font, color: rgb(0.3, 0.3, 0.3) }
  );
  y -= 10;
  page.drawText("    any foreign partners, owners, or beneficiaries. See instructions.", {
    x: 33,
    y: y - 2,
    size: 7,
    font,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 11;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "4  Exempt payee code (if any)",
    value: data.exemptPayeeCode || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "    FATCA reporting code (if any)",
    value: data.fatcaCode || "",
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "5  Address (number, street, and apt. or suite no.)",
    value: data.address,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "6  City, state, and ZIP code",
    value: formatW9CityStateZip(data),
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "7  List account number(s) here (optional)",
    value: data.accountNumbers || "",
    font,
    boldFont: bold
  });
  y -= 50;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: rgb(0.15, 0.15, 0.15) });
  y -= 6;
  page.drawText("Part I", { x: 33, y: y - 4, size: 10, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText("Taxpayer Identification Number (TIN)", {
    x: 80,
    y: y - 4,
    size: 10,
    font,
    color: rgb(0.15, 0.15, 0.15)
  });
  y -= 18;
  page.drawText(
    "Enter your TIN in the appropriate box. For individuals, this is generally your social security number (SSN).",
    { x: 33, y: y - 2, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) }
  );
  y -= 14;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 36,
    label: "Social security number (SSN)",
    value: data.ssn || "",
    font,
    boldFont: bold,
    fontSize: 13
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 36,
    label: "Employer identification number (EIN)",
    value: data.ein || "",
    font,
    boldFont: bold,
    fontSize: 13
  });
  y -= 50;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: rgb(0.15, 0.15, 0.15) });
  y -= 6;
  page.drawText("Part II", { x: 33, y: y - 4, size: 10, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText("Certification", {
    x: 80,
    y: y - 4,
    size: 10,
    font,
    color: rgb(0.15, 0.15, 0.15)
  });
  y -= 18;
  const certText = "Under penalties of perjury, I certify that: (1) The number shown on this form is my correct taxpayer identification number, (2) I am not subject to backup withholding, (3) I am a U.S. citizen or other U.S. person, and (4) The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.";
  for (const line of wrapText(certText, font, 7.5, 540)) {
    page.drawText(line, { x: 33, y: y - 2, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
  }
  y -= 10;
  page.drawRectangle({ x: 30, y: y - 1, width: 552, height: 1, color: rgb(0, 0, 0) });
  y -= 4;
  drawField(page, {
    x: 30,
    y,
    width: 380,
    height: 32,
    label: "Signature of U.S. person",
    value: data.signature,
    font,
    boldFont: bold,
    fontSize: 13
  });
  drawField(page, {
    x: 410,
    y,
    width: 172,
    height: 32,
    label: "Date",
    value: data.date,
    font,
    boldFont: bold
  });
  page.drawText("Cat. No. 10231X", {
    x: 30,
    y: 42,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText("Form W-9 (Rev. 3-2024)", {
    x: 480,
    y: 42,
    size: 7,
    font: bold,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText(`Generated ${todayIso()}  |  Submission #${refId}`, {
    x: 30,
    y: 30,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
async function generateW8BENPDF(data, refId) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const HEADER = rgb(0.05, 0.25, 0.45);
  page.drawRectangle({ x: 0, y: 740, width: W, height: 52, color: HEADER });
  page.drawText("Form W-8BEN", { x: 30, y: 762, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Certificate of Foreign Status of Beneficial Owner", {
    x: 30,
    y: 748,
    size: 8,
    font,
    color: rgb(0.8, 0.85, 0.95)
  });
  page.drawText("Department of the Treasury \u2014 Internal Revenue Service", {
    x: 340,
    y: 762,
    size: 8,
    font,
    color: rgb(0.8, 0.85, 0.95)
  });
  page.drawText("Rev. October 2021", {
    x: 340,
    y: 748,
    size: 8,
    font,
    color: rgb(0.6, 0.7, 0.8)
  });
  page.drawText("Go to www.irs.gov/FormW8BEN for instructions and the latest information.", {
    x: 340,
    y: 738,
    size: 6.5,
    font,
    color: rgb(0.6, 0.7, 0.8)
  });
  let y = 725;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: HEADER });
  y -= 6;
  page.drawText("Part I", { x: 33, y: y - 4, size: 10, font: bold, color: HEADER });
  page.drawText("Identification of Beneficial Owner", {
    x: 80,
    y: y - 4,
    size: 10,
    font,
    color: HEADER
  });
  y -= 20;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "1  Name of individual who is the beneficial owner",
    value: data.name,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "2  Country of citizenship",
    value: data.citizenship,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "3  Permanent residence address (street, apt. or suite no., or rural route)",
    value: data.permanentAddress,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "    City or town, state/province, postal code",
    // prosciutto-92107: collapse structured fields back into the single PDF
    // line the IRS form provides. Fallback to plain city when state/postal
    // weren't provided (older drafts).
    value: formatW8CityLine(
      data.permanentCity,
      data.permanentStateProvince,
      data.permanentPostalCode
    ),
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "    Country",
    value: data.permanentCountry,
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "4  Mailing address (if different from above)",
    value: data.mailingAddress || "",
    font,
    boldFont: bold
  });
  y -= 40;
  if (data.mailingCity || data.mailingCountry || data.mailingPostalCode) {
    drawField(page, {
      x: 30,
      y,
      width: 276,
      height: 32,
      label: "    City or town, state/province, postal code",
      value: formatW8CityLine(
        data.mailingCity,
        data.mailingStateProvince,
        data.mailingPostalCode
      ),
      font,
      boldFont: bold
    });
    drawField(page, {
      x: 306,
      y,
      width: 276,
      height: 32,
      label: "    Country",
      value: data.mailingCountry || "",
      font,
      boldFont: bold
    });
    y -= 36;
  }
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "5  U.S. taxpayer identification number (SSN or ITIN)",
    value: data.usTin || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "6  Foreign tax identifying number (FTIN)",
    value: data.foreignTin || "",
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "7  Reference number(s)",
    value: data.referenceNumbers || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "8  Date of birth (MM-DD-YYYY)",
    value: data.dateOfBirth,
    font,
    boldFont: bold
  });
  y -= 44;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: HEADER });
  y -= 6;
  page.drawText("Part II", { x: 33, y: y - 4, size: 10, font: bold, color: HEADER });
  page.drawText("Claim of Tax Treaty Benefits (for chapter 3 purposes only)", {
    x: 80,
    y: y - 4,
    size: 10,
    font,
    color: HEADER
  });
  y -= 20;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 32,
    label: "9  I certify that the beneficial owner is a resident of:",
    value: data.treatyCountry || "N/A",
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "10  Article and paragraph",
    value: data.articleParagraph || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 136,
    height: 32,
    label: "    Withholding rate (%)",
    value: data.withholdingRate || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 442,
    y,
    width: 140,
    height: 32,
    label: "    Type of income",
    value: data.incomeType || "",
    font,
    boldFont: bold
  });
  y -= 36;
  if (data.treatyExplanation) {
    drawField(page, {
      x: 30,
      y,
      width: 552,
      height: 40,
      label: "    Explanation",
      value: data.treatyExplanation,
      font,
      boldFont: bold,
      fontSize: 8
    });
    y -= 44;
  }
  y -= 8;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: HEADER });
  y -= 6;
  page.drawText("Part III", { x: 33, y: y - 4, size: 10, font: bold, color: HEADER });
  page.drawText("Certification", { x: 85, y: y - 4, size: 10, font, color: HEADER });
  y -= 18;
  const certText = "Under penalties of perjury, I declare that I have examined the information on this form and to the best of my knowledge and belief it is true, correct, and complete. I further certify under penalties of perjury that I am the individual that is the beneficial owner (or am authorized to sign for the individual that is the beneficial owner) of all the income to which this form relates, that I am not a U.S. person, and that I am a resident of the treaty country listed above (if any).";
  for (const line of wrapText(certText, font, 7.5, 540)) {
    page.drawText(line, { x: 33, y: y - 2, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
  }
  y -= 10;
  page.drawRectangle({ x: 30, y: y - 1, width: 552, height: 1, color: rgb(0, 0, 0) });
  y -= 4;
  drawField(page, {
    x: 30,
    y,
    width: 380,
    height: 32,
    label: "Sign here \u2014 Signature of beneficial owner (or individual authorized to sign)",
    value: data.signature,
    font,
    boldFont: bold,
    fontSize: 13
  });
  drawField(page, {
    x: 410,
    y,
    width: 172,
    height: 32,
    label: "Date (MM-DD-YYYY)",
    value: data.date,
    font,
    boldFont: bold
  });
  page.drawText("Cat. No. 25047Z", {
    x: 30,
    y: 42,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText("Form W-8BEN (Rev. 10-2021)", {
    x: 470,
    y: 42,
    size: 7,
    font: bold,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText(`Generated ${todayIso()}  |  Submission #${refId}`, {
    x: 30,
    y: 30,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
async function generateW8BENEPDF(data, refId) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612;
  const HEADER = rgb(0.04, 0.18, 0.36);
  page.drawRectangle({ x: 0, y: 740, width: W, height: 52, color: HEADER });
  page.drawText("Form W-8BEN-E", { x: 30, y: 762, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Certificate of Status of Beneficial Owner for U.S. Tax Withholding (Entities)", {
    x: 30,
    y: 748,
    size: 8,
    font,
    color: rgb(0.8, 0.85, 0.95)
  });
  page.drawText("Department of the Treasury \u2014 Internal Revenue Service", {
    x: 340,
    y: 762,
    size: 8,
    font,
    color: rgb(0.8, 0.85, 0.95)
  });
  page.drawText("Rev. October 2021", {
    x: 340,
    y: 748,
    size: 8,
    font,
    color: rgb(0.6, 0.7, 0.8)
  });
  page.drawText("Go to www.irs.gov/FormW8BENE for instructions and the latest information.", {
    x: 340,
    y: 738,
    size: 6.5,
    font,
    color: rgb(0.6, 0.7, 0.8)
  });
  let y = 725;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: HEADER });
  y -= 6;
  page.drawText("Part I", { x: 33, y: y - 4, size: 10, font: bold, color: HEADER });
  page.drawText("Identification of Beneficial Owner", {
    x: 80,
    y: y - 4,
    size: 10,
    font,
    color: HEADER
  });
  y -= 20;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "1  Name of organization that is the beneficial owner",
    value: data.entityName,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 36,
    label: "2  Country of incorporation or organization",
    value: data.countryOfIncorporation,
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 36,
    label: "3  Name of disregarded entity (if any)",
    value: data.disregardedEntityName || "",
    font,
    boldFont: bold
  });
  y -= 40;
  page.drawText("4  Chapter 3 Status (entity type)", {
    x: 33,
    y: y - 2,
    size: 7,
    font: bold,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 14;
  const entityTypes = [
    { key: "corporation", label: "Corporation" },
    { key: "partnership", label: "Partnership" },
    { key: "simple_trust", label: "Simple trust" },
    { key: "grantor_trust", label: "Grantor trust" },
    { key: "complex_trust", label: "Complex trust" },
    { key: "estate", label: "Estate" },
    { key: "government", label: "Government" },
    { key: "central_bank", label: "Central bank of issue" },
    { key: "tax_exempt_org", label: "Tax-exempt organization" },
    { key: "private_foundation", label: "Private foundation" },
    { key: "international_org", label: "International organization" }
  ];
  const colWidth = 270;
  let col = 0;
  let rowYCursor = y;
  for (const et of entityTypes) {
    const cx = 33 + col * colWidth;
    drawCheckbox(page, { x: cx, y: rowYCursor, checked: data.entityType === et.key, label: et.label, font });
    if (col === 0) {
      col = 1;
    } else {
      col = 0;
      rowYCursor -= 14;
    }
  }
  if (col === 1) rowYCursor -= 14;
  y = rowYCursor - 6;
  page.drawText("5  Chapter 4 Status (FATCA status)", {
    x: 33,
    y: y - 2,
    size: 7,
    font: bold,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 14;
  const ch4 = [
    { key: "active_nffe", label: "Active NFFE" },
    { key: "passive_nffe", label: "Passive NFFE" },
    { key: "ffi", label: "FFI (contact admin \u2014 paper form required)" }
  ];
  let ch4cx = 33;
  for (const c of ch4) {
    drawCheckbox(page, { x: ch4cx, y, checked: data.chapter4Status === c.key, label: c.label, font });
    ch4cx += font.widthOfTextAtSize(c.label, 8) + 28;
  }
  y -= 18;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "6  Permanent residence address (street, apt. or suite no., or rural route)",
    value: data.permanentAddress,
    font,
    boldFont: bold
  });
  y -= 40;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "    City or town, state/province, postal code",
    // prosciutto-92107: collapse structured fields back into the single PDF
    // line the IRS form provides.
    value: formatW8CityLine(
      data.permanentCity,
      data.permanentStateProvince,
      data.permanentPostalCode
    ),
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "    Country",
    value: data.permanentCountry,
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 36,
    label: "7  Mailing address (if different from above)",
    value: data.mailingAddress || "",
    font,
    boldFont: bold
  });
  y -= 40;
  if (data.mailingCity || data.mailingCountry || data.mailingPostalCode) {
    drawField(page, {
      x: 30,
      y,
      width: 276,
      height: 32,
      label: "    City or town, state/province, postal code",
      value: formatW8CityLine(
        data.mailingCity,
        data.mailingStateProvince,
        data.mailingPostalCode
      ),
      font,
      boldFont: bold
    });
    drawField(page, {
      x: 306,
      y,
      width: 276,
      height: 32,
      label: "    Country",
      value: data.mailingCountry || "",
      font,
      boldFont: bold
    });
    y -= 36;
  }
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "8  U.S. taxpayer identification number (EIN) \u2014 if any",
    value: data.usTin || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "9  GIIN (if applicable)",
    value: data.giin || "",
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "9b  Foreign TIN",
    value: data.foreignTin || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 276,
    height: 32,
    label: "10  Reference number(s)",
    value: data.referenceNumbers || "",
    font,
    boldFont: bold
  });
  y -= 44;
  page.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: HEADER });
  y -= 6;
  page.drawText("Part III", { x: 33, y: y - 4, size: 10, font: bold, color: HEADER });
  page.drawText("Claim of Tax Treaty Benefits (for chapter 3 purposes only)", {
    x: 85,
    y: y - 4,
    size: 10,
    font,
    color: HEADER
  });
  y -= 20;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 32,
    label: "14a  I certify that the beneficial owner is a resident of the following country within the meaning of the income tax treaty between the United States and that country:",
    value: data.treatyCountry || "",
    font,
    boldFont: bold
  });
  y -= 36;
  drawCheckbox(page, {
    x: 33,
    y,
    checked: Boolean(data.treatyCountry && data.treatyCountry.trim()),
    font
  });
  const derivesText = "14b  The beneficial owner derives the item (or items) of income for which the treaty benefits are claimed, and, if applicable, meets the requirements of the treaty provision dealing with limitation on benefits.";
  let derivesY = y;
  for (const line of wrapText(derivesText, font, 7.5, 520)) {
    page.drawText(line, { x: 50, y: derivesY - 2, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    derivesY -= 10;
  }
  y = derivesY - 6;
  drawField(page, {
    x: 30,
    y,
    width: 276,
    height: 32,
    label: "15  Article and paragraph of treaty",
    value: data.articleParagraph || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 306,
    y,
    width: 136,
    height: 32,
    label: "    Withholding rate (%)",
    value: data.withholdingRate || "",
    font,
    boldFont: bold
  });
  drawField(page, {
    x: 442,
    y,
    width: 140,
    height: 32,
    label: "    Type of income",
    value: data.incomeType || "",
    font,
    boldFont: bold
  });
  y -= 36;
  drawField(page, {
    x: 30,
    y,
    width: 552,
    height: 40,
    label: "    Explain the additional conditions in the Article and paragraph the beneficial owner meets to be eligible for the rate of withholding:",
    value: data.treatyExplanation || "",
    font,
    boldFont: bold,
    fontSize: 8
  });
  y -= 48;
  const page2 = doc.addPage([612, 792]);
  y = 760;
  page2.drawRectangle({ x: 30, y: y - 2, width: 552, height: 2, color: HEADER });
  y -= 6;
  page2.drawText("Part XXIX", { x: 33, y: y - 4, size: 10, font: bold, color: HEADER });
  page2.drawText("Certification", { x: 95, y: y - 4, size: 10, font, color: HEADER });
  y -= 18;
  const certText = "Under penalties of perjury, I declare that I have examined the information on this form and to the best of my knowledge and belief it is true, correct, and complete. I further certify under penalties of perjury that the entity identified on line 1 of this form is the beneficial owner of all the income to which this form relates, is using this form to certify its status for chapter 4 purposes, and is not a U.S. person. I agree that I will submit a new form within 30 days if any certification on this form becomes incorrect.";
  for (const line of wrapText(certText, font, 7.5, 540)) {
    page2.drawText(line, { x: 33, y: y - 2, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
  }
  y -= 10;
  page2.drawRectangle({ x: 30, y: y - 1, width: 552, height: 1, color: rgb(0, 0, 0) });
  y -= 4;
  drawField(page2, {
    x: 30,
    y,
    width: 280,
    height: 32,
    label: "Sign here \u2014 Signature of person authorized to sign for the beneficial owner",
    value: data.signature,
    font,
    boldFont: bold,
    fontSize: 13
  });
  drawField(page2, {
    x: 310,
    y,
    width: 130,
    height: 32,
    label: "Capacity (e.g. Director)",
    value: data.signerCapacity || "",
    font,
    boldFont: bold
  });
  drawField(page2, {
    x: 440,
    y,
    width: 142,
    height: 32,
    label: "Date (MM-DD-YYYY)",
    value: data.date,
    font,
    boldFont: bold
  });
  page.drawText("Cat. No. 59689N", {
    x: 30,
    y: 42,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText("Form W-8BEN-E (Rev. 10-2021)", {
    x: 460,
    y: 42,
    size: 7,
    font: bold,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText(`Generated ${todayIso()}  |  Submission #${refId}  |  Page 1 of 2`, {
    x: 30,
    y: 30,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });
  page2.drawText("Cat. No. 59689N", {
    x: 30,
    y: 42,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4)
  });
  page2.drawText("Form W-8BEN-E (Rev. 10-2021)", {
    x: 460,
    y: 42,
    size: 7,
    font: bold,
    color: rgb(0.4, 0.4, 0.4)
  });
  page2.drawText(`Generated ${todayIso()}  |  Submission #${refId}  |  Page 2 of 2`, {
    x: 30,
    y: 30,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6)
  });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
/** stuff.company: add an e-signature audit line to the bottom of every page. */
async function stampEsign(pdfBuffer, text) {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const line = toWinAnsi(font, text);
  for (const page of doc.getPages()) {
    let size = 6.5;
    while (size > 4 && font.widthOfTextAtSize(line, size) > 552) size -= 0.5;
    page.drawText(line, { x: 30, y: 18, size, font, color: rgb(0.45, 0.45, 0.45) });
  }
  return Buffer.from(await doc.save());
}
export {
  stampEsign,
  generateW8BENEPDF,
  generateW8BENPDF,
  generateW9PDF
};
