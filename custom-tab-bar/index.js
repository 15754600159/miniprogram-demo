/**
 * @desc: 自定义tabbar
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import { isLogin } from '../utils/util.js';

const app = getApp();

Component({
  /**
   * selected 当前选中的菜单项
   * list 菜单数据
   */
  data: {
    selected: 0,
    color: "#929292",
    selectedColor: "#0D83EE",
    list: [{
        "pagePath": "/pages/index/index",
        "code": "index",
        "permission": true,
        "text": "首页",
        "iconPath": "/images/tab-bar-icons/icon-index.png",
        "selectedIconPath": "/images/tab-bar-icons/icon-index-hover.png"
      },
      {
        "pagePath": "/pages/logs/logs",
        "code": "logs",
        "permission": false,
        "text": "日志",
        "iconPath": "/images/tab-bar-icons/icon-course-center.png",
        "selectedIconPath": "/images/tab-bar-icons/icon-course-center-hover.png"
      },
      {
        "pagePath": "/pages/todo/todo",
        "code": "todo",
        "permission": true,
        "text": "todo",
        "iconPath": "/images/tab-bar-icons/icon-visitor-notice.png",
        "selectedIconPath": "/images/tab-bar-icons/icon-visitor-notice-hover.png"
      },
      {
        "pagePath": "/pages/vant/vant",
        "code": "vant",
        "permission": true,
        "text": "组件",
        "iconPath": "/images/tab-bar-icons/icon-my-train.png",
        "selectedIconPath": "/images/tab-bar-icons/icon-my-train-hover.png"
      },
      {
        "pagePath": "/pages/user/user",
        "code": "user",
        "permission": true,
        "text": "用户",
        "iconPath": "/images/tab-bar-icons/icon-personal-center.png",
        "selectedIconPath": "/images/tab-bar-icons/icon-personal-center-hover.png"
      }
    ],
  },

  methods: {
    switchTab(e) {
      const { path } = e.currentTarget.dataset
      wx.reLaunch({ url: path })
    }
  }
})