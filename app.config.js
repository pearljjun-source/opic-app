const path = require('path');
const dotenv = require('dotenv');

// APP_ENV에 따라 .env.development 또는 .env.production 로드
const APP_ENV = process.env.APP_ENV || 'development';
dotenv.config({ path: path.resolve(__dirname, `.env.${APP_ENV}`) });

const IS_PROD = APP_ENV === 'production';

module.exports = {
  expo: {
    name: IS_PROD ? 'Speaky' : 'Speaky (Dev)',
    slug: 'opic-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'opic-app',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#3B82F6',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.opic.app',
      infoPlist: {
        NSMicrophoneUsageDescription:
          'OPIc 연습을 위해 음성 녹음이 필요합니다.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.opic.app',
      versionCode: 1,
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'speaky.co.kr',
              pathPrefix: '/join',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        '@sentry/react-native/expo',
        {
          organization: 'speaky',
          project: 'opic-app',
        },
      ],
      [
        'expo-audio',
        {
          microphonePermission:
            'OPIc 연습을 위해 음성 녹음이 필요합니다.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#3B82F6',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '845ccef4-b592-4e2c-9da7-61c06c56e622',
      },
      router: {},
    },
    owner: 'pearljjun',
  },
};
