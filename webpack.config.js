const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

// Get environment with fallback
const getEnvironment = () => {
  const env = process.env.NODE_ENV?.toLowerCase();
  return env === 'test' || env === 'production' ? env : 'development';
};

// Environment variables to expose to the application
const getEnvVars = () => ({
  NODE_ENV: JSON.stringify(getEnvironment())
});

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
      '@test': path.resolve(__dirname, 'src/__tests__'),
      // Alias React to Preact for the webview
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime'
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [
          /node_modules/,
          /dist/
        ],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, './tsconfig.json'),
              // Allow tests to be compiled
              transpileOnly: true
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: false,
          keep_classnames: true,
          keep_fnames: true,
          compress: {
            defaults: false,
            dead_code: true,
            unused: true,
            conditionals: true
          },
          output: {
            beautify: false,
            comments: false
          }
        }
      })
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
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': getEnvVars()
    })
  ],
  optimization: {
    minimize: false // Don't minify the extension code
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
      'process.env': getEnvVars()
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