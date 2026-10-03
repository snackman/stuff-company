// Server-side validation for submitted tax forms. Mirrors rsv.pizza's
// assertSubmitValid (backend/src/routes/tax-form.routes.ts) plus TIN format,
// certification, contact email and "wrong form for a US person" checks.
import { httpError } from './http.js';

export const FORM_TYPES = ['w9', 'w8ben', 'w8bene'];

const FIELDS = {
  w9: [
    'name', 'businessName', 'taxClassification', 'exemptPayeeCode', 'fatcaCode', 'address',
    'city', 'state', 'zipCode', 'accountNumbers', 'ssn', 'ein', 'signature', 'date',
    'hasForeignPartnersOrOwners', 'certify',
  ],
  w8ben: [
    'name', 'citizenship', 'permanentAddress', 'permanentCity', 'permanentStateProvince',
    'permanentPostalCode', 'permanentCountry', 'mailingAddress', 'mailingCity',
    'mailingStateProvince', 'mailingPostalCode', 'mailingCountry', 'usTin', 'foreignTin',
    'referenceNumbers', 'dateOfBirth', 'treatyCountry', 'articleParagraph', 'withholdingRate',
    'incomeType', 'treatyExplanation', 'signature', 'date', 'certify',
  ],
  w8bene: [
    'entityName', 'countryOfIncorporation', 'disregardedEntityName', 'entityType',
    'chapter4Status', 'permanentAddress', 'permanentCity', 'permanentStateProvince',
    'permanentPostalCode', 'permanentCountry', 'mailingAddress', 'mailingCity',
    'mailingStateProvince', 'mailingPostalCode', 'mailingCountry', 'usTin', 'giin', 'foreignTin',
    'referenceNumbers', 'treatyCountry', 'articleParagraph', 'withholdingRate', 'incomeType',
    'treatyExplanation', 'signature', 'signerCapacity', 'date', 'certify',
  ],
};

const W9_CLASSIFICATIONS = [
  'individual', 'c_corp', 's_corp', 'partnership', 'trust_estate', 'llc_c', 'llc_s', 'llc_p', 'other',
];
const ENTITY_TYPES = [
  'corporation', 'partnership', 'simple_trust', 'grantor_trust', 'complex_trust', 'estate',
  'government', 'central_bank', 'tax_exempt_org', 'private_foundation', 'international_org',
];
const CH4 = ['active_nffe', 'passive_nffe', 'ffi'];

const US_COUNTRY_NAMES = new Set([
  'united states', 'united states of america', 'usa', 'us', 'puerto rico', 'guam',
  'u.s. virgin islands', 'us virgin islands', 'american samoa', 'northern mariana islands',
]);
export const isUSCountry = (c) => !!c && US_COUNTRY_NAMES.has(String(c).trim().toLowerCase());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(body) {
  const name = clean(body.contactName, 120);
  const email = clean(body.contactEmail, 200);
  if (!name) throw httpError('Please enter your name.');
  if (!email || !EMAIL_RE.test(email)) throw httpError('Please enter a valid email address.');
  return { name, email };
}

function clean(v, max = 300) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/**
 * Validate and normalize form data. Returns a clean object containing only the
 * known fields for that form type. Throws httpError(400) naming the problem.
 */
export function validateForm(formType, raw) {
  if (!FORM_TYPES.includes(formType)) throw httpError('Unknown form type.');
  if (!raw || typeof raw !== 'object') throw httpError('Missing form data.');
  const d = {};
  for (const f of FIELDS[formType]) {
    const v = raw[f];
    if (typeof v === 'boolean') d[f] = v;
    else if (typeof v === 'string') d[f] = clean(v, f === 'treatyExplanation' ? 600 : 300);
  }
  const need = (field, label) => {
    if (!d[field]) throw httpError(`Missing required field: ${label}.`);
  };

  if (d.certify !== true) throw httpError('Please check the certification box.');
  need('signature', 'signature (type your full name)');
  need('date', 'date');
  if (!validDate(d.date)) throw httpError('Signature date is not a valid date.');

  if (formType === 'w9') {
    need('taxClassification', 'federal tax classification');
    if (!W9_CLASSIFICATIONS.includes(d.taxClassification)) throw httpError('Invalid tax classification.');
    need('name', 'name (line 1)');
    need('address', 'address');
    need('city', 'city');
    need('state', 'state');
    need('zipCode', 'ZIP code');
    const ssn = (d.ssn || '').replace(/\D/g, '');
    const ein = (d.ein || '').replace(/\D/g, '');
    if (!ssn && !ein) throw httpError('Either an SSN or an EIN is required on the W-9.');
    if (ssn && ein) throw httpError('Enter either an SSN or an EIN, not both.');
    if (d.ssn && ssn.length !== 9) throw httpError('SSN must be 9 digits (XXX-XX-XXXX).');
    if (d.ein && ein.length !== 9) throw httpError('EIN must be 9 digits (XX-XXXXXXX).');
    d.ssn = ssn ? `${ssn.slice(0, 3)}-${ssn.slice(3, 5)}-${ssn.slice(5)}` : '';
    d.ein = ein ? `${ein.slice(0, 2)}-${ein.slice(2)}` : '';
    if (!['partnership', 'trust_estate', 'llc_p'].includes(d.taxClassification)) {
      d.hasForeignPartnersOrOwners = false;
    }
  } else if (formType === 'w8ben') {
    need('name', 'name');
    need('citizenship', 'country of citizenship');
    need('permanentAddress', 'permanent residence address');
    need('permanentCity', 'city or town');
    need('permanentCountry', 'country of residence');
    need('dateOfBirth', 'date of birth');
    if (!validDate(d.dateOfBirth)) throw httpError('Date of birth is not a valid date.');
    if (isUSCountry(d.permanentCountry)) {
      throw httpError('W-8BEN is for foreign persons — a US resident should submit a W-9 instead.');
    }
    checkUsTin(d.usTin, 'US TIN (SSN/ITIN)');
  } else {
    need('entityName', 'name of organization');
    need('countryOfIncorporation', 'country of incorporation');
    need('entityType', 'entity type');
    if (!ENTITY_TYPES.includes(d.entityType)) throw httpError('Invalid entity type.');
    need('chapter4Status', 'FATCA (chapter 4) status');
    if (!CH4.includes(d.chapter4Status)) throw httpError('Invalid FATCA status.');
    if (d.chapter4Status === 'ffi') {
      throw httpError(
        'Financial institutions (FFIs) need the full paper W-8BEN-E — please upload a signed PDF instead.',
      );
    }
    need('permanentAddress', 'permanent residence address');
    need('permanentCity', 'city or town');
    need('permanentCountry', 'country');
    if (isUSCountry(d.permanentCountry)) {
      throw httpError('W-8BEN-E is for foreign entities — a US entity should submit a W-9 instead.');
    }
    checkUsTin(d.usTin, 'US EIN');
  }
  return d;
}

function checkUsTin(v, label) {
  if (v && v.replace(/\D/g, '').length !== 9) throw httpError(`${label} must be 9 digits.`);
}

/** Display name for the admin list / email. */
export function payeeName(formType, d) {
  return formType === 'w8bene' ? d.entityName : d.name;
}

/** Last 4 digits of the primary TIN (for admin recognition only). */
export function tinLast4(formType, d) {
  const tin = formType === 'w9' ? d.ssn || d.ein : d.usTin || d.foreignTin || '';
  const digits = String(tin || '').replace(/[^0-9A-Za-z]/g, '');
  return digits ? digits.slice(-4) : '';
}
