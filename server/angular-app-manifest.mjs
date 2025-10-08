
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
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
    "route": "/"
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
    "route": "/strategy"
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
    "route": "/edit-strategy"
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
    "route": "/report"
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
    "route": "/signup"
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
    "route": "/admin-signup"
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
    "route": "/login"
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
    "route": "/overview"
  },
  {
    "renderMode": 2,
    "preload": [
      "chunk-NTEZU5TL.js",
      "chunk-K32DDES3.js",
      "chunk-TB2EFIJE.js"
    ],
    "route": "/users"
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
    "route": "/revenue"
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
    "route": "/account"
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
    "route": "/trading-accounts"
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
    "route": "/add-account"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 1895, hash: '53e60af0db5701b69140cbc1830fae2295eba6e6b2946a052e39118cbef5ae17', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 2243, hash: '3086760f2e740ec8e8bd27425d77f456224c615ca7a7b34c776b218f7188bb06', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'strategy/index.html': {size: 27499, hash: 'a9b849a670cdc5664835007166a6e9fdaf5f89896e570c2d95e0f50c00fb06ed', text: () => import('./assets-chunks/strategy_index_html.mjs').then(m => m.default)},
    'overview/index.html': {size: 27239, hash: 'db024851808c50eacd840d64fcb06f21964cdfc18cf1d45792c3c4e2fb7b4b1f', text: () => import('./assets-chunks/overview_index_html.mjs').then(m => m.default)},
    'revenue/index.html': {size: 27291, hash: 'da0a86bd2ec2205b170bcae0e03dd86bee9348ca133a80b2604fb7c7fa5ded46', text: () => import('./assets-chunks/revenue_index_html.mjs').then(m => m.default)},
    'index.html': {size: 27499, hash: 'a9b849a670cdc5664835007166a6e9fdaf5f89896e570c2d95e0f50c00fb06ed', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'trading-accounts/index.html': {size: 27343, hash: '62b32c8fa8b19395f8c8d580444ee790b9e014cbd08f9642b6a4fd0f800d212b', text: () => import('./assets-chunks/trading-accounts_index_html.mjs').then(m => m.default)},
    'edit-strategy/index.html': {size: 27343, hash: '161ee88f7b93a00f84f61197559637beec54c28dd0ba16f8461eb43604b70cac', text: () => import('./assets-chunks/edit-strategy_index_html.mjs').then(m => m.default)},
    'users/index.html': {size: 27135, hash: '2ae1bccdeb54c8e64c96d82c4b785e86ada1641ffc7972a09d77f37bfbd985de', text: () => import('./assets-chunks/users_index_html.mjs').then(m => m.default)},
    'add-account/index.html': {size: 27291, hash: '74637c3feed73d090fe1f7f1dff442b961deba8631896c1196542e4916220590', text: () => import('./assets-chunks/add-account_index_html.mjs').then(m => m.default)},
    'login/index.html': {size: 27291, hash: 'b59db7943d494402790a7043adc7302f7d4993abfbab60cfde71a2e1c3e36c9e', text: () => import('./assets-chunks/login_index_html.mjs').then(m => m.default)},
    'report/index.html': {size: 27499, hash: '41b0660a379bd04c3c1bb1982a7a1e766257097a4fe94bd4a6783822ad00602e', text: () => import('./assets-chunks/report_index_html.mjs').then(m => m.default)},
    'account/index.html': {size: 27343, hash: '55e974c841a85e6d7c8bdcf3d37d75ef03f472fcdb346888f02638db74fba3d8', text: () => import('./assets-chunks/account_index_html.mjs').then(m => m.default)},
    'admin-signup/index.html': {size: 165590, hash: '9e5aaab58fa7f71178ba7fea414bbe0ebe7f760d0c16ccab5eaa79291d4417d0', text: () => import('./assets-chunks/admin-signup_index_html.mjs').then(m => m.default)},
    'signup/index.html': {size: 165776, hash: '7d47c6530442e6e5165f5c7bbaf057d639710b7ba7a54a7f609ab52cd1fdda6f', text: () => import('./assets-chunks/signup_index_html.mjs').then(m => m.default)},
    'styles-DQD57UPU.css': {size: 28762, hash: '3gTCcubsNy0', text: () => import('./assets-chunks/styles-DQD57UPU_css.mjs').then(m => m.default)}
  },
};
