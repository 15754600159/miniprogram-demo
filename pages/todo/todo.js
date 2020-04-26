/**
 * @desc: todo
 * @author: shengshunyan
 * @date: 2020-4-18
 */

import create from '../../utils/create.js'
import store from '../../store/index.js'

const app = getApp()

create.Page(store, {
  /**
   * @desc 状态
   */
  data: {

  },

  onLoad: function (options) {

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
      selected: 2,
      list
    })
  },
})