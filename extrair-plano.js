/* extrair-plano.js — grava na pasta atual todos os arquivos embutidos no plano (marcados com "<!-- ARQUIVO: caminho -->").
 * Uso (na raiz do repositório): node extrair-plano.js caminho/PLANO_PLACAR_2T.md [--dry]
 * --dry só lista. Recusa caminhos absolutos ou com "..". Sobrescreve arquivos existentes com o mesmo caminho. */
const fs = require('fs');
const path = require('path');
const arquivo = process.argv[2];
if (!arquivo) { console.error('uso: node extrair-plano.js PLANO_PLACAR_2T.md [--dry]'); process.exit(2); }
const dry = process.argv.includes('--dry');
const md = fs.readFileSync(arquivo, 'utf8');
const F = '`'.repeat(3);
const re = new RegExp('<!-- ARQUIVO: (\\S+) -->\\s*\\n' + F + '[a-z]*\\n([\\s\\S]*?)\\n' + F, 'g');
let m, n = 0;
while ((m = re.exec(md))) {
  const rel = m[1];
  if (path.isAbsolute(rel) || rel.split('/').indexOf('..') >= 0) { console.error('caminho recusado:', rel); process.exit(2); }
  if (!dry) { fs.mkdirSync(path.dirname(rel), { recursive: true }); fs.writeFileSync(rel, m[2] + '\n'); }
  console.log((dry ? '[dry] ' : 'escrito ') + rel + ' (' + m[2].split('\n').length + ' linhas)');
  n++;
}
console.log(n + ' arquivos' + (dry ? ' (nada foi gravado)' : ' gravados'));
if (n === 0) process.exit(1);
