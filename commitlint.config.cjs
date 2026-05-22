// Tipos soportados — superset compatible con @commitlint/config-conventional.
// Añadidos sobre el set original (feat/fix/chore/refactor/test/docs):
//   - ci:     cambios a configuración de CI/CD (workflows, scripts de release).
//   - build:  cambios al sistema de build o dependencias (package.json, pom.xml).
//   - perf:   mejoras de performance que no son ni fix ni feature.
//   - style:  cambios cosméticos sin impacto funcional (formato, espacios).
//   - revert: revierte un commit anterior (git revert produce este prefijo
//             en minúscula; "Revert" en mayúscula ya está auto-skippeado en
//             scripts/commitlint.mjs vía shouldSkip()).
const TYPES = ['feat', 'fix', 'chore', 'refactor', 'test', 'docs', 'ci', 'build', 'perf', 'style', 'revert']

module.exports = {
  types: TYPES,
  headerPattern: new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9._/-]+\\))?: .+$`),
  maxHeaderLength: 100,
}

