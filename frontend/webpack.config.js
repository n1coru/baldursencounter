const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  experiments: {
    asyncWebAssembly: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      favicon: false,
    }),
    new MiniCssExtractPlugin({ filename: 'styles.[contenthash].css' }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/wasm/*.wasm'),
          to: '[name][ext]',
        },
        // session.config.json is served as a static file so it can be
        // volume-mounted in Docker without rebuilding the image
        {
          from: path.resolve(__dirname, '../session.config.json'),
          to: 'session.config.json',
        },
      ],
    }),
  ],
  devServer: {
    static: './dist',
    port: 8080,
  },
};
