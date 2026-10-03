/**
 * Stuff Company tax-form portal (vanilla JS port of rsv.pizza's
 * TaxFormSection + W9Form / W8BENForm / W8BENEForm components).
 */
(function () {
    'use strict';

    var FORM_LABEL = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };
    var MAX_UPLOAD = 10 * 1024 * 1024;
    var US_COUNTRY_NAMES = [
        'united states', 'united states of america', 'usa', 'us', 'puerto rico', 'guam',
        'u.s. virgin islands', 'us virgin islands', 'american samoa', 'northern mariana islands'
    ];
    function isUSCountry(c) {
        return !!c && US_COUNTRY_NAMES.indexOf(String(c).trim().toLowerCase()) !== -1;
    }
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function today() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    var panels = {
        pick: $('#step-pick'),
        w9: $('#form-w9'),
        w8ben: $('#form-w8ben'),
        w8bene: $('#form-w8bene'),
        upload: $('#form-upload'),
        done: $('#step-done')
    };

    // Country datalist
    var dl = $('#tf-countries');
    (window.TaxData ? window.TaxData.COUNTRIES : []).forEach(function (name) {
        var o = document.createElement('option');
        o.value = name;
        dl.appendChild(o);
    });

    // ---------------- navigation ----------------

    function show(key) {
        Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== key; });
        if (key === 'w9' || key === 'w8ben' || key === 'w8bene') {
            $all('[data-field="date"]', panels[key]).forEach(function (el) { if (!el.value) el.value = today(); });
        }
        window.scrollTo({ top: panels[key].offsetTop - 20, behavior: 'smooth' });
    }

    function contactOk() {
        var n = $('#contactName'), e = $('#contactEmail');
        if (!n.value.trim()) { n.focus(); n.reportValidity && n.reportValidity(); return false; }
        if (!e.value.trim() || !e.checkValidity()) { e.focus(); e.reportValidity && e.reportValidity(); return false; }
        return true;
    }

    function resetForm(form) {
        form.reset();
        $all('.tf-error', form).forEach(function (el) { el.hidden = true; });
        form.dispatchEvent(new Event('tf-reset'));
    }

    $all('[data-pick]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!contactOk()) { show('pick'); return; }
            show(btn.getAttribute('data-pick'));
        });
    });
    $all('[data-back]').forEach(function (btn) {
        btn.addEventListener('click', function () { show('pick'); });
    });
    // "Wrong form" switches discard the partial draft (as rsv.pizza does).
    $all('[data-switch]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var target = btn.getAttribute('data-switch');
            resetForm(btn.closest('form'));
            resetForm(panels[target]);
            show(target);
        });
    });
    $('[data-restart]').addEventListener('click', function () {
        ['w9', 'w8ben', 'w8bene', 'upload'].forEach(function (k) { resetForm(panels[k]); });
        show('pick');
    });

    // ---------------- W-9 ----------------

    (function initW9() {
        var form = panels.w9;
        var cat = $('#w9-category'), llc = $('#w9-llc'), llcWrap = $('#w9-llc-wrap');
        var rest = $('#w9-rest'), box3b = $('#w9-3b-wrap');
        var ssn = $('#w9-ssn'), ein = $('#w9-ein');
        var tinManual = false;

        function line1(c, s) {
            if (!c) return ['Full legal name (as on your tax return)', null];
            if (c === 'individual') return ['Your legal name (must match your SSN)', 'Enter your personal name exactly as it appears on your tax return.'];
            if (c === 'llc' && s === 'disregarded') return ["OWNER'S legal name (the LLC is disregarded)", "Single-member LLC = disregarded entity. The IRS wants the OWNER'S name here, not the LLC's. The LLC name goes on the next line."];
            if (c === 'llc') return ['Business legal name (must match your EIN)', "Enter the LLC's legal name as registered with the IRS — it must match the LLC's EIN."];
            if (c === 'other') return ['Business legal name (must match your EIN)', 'Enter the legal name of the entity exactly as it appears on its tax return.'];
            return ['Business legal name (must match your EIN)', "Enter the entity's legal name as registered with the IRS — it must match its EIN."];
        }
        function line2(c, s) {
            if (c === 'llc' && s === 'disregarded') return ['LLC name (the disregarded entity)', "The LLC's name. Required if the LLC name differs from the owner's name on Line 1."];
            var ph = 'Business / DBA name (optional — only if different from above)';
            if (c === 'individual') return [ph, "Skip if you don't operate under a different business name (DBA)."];
            if (!c) return [ph, null];
            return [ph, 'Skip if your operating name matches your legal name on Line 1.'];
        }
        function setTin(type, manual) {
            if (manual) tinManual = true;
            $all('input[name="w9-tin"]', form).forEach(function (r) { r.checked = r.value === type; });
            ssn.hidden = type !== 'ssn';
            ein.hidden = type !== 'ein';
            if (type === 'ssn') ein.value = ''; else ssn.value = '';
        }
        function update(fromLlc) {
            var c = cat.value, s = llc.value;
            llcWrap.hidden = c !== 'llc';
            if (c !== 'llc' && llc.value) llc.value = '';
            box3b.hidden = !(c === 'partnership' || c === 'trust_estate' || (c === 'llc' && s === 'p'));
            if (box3b.hidden) $('[data-field="hasForeignPartnersOrOwners"]', form).checked = false;
            rest.hidden = !(c && (c !== 'llc' || s));
            var l1 = line1(c, s), l2 = line2(c, s);
            $('#w9-name').placeholder = l1[0];
            $('#w9-name-help').textContent = l1[1] || '';
            $('#w9-business').placeholder = l2[0];
            $('#w9-business-help').textContent = l2[1] || '';
            if (!tinManual) {
                var want = fromLlc ? (s === 'disregarded' ? 'ssn' : 'ein') : (c === 'individual' || !c ? 'ssn' : 'ein');
                if (c === 'llc' && !s) want = 'ein';
                setTin(want, false);
            }
        }
        cat.addEventListener('change', function () { update(false); });
        llc.addEventListener('change', function () { update(true); });
        $all('input[name="w9-tin"]', form).forEach(function (r) {
            r.addEventListener('change', function () { setTin(r.value, true); });
        });
        // Light auto-formatting of TINs as the user types.
        ssn.addEventListener('input', function () {
            var d = ssn.value.replace(/\D/g, '').slice(0, 9);
            ssn.value = d.length > 5 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
        });
        ein.addEventListener('input', function () {
            var d = ein.value.replace(/\D/g, '').slice(0, 9);
            ein.value = d.length > 2 ? d.slice(0, 2) + '-' + d.slice(2) : d;
        });
        form.addEventListener('tf-reset', function () { tinManual = false; update(false); });

        form.tfCollect = function (data) {
            var c = cat.value, s = llc.value;
            var cls = c === 'llc' ? ({ c: 'llc_c', s: 'llc_s', p: 'llc_p', disregarded: 'individual' })[s] : c;
            data.taxClassification = cls || '';
            return data;
        };
        form.tfCheck = function (d) {
            if (!d.taxClassification) return 'Please pick your federal tax classification.';
            var tinType = $('input[name="w9-tin"]:checked', form).value;
            var digits = (tinType === 'ssn' ? d.ssn : d.ein).replace(/\D/g, '');
            if (digits.length !== 9) return tinType === 'ssn' ? 'SSN must be 9 digits (XXX-XX-XXXX).' : 'EIN must be 9 digits (XX-XXXXXXX).';
            return null;
        };
        update(false);
    })();

    // ---------------- W-8BEN / W-8BEN-E shared ----------------

    function initW8(form, defaultTreatyField) {
        var treatyInput = $('[data-field="treatyCountry"]', form);
        var note = $('[data-treaty-note]', form);
        var autoFilledFor = null;
        var treatyTouched = false;

        // Mailing address toggle (clears values when unchecked).
        var toggle = $('[data-mailing-toggle]', form), mailing = $('[data-mailing]', form);
        toggle.addEventListener('change', function () {
            mailing.hidden = !toggle.checked;
            if (!toggle.checked) $all('input', mailing).forEach(function (i) { i.value = ''; });
        });

        // US permanent-residence warning → offer a switch to W-9.
        var perm = $('[data-field="permanentCountry"]', form), usWarn = $('[data-us-warning]', form);
        function checkUS() { usWarn.hidden = !isUSCountry(perm.value); }
        perm.addEventListener('input', checkUS);

        // Treaty auto-suggest (IRS Pub 901 "Other income" article) — fills
        // article / rate / income type once per country; user edits win.
        function treatyKey() {
            return (treatyInput.value.trim() || $('[data-field="' + defaultTreatyField + '"]', form).value.trim());
        }
        function runTreaty() {
            var key = treatyKey();
            var TD = window.TaxData;
            if (!key || !TD) { note.hidden = true; return; }
            var entry = TD.lookupTreaty(key);
            var cacheKey = TD.normalizeCountryCode(key) || key.toLowerCase();
            var art = $('[data-field="articleParagraph"]', form), rate = $('[data-field="withholdingRate"]', form), inc = $('[data-field="incomeType"]', form);
            if (entry && entry.hasTreaty) {
                note.textContent = 'Auto-filled based on ' + key + "'s US tax treaty (Other income at " + entry.otherIncomeRate + '% under ' + entry.article + '). Edit if needed.' + (entry.notes ? ' ' + entry.notes : '');
                note.hidden = false;
            } else if (entry) {
                note.textContent = 'No US tax treaty in force with ' + key + ' — leave the treaty fields blank; default 30% withholding applies if classified as US-source income.' + (entry.notes ? ' ' + entry.notes : '');
                note.hidden = false;
            } else {
                note.hidden = true;
            }
            if (autoFilledFor === cacheKey) return;
            autoFilledFor = cacheKey;
            if (!entry) return;
            if (!treatyTouched && !treatyInput.value.trim()) treatyInput.value = key;
            if (entry.hasTreaty) {
                art.value = entry.article || '';
                rate.value = String(entry.otherIncomeRate);
                inc.value = 'Other income';
            } else {
                art.value = ''; rate.value = ''; inc.value = '';
            }
        }
        treatyInput.addEventListener('input', function () { treatyTouched = true; autoFilledFor = null; });
        treatyInput.addEventListener('change', runTreaty);
        $('[data-field="' + defaultTreatyField + '"]', form).addEventListener('change', function () {
            if (!treatyTouched) { treatyInput.value = ''; autoFilledFor = null; }
            runTreaty();
        });

        form.addEventListener('tf-reset', function () {
            mailing.hidden = true;
            usWarn.hidden = true;
            note.hidden = true;
            autoFilledFor = null;
            treatyTouched = false;
        });
    }

    initW8(panels.w8ben, 'permanentCountry');
    initW8(panels.w8bene, 'countryOfIncorporation');

    // W-8BEN-E: FATCA status defaults from entity type; FFI → paper form.
    (function initW8BENE() {
        var form = panels.w8bene;
        var entity = $('#w8e-entity'), label = $('[data-fatca-label]', form), ffi = $('[data-ffi-warning]', form);
        var adv = $('[data-advanced]', form);
        var NAMES = { active_nffe: 'Active NFFE', passive_nffe: 'Passive NFFE', ffi: 'FFI' };
        var manual = false;
        function current() { var r = $('input[name="w8e-ch4"]:checked', form); return r ? r.value : ''; }
        function set(v) { $all('input[name="w8e-ch4"]', form).forEach(function (r) { r.checked = r.value === v; }); refresh(); }
        function refresh() { var v = current(); label.textContent = NAMES[v] || '—'; ffi.hidden = v !== 'ffi'; }
        entity.addEventListener('change', function () {
            if (manual && current()) return;
            var t = entity.value;
            if (!t) return set('');
            set(/trust|estate/.test(t) ? 'passive_nffe' : 'active_nffe');
        });
        $all('input[name="w8e-ch4"]', form).forEach(function (r) {
            r.addEventListener('change', function () { manual = true; refresh(); });
        });
        $('[data-open-advanced]', form).addEventListener('click', function () {
            adv.open = true;
            adv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        form.addEventListener('tf-reset', function () { manual = false; adv.open = false; set(''); });
        form.tfCollect = function (d) { d.chapter4Status = current(); return d; };
        form.tfCheck = function (d) {
            if (!d.entityType) return 'Please pick an entity type.';
            if (d.chapter4Status === 'ffi') return 'Financial institutions (FFIs) need the full paper W-8BEN-E — please upload a signed PDF instead.';
            return null;
        };
    })();

    // ---------------- submit (fill + e-sign) ----------------

    function showError(form, msg) {
        var el = $('.tf-error', form);
        el.textContent = msg;
        el.hidden = !msg;
        if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function collect(form) {
        var data = {};
        $all('[data-field]', form).forEach(function (el) {
            if (el.closest('[hidden]') && el.type !== 'checkbox') {
                // Hidden-but-relevant fields (e.g. the unused TIN box) are sent blank.
                data[el.getAttribute('data-field')] = '';
                return;
            }
            data[el.getAttribute('data-field')] = el.type === 'checkbox' ? el.checked : el.value.trim();
        });
        return form.tfCollect ? form.tfCollect(data) : data;
    }

    function firstInvalid(form) {
        return $all('[required]', form).filter(function (el) {
            return !el.closest('[hidden]') && !el.value.trim();
        })[0];
    }

    async function postJson(body) {
        var res = await fetch('/api/tax-form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var out = {};
        try { out = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error(out.error || 'Submission failed (' + res.status + '). Please try again.');
        return out;
    }

    function done(out) {
        $('[data-done-form]').textContent = out.formLabel || 'form';
        $('[data-done-ref]').textContent = out.ref || '';
        show('done');
    }

    ['w9', 'w8ben', 'w8bene'].forEach(function (type) {
        var form = panels[type];
        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            showError(form, '');
            if (!contactOk()) { show('pick'); return; }
            var missing = firstInvalid(form);
            if (missing) { missing.focus(); return showError(form, 'Please fill in all required fields.'); }
            var data = collect(form);
            var problem = form.tfCheck ? form.tfCheck(data) : null;
            if (!problem && !data.certify) problem = 'Please check the certification box.';
            if (problem) return showError(form, problem);
            var btn = $('button[type="submit"]', form);
            btn.disabled = true;
            try {
                var out = await postJson({
                    mode: 'fill',
                    formType: type,
                    contactName: $('#contactName').value.trim(),
                    contactEmail: $('#contactEmail').value.trim(),
                    data: data,
                    website: form.elements.website.value
                });
                resetForm(form);
                done(out);
            } catch (err) {
                showError(form, err.message);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // ---------------- upload a signed PDF (chunked) ----------------

    (function initUpload() {
        var form = panels.upload;
        var bar = $('.tf-progress', form), fill = $('.tf-progress-bar', form);
        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            showError(form, '');
            if (!contactOk()) { show('pick'); return; }
            var type = $('#upload-type').value;
            var file = $('#upload-file').files[0];
            if (!type) return showError(form, 'Please pick the form type.');
            if (!file) return showError(form, 'Please choose a PDF file.');
            if (!/\.pdf$/i.test(file.name)) return showError(form, 'Please upload a PDF file.');
            if (file.size > MAX_UPLOAD) return showError(form, 'The PDF is larger than 10 MB.');
            if (!file.size) return showError(form, 'The file is empty.');
            var btn = $('button[type="submit"]', form);
            btn.disabled = true;
            bar.hidden = false;
            fill.style.width = '2%';
            try {
                var chunk = 3 * 1024 * 1024;
                var parts = Math.ceil(file.size / chunk);
                var init = await postJson({
                    mode: 'upload-init',
                    formType: type,
                    contactName: $('#contactName').value.trim(),
                    contactEmail: $('#contactEmail').value.trim(),
                    fileName: file.name,
                    size: file.size,
                    parts: parts,
                    website: form.elements.website.value
                });
                if (!init.token) { done(init); return; } // honeypot path
                chunk = init.chunkBytes || chunk;
                for (var i = 0; i < parts; i++) {
                    var body = file.slice(i * chunk, Math.min(file.size, (i + 1) * chunk));
                    var ok = false, lastErr = null;
                    for (var attempt = 0; attempt < 3 && !ok; attempt++) {
                        var res = await fetch('/api/tax-form-chunk?i=' + i, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Token': init.token },
                            body: body
                        });
                        if (res.ok) ok = true;
                        else { try { lastErr = (await res.json()).error; } catch (e) {} }
                    }
                    if (!ok) throw new Error(lastErr || 'Upload failed. Please try again.');
                    fill.style.width = Math.round(((i + 1) / (parts + 1)) * 100) + '%';
                }
                var out = await postJson({ mode: 'upload-complete', token: init.token });
                fill.style.width = '100%';
                resetForm(form);
                done(out);
            } catch (err) {
                showError(form, err.message);
            } finally {
                btn.disabled = false;
                bar.hidden = true;
                fill.style.width = '0';
            }
        });
    })();
})();
