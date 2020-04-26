/**
 * @desc: index
 * @author: shengshunyan
 * @date: 2020-4-18
 */

const app = getApp()

Page({
  /**
   * motto 显示文本
   * userInfo 用户信息
   * hasUserInfo 是否有用户信息
   */
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },

  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
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
      selected: 0,
      list
    })
  },

  // 获取用户信息
  getUserInfo: function (e) {
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
})
