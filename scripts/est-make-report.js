#!/usr/bin/env node
/* est-make-report.js — Gera out/estudo.html e out/zonas.csv a partir de out/resultados.json (e out/qa.json, opcional).
 * Uso: node scripts/est-make-report.js out/resultados.json out/qa.json out/estudo.html */
'use strict';
const fs = require('fs'), path = require('path');
const P = require('./est-report.js');
const [resFile, qaFile, outHtml] = process.argv.slice(2);
if (!resFile || !outHtml) { console.error('uso: node scripts/est-make-report.js out/resultados.json out/qa.json out/estudo.html'); process.exit(2); }
const res = JSON.parse(fs.readFileSync(resFile, 'utf8'));
let qa = null;
try { qa = JSON.parse(fs.readFileSync(qaFile, 'utf8')); } catch (e) { console.warn('aviso: sem qa.json (' + qaFile + ')'); }
const html = P.render(res, { generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), qa: qa });
fs.mkdirSync(path.dirname(outHtml), { recursive: true });
fs.writeFileSync(outHtml, html);
fs.writeFileSync(path.join(path.dirname(outHtml), 'zonas.csv'), P.zonesCsv(res));
console.log('gravado', outHtml, '(' + Math.round(html.length / 1024) + ' KB) e zonas.csv');
