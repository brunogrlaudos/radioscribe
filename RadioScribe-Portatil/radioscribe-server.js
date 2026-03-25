/**
 * RadioScribe Pro — Servidor Local SQLite
 * Porta: 3131
 * Uso: node radioscribe-server.js
 */

const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

const Database = require('better-sqlite3');

// ── Configuração ──────────────────────────────────────
const PORT    = 3131;

// Pasta de dados separada — facilita backup e sincronização em nuvem
const DATA_DIR = path.join(__dirname, 'dados');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH   = path.join(DATA_DIR, 'radioscribe.db');
const HTML_PATH = path.join(__dirname, 'radioscribe-pro.html');

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║      RadioScribe Pro — Servidor Local     ║');
console.log('╚══════════════════════════════════════════╝');
console.log(`  Banco de dados : ${DB_PATH}`);
console.log(`  Servidor       : http://localhost:${PORT}`);
console.log('');

// ── Inicializar banco de dados ────────────────────────
const db = new Database(DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes (
        chave   TEXT PRIMARY KEY,
        valor   TEXT NOT NULL,
        updated INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS formulas (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        regiao  TEXT NOT NULL,
        label   TEXT NOT NULL,
        texto   TEXT NOT NULL,
        ordem   INTEGER DEFAULT 0,
        created INTEGER DEFAULT (strftime('%s','now')),
        updated INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS alternativas (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        regiao  TEXT NOT NULL,
        cat     TEXT NOT NULL,
        frase   TEXT NOT NULL,
        ordem   INTEGER DEFAULT 0,
        created INTEGER DEFAULT (strftime('%s','now')),
        updated INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS laudos (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo  TEXT,
        texto   TEXT NOT NULL,
        created INTEGER DEFAULT (strftime('%s','now')),
        updated INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_formulas_regiao     ON formulas(regiao);
    CREATE INDEX IF NOT EXISTS idx_alternativas_regiao ON alternativas(regiao);
    CREATE INDEX IF NOT EXISTS idx_laudos_created      ON laudos(created DESC);
`);

console.log('  ✅ Banco de dados inicializado');

// ── Helpers ───────────────────────────────────────────
function json(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

function err(res, msg, status = 400) {
    json(res, { error: msg }, status);
}

function bodyJSON(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch(e) { reject(e); }
        });
    });
}

// ── Roteador ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
    const url    = new URL(req.url, `http://localhost:${PORT}`);
    const method = req.method.toUpperCase();
    const parts  = url.pathname.split('/').filter(Boolean); // ['api','formulas',...]

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // ── Servir o HTML ──────────────────────────────────
    if (method === 'GET' && url.pathname === '/') {
        if (fs.existsSync(HTML_PATH)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(fs.readFileSync(HTML_PATH));
        }
        return err(res, 'radioscribe-pro.html não encontrado na mesma pasta do servidor.', 404);
    }

    // ── API ────────────────────────────────────────────
    if (parts[0] !== 'api') {
        return err(res, 'Rota não encontrada', 404);
    }

    try {
        // ── /api/config ─────────────────────────────────
        if (parts[1] === 'config') {
            if (method === 'GET') {
                const rows = db.prepare('SELECT chave, valor FROM configuracoes').all();
                const cfg  = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
                return json(res, cfg);
            }
            if (method === 'POST') {
                const body = await bodyJSON(req);
                const stmt = db.prepare(`
                    INSERT INTO configuracoes(chave,valor,updated)
                    VALUES(?,?,strftime('%s','now'))
                    ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, updated=strftime('%s','now')
                `);
                for (const [k, v] of Object.entries(body)) stmt.run(k, String(v));
                return json(res, { ok: true });
            }
        }

        // ── /api/formulas ────────────────────────────────
        if (parts[1] === 'formulas') {
            // GET /api/formulas  →  { "Região": [{id,label,texto},...], ... }
            if (method === 'GET') {
                const rows = db.prepare('SELECT * FROM formulas ORDER BY regiao, ordem, id').all();
                const result = {};
                for (const r of rows) {
                    if (!result[r.regiao]) result[r.regiao] = [];
                    result[r.regiao].push({ id: r.id, label: r.label, text: r.texto });
                }
                return json(res, result);
            }

            // POST /api/formulas  →  bulk upsert { "Região": [{label,text},...], ... }
            if (method === 'POST') {
                const body = await bodyJSON(req);
                const del  = db.prepare('DELETE FROM formulas');
                const ins  = db.prepare('INSERT INTO formulas(regiao,label,texto,ordem) VALUES(?,?,?,?)');
                db.transaction(() => {
                    del.run();
                    for (const [regiao, items] of Object.entries(body)) {
                        items.forEach((item, i) => ins.run(regiao, item.label, item.text, i));
                    }
                })();
                return json(res, { ok: true });
            }

            // PUT /api/formulas/:id
            if (method === 'PUT' && parts[2]) {
                const body = await bodyJSON(req);
                db.prepare(`UPDATE formulas SET label=?,texto=?,regiao=?,updated=strftime('%s','now') WHERE id=?`)
                  .run(body.label, body.text, body.regiao, parts[2]);
                return json(res, { ok: true });
            }

            // DELETE /api/formulas/:id
            if (method === 'DELETE' && parts[2]) {
                db.prepare('DELETE FROM formulas WHERE id=?').run(parts[2]);
                return json(res, { ok: true });
            }
        }

        // ── /api/alternativas ─────────────────────────────
        if (parts[1] === 'alternativas') {
            if (method === 'GET') {
                const rows = db.prepare('SELECT * FROM alternativas ORDER BY regiao, ordem, id').all();
                const result = {};
                for (const r of rows) {
                    if (!result[r.regiao]) result[r.regiao] = [];
                    result[r.regiao].push({ id: r.id, cat: r.cat, phrase: r.frase });
                }
                return json(res, result);
            }

            if (method === 'POST') {
                const body = await bodyJSON(req);
                const del  = db.prepare('DELETE FROM alternativas');
                const ins  = db.prepare('INSERT INTO alternativas(regiao,cat,frase,ordem) VALUES(?,?,?,?)');
                db.transaction(() => {
                    del.run();
                    for (const [regiao, items] of Object.entries(body)) {
                        items.forEach((item, i) => ins.run(regiao, item.cat, item.phrase, i));
                    }
                })();
                return json(res, { ok: true });
            }

            if (method === 'PUT' && parts[2]) {
                const body = await bodyJSON(req);
                db.prepare(`UPDATE alternativas SET regiao=?,cat=?,frase=?,updated=strftime('%s','now') WHERE id=?`)
                  .run(body.regiao, body.cat, body.phrase, parts[2]);
                return json(res, { ok: true });
            }

            if (method === 'DELETE' && parts[2]) {
                db.prepare('DELETE FROM alternativas WHERE id=?').run(parts[2]);
                return json(res, { ok: true });
            }
        }

        // ── /api/laudos ───────────────────────────────────
        if (parts[1] === 'laudos') {
            // GET /api/laudos         → lista últimos 50
            // GET /api/laudos/:id     → laudo específico
            if (method === 'GET') {
                if (parts[2]) {
                    const row = db.prepare('SELECT * FROM laudos WHERE id=?').get(parts[2]);
                    return row ? json(res, row) : err(res, 'Não encontrado', 404);
                }
                const rows = db.prepare('SELECT id, titulo, substr(texto,1,120) as preview, created, updated FROM laudos ORDER BY updated DESC LIMIT 50').all();
                return json(res, rows);
            }

            // POST /api/laudos  → salvar/criar laudo  { titulo?, texto }
            if (method === 'POST') {
                const body = await bodyJSON(req);
                if (!body.texto) return err(res, 'Campo "texto" obrigatório');
                const titulo = body.titulo || `Laudo ${new Date().toLocaleDateString('pt-BR')}`;
                if (body.id) {
                    // Atualizar existente
                    db.prepare(`UPDATE laudos SET titulo=?,texto=?,updated=strftime('%s','now') WHERE id=?`)
                      .run(titulo, body.texto, body.id);
                    return json(res, { ok: true, id: body.id });
                }
                // Criar novo
                const result = db.prepare('INSERT INTO laudos(titulo,texto) VALUES(?,?)').run(titulo, body.texto);
                return json(res, { ok: true, id: result.lastInsertRowid });
            }

            // DELETE /api/laudos/:id
            if (method === 'DELETE' && parts[2]) {
                db.prepare('DELETE FROM laudos WHERE id=?').run(parts[2]);
                return json(res, { ok: true });
            }
        }

        // ── /api/status ───────────────────────────────────
        if (parts[1] === 'status' && method === 'GET') {
            const counts = {
                formulas:     db.prepare('SELECT COUNT(*) as n FROM formulas').get().n,
                alternativas: db.prepare('SELECT COUNT(*) as n FROM alternativas').get().n,
                laudos:       db.prepare('SELECT COUNT(*) as n FROM laudos').get().n,
                db_path:      DB_PATH,
                db_size_kb:   Math.round(fs.statSync(DB_PATH).size / 1024)
            };
            return json(res, counts);
        }

        err(res, 'Rota não encontrada', 404);

    } catch(e) {
        console.error('[Erro]', e.message);
        err(res, e.message, 500);
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`  ✅ Servidor rodando em http://localhost:${PORT}`);
    console.log('');
    console.log('  Abra o navegador em: http://localhost:3131');
    console.log('  Para parar: Ctrl+C');
    console.log('');

    // Abrir navegador automaticamente (Windows/Linux/Mac)
    const plat = process.platform;
    const cmd  = plat === 'win32' ? 'start' : plat === 'darwin' ? 'open' : 'xdg-open';
    try { require('child_process').exec(`${cmd} http://localhost:${PORT}`); } catch(e) {}
});

server.on('error', e => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\n  ❌ Porta ${PORT} já está em uso.`);
        console.error(`     Feche o outro processo ou edite PORT no início deste arquivo.\n`);
    } else {
        console.error('\n  ❌ Erro:', e.message);
    }
    process.exit(1);
});
