'use strict';

const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

const productionConfig = { ...require('./webpack.config') };

delete productionConfig.devServer;
delete productionConfig.devtool;

productionConfig.mode = 'production';
productionConfig.module.rules[0].enforce = 'pre';
productionConfig.optimization.minimizer = [
  '...',
  new TerserPlugin({
    include: /\.min\.js$/,
    terserOptions: {
      cache: true,
      parallel: true,
      sourceMap: false
    }
  }),
  new CssMinimizerPlugin({
    test: /\.min\.css$/
  })
];

module.exports = productionConfig;
