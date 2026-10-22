const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

class VersionedAssetsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('VersionedAssetsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'VersionedAssetsPlugin',
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      }, () => {
        const stylesheet = compilation.getAssets().find((asset) => /^css\/style\.[a-f0-9]+\.css$/.test(asset.name));
        const script = compilation.entrypoints.get('app').getFiles().find((file) => /^js\/app\.[a-f0-9]+\.js$/.test(file));
        if (!stylesheet || !script) throw new Error('Versioned website assets are missing.');
        for (const filename of ['index.html', 'blog/index.html']) {
          const html = compilation.getAsset(filename).source.source().toString()
            .replaceAll('css/style.css', stylesheet.name)
            .replaceAll('js/app.js', script);
          compilation.updateAsset(filename, new compiler.webpack.sources.RawSource(html));
        }
      });
    });
  }
}

module.exports = merge(common, {
  mode: 'production',
  output: {
    filename: 'js/[name].[contenthash:8].js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      inject: false,
    }),
    new CopyPlugin({
      patterns: [
        { from: 'img', to: 'img' },
        { from: 'fonts/zpix-subset.woff2', to: 'fonts/zpix-subset.woff2' },
        { from: 'css/style.css', to: 'css/style.[contenthash:8].css' },
        { from: 'js/vendor', to: 'js/vendor' },
        { from: 'blog', to: 'blog' },
        { from: 'icon.svg', to: 'icon.svg' },
        { from: 'favicon.ico', to: 'favicon.ico' },
        { from: 'robots.txt', to: 'robots.txt' },
        { from: 'icon.png', to: 'icon.png' },
        { from: '404.html', to: '404.html' },
        { from: 'site.webmanifest', to: 'site.webmanifest' },
      ],
    }),
    new VersionedAssetsPlugin(),
  ],
});
