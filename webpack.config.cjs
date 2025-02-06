const path = require('path');

// Base configuration shared between extension and panel
const baseConfig = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@server': path.resolve(__dirname, 'src/server'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@test': path.resolve(__dirname, 'src/__tests__'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@panel': path.resolve(__dirname, 'src/panel'),
      '@components': path.resolve(__dirname, 'src/panel/components'),
      '@controllers': path.resolve(__dirname, 'src/server/controllers'),
      // Alias React to Preact
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime'
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [{
          loader: 'ts-loader',
          options: {
            transpileOnly: true
          }
        }]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['tailwindcss', {
                    content: [
                      './src/panel/**/*.{js,ts,jsx,tsx}',
                      './src/panel/components/**/*.{js,ts,jsx,tsx}'
                    ],
                    // Explicitly exclude patterns
                    exclude: [
                      '**/node_modules/**',
                      '**/__tests__/**',
                      '**/*.test.{js,ts,jsx,tsx}'
                    ]
                  }],
                  require('autoprefixer'),
                ]
              }
            }
          }
        ]
      }
    ]
  }
};

// Extension configuration (Node.js target)
const extensionConfig = {
  ...baseConfig,
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.cjs',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode',
    // Add Express and its dependencies as externals
    express: 'commonjs express',
    'express/lib/view': 'commonjs express/lib/view',
    'express/lib/application': 'commonjs express/lib/application',
    'express/lib/express': 'commonjs express/lib/express'
  }
};

// WebView Panel configuration (Web target)
const panelConfig = {
  ...baseConfig,
  target: 'web',
  entry: './src/panel/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'panel.js',
    libraryTarget: 'window'
  },
  resolve: {
    ...baseConfig.resolve,
    fallback: {
      // Polyfills for browser environment
      path: false,
      fs: false,
      os: false,
      process: require.resolve('process/browser')
    }
  },
  plugins: [
    // Define environment variables consistently
    new (require('webpack')).DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        VSCODE_TEST: JSON.stringify(process.env.VSCODE_TEST || false)
      }
    }),
    // Provide process and Buffer for the browser
    new (require('webpack')).ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]
};

// Export both configurations
module.exports = [extensionConfig, panelConfig]; 