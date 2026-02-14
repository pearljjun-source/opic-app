/**
 * phosphor-react-native 3.0.3 배포 버그 패치
 *
 * 문제: package.json의 "source": "src/index" 필드가 있는데,
 *       src/defs/ 폴더가 npm 패키지에 포함되지 않음.
 *       Metro가 source 필드를 보고 TypeScript 소스를 직접 읽으려다 실패.
 *
 * 해결: source 필드 제거 → Metro가 빌드된 lib/module/index.js 사용.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', 'phosphor-react-native', 'package.json');

if (!fs.existsSync(pkgPath)) {
  // 패키지가 아직 설치되지 않은 경우 (최초 install 시)
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (pkg.source) {
  delete pkg.source;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[patch] phosphor-react-native: removed "source" field from package.json');
} else {
  console.log('[patch] phosphor-react-native: already patched');
}
