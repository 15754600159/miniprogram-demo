## 小程序脚手架简介

### 库的来源
1. /utils/ajax: 基于promise实现的接口
2. /utils/create.js, /utils/obaa.js, /utils/path.js, /store: 腾讯omix状态管理库：https://github.com/Tencent/omi/tree/master/packages/omix
3. /util/vuefy.js 添加属性的computer和watch功能 https://github.com/donghaohao/vuefy
4. /miniprogram_npm/@vant: 有赞的微信小程序组件库，支持组件样式覆盖 https://youzan.github.io/vant-weapp/#/intro

### 目录介绍
1. /api: 各个页面的请求配置
2. /components: 公共组件
3. /constants: 常量
4. /custom-tab-bar: 根据权限控制的需求，增加的自定义底部菜单栏
5. /images: 公共的图片
6. /miniprogram_npm: 小程序构建的npm包
7. /pages: 小程序的页面
8. /server: 本地mock服务
    - 启动本地mock服务: cd server && npm run server 
    - 注意小程序默认只能请求https域名的接口，想要用本地模拟数据联调，则需要设置小程序idea不检查域名规范
9. /store: 全局状态
10. /utils: 存放一些库

### 注意点：
1. 微信小程序中的组件是shadow-dom的形式，样式覆盖等相关问题请参考 https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/wxml-wxss.html#%E7%BB%84%E4%BB%B6%E6%A0%B7%E5%BC%8F%E9%9A%94%E7%A6%BB
2. 模块权限：使用了自定义的底部tabbar，所以模块的显示隐藏相关的判断代码需要写在各个模块的生命周期函数onShow中（周末试了很久，不知是否还有更好的方法）