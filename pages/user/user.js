/**
 * @desc: personal center
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import loginAPI from '../../api/login-api.js';

const app = getApp()

Page({
  /**
   * isLogin 是否已登录
   * userName 用户名
   */
  data: {
    isLogin: false,
    userName: '',
  },

  onLoad: function () {
    
  },

  onShow() {
    // 自定义tabbar需页面手动设置选中的菜单项和模块权限
    const tabbarNavList = this.getTabBar().data.list
    const { userInfo, defaultPermission } = app.globalData
    const permission = userInfo.permission
      ? userInfo.permission
      : defaultPermission
    const list = tabbarNavList.map(item => {
      const newItem = { ...item }
      if (permission.includes(item.code)) {
        newItem.permission = true
      } else {
        newItem.permission = false
      }
      return newItem
    })
    this.getTabBar().setData({
      selected: 4,
      list
    })

    const { userName } = app.globalData.userInfo
    if (userName && userName.length > 0) {
      this.setData({ isLogin: true, userName })
    }
  },

  // 登录
  handleLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  // 登出
  async handleLogout() {
    try {
      const res = await loginAPI.logout()
      // 删除用户信息
      delete app.globalData.userInfo.userName
      delete app.globalData.userInfo.permission
      this.setData({ isLogin: false, userName: '' })
      // 刷新一下
      wx.reLaunch({
        url: '/pages/user/user'
      })
    } catch (e) {
      wx.showToast({
        title: '登出出错',
        icon: 'none',
      })
    }
  }
})
