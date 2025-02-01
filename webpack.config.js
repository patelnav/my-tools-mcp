const path = require('path');
const webpack = require('webpack');

// Base configuration for both extension and webview
const baseConfig = {
  mode: 'none',
  devtool: 'nosources-source-map',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@panel': path.resolve(__dirname, 'src/panel'),
      '@components': path.resolve(__dirname, 'src/panel/components'),
      '@controllers': path.resolve(__dirname, 'src/server/controllers'),
      '@tests': path.resolve(__dirname, 'src/__tests__')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  }
};

// Extension host configuration
const extensionConfig = {
  ...baseConfig,
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  }
};

// WebView panel configuration
const webviewConfig = {
  ...baseConfig,
  target: 'web',
  entry: './src/panel/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'panel.js'
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({})
    })
  ],
  resolve: {
    ...baseConfig.resolve,
    fallback: {
      process: require.resolve('process/browser')
    }
  }
};

module.exports = [extensionConfig, webviewConfig]; 