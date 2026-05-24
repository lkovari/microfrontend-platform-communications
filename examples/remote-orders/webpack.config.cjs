const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

const isDev = process.env.NODE_ENV !== 'production';
const libraryRoot = path.resolve(__dirname, '../../mfe-platform-communication');

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: path.resolve(__dirname, 'src/bootstrap.ts'),
  output: {
    path: path.resolve(__dirname, '../dist/remote-orders'),
    publicPath: isDev ? 'http://localhost:4301/' : '/remote-orders/',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@lkovari/microfrontend-platform-communication/core': path.join(
        libraryRoot,
        'dist/core/index.js',
      ),
      '@lkovari/microfrontend-platform-communication/schemas': path.join(
        libraryRoot,
        'dist/schemas/index.js',
      ),
      '@lkovari/microfrontend-platform-communication/contracts': path.join(
        libraryRoot,
        'dist/contracts/index.js',
      ),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: { transpileOnly: true },
      },
    ],
  },
  devServer: {
    port: 4301,
    hot: false,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'remoteOrders',
      filename: 'remoteEntry.js',
      exposes: {
        './bootstrap': path.resolve(__dirname, 'src/bootstrap.ts'),
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
    }),
  ],
};
