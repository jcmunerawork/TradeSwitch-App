
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/tradeManager-web/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "preload": [
      "chunk-CTRQBIZR.js",
      "chunk-LJ2FCI6F.js",
      "chunk-SKZDU2RJ.js",
      "chunk-HLCVMOPQ.js",
      "chunk-SAK2ZTT3.js",
      "chunk-EM2IW7TQ.js",
      "chunk-AJ3MBESQ.js",
      "chunk-6B66MAHI.js",
      "chunk-HJWNCUMO.js",
      "chunk-5E6NCZTH.js"
    ],
    "route": "/tradeManager-web"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-CTRQBIZR.js",
      "chunk-LJ2FCI6F.js",
      "chunk-SKZDU2RJ.js",
      "chunk-HLCVMOPQ.js",
      "chunk-SAK2ZTT3.js",
      "chunk-EM2IW7TQ.js",
      "chunk-AJ3MBESQ.js",
      "chunk-6B66MAHI.js",
      "chunk-HJWNCUMO.js",
      "chunk-5E6NCZTH.js"
    ],
    "route": "/tradeManager-web/strategy"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-PSE2Z7GP.js",
      "chunk-K32DDES3.js",
      "chunk-JG5HE6JJ.js",
      "chunk-SKZDU2RJ.js",
      "chunk-HLCVMOPQ.js",
      "chunk-SAK2ZTT3.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/edit-strategy"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-5ADDPBRG.js",
      "chunk-Q4UU5KEX.js",
      "chunk-Q7LL5VG7.js",
      "chunk-QT3TED6C.js",
      "chunk-LJ2FCI6F.js",
      "chunk-JG5HE6JJ.js",
      "chunk-SKZDU2RJ.js",
      "chunk-HLCVMOPQ.js",
      "chunk-SAK2ZTT3.js",
      "chunk-EM2IW7TQ.js"
    ],
    "route": "/tradeManager-web/report"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-IK6TRPLK.js",
      "chunk-DIYGMRU6.js",
      "chunk-EM2IW7TQ.js",
      "chunk-HJWNCUMO.js",
      "chunk-5E6NCZTH.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/signup"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-IK6TRPLK.js",
      "chunk-DIYGMRU6.js",
      "chunk-EM2IW7TQ.js",
      "chunk-HJWNCUMO.js",
      "chunk-5E6NCZTH.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/admin-signup"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-H374AYGF.js",
      "chunk-AJ3MBESQ.js",
      "chunk-6B66MAHI.js",
      "chunk-HJWNCUMO.js",
      "chunk-5E6NCZTH.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/login"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-XHFSM47B.js",
      "chunk-K32DDES3.js",
      "chunk-Q7LL5VG7.js",
      "chunk-6B66MAHI.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/overview"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-NTEZU5TL.js",
      "chunk-K32DDES3.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/users"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-5VW5BGMN.js",
      "chunk-K32DDES3.js",
      "chunk-Q4UU5KEX.js",
      "chunk-Q7LL5VG7.js",
      "chunk-6B66MAHI.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/revenue"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-A5FCZVQK.js",
      "chunk-HLCVMOPQ.js",
      "chunk-SAK2ZTT3.js",
      "chunk-DIYGMRU6.js",
      "chunk-EM2IW7TQ.js",
      "chunk-5E6NCZTH.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/account"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-2LEMHCQH.js",
      "chunk-K32DDES3.js",
      "chunk-QT3TED6C.js",
      "chunk-LJ2FCI6F.js",
      "chunk-SAK2ZTT3.js",
      "chunk-EM2IW7TQ.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/trading-accounts"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-ZG4WX4SY.js",
      "chunk-AJ3MBESQ.js",
      "chunk-6B66MAHI.js",
      "chunk-HJWNCUMO.js",
      "chunk-5E6NCZTH.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/tradeManager-web/add-account"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 1912, hash: '2092986453130c43f31441032a9055660383dc9f2fa2b1e940a8e2da95fb6079', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2260, hash: '003fed144d6116698fd04632d815284139913c1d94c75eafc2396dd2bde702b9', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 27533, hash: '3d4f06f9d1e79ec4491e885bdb8f39aeb029f9e469aa700050e4fd87be25054a', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'strategy/index.html': {size: 27533, hash: '3d4f06f9d1e79ec4491e885bdb8f39aeb029f9e469aa700050e4fd87be25054a', text: () => import('./assets-chunks/strategy_index_html.mjs').then(m => m.default)},
    'revenue/index.html': {size: 27325, hash: '241d2e6172792d81c097f047dc91d2b7446ec4f55c32cd9baf9215b3e6f20d61', text: () => import('./assets-chunks/revenue_index_html.mjs').then(m => m.default)},
    'overview/index.html': {size: 27273, hash: '4e1831e6e0588d9b61943d57f73576a6d78b1647176d745ba1e3b798d155e2f3', text: () => import('./assets-chunks/overview_index_html.mjs').then(m => m.default)},
    'edit-strategy/index.html': {size: 27377, hash: '011da764798ca43ab2083e0e5bd3352896e1f90c6d328d9f18d9d2112621e91f', text: () => import('./assets-chunks/edit-strategy_index_html.mjs').then(m => m.default)},
    'trading-accounts/index.html': {size: 27377, hash: '0b656b30ae450e9a598cb97b7acd0539b4af72cd936e8328e669bbb4db1d3c64', text: () => import('./assets-chunks/trading-accounts_index_html.mjs').then(m => m.default)},
    'users/index.html': {size: 27169, hash: 'c14c4c8c47df308a0d061ab9c3a4e00ca9e37f02bf6308513d45288cdf49a675', text: () => import('./assets-chunks/users_index_html.mjs').then(m => m.default)},
    'add-account/index.html': {size: 27325, hash: '34301188bf81b32a8cd4d53218aee5797c157ca97cfaf07a8ef88d3822a02744', text: () => import('./assets-chunks/add-account_index_html.mjs').then(m => m.default)},
    'login/index.html': {size: 27325, hash: '1423d8fce11796d407b9c14f0a6cf2bd0cb46c73e7bd3e5dabacc0fb500e9cb1', text: () => import('./assets-chunks/login_index_html.mjs').then(m => m.default)},
    'report/index.html': {size: 27533, hash: 'b0cfd8f22dd45ab920f11591c570c65a54eeb644e9f5f11031f2f82b175ecae3', text: () => import('./assets-chunks/report_index_html.mjs').then(m => m.default)},
    'account/index.html': {size: 27377, hash: '8e1baea0c285d18769bd8ba6809a9a43afc6be629d8c1fc0526290d5b8772c8e', text: () => import('./assets-chunks/account_index_html.mjs').then(m => m.default)},
    'signup/index.html': {size: 165810, hash: '8010358c3e1ee3605342e774e719fd100e12c00e2ecc8e8855882ca79e0771cf', text: () => import('./assets-chunks/signup_index_html.mjs').then(m => m.default)},
    'admin-signup/index.html': {size: 165607, hash: '7e3e00eaa29f1e835f6bd98f105f33d0fb4cb57566f3c02e7385d65cfb94034a', text: () => import('./assets-chunks/admin-signup_index_html.mjs').then(m => m.default)},
    'styles-DQD57UPU.css': {size: 28762, hash: '3gTCcubsNy0', text: () => import('./assets-chunks/styles-DQD57UPU_css.mjs').then(m => m.default)}
  },
};
