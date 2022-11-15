/* eslint-disable no-undef */
/* eslint-disable quote-props */
/* global __dirname: readonly */
'use strict';

const { readFileSync } = require('fs');
const { version } = require('./package');
const CopyPlugin = require('copy-webpack-plugin');
const { resolve, join, dirname } = require('path');
const JsDocPlugin = require('jsdoc-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const WriteFilePlugin = require('write-file-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const SymlinkWebpackPlugin = require('symlink-webpack-plugin');
const FileManagerPlugin = require('filemanager-webpack-plugin');
const replaceVersionStrings = require('./scripts/replace-version-strings');

const isEnvProduction = process.env.NODE_ENV === 'production';
const isEnvDevelopment = process.env.NODE_ENV === 'development';
const isDevServer = isEnvDevelopment && process.argv.includes('serve');

module.exports = {
  name: 'Braintree-dropin',
  mode: isEnvProduction ? 'production' : 'development',
  target: isDevServer ? 'web' : 'browserslist',
  bail: isEnvProduction,
  output: {
    library: 'dropin',
    libraryTarget: 'umd',
    filename: `web/dropin/${version}/js/[name].js`,
    path: resolve(__dirname, 'dist'),
  },
  // eslint-disable-next-line no-undefined
  devtool: isEnvProduction ? undefined : 'inline-source-map',
  entry: {
    dropin: ['./src/less/main.less', './src/index.js'],
    'dropin.min': ['./src/less/main.less', './src/index.js'],
  },
  module: {
    rules: [
      {
        oneOf: [
          {
            test: /\.css$/i,
            use: [MiniCssExtractPlugin.loader, 'css-loader'],
          },
          {
            test: /\.less$/,
            use: [
              { loader: MiniCssExtractPlugin.loader },
              { loader: 'css-loader' },
              {
                loader: 'postcss-loader',
                options: {
                  postcssOptions: {
                    plugins: [['postcss-preset-env', 'postcss-clean']],
                  },
                },
              },
              { loader: 'less-loader' },
            ],
          },
          {
            test: /\.svg$/,
            use: [
              {
                loader: '@svgr/webpack',
                options: {
                  prettier: false,
                  svgo: false,
                  svgoConfig: {
                    plugins: [{ removeViewBox: false }],
                  },
                  titleProp: true,
                  ref: true,
                },
              },
              {
                loader: 'file-loader',
                options: {
                  name: 'static/media/[name].[hash].[ext]',
                },
              },
            ],
            issuer: {
              and: [/\.(ts|tsx|js|jsx|md|mdx)$/],
            },
          },
          {
            test: /\.(js|ts)?$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: 'babel-loader',
            },
          },
          // eslint-disable-next-line object-curly-spacing
          { test: /\.[cm]?js$/, parser: { requireEnsure: false } },
          {
            test: /\.html$/i,
            loader: 'html-loader',
            options: {
              esModule: false,
            },
          },
          {
            test: /\.(js|html)$/,
            use: './scripts/replace-version-strings',
          },
        ],
      },
    ],
  },
  optimization: {
    moduleIds: 'deterministic',
    splitChunks: {
      cacheGroups: {
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
        },
      },
    },
    minimize: isEnvProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
          },
          mangle: {
            safari10: true,
          },
          // eslint-disable-next-line camelcase
          keep_classnames: isEnvProduction,
          // eslint-disable-next-line camelcase
          keep_fnames: isEnvProduction,
          output: {
            ecma: 5,
            comments: false,
            // eslint-disable-next-line camelcase
            ascii_only: true,
          },
        },
      }),
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new ESLintPlugin(),
    new MiniCssExtractPlugin({
      filename: `web/dropin/${version}/css/[name].css`,
    }),
    new WriteFilePlugin(), // write files to our ./dist folder when running dev server
    new JsDocPlugin({
      conf: './jsdoc/jsdoc.conf.js',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'test/app',
          to: 'gh-pages',
          globOptions: { dot: true },
        },
        { from: 'jsdoc/index.html', to: 'gh-pages/docs' },
        { from: './LICENSE', to: './npm' },
        {
          from: './package.json',
          to: './npm',
          transform: (content) => {
            const pkg = JSON.parse(content.toString());

            delete pkg.private;
            pkg.main = 'index.js';
            pkg.browser = './dist/browser/dropin.js';

            return JSON.stringify(pkg);
          },
        },
        {
          from: './src/**/*.js',
          to: './npm',
          transform: (content, path) => {
            let htmlContent, filePath;
            let jsContent = replaceVersionStrings(content.toString());
            const htmlPaths = [
              ...jsContent.matchAll(
                new RegExp("require\\('(.+)\\.html'\\)", 'g')
              ),
            ];

            if (htmlPaths.length > 0) {
              htmlPaths.forEach((foundPath) => {
                filePath = resolve(dirname(path), `${foundPath[1]}.html`);
                htmlContent = readFileSync(filePath, 'utf8');
                htmlContent = htmlContent
                  .replace(/\\([\s\S])|(")/g, '\\$1$2')
                  .replace(/\n/g, '\\n')
                  .replace(/ {2,}/g, ' ')
                  .replace(/> +</g, '><');

                jsContent = jsContent.replace(foundPath[0], `"${htmlContent}"`);
              });
            }

            return jsContent;
          },
        },
      ],
    }),
    new FileManagerPlugin({
      events: {
        onEnd: {
          copy: [
            { source: './{CHANGELOG,README}.md', destination: './dist/npm' },
            {
              source: `./dist/web/dropin/${version}/js/*.js`,
              destination: './dist/npm/dist/browser',
            },
            {
              source: `./dist/web/dropin/${version}/css/*.css`,
              destination: './dist/npm',
            },
          ],
          delete: ['./dist/npm/**/__mocks__'],
        },
      },
    }),
    new SymlinkWebpackPlugin([
      { origin: `web/dropin/${version}`, symlink: 'web/dropin/dev' },
      { origin: `gh-pages/docs/${version}`, symlink: 'gh-pages/docs/current' },
    ]),
  ],
  resolve: {
    extensions: ['.wasm', '.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      cldr$: 'cldrjs',
      cldr: 'cldrjs/dist/cldr',
    },
    fallback: {
      path: require.resolve('path-browserify'),
    },
    plugins: [],
  },
  devServer: {
    allowedHosts: ['.bt.local'],
    static: [
      { directory: join(__dirname, 'dist', 'gh-pages') },
      { directory: join(__dirname, 'dist') },
    ],
    liveReload: false,
    onListening: (devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      const port = devServer.server.address().port;

      // eslint-disable-next-line no-console
      console.log('Development server listening:', port);
    },
    port: 4567,
    devMiddleware: {
      writeToDisk: true,
    },
  },
};
