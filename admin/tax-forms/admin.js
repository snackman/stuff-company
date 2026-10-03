(function () {
    'use strict';
    var FORM_LABEL = { w9: 'W-9', w8ben: 'W-8BEN', w8bene: 'W-8BEN-E' };
    var API = '/api/admin/submissions';
    var login = document.getElementById('login');
    var list = document.getElementById('list');
    var rows = document.getElementById('rows');

    function err(root, msg) {
        var el = root.querySelector('.tf-error');
        el.textContent = msg || '';
        el.hidden = !msg;
    }
    function td(text) { var c = document.createElement('td'); c.textContent = text == null ? '' : text; return c; }

    async function load() {
        err(list, '');
        var res = await fetch(API, { credentials: 'same-origin' });
        if (res.status === 401) { list.hidden = true; login.hidden = false; document.getElementById('password').focus(); return; }
        var out = {};
        try { out = await res.json(); } catch (e) {}
        login.hidden = true;
        list.hidden = false;
        if (!res.ok) return err(list, out.error || 'Could not load submissions.');
        render(out.submissions || []);
    }

    function render(items) {
        rows.textContent = '';
        document.getElementById('count').textContent = items.length + ' submission' + (items.length === 1 ? '' : 's');
        items.forEach(function (s) {
            var tr = document.createElement('tr');
            if (s.error) {
                tr.appendChild(td(s.id));
                var c = td('Unreadable entry (wrong key?)'); c.colSpan = 6; tr.appendChild(c);
                rows.appendChild(tr);
                return;
            }
            tr.appendChild(td(s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ''));
            var name = td(s.name);
            if (s.contactName && s.contactName !== s.name) {
                var sm = document.createElement('div'); sm.className = 'tf-help'; sm.textContent = 'contact: ' + s.contactName; name.appendChild(sm);
            }
            tr.appendChild(name);
            tr.appendChild(td(s.email));
            var f = td(''); var pill = document.createElement('span'); pill.className = 'tf-pill'; pill.textContent = FORM_LABEL[s.formType] || s.formType; f.appendChild(pill); tr.appendChild(f);
            tr.appendChild(td(s.method === 'upload' ? 'Uploaded PDF' : 'E-signed'));
            tr.appendChild(td(s.tinLast4 ? '•••' + s.tinLast4 : ''));
            var actions = td(''); actions.className = 'tf-actions';
            if (s.hasPdf) {
                var view = document.createElement('a'); view.href = API + '?id=' + encodeURIComponent(s.id); view.target = '_blank'; view.rel = 'noopener'; view.textContent = 'View';
                var dl = document.createElement('a'); dl.href = API + '?id=' + encodeURIComponent(s.id) + '&download=1'; dl.textContent = 'Download';
                actions.appendChild(view); actions.appendChild(document.createTextNode(' · ')); actions.appendChild(dl); actions.appendChild(document.createTextNode(' · '));
            }
            var del = document.createElement('button'); del.type = 'button'; del.className = 'tf-link'; del.textContent = 'Delete';
            del.addEventListener('click', async function () {
                if (!confirm('Permanently delete the ' + (FORM_LABEL[s.formType] || 'form') + ' from ' + s.name + '?')) return;
                var r = await fetch(API + '?id=' + encodeURIComponent(s.id), { method: 'DELETE', credentials: 'same-origin' });
                if (!r.ok) { var o = {}; try { o = await r.json(); } catch (e) {} return err(list, o.error || 'Delete failed.'); }
                load();
            });
            actions.appendChild(del);
            tr.appendChild(actions);
            rows.appendChild(tr);
        });
    }

    login.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        err(login, '');
        var btn = login.querySelector('button');
        btn.disabled = true;
        try {
            var res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ password: document.getElementById('password').value })
            });
            var out = {}; try { out = await res.json(); } catch (e) {}
            if (!res.ok) return err(login, out.error || 'Sign-in failed.');
            document.getElementById('password').value = '';
            load();
        } finally {
            btn.disabled = false;
        }
    });
    document.getElementById('refresh').addEventListener('click', load);
    document.getElementById('logout').addEventListener('click', async function () {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
        list.hidden = true; login.hidden = false;
    });
    load();
})();
