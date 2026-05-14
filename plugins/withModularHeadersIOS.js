const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeadersIOS(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Si ya existe, no hacer nada
      if (contents.includes('use_modular_headers!')) {
        return config;
      }

      // Buscar la línea que empieza con platform :ios (con o sin versión)
      contents = contents.replace(
        /^platform\s+:ios.*$/m,
        (match) => `${match}\nuse_modular_headers!`
      );

      fs.writeFileSync(podfilePath, contents);

      return config;
    },
  ]);
};